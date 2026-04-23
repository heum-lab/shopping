import { NextResponse, type NextRequest } from "next/server";

// 보호 경로: /dashboard, /sub, /api (단, /api/login은 제외)
const PROTECTED = [/^\/dashboard/, /^\/sub\//, /^\/api\/(?!login$)/];

function withPathname(req: NextRequest, res: NextResponse): NextResponse {
  res.headers.set("x-next-pathname", req.nextUrl.pathname);
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((re) => re.test(pathname));
  if (!needsAuth) {
    const res = NextResponse.next({ request: { headers: new Headers(req.headers) } });
    res.headers.set("x-next-pathname", pathname);
    // also propagate on request so server components can read it via headers()
    const h = new Headers(req.headers);
    h.set("x-next-pathname", pathname);
    return NextResponse.next({ request: { headers: h } });
  }

  const cookieName = process.env.SESSION_COOKIE_NAME ?? "control_session";
  const cookie = req.cookies.get(cookieName);
  if (!cookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("return", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  const h = new Headers(req.headers);
  h.set("x-next-pathname", pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = {
  matcher: [
    // 보호/미보호 모두 매칭해서 x-next-pathname을 꽂아준다 (정적 자산/_next 제외)
    "/((?!_next/|assets/|favicon\\.ico).*)",
  ],
};
