import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { SessionData } from "@/types/session";

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD ?? "dev-fallback-password-at-least-32-chars-long!",
  cookieName: process.env.SESSION_COOKIE_NAME ?? "control_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<Partial<SessionData>>(cookieStore, sessionOptions);
}

export async function requireSession(): Promise<SessionData> {
  const s = await getSession();
  if (!s.adminIdx) {
    throw new Error("UNAUTHORIZED");
  }
  return s as SessionData;
}

export function isSuper(level: number): boolean {
  return level === 1;
}

export function levelLabel(level: number): string {
  switch (level) {
    case 1: return "슈퍼관리자";
    case 2: return "관리자";
    case 3: return "대행사";
    default: return "-";
  }
}
