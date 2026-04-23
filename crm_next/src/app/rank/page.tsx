import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { query, queryOne } from "@/lib/db";
import { CHANNEL_MAP, channelValid, type ChannelKey } from "@/lib/channels";
import { todayYmd } from "@/lib/format";
import { addRank } from "@/lib/actions/rank";
import RankTrendChart from "./RankTrendChart";
import NaverAutoFetchButton from "./NaverAutoFetchButton";
import type { RowDataPacket } from "mysql2";

type SP = {
  channel?: string;
  work_idx?: string;
  cr_idx?: string;   // 레거시 호환
  keyword?: string;
  saved?: string;
  warn?: string;
  error?: string;
};

type WorkRow = RowDataPacket & {
  idx: number;
  keyword: string;
  product_mid: string;
  rank_first: number | null;
  rank_yesterday: number | null;
  rank_current: number | null;
  seller_idx: number;
  seller_name: string | null;
};

type HistRow = RowDataPacket & {
  idx: number;
  channel: string;
  work_idx: number;
  keyword: string;
  rank: number | null;
  memo: string | null;
  admin_idx: number | null;
  check_date: string;
};

type AdminRow = RowDataPacket & { idx: number; name: string };

export default async function RankPopupPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session.adminIdx) {
    return (
      <div className="rank-box">
        <h5>로그인 필요</h5>
        <p>이 창을 닫고 다시 로그인한 후 시도해주세요.</p>
      </div>
    );
  }

  const channel = sp.channel ?? "";
  const workIdx = Number(sp.work_idx ?? sp.cr_idx ?? 0);
  const keywordLabel = sp.keyword ?? "";

  if (!channelValid(channel) || workIdx <= 0) {
    notFound();
  }
  const ch = channel as ChannelKey;
  const table = CHANNEL_MAP[ch].table;
  const label = CHANNEL_MAP[ch].label;

  const scopeSql = session.adminLevel === 3 ? " AND w.seller_idx = ?" : "";
  const scopeParams = session.adminLevel === 3 ? [session.adminIdx] : [];
  const work = await queryOne<WorkRow>(
    `SELECT w.idx, w.keyword, w.product_mid, w.rank_first, w.rank_yesterday, w.rank_current, w.seller_idx, s.name AS seller_name
       FROM ${table} w
       LEFT JOIN admin s ON s.idx = w.seller_idx
      WHERE w.idx = ?${scopeSql} LIMIT 1`,
    [workIdx, ...scopeParams]
  );

  if (!work) {
    return (
      <div className="rank-box">
        <h5>접근 거부</h5>
        <p>권한이 없거나 존재하지 않는 작업입니다.</p>
      </div>
    );
  }

  // 이력 조회 (naver 는 legacy 테이블 UNION)
  const legacyUnion =
    ch === "naver"
      ? `UNION ALL
         SELECT idx, 'naver' AS channel, work_idx, keyword, \`rank\`, NULL AS memo, NULL AS admin_idx, check_date
         FROM naver_rank_history WHERE work_idx = ?`
      : "";
  const histParams: (number | string)[] = [ch, workIdx];
  if (ch === "naver") histParams.push(workIdx);

  const rows = await query<HistRow[]>(
    `SELECT * FROM (
       SELECT idx, channel, work_idx, keyword, \`rank\`, memo, admin_idx, check_date
         FROM rank_history WHERE channel = ? AND work_idx = ?
       ${legacyUnion}
     ) x ORDER BY check_date DESC LIMIT 300`,
    histParams
  );

  // 관리자 이름 맵
  const adminIds = Array.from(new Set(rows.map((r) => r.admin_idx).filter((v): v is number => v !== null && v !== undefined)));
  const adminMap = new Map<number, string>();
  if (adminIds.length > 0) {
    const placeholders = adminIds.map(() => "?").join(",");
    const adminRows = await query<AdminRow[]>(
      `SELECT idx, name FROM admin WHERE idx IN (${placeholders})`,
      adminIds
    );
    for (const a of adminRows) adminMap.set(a.idx, a.name);
  }

  // 차트 데이터 (rank != null만, 오래된 순)
  const chartRows = rows.filter((r) => r.rank !== null && r.rank !== undefined).reverse();
  const chartLabels = chartRows.map((r) => {
    const d = new Date(r.check_date.replace(" ", "T"));
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const chartData = chartRows.map((r) => Number(r.rank));

  const flash = sp.saved ? { type: "success", msg: "순위 기록이 추가되었습니다." }
              : sp.warn  ? { type: "warning", msg: decodeURIComponent(sp.warn) }
              : sp.error ? { type: "danger",  msg: decodeURIComponent(sp.error) }
              : null;

  const displayKeyword = keywordLabel || work.keyword;

  return (
    <>
      <div className="rank-box">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h5 className="mb-1">
              <span className="badge bg-secondary">{label}</span>
              {" "}순위 이력 <small className="text-muted">{displayKeyword}</small>
            </h5>
            <div className="small text-muted">
              셀러: <strong>{work.seller_name}</strong>
              {" · "}MID: {work.product_mid}
              {" · "}최초: {work.rank_first ?? "-"}
              {" · "}어제: {work.rank_yesterday ?? "-"}
              {" · "}<strong>현재: {work.rank_current ?? "-"}</strong>
            </div>
          </div>
          <form action="javascript:window.close()">
            <button type="submit" className="btn btn-sm btn-outline-secondary">닫기</button>
          </form>
        </div>
        {flash && (
          <div className={`alert alert-${flash.type} py-2 px-3 small mb-0`}>{flash.msg}</div>
        )}
      </div>

      {ch === "naver" && (
        <div className="rank-box">
          <NaverAutoFetchButton workIdx={workIdx} />
        </div>
      )}

      <div className="rank-box">
        <div className="small fw-bold mb-2">새 순위 기록 (수동)</div>
        <form action={addRank}>
          <input type="hidden" name="channel" value={ch} />
          <input type="hidden" name="work_idx" value={workIdx} />
          <input type="hidden" name="keyword" value={displayKeyword} />
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small">조회 일자</label>
              <input type="date" name="check_date" defaultValue={todayYmd()} className="form-control form-control-sm" />
            </div>
            <div className="col-md-3">
              <label className="form-label small">순위 (숫자)</label>
              <input type="number" name="rank" min={1} placeholder="예: 3" className="form-control form-control-sm" />
            </div>
            <div className="col-md-4">
              <label className="form-label small">메모</label>
              <input type="text" name="memo" maxLength={200} className="form-control form-control-sm" placeholder="선택" />
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-sm btn-dark w-100">기록 추가</button>
            </div>
          </div>
          <div className="small text-muted mt-1">순위가 비어있어도 메모만 남길 수 있습니다. (예: &quot;진입 실패&quot;)</div>
        </form>
      </div>

      {chartData.length >= 2 && (
        <div className="rank-box">
          <div className="small fw-bold mb-2">
            순위 추이 <span className="text-muted">({chartData.length}개 데이터 포인트, Y축 반전: 위쪽이 상위 순위)</span>
          </div>
          <RankTrendChart labels={chartLabels} data={chartData} />
        </div>
      )}
      {chartData.length === 1 && (
        <div className="rank-box small text-muted">단일 기록이라 추이 차트를 그리지 않습니다. 2건 이상 쌓이면 그래프로 표시됩니다.</div>
      )}

      <div className="rank-box">
        <div className="small fw-bold mb-2">기록 이력 <span className="text-muted">({rows.length}건, 최대 300건)</span></div>
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th style={{ width: 150 }}>조회일시</th>
                <th>키워드</th>
                <th style={{ width: 80 }}>순위</th>
                <th>메모</th>
                <th style={{ width: 90 }}>기록자</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-3">조회된 이력이 없습니다.</td></tr>
              ) : rows.map((h, i) => {
                const recBy = h.admin_idx ? (adminMap.get(Number(h.admin_idx)) ?? "-") : null;
                return (
                  <tr key={`${h.channel}-${h.idx}`}>
                    <td className="text-center">{rows.length - i}</td>
                    <td>{h.check_date}</td>
                    <td>{h.keyword}</td>
                    <td className="text-end">{h.rank !== null ? h.rank : <span className="text-muted">-</span>}</td>
                    <td className="small">{h.memo}</td>
                    <td className="small text-muted">{recBy ?? <span className="text-muted">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
