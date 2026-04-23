import { getAuthSession } from "@/lib/auth-guard";
import { levelLabel } from "@/lib/session";
import { updateAdminName, updateAdminPassword } from "@/lib/actions/account";

type SP = { message?: string; error?: string };

export default async function MyAccountPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await getAuthSession();
  const sp = await searchParams;
  const message = sp.message ? decodeURIComponent(sp.message) : "";
  const error   = sp.error   ? decodeURIComponent(sp.error)   : "";

  return (
    <>
      <h2 className="page-title">내 계정</h2>

      {message && <div className="alert alert-success py-2 small">{message}</div>}
      {error   && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="row g-3">
        <div className="col-md-6">
          <div className="search-box">
            <h5 className="fs-6 fw-bold mb-3">기본 정보</h5>
            <table className="table table-sm mb-3">
              <tbody>
                <tr><th className="w-25 bg-light">아이디</th><td>{s.adminId}</td></tr>
                <tr><th className="bg-light">권한</th><td>{levelLabel(s.adminLevel)} (level {s.adminLevel})</td></tr>
              </tbody>
            </table>

            <form action={updateAdminName}>
              <label className="form-label small fw-bold">이름</label>
              <div className="input-group input-group-sm">
                <input type="text" name="new_name" defaultValue={s.adminName} className="form-control" required />
                <button type="submit" className="btn btn-dark">이름 변경</button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-md-6">
          <div className="search-box">
            <h5 className="fs-6 fw-bold mb-3">비밀번호 변경</h5>
            <form action={updateAdminPassword}>
              <div className="mb-2">
                <label className="form-label small fw-bold">현재 비밀번호</label>
                <input type="password" name="current_pw" className="form-control form-control-sm" required autoComplete="current-password" />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-bold">새 비밀번호 (8자 이상)</label>
                <input type="password" name="new_pw" className="form-control form-control-sm" minLength={8} required autoComplete="new-password" />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-bold">새 비밀번호 확인</label>
                <input type="password" name="new_pw2" className="form-control form-control-sm" minLength={8} required autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-sm btn-dark">비밀번호 변경</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
