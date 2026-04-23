"use client";

import { useRef, useState } from "react";

type UploadResult =
  | { result: "ok"; inserted: number; skipped: number; errors: string[] }
  | { result: "fail"; msg: string };

export default function XlsUploadModal({
  channel,
  channelLabel,
}: {
  channel: string;
  channelLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("channel", channel);
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/xls/upload", { method: "POST", body: fd });
      const json = (await res.json()) as UploadResult;
      setResult(json);
    } catch (e) {
      setResult({ result: "fail", msg: `네트워크 오류: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal fade" id="showModalUpload" tabIndex={-1}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{channelLabel} 엑셀 대량 등록</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-light small">
              <strong>안내:</strong>
              <ol className="mb-0 ps-3">
                <li><a href={`/api/xls/download?channel=${channel}&xls_mode=template`}>엑셀 양식 다운로드</a> 후 작성하세요.</li>
                <li>Excel에서 <strong>다른 이름으로 저장 → CSV UTF-8(쉼표로 분리)</strong> 형식으로 내보내세요.</li>
                <li>대행사/셀러명은 사전에 시스템에 등록되어 있어야 합니다.</li>
                <li>날짜는 <code>YYYY-MM-DD</code> 형식을 권장합니다.</li>
              </ol>
            </div>
            <form ref={formRef} onSubmit={onSubmit} encType="multipart/form-data">
              <div className="mb-2">
                <label className="form-label small fw-bold">CSV 파일 선택</label>
                <input type="file" name="excel_file" accept=".csv,.txt" className="form-control form-control-sm" required />
              </div>
              <button type="submit" className="btn btn-sm btn-dark" disabled={loading}>
                {loading ? "처리 중..." : "업로드 실행"}
              </button>
            </form>
            <hr />
            <div className="small">
              {result && result.result === "ok" && (
                <>
                  <div className="alert alert-success py-2 mb-2">
                    <strong>{result.inserted}건</strong> 등록 완료
                    {result.skipped > 0 && <>, <strong>{result.skipped}건</strong> 실패</>}
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: 200, overflow: "auto" }}>
                      <strong>오류 상세:</strong>
                      <ul className="mb-0 ps-3">
                        {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.inserted > 0 && (
                    <div className="mt-2 text-end">
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => location.reload()}>
                        목록 새로고침
                      </button>
                    </div>
                  )}
                </>
              )}
              {result && result.result === "fail" && (
                <div className="alert alert-danger py-2">{result.msg}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
