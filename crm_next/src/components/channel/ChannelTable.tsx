"use client";

import { useMemo, useRef, useState } from "react";
import type { ChannelKey } from "@/lib/channels";
import type { WorkRow, AgencyOpt, SellerOpt } from "@/lib/works";
import { STATUS_OPTIONS, statusBadgeStyle, statusLabel } from "@/lib/status";
import { numberFormat } from "@/lib/format";

type Props = {
  channel: ChannelKey;
  channelLabel: string;
  rows: WorkRow[];
  total: number;
  offset: number;
  sessionLevel: 1 | 2 | 3;
  isSuper: boolean;
  agencies: AgencyOpt[];
  sellers: SellerOpt[];
  returnUrl: string;
  sort: string;
  sortDir: "ASC" | "DESC";
  sortLinks: Record<string, string>;
  bulkUpdateAction: (fd: FormData) => void | Promise<void>;
  updateWorkAction: (fd: FormData) => void | Promise<void>;
};

export default function ChannelTable(props: Props) {
  const {
    channel, channelLabel, rows, total, offset, sessionLevel, isSuper,
    agencies, sellers, returnUrl, sort, sortDir, sortLinks,
    bulkUpdateAction, updateWorkAction,
  } = props;

  const canEdit = sessionLevel <= 3;
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<WorkRow | null>(null);
  const bulkFormRef = useRef<HTMLFormElement>(null);

  const allCheckedOnPage = useMemo(() =>
    rows.length > 0 && rows.every((r) => checked.has(r.idx)),
    [rows, checked]
  );

  function toggleAll(v: boolean) {
    const next = new Set(checked);
    rows.forEach((r) => { v ? next.add(r.idx) : next.delete(r.idx); });
    setChecked(next);
  }

  function toggleOne(idx: number, v: boolean) {
    const next = new Set(checked);
    v ? next.add(idx) : next.delete(idx);
    setChecked(next);
  }

  function submitBulk(mode: string, label: string, extendDays = 0) {
    if (checked.size === 0) { alert("항목을 선택해주세요."); return; }
    if (!confirm(`선택한 ${checked.size}건을 [${label}] 처리하시겠습니까?`)) return;
    const form = bulkFormRef.current;
    if (!form) return;
    (form.querySelector('input[name="mode"]') as HTMLInputElement).value = mode;
    (form.querySelector('input[name="extend_days"]') as HTMLInputElement).value = String(extendDays);
    form.requestSubmit();
  }

  const sortArrow = (col: string) => {
    if (sort !== col) return "⇅";
    return sortDir === "ASC" ? "▲" : "▼";
  };

  const rowNoStart = total - offset;

  return (
    <>
      {/* 일괄 처리 폼 (checkboxes submit via this form) */}
      <form ref={bulkFormRef} method="post" action={bulkUpdateAction as any} style={{ display: "contents" }}>
        <input type="hidden" name="channel" value={channel} />
        <input type="hidden" name="mode" value="" />
        <input type="hidden" name="extend_days" value="" />
        <input type="hidden" name="return_url" value={returnUrl} />

        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="bulk-actions">
            {canEdit && (
              <>
                <button type="button" className="btn btn-sm btn-outline-success me-1"
                        onClick={() => submitBulk("etc_date_act", "10일 연장", 10)}>선택 10일 연장</button>
                <button type="button" className="btn btn-sm btn-outline-success me-1"
                        onClick={() => submitBulk("etc_date_act", "7일 연장", 7)}>선택 7일 연장</button>
                <button type="button" className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => submitBulk("move_working", "작업중 전환")}>작업중 전환</button>
                <button type="button" className="btn btn-sm btn-outline-warning me-1"
                        onClick={() => submitBulk("refund_req", "환불요청")}>환불요청</button>
                <button type="button" className="btn btn-sm btn-outline-danger me-1"
                        onClick={() => submitBulk("delete_req", "삭제요청")}>삭제요청</button>
                {isSuper && (
                  <button type="button" className="btn btn-sm btn-outline-dark"
                          onClick={() => submitBulk("del_mode", "완전 삭제")}>완전 삭제</button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered table-hover data-table align-middle">
            <thead>
              <tr>
                {canEdit && (
                  <th style={{ width: 32 }}>
                    <input type="checkbox" className="form-check-input" checked={allCheckedOnPage}
                           onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                )}
                <th style={{ width: 60 }}>번호</th>
                <th>대행사</th>
                <th>셀러</th>
                <th>키워드</th>
                <th>상품MID</th>
                <th>광고타입</th>
                <th><a href={sortLinks.start_date}>시작일 <span className={`sort-arrow ${sort === "start_date" ? "active" : ""}`}>{sortArrow("start_date")}</span></a></th>
                <th><a href={sortLinks.end_date}>종료일 <span className={`sort-arrow ${sort === "end_date" ? "active" : ""}`}>{sortArrow("end_date")}</span></a></th>
                <th>유입수</th>
                <th>상태</th>
                <th style={{ width: 120 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="text-center text-muted py-4">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              ) : rows.map((r, i) => (
                <tr key={r.idx}>
                  {canEdit && (
                    <td>
                      <input type="checkbox" name="check_idx[]" value={r.idx} className="form-check-input"
                             checked={checked.has(r.idx)}
                             onChange={(e) => toggleOne(r.idx, e.target.checked)} />
                    </td>
                  )}
                  <td>{rowNoStart - i}</td>
                  <td>{r.agency_name}</td>
                  <td>{r.seller_name}</td>
                  <td>
                    {r.keyword}
                    {r.keyword_sub1 && <div className="small text-muted">{r.keyword_sub1}</div>}
                  </td>
                  <td>{r.product_mid}</td>
                  <td>{r.keyword_type}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td className="text-end">{numberFormat(r.inflow_count)}</td>
                  <td className="text-center">
                    <span className="badge" style={statusBadgeStyle(r.status)}>{statusLabel(r.status, r.drive_days)}</span>
                  </td>
                  <td className="text-center">
                    <button type="button" className="btn btn-sm btn-outline-primary py-0 px-1"
                            onClick={() => setEditing(r)}>
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      {/* 편집 모달 — Bootstrap 없이 단순 모달 */}
      {editing && (
        <EditModal
          channel={channel}
          channelLabel={channelLabel}
          row={editing}
          agencies={agencies}
          sellers={sellers}
          returnUrl={returnUrl}
          action={updateWorkAction}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditModal({
  channel, channelLabel, row, agencies, sellers, returnUrl, action, onClose,
}: {
  channel: ChannelKey;
  channelLabel: string;
  row: WorkRow;
  agencies: AgencyOpt[];
  sellers: SellerOpt[];
  returnUrl: string;
  action: (fd: FormData) => void | Promise<void>;
  onClose: () => void;
}) {
  const isNaver = channel === "naver";

  return (
    <div
      className="modal fade show"
      style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{channelLabel} 작업 상세</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form action={action as any}>
            <input type="hidden" name="channel" value={channel} />
            <input type="hidden" name="idx" value={row.idx} />
            <input type="hidden" name="return_url" value={returnUrl} />
            <div className="modal-body">
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small fw-bold">대행사</label>
                  <select name="agency_idx" defaultValue={row.agency_idx} className="form-select form-select-sm">
                    <option value="0">-</option>
                    {agencies.map((a) => <option key={a.idx} value={a.idx}>{a.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">셀러</label>
                  <select name="seller_idx" defaultValue={row.seller_idx} className="form-select form-select-sm">
                    {sellers.map((s) => <option key={s.idx} value={s.idx}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">키워드</label>
                  <input type="text" name="keyword" defaultValue={row.keyword} className="form-control form-control-sm" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">광고 타입</label>
                  {isNaver ? (
                    <select name="keyword_type" defaultValue={row.keyword_type} className="form-select form-select-sm">
                      <option value="쇼핑">쇼핑</option>
                    </select>
                  ) : (
                    <input type="text" name="keyword_type" defaultValue={row.keyword_type} className="form-control form-control-sm" />
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">서브 키워드1</label>
                  <input type="text" name="keyword_sub1" defaultValue={row.keyword_sub1 ?? ""} className="form-control form-control-sm" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">서브 키워드2</label>
                  <input type="text" name="keyword_sub2" defaultValue={row.keyword_sub2 ?? ""} className="form-control form-control-sm" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">상품 MID / ID</label>
                  <input type="text" name="product_mid" defaultValue={row.product_mid} className="form-control form-control-sm" />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-bold">대상 URL</label>
                  <input type="url" name="product_url" defaultValue={row.product_url} className="form-control form-control-sm" />
                </div>

                {isNaver && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">가격비교 MID</label>
                      <input type="text" name="compare_mid" defaultValue={row.compare_mid ?? ""} className="form-control form-control-sm" />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">가격비교 URL</label>
                      <input type="url" name="compare_url" defaultValue={row.compare_url ?? ""} className="form-control form-control-sm" />
                    </div>
                  </>
                )}

                <div className="col-md-3">
                  <label className="form-label small fw-bold">시작일</label>
                  <input type="text" name="start_date" defaultValue={row.start_date ?? ""} className="form-control form-control-sm datepicker" />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">종료일</label>
                  <input type="text" name="end_date" defaultValue={row.end_date ?? ""} className="form-control form-control-sm datepicker" />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">주문일</label>
                  <input type="text" name="order_date" defaultValue={row.order_date ?? ""} className="form-control form-control-sm datepicker" />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-bold">유입수</label>
                  <input type="number" name="inflow_count" defaultValue={row.inflow_count} min={0} className="form-control form-control-sm" />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold">상태</label>
                  <select name="status" defaultValue={row.status} className="form-select form-select-sm">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-bold text-muted">수정일</label>
                  <input type="text" defaultValue={row.mod_date} className="form-control form-control-sm" readOnly />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-bold">비고</label>
                  <textarea name="memo" defaultValue={row.memo ?? ""} rows={2} className="form-control form-control-sm" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>닫기</button>
              <button type="submit" className="btn btn-sm btn-dark">저장</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
