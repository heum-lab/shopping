import { query, queryOne } from "@/lib/db";
import { CHANNEL_MAP, type ChannelKey } from "@/lib/channels";
import type { SessionData } from "@/types/session";
import type { RowDataPacket } from "mysql2";

export type WorkRow = RowDataPacket & {
  idx: number;
  agency_idx: number;
  seller_idx: number;
  ad_product: string | null;
  keyword: string;
  keyword_sub1: string | null;
  keyword_sub2: string | null;
  product_mid: string;
  product_url: string;
  compare_mid: string | null;
  compare_url: string | null;
  inflow_count: number;
  keyword_type: string;
  start_date: string | null;
  end_date: string | null;
  order_date: string | null;
  drive_days: string | null;
  status: string;
  refund_date: string | null;
  memo: string | null;
  reg_date: string;
  mod_date: string;
  seller_name: string | null;
  agency_name: string | null;
};

export type WorkFilters = {
  pass_assign?: string;   // 셀러 idx
  pass_assign3?: string;  // 대행사 idx (슈퍼만)
  pass_status?: string;
  pass_date_type?: string;
  pass_date?: string;
  pass_date2?: string;
  pass_input_type?: string;
  pass_input?: string;
  sort?: string;
  sort_dir?: string;
  page?: number;
  per_page?: number;
};

const DATE_COL_MAP: Record<string, string> = {
  start_date:  "w.start_date",
  end_date:    "w.end_date",
  order_date:  "w.order_date",
  refund_date: "w.refund_date",
};
const SORT_WHITE = ["reg_date", "start_date", "end_date", "refund_date"];

export async function loadWorks(
  channel: ChannelKey,
  session: SessionData,
  f: WorkFilters
): Promise<{ total: number; rows: WorkRow[]; page: number; perPage: number; totalPages: number; offset: number; sort: string; sortDir: "ASC" | "DESC" }> {
  const table = CHANNEL_MAP[channel].table;

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (session.adminLevel === 3) {
    where.push("w.seller_idx = ?");
    params.push(session.adminIdx);
  }
  if (session.adminLevel === 1 && f.pass_assign3) {
    where.push("w.agency_idx = ?");
    params.push(Number(f.pass_assign3));
  }
  if (f.pass_assign) {
    where.push("w.seller_idx = ?");
    params.push(Number(f.pass_assign));
  }
  if (f.pass_status) {
    where.push("w.status = ?");
    params.push(f.pass_status);
  }

  const dateCol = DATE_COL_MAP[f.pass_date_type ?? ""] ?? "w.start_date";
  if (f.pass_date)  { where.push(`${dateCol} >= ?`); params.push(f.pass_date); }
  if (f.pass_date2) { where.push(`${dateCol} <= ?`); params.push(f.pass_date2); }

  if (f.pass_input) {
    const kw = `%${f.pass_input}%`;
    switch (f.pass_input_type) {
      case "seller_name": where.push("s.name LIKE ?"); params.push(kw); break;
      case "product_mid": where.push("w.product_mid = ?"); params.push(f.pass_input); break;
      case "keyword":
      default:            where.push("w.keyword LIKE ?"); params.push(kw); break;
    }
  }
  const whereSql = where.join(" AND ");

  const sort = SORT_WHITE.includes(f.sort ?? "") ? f.sort! : "reg_date";
  const sortDir: "ASC" | "DESC" = (f.sort_dir ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const perPage = [50, 70, 100, 130, 150].includes(Number(f.per_page)) ? Number(f.per_page) : 50;
  let page = Math.max(1, Number(f.page ?? 1));

  const cntRow = await queryOne<RowDataPacket & { cnt: number }>(
    `SELECT COUNT(*) AS cnt
       FROM ${table} w
       LEFT JOIN admin  s ON s.idx = w.seller_idx
       LEFT JOIN agency a ON a.idx = w.agency_idx
      WHERE ${whereSql}`,
    params
  );
  const total = Number(cntRow?.cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * perPage;

  const rows = await query<WorkRow[]>(
    `SELECT w.*, s.name AS seller_name, a.name AS agency_name
       FROM ${table} w
       LEFT JOIN admin  s ON s.idx = w.seller_idx
       LEFT JOIN agency a ON a.idx = w.agency_idx
      WHERE ${whereSql}
      ORDER BY w.${sort} ${sortDir}, w.idx DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    params
  );

  return { total, rows, page, perPage, totalPages, offset, sort, sortDir };
}

export type AgencyOpt = { idx: number; name: string };
export type SellerOpt = { idx: number; name: string };

export async function loadAgencyOptions(): Promise<AgencyOpt[]> {
  const rows = await query<(RowDataPacket & AgencyOpt)[]>(
    "SELECT idx, name FROM agency ORDER BY name"
  );
  return rows.map((r) => ({ idx: r.idx, name: r.name }));
}

export async function loadSellerOptions(session: SessionData): Promise<SellerOpt[]> {
  const where = session.adminLevel === 3 ? "WHERE level = 3 AND idx = ?" : "WHERE level = 3";
  const params = session.adminLevel === 3 ? [session.adminIdx] : [];
  const rows = await query<(RowDataPacket & SellerOpt)[]>(
    `SELECT idx, name FROM admin ${where} ORDER BY name`,
    params
  );
  return rows.map((r) => ({ idx: r.idx, name: r.name }));
}
