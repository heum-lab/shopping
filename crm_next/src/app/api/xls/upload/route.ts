import { NextResponse, type NextRequest } from "next/server";
import { query, execute } from "@/lib/db";
import { getSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import { CHANNEL_MAP, channelValid, type ChannelKey } from "@/lib/channels";
import { parseCsv } from "@/lib/csv";
import type { RowDataPacket } from "mysql2";

const VALID_STATUS = new Set([
  "대기","작업중","중지","환불요청","환불완료","연장처리","작업완료","삭제요청",
]);
const VALID_TYPE = new Set([
  "통검","쇼검","통+쇼검","랜딩페이지","플러스스토어","기타유입","기타유입L","원픽플러스","팝콘","팝핀",
]);

function fail(msg: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ result: "fail", msg, ...extra });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s.adminIdx) return NextResponse.json({ result: "fail", msg: "UNAUTHORIZED" }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("폼 데이터 파싱 실패"); }

  const channel = String(form.get("channel") ?? "naver");
  if (!channelValid(channel)) return fail("알 수 없는 채널입니다.");
  const ch = channel as ChannelKey;
  const table = CHANNEL_MAP[ch].table;

  const file = form.get("excel_file");
  if (!(file instanceof File)) return fail("파일 업로드에 실패했습니다.");

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!["csv", "txt"].includes(ext)) {
    return fail("CSV 파일만 업로드 가능합니다. (Excel에서 \"CSV UTF-8\"으로 내보내기 하세요)");
  }
  if (file.size > 10 * 1024 * 1024) {
    return fail("파일 크기는 10MB를 초과할 수 없습니다.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const text = buf.toString("utf8");
  const rows = parseCsv(text);
  if (rows.length < 1) return fail("파일이 비어있습니다.");

  // 1행 헤더 스킵
  const bodyRows = rows.slice(1);

  // 대행사/셀러 맵
  const agencyMap = new Map<string, number>();
  const agencyRows = await query<(RowDataPacket & { idx: number; name: string })[]>(
    "SELECT idx, name FROM agency"
  );
  for (const a of agencyRows) agencyMap.set(String(a.name).trim(), Number(a.idx));

  const sellerMap = new Map<string, number>();
  const sellerRows = await query<(RowDataPacket & { idx: number; name: string; agency_idx: number })[]>(
    "SELECT idx, name, agency_idx FROM seller"
  );
  for (const sl of sellerRows) {
    sellerMap.set(`${String(sl.name).trim()}::${Number(sl.agency_idx)}`, Number(sl.idx));
  }

  const strictTypeCheck = ch === "naver";
  const errors: string[] = [];
  type Rec = {
    agency_idx: number; seller_idx: number;
    keyword: string; keyword_sub1: string; keyword_sub2: string;
    keyword_type: string; product_mid: string; product_url: string;
    compare_mid: string; compare_url: string; inflow_count: number;
    start_date: string; end_date: string; order_date: string; payment_date: string;
    status: string; memo: string;
  };
  const validRecs: Rec[] = [];

  let lineNo = 1; // 헤더가 1행
  for (const row of bodyRows) {
    lineNo++;
    if (row.every((v) => String(v).trim() === "")) continue;

    const [
      agencyName = "", sellerName = "", keyword = "",
      keywordSub1 = "", keywordSub2 = "",
      keywordType = "", productMid = "", productUrl = "",
      compareMid = "", compareUrl = "",
      inflowCount = "",
      startDate = "", endDate = "", orderDate = "", paymentDate = "",
      status = "", memo = "",
    ] = row;

    const an = agencyName.trim();
    const sn = sellerName.trim();
    const kw = keyword.trim();
    const kt = keywordType.trim();
    const pm = productMid.trim();
    const pu = productUrl.trim();
    const st = (status.trim() || "대기");

    const missing: string[] = [];
    if (!an) missing.push("대행사");
    if (!sn) missing.push("셀러");
    if (!kw) missing.push("키워드");
    if (!pm) missing.push("상품MID");
    if (!pu) missing.push("상품URL");
    if (!kt) missing.push("광고타입");
    if (missing.length > 0) {
      errors.push(`${lineNo}행: 필수값 누락 (${missing.join(", ")})`);
      continue;
    }

    const agencyIdx = agencyMap.get(an);
    if (agencyIdx === undefined) {
      errors.push(`${lineNo}행: 존재하지 않는 대행사 '${an}'`);
      continue;
    }
    const sellerIdx = sellerMap.get(`${sn}::${agencyIdx}`);
    if (sellerIdx === undefined) {
      errors.push(`${lineNo}행: 대행사 '${an}' 소속이 아닌 셀러 '${sn}'`);
      continue;
    }

    if (strictTypeCheck && !VALID_TYPE.has(kt)) {
      errors.push(`${lineNo}행: 지원하지 않는 광고타입 '${kt}'`);
      continue;
    }
    if (!VALID_STATUS.has(st)) {
      errors.push(`${lineNo}행: 지원하지 않는 상태 '${st}'`);
      continue;
    }

    validRecs.push({
      agency_idx: agencyIdx,
      seller_idx: sellerIdx,
      keyword: kw,
      keyword_sub1: keywordSub1.trim(),
      keyword_sub2: keywordSub2.trim(),
      keyword_type: kt,
      product_mid: pm,
      product_url: pu,
      compare_mid: compareMid.trim(),
      compare_url: compareUrl.trim(),
      inflow_count: Number(inflowCount) || 0,
      start_date: startDate.trim(),
      end_date: endDate.trim(),
      order_date: orderDate.trim(),
      payment_date: paymentDate.trim(),
      status: st,
      memo: memo.trim(),
    });
  }

  // 배치 INSERT (100건)
  let inserted = 0;
  const batch = 100;
  for (let i = 0; i < validRecs.length; i += batch) {
    const chunk = validRecs.slice(i, i + batch);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
    const params: (string | number | null)[] = [];
    for (const r of chunk) {
      params.push(
        r.agency_idx, r.seller_idx,
        r.keyword, r.keyword_sub1, r.keyword_sub2,
        r.keyword_type, r.product_mid, r.product_url,
        r.compare_mid, r.compare_url,
        r.inflow_count,
        r.start_date || null,
        r.end_date   || null,
        r.order_date || null,
        r.payment_date || null,
        r.status, r.memo
      );
    }
    try {
      await execute(
        `INSERT INTO ${table}
           (agency_idx, seller_idx, keyword, keyword_sub1, keyword_sub2,
            keyword_type, product_mid, product_url, compare_mid, compare_url,
            inflow_count, start_date, end_date, order_date, payment_date,
            status, memo)
         VALUES ${placeholders}`,
        params
      );
      inserted += chunk.length;
    } catch (e) {
      errors.push(`DB 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await auditLog({
    action: "upload_bulk",
    entityType: table,
    detail: { channel: ch, inserted, skipped: errors.length, filename: file.name },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId ?? null },
  });

  return NextResponse.json({ result: "ok", inserted, skipped: errors.length, errors });
}
