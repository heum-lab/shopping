import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

type AdminRow = RowDataPacket & {
  idx: number;
  id: string;
  pw: string;
  name: string;
  level: number;
  agency_idx: number | null;
  seller_idx: number | null;
};

function safeReturn(raw: string | null): string {
  if (!raw) return "/dashboard";
  // allow only same-site, same-app paths
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = (form.get("id") ?? "").toString().trim();
  const pw = (form.get("pw") ?? "").toString();
  const ret = safeReturn((form.get("return") ?? "").toString() || null);

  if (!id || !pw) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("아이디와 비밀번호를 입력하세요.")}&return=${encodeURIComponent(ret)}`,
        req.url
      ),
      { status: 303 }
    );
  }

  const row = await queryOne<AdminRow>(
    "SELECT idx, id, pw, name, level, agency_idx, seller_idx FROM admin WHERE id = ? LIMIT 1",
    [id]
  );

  // PHP password_hash 기본값 = bcrypt($2y$). bcryptjs가 동일 해시 검증 가능.
  const ok = !!row && (await bcrypt.compare(pw, row.pw));

  if (!ok) {
    await auditLog({
      action: "login_fail",
      entityType: "auth",
      detail: { attempted_id: id },
      actor: { adminIdx: null, adminId: null },
    });
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다.")}&return=${encodeURIComponent(ret)}`,
        req.url
      ),
      { status: 303 }
    );
  }

  const session = await getSession();
  session.adminIdx = Number(row!.idx);
  session.adminId = row!.id;
  session.adminName = row!.name;
  session.adminLevel = Number(row!.level) as 1 | 2 | 3;
  session.adminAgencyIdx = Number(row!.agency_idx ?? 0);
  session.adminSellerIdx = Number(row!.seller_idx ?? 0);
  await session.save();

  await auditLog({
    action: "login",
    entityType: "auth",
    entityIdx: Number(row!.idx),
    detail: { level: Number(row!.level) },
    actor: { adminIdx: Number(row!.idx), adminId: row!.id },
  });

  return NextResponse.redirect(new URL(ret, req.url), { status: 303 });
}
