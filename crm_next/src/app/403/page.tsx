import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="p-5 text-center">
      <div className="container">
        <h3>403 접근 권한이 없습니다.</h3>
        <p className="text-muted">이 페이지는 상위 권한 관리자만 이용할 수 있습니다.</p>
        <Link href="/dashboard" className="btn btn-sm btn-dark">홈으로</Link>
      </div>
    </div>
  );
}
