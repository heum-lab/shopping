"use client";

import { useState } from "react";

export default function NaverAutoFetchButton({ workIdx }: { workIdx: number }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ cls: string; msg: string } | null>(null);

  async function onClick() {
    setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/naver-rank-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `work_idx=${encodeURIComponent(String(workIdx))}`,
      });
      const json = await res.json();
      const cls = json.result === "ok" ? (json.rank ? "text-success" : "text-warning") : "text-danger";
      setResult({ cls, msg: json.msg ?? "" });
      if (json.result === "ok") {
        setTimeout(() => location.reload(), 800);
      }
    } catch (e) {
      setResult({ cls: "text-danger", msg: `네트워크 오류: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <div className="small fw-bold">네이버 자동 순위 조회</div>
        <button type="button" className="btn btn-sm btn-dark" disabled={loading} onClick={onClick}>
          {loading ? "조회중…" : "현재 순위 자동 조회"}
        </button>
      </div>
      <div className="small text-muted mt-1">상위 5페이지(약 400건)에서 등록된 상품 MID 매칭. 조회 결과는 자동으로 이력에 기록됩니다.</div>
      {result && <div className={`mt-2 small ${result.cls}`}>{result.msg}</div>}
    </>
  );
}
