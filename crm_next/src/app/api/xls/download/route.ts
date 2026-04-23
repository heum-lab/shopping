import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { CHANNEL_MAP, channelValid, type ChannelKey } from "@/lib/channels";
import { toCsvWithBom } from "@/lib/csv";
import type { RowDataPacket } from "mysql2";

const COLUMNS: Array<[string, string]> = [
  ["agency_name",  "대행사"],
  ["seller_name",  "셀러"],
  ["keyword",      "키워드"],
  ["keyword_sub1", "서브키워드1"],
  ["keyword_sub2", "서브키워드2"],
  ["keyword_type", "광고타입"],
  ["product_mid",  "상품MID"],
  ["product_url",  "상품URL"],
  ["compare_mid",  "가격비교MID"],
  ["compare_url",  "가격비교URL"],
  ["inflow_count", "유입수"],
  ["start_date",   "시작일"],
  ["end_date",     "종료일"],
  ["order_date",   "주문일"],
  ["payment_date", "입금일"],
  ["status",       "상태"],
  ["memo",         "비고"],
];

const DATE_COL_MAP: Record<string, string> = {
  start_date:  "w.start_date",
  end_date:    "w.end_date",
  order_date:  "w.order_date",
  refund_date: "w.refund_date",
};

function ymd(d: Date): string {
  const p = (n: number) => n < 10 ? `0${n}` : `${n}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function stamp(): string {
  const d = new Date();
  const p = (n: number) => n < 10 ? `0${n}` : `${n}`;
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s.adminIdx) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const channel = sp.get("channel") ?? "naver";
  const xlsMode = sp.get("xls_mode") ?? "template";

  if (!channelValid(channel)) return new Response("Invalid channel.", { status: 400 });
  const ch = channel as ChannelKey;
  const table = CHANNEL_MAP[ch].table;
  const label = CHANNEL_MAP[ch].label;

  const headerRow = COLUMNS.map(([, ko]) => ko);
  const rowsToWrite: unknown[][] = [headerRow];

  const filenamePrefix = xlsMode === "template" ? `${ch}_template` : `${ch}_list`;
  const filename = `${filenamePrefix}_${stamp()}.csv`;

  if (xlsMode === "template") {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    rowsToWrite.push([
      "샘플대행사", "샘플셀러", "여름 원피스", "쉬폰원피스", "",
      ch === "naver" ? "쇼검" : `${label}타입`,
      "12345678",
      ch === "naver" ? "https://smartstore.naver.com/sample/products/12345678" : "https://example.com/target-url",
      "", "", "500",
      ymd(now), ymd(end),
      "", "", "대기", "엑셀 대량 등록 샘플",
    ]);
  } else {
    // search mode — 채널 페이지의 필터와 동일
    const where: string[] = ["1=1"];
    const params: (string | number)[] = [];
    if (s.adminLevel === 3) {
      where.push("w.seller_idx = ?");
      params.push(s.adminIdx);
    }
    if (s.adminLevel === 1 && sp.get("pass_assign3")) {
      where.push("w.agency_idx = ?"); params.push(Number(sp.get("pass_assign3")));
    }
    if (sp.get("pass_assign")) {
      where.push("w.seller_idx = ?"); params.push(Number(sp.get("pass_assign")));
    }
    if (sp.get("pass_status")) {
      where.push("w.status = ?"); params.push(String(sp.get("pass_status")));
    }
    const dateCol = DATE_COL_MAP[sp.get("pass_date_type") ?? ""] ?? "w.start_date";
    if (sp.get("pass_date"))  { where.push(`${dateCol} >= ?`); params.push(String(sp.get("pass_date"))); }
    if (sp.get("pass_date2")) { where.push(`${dateCol} <= ?`); params.push(String(sp.get("pass_date2"))); }
    const input = sp.get("pass_input");
    if (input) {
      const inputType = sp.get("pass_input_type") ?? "seller_name";
      if (inputType === "seller_name") { where.push("s.name LIKE ?"); params.push(`%${input}%`); }
      else if (inputType === "keyword") { where.push("w.keyword LIKE ?"); params.push(`%${input}%`); }
      else if (inputType === "product_mid") { where.push("w.product_mid = ?"); params.push(input); }
    }

    type WorkRow = RowDataPacket & {
      keyword: string; keyword_sub1: string | null; keyword_sub2: string | null;
      keyword_type: string; product_mid: string; product_url: string;
      compare_mid: string | null; compare_url: string | null;
      inflow_count: number;
      start_date: string | null; end_date: string | null; order_date: string | null; payment_date: string | null;
      status: string; memo: string | null;
      seller_name: string | null; agency_name: string | null;
    };

    const rows = await query<WorkRow[]>(
      `SELECT w.*, s.name AS seller_name, a.name AS agency_name
         FROM ${table} w
         LEFT JOIN seller s ON s.idx = w.seller_idx
         LEFT JOIN agency a ON a.idx = w.agency_idx
        WHERE ${where.join(" AND ")}
        ORDER BY w.reg_date DESC`,
      params
    );

    for (const r of rows) {
      rowsToWrite.push([
        r.agency_name ?? "", r.seller_name ?? "",
        r.keyword, r.keyword_sub1 ?? "", r.keyword_sub2 ?? "",
        r.keyword_type, r.product_mid, r.product_url,
        r.compare_mid ?? "", r.compare_url ?? "",
        r.inflow_count,
        r.start_date ?? "", r.end_date ?? "", r.order_date ?? "", r.payment_date ?? "",
        r.status, r.memo ?? "",
      ]);
    }
  }

  const csv = toCsvWithBom(rowsToWrite);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache",
    },
  });
}
