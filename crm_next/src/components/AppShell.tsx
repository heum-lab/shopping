import Link from "next/link";
import Script from "next/script";
import { headers } from "next/headers";
import { levelLabel } from "@/lib/session";
import type { SessionData } from "@/types/session";

type NavItem = { href: string; label: string; minLevel: 1 | 2 | 3 };

const NAV: NavItem[] = [
  { href: "/dashboard",       label: "대시보드",   minLevel: 3 },
  { href: "/sub/info_acc_naver",   label: "네이버쇼핑", minLevel: 3 },
  { href: "/sub/admin_manage",     label: "계정관리",   minLevel: 2 },
  { href: "/sub/audit_log",        label: "감사로그",   minLevel: 1 },
];

export default async function AppShell({
  session,
  children,
}: {
  session: SessionData;
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-next-pathname") ?? "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const visible = NAV.filter((it) => session.adminLevel <= it.minLevel);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css"
      />
      <link rel="stylesheet" href="/assets/css/admin.css" />

      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" href="/dashboard">CONTROL</Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="mainNav">
            <ul className="navbar-nav me-auto">
              {visible.map((it) => (
                <li className="nav-item" key={it.href}>
                  <Link
                    className={`nav-link ${isActive(it.href) ? "active" : ""}`}
                    href={it.href}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="navbar-nav">
              <li className="nav-item">
                <span className="navbar-text me-3">
                  {session.adminName}({session.adminId}){" "}
                  <span className="badge bg-secondary">{levelLabel(session.adminLevel)}</span>
                </span>
              </li>
              <li className="nav-item">
                <Link
                  className={`nav-link ${isActive("/sub/my_account") ? "active" : ""}`}
                  href="/sub/my_account"
                >
                  내 계정
                </Link>
              </li>
              <li className="nav-item">
                <form method="post" action="/api/logout" style={{ display: "inline" }}>
                  <button type="submit" className="nav-link" style={{ background: "none", border: "none", padding: "0.5rem 0.85rem" }}>
                    로그아웃
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main className="container-fluid py-3">{children}</main>

      <footer className="text-center text-muted py-3 small">
        &copy; {new Date().getFullYear()} CONTROL Admin
      </footer>

      <Script src="https://code.jquery.com/jquery-3.7.1.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js" strategy="afterInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/l10n/ko.js" strategy="afterInteractive" />
      <Script src="/assets/js/admin.js" strategy="afterInteractive" />
    </>
  );
}
