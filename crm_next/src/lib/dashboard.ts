import { query } from "@/lib/db";
import { CHANNEL_MAP, CHANNEL_KEYS, type ChannelKey } from "@/lib/channels";
import type { RowDataPacket } from "mysql2";
import type { SessionData } from "@/types/session";

export type Kpi = {
  total: number;
  active: number;
  refund_req: number;
  today_new: number;
};

export type ByChannel = Record<ChannelKey, Kpi>;

export type RankRow = {
  ch: ChannelKey;
  work_idx: number;
  keyword: string;
  seller_name: string | null;
  rank_yesterday: number;
  rank_current: number;
  delta: number;
};

export type TopRow = { name: string; agency_name?: string | null; cnt: number };

export type DashboardData = {
  byChannel: ByChannel;
  kpi: Kpi;
  byStatus: Record<string, number>;
  trendLabels: string[];
  trendData: number[];
  topAgency: TopRow[];
  topSeller: TopRow[];
  rankUp: RankRow[];
  rankDown: RankRow[];
};

type SumRow = RowDataPacket & { ch: string; total: number; active: number; refund_req: number; today_new: number };
type StatusRow = RowDataPacket & { status: string; cnt: number };
type TrendRow = RowDataPacket & { d: string; cnt: number };
type TopRowDb = RowDataPacket & { name: string | null; agency_name?: string | null; cnt: number };
type RankRowDb = RowDataPacket & RankRow;

// 대행사(level=3)는 본인 작업만 조회 (seller_idx = admin.idx)
function scopeWhere(session: SessionData): string {
  if (session.adminLevel === 3) {
    return `seller_idx = ${Number(session.adminIdx)}`;
  }
  return "1=1";
}

export async function loadDashboard(
  session: SessionData,
  passDate: string,
  passDate2: string
): Promise<DashboardData> {
  const scope = scopeWhere(session);

  // 1) 채널별 집계 (UNION ALL)
  const sumSql = CHANNEL_KEYS.map((key) => {
    const t = CHANNEL_MAP[key].table;
    return `SELECT '${key}' AS ch,
      (SELECT COUNT(*) FROM ${t} WHERE ${scope})                                                  AS total,
      (SELECT COUNT(*) FROM ${t} WHERE ${scope} AND status = '작업중')                              AS active,
      (SELECT COUNT(*) FROM ${t} WHERE ${scope} AND status = '환불요청')                            AS refund_req,
      (SELECT COUNT(*) FROM ${t} WHERE ${scope} AND DATE(reg_date) = CURDATE())                     AS today_new`;
  }).join(" UNION ALL ");

  const sumRows = await query<SumRow[]>(sumSql);

  const byChannel = {} as ByChannel;
  const kpi: Kpi = { total: 0, active: 0, refund_req: 0, today_new: 0 };
  for (const k of CHANNEL_KEYS) {
    byChannel[k] = { total: 0, active: 0, refund_req: 0, today_new: 0 };
  }
  for (const r of sumRows) {
    const ch = r.ch as ChannelKey;
    byChannel[ch] = {
      total: Number(r.total),
      active: Number(r.active),
      refund_req: Number(r.refund_req),
      today_new: Number(r.today_new),
    };
    kpi.total      += Number(r.total);
    kpi.active     += Number(r.active);
    kpi.refund_req += Number(r.refund_req);
    kpi.today_new  += Number(r.today_new);
  }

  // 2) 상태 분포 (기간 내)
  const statusParts = CHANNEL_KEYS.map((key) => {
    const t = CHANNEL_MAP[key].table;
    return `SELECT status, COUNT(*) AS cnt FROM ${t}
            WHERE ${scope} AND reg_date >= ? AND reg_date <= ?
            GROUP BY status`;
  }).join(" UNION ALL ");
  const statusSql = `SELECT status, SUM(cnt) AS cnt FROM (${statusParts}) x GROUP BY status ORDER BY cnt DESC`;
  const statusParams = CHANNEL_KEYS.flatMap(() => [`${passDate} 00:00:00`, `${passDate2} 23:59:59`]);
  const statusRows = await query<StatusRow[]>(statusSql, statusParams);
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    if (r.status) byStatus[r.status] = Number(r.cnt);
  }

  // 3) 일별 추이
  const trendParts = CHANNEL_KEYS.map((key) => {
    const t = CHANNEL_MAP[key].table;
    return `SELECT DATE(reg_date) AS d, COUNT(*) AS cnt FROM ${t}
            WHERE ${scope} AND reg_date >= ? AND reg_date <= ?
            GROUP BY DATE(reg_date)`;
  }).join(" UNION ALL ");
  const trendSql = `SELECT d, SUM(cnt) AS cnt FROM (${trendParts}) x GROUP BY d ORDER BY d`;
  const trendRows = await query<TrendRow[]>(trendSql, statusParams);
  const trendMap: Record<string, number> = {};
  for (const r of trendRows) trendMap[String(r.d).slice(0, 10)] = Number(r.cnt);

  const trendLabels: string[] = [];
  const trendData: number[] = [];
  const start = new Date(passDate + "T00:00:00");
  const end   = new Date(passDate2 + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ymd = d.toISOString().slice(0, 10);
    trendLabels.push(`${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    trendData.push(trendMap[ymd] ?? 0);
  }

  // 4) Top 10 대행사/셀러 (level ≤ 2만)
  let topAgency: TopRow[] = [];
  let topSeller: TopRow[] = [];
  if (session.adminLevel <= 2) {
    const agencyParts = CHANNEL_KEYS.map((k) =>
      `SELECT agency_idx, COUNT(*) AS cnt FROM ${CHANNEL_MAP[k].table} WHERE ${scope} GROUP BY agency_idx`
    ).join(" UNION ALL ");
    const sellerParts = CHANNEL_KEYS.map((k) =>
      `SELECT seller_idx, COUNT(*) AS cnt FROM ${CHANNEL_MAP[k].table} WHERE ${scope} GROUP BY seller_idx`
    ).join(" UNION ALL ");

    const agencyRows = await query<TopRowDb[]>(
      `SELECT a.name, SUM(x.cnt) AS cnt
         FROM (${agencyParts}) x
         LEFT JOIN agency a ON a.idx = x.agency_idx
        GROUP BY a.name
        ORDER BY cnt DESC
        LIMIT 10`
    );
    topAgency = agencyRows
      .filter((r) => r.name)
      .map((r) => ({ name: r.name!, cnt: Number(r.cnt) }));

    const sellerRows = await query<TopRowDb[]>(
      `SELECT s.name, a.name AS agency_name, SUM(x.cnt) AS cnt
         FROM (${sellerParts}) x
         LEFT JOIN seller s ON s.idx = x.seller_idx
         LEFT JOIN agency a ON a.idx = s.agency_idx
        GROUP BY s.name, a.name
        ORDER BY cnt DESC
        LIMIT 10`
    );
    topSeller = sellerRows
      .filter((r) => r.name)
      .map((r) => ({ name: r.name!, agency_name: r.agency_name ?? null, cnt: Number(r.cnt) }));
  }

  // 5) 순위 변동 TOP 10
  const rankParts = CHANNEL_KEYS.map((k) => {
    const t = CHANNEL_MAP[k].table;
    return `SELECT '${k}' AS ch, w.idx AS work_idx, w.keyword, s.name AS seller_name,
              w.rank_yesterday, w.rank_current,
              (w.rank_yesterday - w.rank_current) AS delta
         FROM ${t} w
         LEFT JOIN seller s ON s.idx = w.seller_idx
        WHERE ${scope}
          AND w.rank_yesterday IS NOT NULL
          AND w.rank_current   IS NOT NULL
          AND w.rank_yesterday != w.rank_current`;
  }).join(" UNION ALL ");

  const rankUp   = await query<RankRowDb[]>(`SELECT * FROM (${rankParts}) x WHERE delta > 0 ORDER BY delta DESC LIMIT 10`);
  const rankDown = await query<RankRowDb[]>(`SELECT * FROM (${rankParts}) x WHERE delta < 0 ORDER BY delta ASC  LIMIT 10`);

  return {
    byChannel,
    kpi,
    byStatus,
    trendLabels,
    trendData,
    topAgency,
    topSeller,
    rankUp: rankUp.map((r) => ({ ...r, delta: Number(r.delta), rank_yesterday: Number(r.rank_yesterday), rank_current: Number(r.rank_current), work_idx: Number(r.work_idx) })),
    rankDown: rankDown.map((r) => ({ ...r, delta: Number(r.delta), rank_yesterday: Number(r.rank_yesterday), rank_current: Number(r.rank_current), work_idx: Number(r.work_idx) })),
  };
}
