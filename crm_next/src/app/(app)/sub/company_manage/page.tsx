import { requireLevel } from "@/lib/auth-guard";
import { query } from "@/lib/db";
import { numberFormat } from "@/lib/format";
import { createAgency, deleteAgency, updateAgency } from "@/lib/actions/agency";
import DeleteButton from "@/components/DeleteButton";
import FlashError from "@/components/FlashError";
import type { RowDataPacket } from "mysql2";
import { headers } from "next/headers";

type SP = { pass_input?: string; error?: string };

type AgencyRow = RowDataPacket & {
  idx: number;
  name: string;
  maketer_idx: number | null;
  reg_date: string;
  seller_cnt: number;
  work_cnt: number;
  maketer_name: string | null;
};

type MarketerRow = RowDataPacket & { idx: number; name: string };

export default async function CompanyManagePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireLevel(2);
  const sp = await searchParams;
  const passInput = (sp.pass_input ?? "").trim();

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];
  if (passInput) {
    where.push("a.name LIKE ?");
    params.push(`%${passInput}%`);
  }

  const rows = await query<AgencyRow[]>(
    `SELECT a.*,
            (SELECT COUNT(*) FROM seller s WHERE s.agency_idx = a.idx) AS seller_cnt,
            (SELECT COUNT(*) FROM naver_shopping_work w WHERE w.agency_idx = a.idx) AS work_cnt,
            m.name AS maketer_name
       FROM agency a
       LEFT JOIN admin m ON m.idx = a.maketer_idx
      WHERE ${where.join(" AND ")}
      ORDER BY a.reg_date DESC`,
    params
  );
  const total = rows.length;

  const marketers = await query<MarketerRow[]>("SELECT idx, name FROM admin WHERE level <= 2 ORDER BY name");

  const h = await headers();
  const pathname = h.get("x-next-pathname") ?? "/sub/company_manage";
  const qs = Object.entries(sp)
    .filter(([k, v]) => k !== "error" && v)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const returnUrl = qs ? `${pathname}?${qs}` : pathname;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="page-title mb-0">대행사 관리 <span className="text-muted small">총 {numberFormat(total)}건</span></h2>
        <button type="button" className="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 대행사 등록</button>
      </div>

      <FlashError error={sp.error} />

      <form name="searchfrm" method="get" className="search-box">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label>대행사명</label>
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
              <th>대행사명</th>
              <th>담당 마케터</th>
              <th className="text-end">셀러</th>
              <th className="text-end">작업</th>
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
                <td>{r.maketer_name ?? <span className="text-muted">-</span>}</td>
                <td className="text-end">{numberFormat(r.seller_cnt)}</td>
                <td className="text-end">{numberFormat(r.work_cnt)}</td>
                <td>{r.reg_date}</td>
                <td className="text-center">
                  <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1 me-1"
                          data-bs-toggle="modal" data-bs-target={`#showModalEdit-${r.idx}`}>
                    수정
                  </button>
                  <DeleteButton action={deleteAgency} idx={r.idx} label={r.name} returnUrl={returnUrl} />
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
            <form action={createAgency}>
              <input type="hidden" name="return_url" value={returnUrl} />
              <div className="modal-header">
                <h5 className="modal-title">대행사 등록</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small fw-bold">대행사명 *</label>
                  <input type="text" name="name" className="form-control form-control-sm" required />
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-bold">담당 마케터</label>
                  <select name="maketer_idx" className="form-select form-select-sm">
                    <option value="">선택 없음</option>
                    {marketers.map((m) => <option key={m.idx} value={m.idx}>{m.name}</option>)}
                  </select>
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

      {/* 수정 모달 */}
      {rows.map((r) => (
        <div key={`edit-${r.idx}`} className="modal fade" id={`showModalEdit-${r.idx}`} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form action={updateAgency}>
                <input type="hidden" name="idx" value={r.idx} />
                <input type="hidden" name="return_url" value={returnUrl} />
                <div className="modal-header">
                  <h5 className="modal-title">대행사 수정 — {r.name}</h5>
                  <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label small fw-bold">대행사명 *</label>
                    <input type="text" name="name" defaultValue={r.name} className="form-control form-control-sm" required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-bold">담당 마케터</label>
                    <select name="maketer_idx" defaultValue={r.maketer_idx ?? ""} className="form-select form-select-sm">
                      <option value="">선택 없음</option>
                      {marketers.map((m) => <option key={m.idx} value={m.idx}>{m.name}</option>)}
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
