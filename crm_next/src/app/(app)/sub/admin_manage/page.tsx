import { requireLevel } from "@/lib/auth-guard";
import { query } from "@/lib/db";
import { levelLabel } from "@/lib/session";
import { numberFormat } from "@/lib/format";
import { createAdmin, deleteAdmin, updateAdmin } from "@/lib/actions/admin";
import DeleteButton from "@/components/DeleteButton";
import FlashError from "@/components/FlashError";
import type { RowDataPacket } from "mysql2";
import { headers } from "next/headers";

type SP = { pass_input?: string; pass_level?: string; error?: string };

type AdminRow = RowDataPacket & {
  idx: number;
  id: string;
  name: string;
  level: number;
  reg_date: string;
  created_by: number | null;
  agency_name: string | null;
};

export default async function AdminManagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireLevel(2);
  const sp = await searchParams;
  const passInput = (sp.pass_input ?? "").trim();
  const passLevel = (sp.pass_level ?? "").trim();

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (s.adminLevel === 2) {
    where.push("(created_by = ? OR idx = ?)");
    params.push(s.adminIdx, s.adminIdx);
  }
  if (passInput) {
    where.push("(id LIKE ? OR name LIKE ?)");
    const like = `%${passInput}%`;
    params.push(like, like);
  }
  if (passLevel) {
    where.push("level = ?");
    params.push(Number(passLevel));
  }

  const rows = await query<AdminRow[]>(
    `SELECT idx, id, name, level, reg_date, created_by, agency_name
       FROM admin
      WHERE ${where.join(" AND ")}
      ORDER BY level, reg_date DESC`,
    params
  );
  const total = rows.length;
  const allowedLevels = s.adminLevel === 1 ? [2, 3] : [3];

  const h = await headers();
  const pathname = h.get("x-next-pathname") ?? "/sub/admin_manage";
  const qs = Object.entries(sp)
    .filter(([k, v]) => k !== "error" && v)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const returnUrl = qs ? `${pathname}?${qs}` : pathname;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="page-title mb-0">계정관리 <span className="text-muted small">총 {numberFormat(total)}건</span></h2>
        <button type="button" className="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 계정 등록</button>
      </div>

      <FlashError error={sp.error} />

      <form name="searchfrm" method="get" className="search-box">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label>권한</label>
            <select name="pass_level" defaultValue={passLevel} className="form-select form-select-sm">
              <option value="">전체</option>
              {s.adminLevel === 1 && (
                <>
                  <option value="1">슈퍼관리자</option>
                  <option value="2">관리자</option>
                </>
              )}
              <option value="3">대행사</option>
            </select>
          </div>
          <div className="col-md-4">
            <label>아이디/이름</label>
            <input type="text" name="pass_input" defaultValue={passInput} className="form-control form-control-sm" />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm btn-dark w-100">검색</button>
          </div>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-bordered table-hover data-table align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>번호</th>
              <th style={{ width: 110 }}>권한</th>
              <th>아이디</th>
              <th>이름</th>
              <th>대행사명</th>
              <th>등록일</th>
              <th style={{ width: 140 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
            ) : rows.map((r, i) => {
              const isSelf = Number(r.idx) === s.adminIdx;
              const canModify = s.adminLevel === 1 || (s.adminLevel === 2 && Number(r.created_by) === s.adminIdx);
              return (
                <tr key={r.idx}>
                  <td>{total - i}</td>
                  <td><span className="badge bg-secondary">{levelLabel(Number(r.level))}</span></td>
                  <td>
                    {r.id}
                    {isSelf && <span className="badge bg-info text-white small ms-1">나</span>}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.agency_name ?? <span className="text-muted">-</span>}</td>
                  <td>{r.reg_date}</td>
                  <td className="text-center">
                    {canModify ? (
                      <>
                        <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1 me-1"
                                data-bs-toggle="modal" data-bs-target={`#showModalEdit-${r.idx}`}>
                          수정
                        </button>
                        {!isSelf && (
                          <DeleteButton action={deleteAdmin} idx={r.idx} label={r.id} returnUrl={returnUrl} />
                        )}
                      </>
                    ) : <span className="text-muted small">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      <div className="modal fade" id="showModalInsert" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={createAdmin}>
              <input type="hidden" name="return_url" value={returnUrl} />
              <div className="modal-header">
                <h5 className="modal-title">계정 등록</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">아이디 *</label>
                    <input type="text" name="id" className="form-control form-control-sm" required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">비밀번호 * (8자 이상)</label>
                    <input type="password" name="pw" className="form-control form-control-sm" minLength={8} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">이름 *</label>
                    <input type="text" name="admin_name" className="form-control form-control-sm" required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">대행사명</label>
                    <input type="text" name="agency_name" className="form-control form-control-sm" placeholder="대행사/회사명" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">권한 *</label>
                    <select name="level" className="form-select form-select-sm" required defaultValue={3}>
                      {allowedLevels.includes(2) && <option value={2}>관리자</option>}
                      {allowedLevels.includes(3) && <option value={3}>대행사</option>}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="submit" className="btn btn-sm btn-dark">등록</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 행별 수정 모달 */}
      {rows.map((r) => {
        const canModify = s.adminLevel === 1 || (s.adminLevel === 2 && Number(r.created_by) === s.adminIdx);
        if (!canModify) return null;
        const editableLevels = s.adminLevel === 1 ? [1, 2, 3] : [3];
        return (
          <div key={`edit-${r.idx}`} className="modal fade" id={`showModalEdit-${r.idx}`} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <form action={updateAdmin}>
                  <input type="hidden" name="idx" value={r.idx} />
                  <input type="hidden" name="return_url" value={returnUrl} />
                  <div className="modal-header">
                    <h5 className="modal-title">계정 수정 — {r.id}</h5>
                    <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div className="modal-body">
                    <div className="row g-2">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">아이디</label>
                        <input type="text" defaultValue={r.id} className="form-control form-control-sm" readOnly />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">이름 *</label>
                        <input type="text" name="name" defaultValue={r.name} className="form-control form-control-sm" required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">새 비밀번호</label>
                        <input type="password" name="new_pw" className="form-control form-control-sm" minLength={8} placeholder="변경 시에만 입력 (8자 이상)" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">대행사명</label>
                        <input type="text" name="agency_name" defaultValue={r.agency_name ?? ""} className="form-control form-control-sm" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">권한 *</label>
                        <select name="level" defaultValue={r.level} className="form-select form-select-sm" required>
                          {editableLevels.includes(1) && <option value={1}>슈퍼관리자</option>}
                          {editableLevels.includes(2) && <option value={2}>관리자</option>}
                          {editableLevels.includes(3) && <option value={3}>대행사</option>}
                        </select>
                      </div>
                      <div className="col-12 small text-muted mt-2">등록일: {r.reg_date}</div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">닫기</button>
                    <button type="submit" className="btn btn-sm btn-dark">저장</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
