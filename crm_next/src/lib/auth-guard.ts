import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import type { SessionData } from "@/types/session";

export async function getAuthSession(returnPath?: string): Promise<SessionData> {
  const s = await getSession();
  if (!s.adminIdx) {
    const ret = returnPath ?? (await headers()).get("x-next-pathname") ?? "/dashboard";
    redirect(`/login?return=${encodeURIComponent(ret)}`);
  }
  return s as SessionData;
}

export async function requireLevel(min: 1 | 2 | 3): Promise<SessionData> {
  const s = await getAuthSession();
  if (s.adminLevel > min) {
    redirect("/403");
  }
  return s;
}
