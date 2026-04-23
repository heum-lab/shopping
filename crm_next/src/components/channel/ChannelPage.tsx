import { requireLevel } from "@/lib/auth-guard";
import { CHANNEL_MAP, type ChannelKey } from "@/lib/channels";
import { loadWorks, loadAgencyOptions, loadSellerOptions } from "@/lib/works";
import { dateShortcut, SHORTCUTS } from "@/lib/dateShortcut";
import { STATUS_OPTIONS } from "@/lib/status";
import { numberFormat } from "@/lib/format";
import { buildQs } from "@/lib/qs";
import { insertWork, bulkUpdateWork, updateWork } from "@/lib/actions/work";
import FlashError from "@/components/FlashError";
import Pagination from "@/components/Pagination";
import PerPageSelect from "@/components/PerPageSelect";
import ChannelTable from "./ChannelTable";
import XlsUploadModal from "./XlsUploadModal";

export type ChannelPageSP = {
  pass_assign?: string;
  pass_assign3?: string;
  pass_status?: string;
  pass_date_type?: string;
  pass_date?: string;
  pass_date2?: string;
  pass_input_type?: string;
  pass_input?: string;
  pass_shortcut?: string;
  per_page?: string;
  sort?: string;
  sort_dir?: string;
  page?: string;
  error?: string;
};

const DATE_TYPE_LABELS: Record<string, string> = {
  start_date:  "시작일",
  end_date:    "종료일",
  order_date:  "주문일",
  refund_date: "환불요청일",
};
const INPUT_TYPE_LABELS: Record<string, string> = {
  seller_name: "셀러명",
  keyword:     "키워드",
  product_mid: "상품MID",
};

export default async function ChannelPage({
  channel,
  searchParams,
}: {
  channel: ChannelKey;
  searchParams: ChannelPageSP;
}) {
  const s = await requireLevel(3);
  const pageUrl = `/sub/info_acc_${channel}`;
  const channelLabel = CHANNEL_MAP[channel].label;
  const isSuper = s.adminLevel === 1;

  // 간편 조회 shortcut 적용
  let passDate = searchParams.pass_date ?? "";
  let passDate2 = searchParams.pass_date2 ?? "";
  if (searchParams.pass_shortcut) {
    const res = dateShortcut(searchParams.pass_shortcut);
    if (res) { [passDate, passDate2] = res; }
  }

  const filters = {
    pass_assign:     searchParams.pass_assign,
    pass_assign3:    searchParams.pass_assign3,
    pass_status:     searchParams.pass_status,
    pass_date_type:  searchParams.pass_date_type ?? "start_date",
    pass_date:       passDate,
    pass_date2:      passDate2,
    pass_input_type: searchParams.pass_input_type ?? "seller_name",
    pass_input:      searchParams.pass_input,
    sort:            searchParams.sort,
    sort_dir:        searchParams.sort_dir,
    page:            Number(searchParams.page ?? 1),
    per_page:        Number(searchParams.per_page ?? 50),
  };

  const { total, rows, page, perPage, totalPages, offset, sort, sortDir } =
    await loadWorks(channel, s, filters);

  const agencies = await loadAgencyOptions();
  const sellers  = await loadSellerOptions(s);

  const qsState = {
    pass_assign:     filters.pass_assign,
    pass_assign3:    filters.pass_assign3,
    pass_status:     filters.pass_status,
    pass_date_type:  filters.pass_date_type,
    pass_date:       filters.pass_date,
    pass_date2:      filters.pass_date2,
    pass_input_type: filters.pass_input_type,
    pass_input:      filters.pass_input,
    per_page:        perPage,
    sort:            sort,
    sort_dir:        sortDir.toLowerCase(),
  };

  const currentQs = buildQs(qsState, { page });
  const returnUrl = currentQs ? `${pageUrl}?${currentQs}` : pageUrl;

  const sortLinks: Record<string, string> = {};
  for (const col of ["reg_date", "start_date", "end_date", "refund_date"]) {
    const nextDir = sort === col && sortDir === "ASC" ? "desc" : "asc";
    sortLinks[col] = `${pageUrl}?${buildQs(qsState, { sort: col, sort_dir: nextDir })}`;
  }

  const canEdit = s.adminLevel <= 3;

  return (
    <>
      <FlashError error={searchParams.error} />

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="page-title mb-0">
          {channelLabel} 작업 관리 <span className="text-muted small">총 {numberFormat(total)}건</span>
        </h2>
        <div>
          {canEdit && (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary me-1"
                      data-bs-toggle="modal" data-bs-target="#showModalInsert">
                + 상품 등록
              </button>
              <a className="btn btn-sm btn-outline-secondary me-1"
                 href={`/api/xls/download?channel=${channel}&xls_mode=template`}>엑셀 양식</a>
            </>
          )}
          <a className="btn btn-sm btn-outline-secondary me-1"
             href={`/api/xls/download?${buildQs(qsState, { channel, xls_mode: "search" })}`}>
            검색결과 다운로드
          </a>
          {canEdit && (
            <button type="button" className="btn btn-sm btn-outline-secondary"
                    data-bs-toggle="modal" data-bs-target="#showModalUpload">
              엑셀 대량등록
            </button>
          )}
        </div>
      </div>

      {/* 검색 폼 */}
      <form method="get" className="search-box">
        <input type="hidden" name="pass_shortcut" value="" />
        <div className="row g-2 align-items-end">
          {isSuper && (
            <div className="col-md-2">
              <label>대행사</label>
              <select name="pass_assign3" defaultValue={filters.pass_assign3 ?? ""} className="form-select form-select-sm">
                <option value="">전체</option>
                {agencies.map((a) => <option key={a.idx} value={a.idx}>{a.name}</option>)}
              </select>
            </div>
          )}
          {canEdit && (
            <div className="col-md-2">
              <label>셀러</label>
              <select name="pass_assign" defaultValue={filters.pass_assign ?? ""} className="form-select form-select-sm">
                <option value="">전체</option>
                {sellers.map((sl) => <option key={sl.idx} value={sl.idx}>{sl.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-2">
            <label>상태</label>
            <select name="pass_status" defaultValue={filters.pass_status ?? ""} className="form-select form-select-sm">
              <option value="">전체</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label>날짜 타입</label>
            <select name="pass_date_type" defaultValue={filters.pass_date_type} className="form-select form-select-sm">
              {Object.entries(DATE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" defaultValue={filters.pass_date} className="form-control form-control-sm datepicker" placeholder="YYYY-MM-DD" />
          </div>
          <div className="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" defaultValue={filters.pass_date2} className="form-control form-control-sm datepicker" placeholder="YYYY-MM-DD" />
          </div>
        </div>
        <div className="row g-2 align-items-end mt-1">
          <div className="col-md-2">
            <label>검색 구분</label>
            <select name="pass_input_type" defaultValue={filters.pass_input_type} className="form-select form-select-sm">
              {Object.entries(INPUT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label>검색어</label>
            <input type="text" name="pass_input" defaultValue={filters.pass_input ?? ""} className="form-control form-control-sm" />
          </div>
          <div className="col-md-5">
            <label>간편 조회</label>
            <div className="d-flex flex-wrap gap-1">
              {Object.entries(SHORTCUTS).map(([k, v]) => (
                <button key={k} type="button" className="btn btn-sm btn-outline-secondary btn-date-shortcut" data-shortcut={k}>{v}</button>
              ))}
            </div>
          </div>
          <div className="col-md-2 d-flex gap-1">
            <button type="submit" className="btn btn-sm btn-dark flex-grow-1">검색</button>
            <a href={pageUrl} className="btn btn-sm btn-outline-secondary">초기화</a>
          </div>
        </div>
      </form>

      <div className="d-flex justify-content-end align-items-center mb-2">
        <label className="small text-muted mb-0 me-2">표시</label>
        <PerPageSelect value={perPage} options={[50, 70, 100, 130, 150]} />
      </div>

      <ChannelTable
        channel={channel}
        channelLabel={channelLabel}
        rows={rows}
        total={total}
        offset={offset}
        sessionLevel={s.adminLevel}
        isSuper={isSuper}
        agencies={agencies}
        sellers={sellers}
        returnUrl={returnUrl}
        sort={sort}
        sortDir={sortDir}
        sortLinks={sortLinks}
        bulkUpdateAction={bulkUpdateWork}
        updateWorkAction={updateWork}
      />

      <Pagination page={page} totalPages={totalPages} basePath={pageUrl} params={qsState} />

      {/* 단건 등록 모달 */}
      <div className="modal fade" id="showModalInsert" tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <form action={insertWork}>
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="return_url" value={returnUrl} />
              <input type="hidden" name="agency_idx" value="0" />
              <div className="modal-header">
                <h5 className="modal-title">{channelLabel} 작업 등록</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div className="modal-body">
                <div className="row g-2">
                  {s.adminLevel === 3 ? (
                    <input type="hidden" name="seller_idx" value={s.adminIdx} />
                  ) : (
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">셀러 *</label>
                      <select name="seller_idx" defaultValue="" className="form-select form-select-sm" required>
                        <option value="">선택</option>
                        {sellers.map((sl) => <option key={sl.idx} value={sl.idx}>{sl.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">키워드 *</label>
                    <input type="text" name="keyword" className="form-control form-control-sm" required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">광고 타입{channel === "naver" ? " *" : ""}</label>
                    {channel === "naver" ? (
                      <select name="keyword_type" defaultValue="쇼핑" className="form-select form-select-sm" required>
                        <option value="쇼핑">쇼핑</option>
                      </select>
                    ) : (
                      <input type="text" name="keyword_type" className="form-control form-control-sm" placeholder={`${channelLabel}별 타입 자유 입력`} />
                    )}
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">서브 키워드1</label>
                    <input type="text" name="keyword_sub1" className="form-control form-control-sm" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">서브 키워드2</label>
                    <input type="text" name="keyword_sub2" className="form-control form-control-sm" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">상품 MID / ID{channel === "naver" ? " *" : ""}</label>
                    <input type="text" name="product_mid" className="form-control form-control-sm" required={channel === "naver"} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">대상 URL{channel === "naver" ? " *" : ""}</label>
                    <input type="url" name="product_url" className="form-control form-control-sm" required={channel === "naver"} />
                  </div>

                  {channel === "naver" && (
                    <>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">가격비교 MID</label>
                        <input type="text" name="compare_mid" className="form-control form-control-sm" />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">가격비교 URL</label>
                        <input type="url" name="compare_url" className="form-control form-control-sm" />
                      </div>
                    </>
                  )}

                  <div className="col-md-4">
                    <label className="form-label small fw-bold">시작일{channel === "naver" ? " *" : ""}</label>
                    <input type="text" name="start_date" className="form-control form-control-sm datepicker" required={channel === "naver"} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">종료일{channel === "naver" ? " *" : ""}</label>
                    <input type="text" name="end_date" className="form-control form-control-sm datepicker" required={channel === "naver"} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">주문일</label>
                    <input type="text" name="order_date" className="form-control form-control-sm datepicker" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">유입수{channel === "naver" ? " *" : ""}</label>
                    <input type="number" name="inflow_count" defaultValue={0} min={0} className="form-control form-control-sm" required={channel === "naver"} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">상태 *</label>
                    <select name="status" defaultValue="대기" className="form-select form-select-sm" required>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-bold">비고</label>
                    <textarea name="memo" rows={2} className="form-control form-control-sm" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="submit" className="btn btn-sm btn-dark">등록하기</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 엑셀 대량등록 모달 (5차에서 실제 업로드 활성화) */}
      {canEdit && <XlsUploadModal channel={channel} channelLabel={channelLabel} />}
    </>
  );
}
