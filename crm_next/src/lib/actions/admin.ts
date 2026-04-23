"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryOne, execute } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

const PAGE = "/sub/admin_manage";

function flashRedirect(err: string, returnUrl?: string) {
  const target = returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : PAGE;
  const sep = target.includes("?") ? "&" : "?";
  redirect(`${target}${sep}error=${encodeURIComponent(err)}`);
}

function okRedirect(returnUrl?: string) {
  const target = returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : PAGE;
  revalidatePath(PAGE);
  redirect(target);
}

type AdminRow = RowDataPacket & {
  idx: number;
  id: string;
  name: string;
  level: number;
  created_by: number | null;
};

export async function createAdmin(formData: FormData) {
  const s = await requireSession();
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const id          = String(formData.get("id") ?? "").trim();
  const pw          = String(formData.get("pw") ?? "");
  const name        = String(formData.get("admin_name") ?? "").trim();
  const agencyName  = String(formData.get("agency_name") ?? "").trim();
  const level       = Number(formData.get("level") ?? 3);

  const allowedLevels = s.adminLevel === 1 ? [2, 3] : s.adminLevel === 2 ? [3] : [];
  if (!allowedLevels.includes(level)) flashRedirect("해당 권한 등록 권한이 없습니다.", returnUrl);
  if (!id || !pw || !name) flashRedirect("아이디/비밀번호/이름은 필수입니다.", returnUrl);
  if (pw.length < 8) flashRedirect("비밀번호는 8자 이상이어야 합니다.", returnUrl);

  const dup = await queryOne<RowDataPacket>("SELECT idx FROM admin WHERE id = ? LIMIT 1", [id]);
  if (dup) flashRedirect("이미 존재하는 아이디입니다.", returnUrl);

  const hash = await bcrypt.hash(pw, 10);
  const res = await execute(
    "INSERT INTO admin (id, pw, name, agency_name, level, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    [id, hash, name, agencyName || null, level, s.adminIdx]
  );
  await auditLog({
    action: "insert",
    entityType: "admin",
    entityIdx: res.insertId,
    detail: { id, name, agency_name: agencyName, level, created_by: s.adminIdx },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function deleteAdmin(formData: FormData) {
  const s = await requireSession();
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx = Number(formData.get("idx") ?? 0);

  if (idx <= 0) flashRedirect("잘못된 요청입니다.", returnUrl);
  if (idx === s.adminIdx) flashRedirect("본인 계정은 삭제할 수 없습니다.", returnUrl);

  const target = await queryOne<AdminRow>(
    "SELECT idx, id, name, level, created_by FROM admin WHERE idx = ? LIMIT 1",
    [idx]
  );
  if (!target) flashRedirect("대상 계정을 찾을 수 없습니다.", returnUrl);
  if (s.adminLevel === 2 && Number(target!.created_by ?? 0) !== s.adminIdx) {
    flashRedirect("본인이 등록한 계정만 삭제할 수 있습니다.", returnUrl);
  }

  await execute("DELETE FROM admin WHERE idx = ?", [idx]);
  await auditLog({
    action: "delete",
    entityType: "admin",
    entityIdx: idx,
    detail: { id: target!.id, name: target!.name, level: target!.level, created_by: target!.created_by },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function updateAdmin(formData: FormData) {
  const s = await requireSession();
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx   = Number(formData.get("idx") ?? 0);
  const name  = String(formData.get("name") ?? "").trim();
  const agencyName = String(formData.get("agency_name") ?? "").trim();
  const level = Number(formData.get("level") ?? 3);
  const newPw = String(formData.get("new_pw") ?? "");

  if (idx <= 0 || !name) flashRedirect("이름은 필수입니다.", returnUrl);

  // 권한 체크: 슈퍼는 모두, 관리자는 본인이 만든 대상만
  if (s.adminLevel !== 1) {
    const target = await queryOne<AdminRow>(
      "SELECT level, created_by FROM admin WHERE idx = ? LIMIT 1",
      [idx]
    );
    if (!target) flashRedirect("대상 계정을 찾을 수 없습니다.", returnUrl);
    if (Number(target!.created_by ?? 0) !== s.adminIdx) {
      flashRedirect("본인이 등록한 계정만 수정할 수 있습니다.", returnUrl);
    }
  }

  const allowedLevels = s.adminLevel === 1 ? [1, 2, 3] : [3];
  if (!allowedLevels.includes(level)) flashRedirect("해당 권한 등록 권한이 없습니다.", returnUrl);
  if (newPw && newPw.length < 8) flashRedirect("비밀번호는 8자 이상이어야 합니다.", returnUrl);

  if (newPw) {
    const hash = await bcrypt.hash(newPw, 10);
    await execute(
      "UPDATE admin SET name=?, agency_name=?, level=?, agency_idx=NULL, seller_idx=NULL, pw=? WHERE idx=?",
      [name, agencyName || null, level, hash, idx]
    );
  } else {
    await execute(
      "UPDATE admin SET name=?, agency_name=?, level=?, agency_idx=NULL, seller_idx=NULL WHERE idx=?",
      [name, agencyName || null, level, idx]
    );
  }
  await auditLog({
    action: "update",
    entityType: "admin",
    entityIdx: idx,
    detail: { name, agency_name: agencyName, level, pw_changed: !!newPw },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}
