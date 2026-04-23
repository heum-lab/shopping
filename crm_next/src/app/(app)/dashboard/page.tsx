import Link from "next/link";
import { getAuthSession } from "@/lib/auth-guard";
import { loadDashboard } from "@/lib/dashboard";
import { CHANNEL_MAP, CHANNEL_KEYS } from "@/lib/channels";
import { daysAgoYmd, numberFormat, todayYmd } from "@/lib/format";
import DashboardCharts from "./DashboardCharts";

type Search = { pass_date?: string; pass_date2?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getAuthSession();
  const sp = await searchParams;
  const passDate  = sp.pass_date  || daysAgoYmd(29);
  const passDate2 = sp.pass_date2 || todayYmd();

  const data = await loadDashboard(session, passDate, passDate2);

  const kpiCards = [
    { label: "총 작업",   value: data.kpi.total,      color: "#00E5FF" },
    { label: "작업중",    value: data.kpi.active,     color: "#5dd6a0" },
    { label: "오늘 신규", value: data.kpi.today_new,  color: "#ffc66e" },
    { label: "환불요청",  value: data.kpi.refund_req, color: "#ff6b76" },
  ];

  const channelLabels = CHANNEL_KEYS.map((k) => CHANNEL_MAP[k].label);
  const channelTotals = CHANNEL_KEYS.map((k) => data.byChannel[k].total);
  const statusLabels  = Object.keys(data.byStatus);
  const statusValues  = Object.values(data.byStatus);

  const linkFor = (ch: string) => (ch === "naver" ? "/sub/info_acc_naver" : `/sub/info_acc_${ch}`);

  return (
    <>
      <h2 className="page-title">대시보드</h2>

      <form method="get" className="search-box">
        <div className="row g-2 align-items-end">
          <div className="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" defaultValue={passDate} className="form-control form-control-sm datepicker" />
          </div>
          <div className="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" defaultValue={passDate2} className="form-control form-control-sm datepicker" />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm btn-dark w-100">조회</button>
          </div>
          <div className="col-md-6 text-end small text-muted">
            KPI는 전체 데이터 기준 · 상태/추이 차트는 선택 기간 내 등록 기준
          </div>
        </div>
      </form>

      <div className="row g-2 mb-3">
        {kpiCards.map((c) => (
          <div key={c.label} className="col-md-3 col-6">
            <div className="search-box" style={{ borderLeft: `4px solid ${c.color}` }}>
              <div className="small text-muted mb-1">{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{numberFormat(c.value)}</div>
            </div>
          </div>
        ))}
      </div>

      <DashboardCharts
        channelLabels={channelLabels}
        channelTotals={channelTotals}
        statusLabels={statusLabels}
        statusValues={statusValues}
        trendLabels={data.trendLabels}
        trendData={data.trendData}
      />

      <div className="row g-2 mb-3">
        <div className="col-12">
          <div className="search-box">
            <h6 className="fw-bold mb-3">채널별 현황 상세</h6>
            <div className="table-responsive">
              <table className="table table-sm table-bordered align-middle data-table mb-0">
                <thead>
                  <tr>
                    <th>채널</th>
                    <th className="text-end">총 작업</th>
                    <th className="text-end">작업중</th>
                    <th className="text-end">환불요청</th>
                    <th className="text-end">오늘 신규</th>
                    <th style={{ width: 100 }}>바로가기</th>
                  </tr>
                </thead>
                <tbody>
                  {CHANNEL_KEYS.map((k) => {
                    const r = data.byChannel[k];
                    return (
                      <tr key={k}>
                        <td>{CHANNEL_MAP[k].label}</td>
                        <td className="text-end">{numberFormat(r.total)}</td>
                        <td className="text-end">{numberFormat(r.active)}</td>
                        <td className="text-end">{numberFormat(r.refund_req)}</td>
                        <td className="text-end">{numberFormat(r.today_new)}</td>
                        <td>
                          <Link className="btn btn-sm btn-outline-secondary py-0 px-2" href={linkFor(k)}>보기</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {(data.rankUp.length > 0 || data.rankDown.length > 0) && (
        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <div className="search-box">
              <h6 className="fw-bold mb-3">
                순위 상승 TOP 10 <small className="text-muted">(어제 대비)</small>
              </h6>
              <div className="table-responsive">
                <table className="table table-sm data-table mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th style={{ width: 70 }}>채널</th>
                      <th>키워드 / 셀러</th>
                      <th className="text-end" style={{ width: 110 }}>어제 → 현재</th>
                      <th className="text-end" style={{ width: 70 }}>변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rankUp.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-muted py-3">상승 데이터가 없습니다.</td></tr>
                    ) : data.rankUp.map((r, i) => (
                      <tr key={`${r.ch}-${r.work_idx}`}>
                        <td>{i + 1}</td>
                        <td>
                          <Link className="badge text-decoration-none" style={{ background: "#0d6efd", color: "#fff" }} href={linkFor(r.ch)}>
                            {CHANNEL_MAP[r.ch].label}
                          </Link>
                        </td>
                        <td>
                          <div>{r.keyword}</div>
                          <div className="small text-muted">{r.seller_name}</div>
                        </td>
                        <td className="text-end">{r.rank_yesterday} → <strong>{r.rank_current}</strong></td>
                        <td className="text-end rank-up fw-bold">▲{r.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="search-box">
              <h6 className="fw-bold mb-3">
                순위 하락 TOP 10 <small className="text-muted">(어제 대비)</small>
              </h6>
              <div className="table-responsive">
                <table className="table table-sm data-table mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th style={{ width: 70 }}>채널</th>
                      <th>키워드 / 셀러</th>
                      <th className="text-end" style={{ width: 110 }}>어제 → 현재</th>
                      <th className="text-end" style={{ width: 70 }}>변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rankDown.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-muted py-3">하락 데이터가 없습니다.</td></tr>
                    ) : data.rankDown.map((r, i) => (
                      <tr key={`${r.ch}-${r.work_idx}`}>
                        <td>{i + 1}</td>
                        <td>
                          <Link className="badge text-decoration-none" style={{ background: "#6c757d", color: "#fff" }} href={linkFor(r.ch)}>
                            {CHANNEL_MAP[r.ch].label}
                          </Link>
                        </td>
                        <td>
                          <div>{r.keyword}</div>
                          <div className="small text-muted">{r.seller_name}</div>
                        </td>
                        <td className="text-end">{r.rank_yesterday} → <strong>{r.rank_current}</strong></td>
                        <td className="text-end rank-down fw-bold">▼{Math.abs(r.delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {(data.topAgency.length > 0 || data.topSeller.length > 0) && (
        <div className="row g-2 mb-3">
          {data.topAgency.length > 0 && (
            <div className="col-md-6">
              <div className="search-box">
                <h6 className="fw-bold mb-3">대행사 Top 10 <small className="text-muted">(총 작업 기준)</small></h6>
                <div className="table-responsive">
                  <table className="table table-sm table-striped data-table mb-0">
                    <thead><tr><th style={{ width: 50 }}>#</th><th>대행사</th><th className="text-end">작업 수</th></tr></thead>
                    <tbody>
                      {data.topAgency.map((r, i) => (
                        <tr key={r.name}>
                          <td>{i + 1}</td>
                          <td>{r.name}</td>
                          <td className="text-end">{numberFormat(r.cnt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {data.topSeller.length > 0 && (
            <div className="col-md-6">
              <div className="search-box">
                <h6 className="fw-bold mb-3">셀러 Top 10 <small className="text-muted">(총 작업 기준)</small></h6>
                <div className="table-responsive">
                  <table className="table table-sm table-striped data-table mb-0">
                    <thead><tr><th style={{ width: 50 }}>#</th><th>셀러</th><th>대행사</th><th className="text-end">작업 수</th></tr></thead>
                    <tbody>
                      {data.topSeller.map((r, i) => (
                        <tr key={`${r.name}-${r.agency_name}`}>
                          <td>{i + 1}</td>
                          <td>{r.name}</td>
                          <td className="small text-muted">{r.agency_name}</td>
                          <td className="text-end">{numberFormat(r.cnt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
