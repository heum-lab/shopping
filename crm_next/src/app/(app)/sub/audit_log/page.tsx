import { requireLevel } from "@/lib/auth-guard";
import { query, queryOne } from "@/lib/db";
import { numberFormat, todayYmd, daysAgoYmd } from "@/lib/format";
import Pagination from "@/components/Pagination";
import PerPageSelect from "@/components/PerPageSelect";
import type { RowDataPacket } from "mysql2";

type SP = {
  pass_admin?: string;
  pass_action?: string;
  pass_entity?: string;
  pass_date?: string;
  pass_date2?: string;
  per_page?: string;
  page?: string;
};

type LogRow = RowDataPacket & {
  idx: number;
  admin_idx: number | null;
  admin_id: string | null;
  admin_name: string | null;
  action: string;
  entity_type: string;
  entity_idx: number | null;
  detail: string | null;
  ip: string | null;
  reg_date: string;
};

const ACTION_LABEL: Record<string, string> = {
  login: "로그인",
  login_fail: "로그인 실패",
  logout: "로그아웃",
  insert: "등록",
  update: "수정",
  delete: "삭제",
  bulk_update: "일괄처리",
  upload_bulk: "엑셀 업로드",
  change_pw: "비밀번호 변경",
};
const ACTION_COLOR: Record<string, string> = {
  login: "#198754",
  login_fail: "#dc3545",
  logout: "#6c757d",
  insert: "#0d6efd",
  update: "#0dcaf0",
  delete: "#dc3545",
  bulk_update: "#fd7e14",
  upload_bulk: "#6f42c1",
  change_pw: "#ffc107",
};

function actionBadge(a: string) {
  const label = ACTION_LABEL[a] ?? a;
  const color = ACTION_COLOR[a] ?? "#6c757d";
  return <span className="badge" style={{ background: color, color: "#fff" }}>{label}</span>;
}

const PER_PAGE_OPTIONS = [50, 100, 200];

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireLevel(1);
  const sp = await searchParams;
  const passAdmin  = (sp.pass_admin  ?? "").trim();
  const passAction = (sp.pass_action ?? "").trim();
  const passEntity = (sp.pass_entity ?? "").trim();
  const passDate   = sp.pass_date  || daysAgoYmd(7);
  const passDate2  = sp.pass_date2 || todayYmd();
  let perPage = Number(sp.per_page ?? 50);
  if (!PER_PAGE_OPTIONS.includes(perPage)) perPage = 50;
  let page = Math.max(1, Number(sp.page ?? 1));

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (passAdmin)  { where.push("l.admin_idx = ?"); params.push(Number(passAdmin)); }
  if (passAction) { where.push("l.action = ?"); params.push(passAction); }
  if (passEntity) { where.push("l.entity_type = ?"); params.push(passEntity); }
  if (passDate)   { where.push("l.reg_date >= ?"); params.push(`${passDate} 00:00:00`); }
  if (passDate2)  { where.push("l.reg_date <= ?"); params.push(`${passDate2} 23:59:59`); }
  const whereSql = where.join(" AND ");

  const cntRow = await queryOne<RowDataPacket & { cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM audit_log l WHERE ${whereSql}`,
    params
  );
  const total = Number(cntRow?.cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * perPage;

  const rows = await query<LogRow[]>(
    `SELECT l.*, m.name AS admin_name
       FROM audit_log l
       LEFT JOIN admin m ON m.idx = l.admin_idx
      WHERE ${whereSql}
      ORDER BY l.reg_date DESC, l.idx DESC
      LIMIT ${perPage} OFFSET ${offset}`,
    params
  );

  const admins   = await query<(RowDataPacket & { idx: number; id: string; name: string })[]>(
    "SELECT idx, id, name FROM admin ORDER BY name"
  );
  const actions  = await query<(RowDataPacket & { action: string })[]>(
    "SELECT DISTINCT action FROM audit_log ORDER BY action"
  );
  const entities = await query<(RowDataPacket & { entity_type: string })[]>(
    "SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type"
  );

  const basePath = "/sub/audit_log";
  const qsParams = {
    pass_admin: passAdmin,
    pass_action: passAction,
    pass_entity: passEntity,
    pass_date: passDate,
    pass_date2: passDate2,
    per_page: perPage,
  };

  return (
    <>
      <h2 className="page-title">감사 로그 <span className="text-muted small">총 {numberFormat(total)}건</span></h2>

      <form method="get" className="search-box">
        <div className="row g-2 align-items-end">
          <div className="col-md-2">
            <label>관리자</label>
            <select name="pass_admin" defaultValue={passAdmin} className="form-select form-select-sm">
              <option value="">전체</option>
              {admins.map((m) => (
                <option key={m.idx} value={m.idx}>{m.name} ({m.id})</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label>액션</label>
            <select name="pass_action" defaultValue={passAction} className="form-select form-select-sm">
              <option value="">전체</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>{ACTION_LABEL[a.action] ?? a.action}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label>엔티티</label>
            <select name="pass_entity" defaultValue={passEntity} className="form-select form-select-sm">
              <option value="">전체</option>
              {entities.map((e) => (
                <option key={e.entity_type} value={e.entity_type}>{e.entity_type}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" defaultValue={passDate} className="form-control form-control-sm datepicker" />
          </div>
          <div className="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" defaultValue={passDate2} className="form-control form-control-sm datepicker" />
          </div>
          <div className="col-md-2 d-flex gap-1">
            <button type="submit" className="btn btn-sm btn-dark flex-grow-1">검색</button>
            <a href={basePath} className="btn btn-sm btn-outline-secondary">초기화</a>
          </div>
        </div>
      </form>

      <div className="d-flex justify-content-end align-items-center mb-2">
        <label className="small text-muted mb-0 me-2">표시</label>
        <PerPageSelect value={perPage} options={PER_PAGE_OPTIONS} />
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-hover data-table align-middle" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>시각</th>
              <th style={{ width: 140 }}>관리자</th>
              <th style={{ width: 110 }}>액션</th>
              <th style={{ width: 160 }}>엔티티</th>
              <th style={{ width: 80 }}>대상 idx</th>
              <th>상세</th>
              <th style={{ width: 110 }}>IP</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.idx}>
                <td>{r.reg_date}</td>
                <td>{r.admin_name || r.admin_id || <span className="text-muted">-</span>}</td>
                <td>{actionBadge(r.action)}</td>
                <td><code>{r.entity_type}</code></td>
                <td className="text-end">{r.entity_idx ?? <span className="text-muted">-</span>}</td>
                <td>
                  {r.detail ? (
                    <code className="small" style={{ wordBreak: "break-all" }}>{r.detail}</code>
                  ) : <span className="text-muted">-</span>}
                </td>
                <td className="small text-muted">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath={basePath} params={qsParams} />
    </>
  );
}
