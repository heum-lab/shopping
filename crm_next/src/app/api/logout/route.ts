import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";

async function handle(req: NextRequest) {
  const session = await getSession();
  const adminIdx = session.adminIdx ?? null;
  const adminId = session.adminId ?? null;
  if (adminIdx) {
    await auditLog({
      action: "logout",
      entityType: "auth",
      entityIdx: adminIdx,
      actor: { adminIdx, adminId },
    });
  }
  session.destroy();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

export const GET = handle;
export const POST = handle;
