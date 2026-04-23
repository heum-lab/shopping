import { requireLevel } from "@/lib/auth-guard";
import { query } from "@/lib/db";
import { numberFormat } from "@/lib/format";
import { createSeller, deleteSeller, updateSeller } from "@/lib/actions/seller";
import DeleteButton from "@/components/DeleteButton";
import FlashError from "@/components/FlashError";
import type { RowDataPacket } from "mysql2";
import { headers } from "next/headers";

type SP = { pass_assign3?: string; pass_input?: string; error?: string };

type SellerRow = RowDataPacket & {
  idx: number;
  name: string;
  manager_name: string | null;
  agency_idx: number;
  agency_name: string | null;
  reg_date: string;
  work_cnt: number;
};

type AgencyOpt = RowDataPacket & { idx: number; name: string };

export default async function SellerManagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await requireLevel(2);
  const sp = await searchParams;
  const passAssign3 = (sp.pass_assign3 ?? "").trim();
  const passInput = (sp.pass_input ?? "").trim();

  const forceAgency = s.adminLevel === 2 && s.adminAgencyIdx > 0 ? s.adminAgencyIdx : 0;

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (forceAgency > 0) {
    where.push("s.agency_idx = ?");
    params.push(forceAgency);
  } else if (passAssign3) {
    where.push("s.agency_idx = ?");
    params.push(Number(passAssign3));
  }
  if (passInput) {
    where.push("(s.name LIKE ? OR s.manager_name LIKE ?)");
    const like = `%${passInput}%`;
    params.push(like, like);
  }

  const rows = await query<SellerRow[]>(
    `SELECT s.*,
            a.name AS agency_name,
            (SELECT COUNT(*) FROM naver_shopping_work w WHERE w.seller_idx = s.idx) AS work_cnt
       FROM seller s
       LEFT JOIN agency a ON a.idx = s.agency_idx
      WHERE ${where.join(" AND ")}
      ORDER BY s.reg_date DESC`,
    params
  );
  const total = rows.length;
  const agencies = await query<AgencyOpt[]>("SELECT idx, name FROM agency ORDER BY name");

  const h = await headers();
  const pathname = h.get("x-next-pathname") ?? "/sub/seller_manage";
  const qs = Object.entries(sp)
    .filter(([k, v]) => k !== "error" && v)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const returnUrl = qs ? `${pathname}?${qs}` : pathname;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="page-title mb-0">셀러 관리 <span className="text-muted small">총 {numberFormat(total)}건</span></h2>
        <button type="button" className="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 셀러 등록</button>
      </div>

      <FlashError error={sp.error} />

      <form name="searchfrm" method="get" className="search-box">
        <div className="row g-2 align-items-end">
          {forceAgency === 0 && (
            <div className="col-md-3">
              <label>대행사</label>
              <select name="pass_assign3" defaultValue={passAssign3} className="form-select form-select-sm">
                <option value="">전체</option>
                {agencies.map((a) => <option key={a.idx} value={a.idx}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-4">
            <label>셀러명/담당자</label>
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
              <th>셀러명</th>
              <th>담당자</th>
              <th>소속 대행사</th>
              <th className="text-end">작업 수</th>
              <th>등록일</th>
              <th style={{ width: 140 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.idx}>
                <td>{total - i}</td>
                <td>{r.name}</td>
                <td>{r.manager_name || <span className="text-muted">-</span>}</td>
                <td>{r.agency_name || <span className="text-muted">-</span>}</td>
                <td className="text-end">{numberFormat(r.work_cnt)}</td>
                <td>{r.reg_date}</td>
                <td className="text-center">
                  <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1 me-1"
                          data-bs-toggle="modal" data-bs-target={`#showModalEdit-${r.idx}`}>
                    수정
                  </button>
                  <DeleteButton action={deleteSeller} idx={r.idx} label={r.name} returnUrl={returnUrl} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 등록 모달 */}
      <div className="modal fade" id="showModalInsert" tabIndex={-1}>
        <div className="modal-dialog">
          <div className="modal-content">
            <form action={createSeller}>
              <input type="hidden" name="return_url" value={returnUrl} />
              <div className="modal-header">
                <h5 className="modal-title">셀러 등록</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small fw-bold">셀러명 *</label>
                  <input type="text" name="name" className="form-control form-control-sm" required />
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-bold">담당자</label>
                  <input type="text" name="manager_name" className="form-control form-control-sm" placeholder="담당자 이름" />
                </div>
                {forceAgency > 0 ? (
                  <input type="hidden" name="agency_idx" value={forceAgency} />
                ) : (
                  <div className="mb-2">
                    <label className="form-label small fw-bold">소속 대행사 *</label>
                    <select name="agency_idx" className="form-select form-select-sm" required defaultValue="">
                      <option value="">선택</option>
                      {agencies.map((a) => <option key={a.idx} value={a.idx}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="submit" className="btn btn-sm btn-dark">등록</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 수정 모달 */}
      {rows.map((r) => (
        <div key={`edit-${r.idx}`} className="modal fade" id={`showModalEdit-${r.idx}`} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form action={updateSeller}>
                <input type="hidden" name="idx" value={r.idx} />
                <input type="hidden" name="return_url" value={returnUrl} />
                <div className="modal-header">
                  <h5 className="modal-title">셀러 수정 — {r.name}</h5>
                  <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label small fw-bold">셀러명 *</label>
                    <input type="text" name="name" defaultValue={r.name} className="form-control form-control-sm" required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">담당자</label>
                    <input type="text" name="manager_name" defaultValue={r.manager_name ?? ""} className="form-control form-control-sm" />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">소속 대행사 *</label>
                    <select name="agency_idx" defaultValue={r.agency_idx} className="form-select form-select-sm" required>
                      {agencies.map((a) => <option key={a.idx} value={a.idx}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-2 small text-muted">등록일: {r.reg_date}</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">닫기</button>
                  <button type="submit" className="btn btn-sm btn-dark">저장</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
