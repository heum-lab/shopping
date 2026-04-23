"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryOne, execute } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

type AdminRow = RowDataPacket & { pw: string };

export async function updateAdminName(formData: FormData) {
  const s = await requireSession();
  const newName = String(formData.get("new_name") ?? "").trim();
  if (!newName) redirect("/sub/my_account?error=" + encodeURIComponent("이름을 입력하세요."));

  await execute("UPDATE admin SET name = ? WHERE idx = ?", [newName, s.adminIdx]);

  // 세션 이름 동기화
  const session = await getSession();
  session.adminName = newName;
  await session.save();

  revalidatePath("/sub/my_account");
  redirect("/sub/my_account?message=" + encodeURIComponent("이름을 변경했습니다."));
}

export async function updateAdminPassword(formData: FormData) {
  const s = await requireSession();
  const current = String(formData.get("current_pw") ?? "");
  const new1    = String(formData.get("new_pw")     ?? "");
  const new2    = String(formData.get("new_pw2")    ?? "");

  const me = await queryOne<AdminRow>("SELECT pw FROM admin WHERE idx = ? LIMIT 1", [s.adminIdx]);
  if (!me || !(await bcrypt.compare(current, me.pw))) {
    redirect("/sub/my_account?error=" + encodeURIComponent("현재 비밀번호가 일치하지 않습니다."));
  }
  if (new1.length < 8) {
    redirect("/sub/my_account?error=" + encodeURIComponent("새 비밀번호는 8자 이상이어야 합니다."));
  }
  if (new1 !== new2) {
    redirect("/sub/my_account?error=" + encodeURIComponent("새 비밀번호 확인이 일치하지 않습니다."));
  }

  const hash = await bcrypt.hash(new1, 10);
  await execute("UPDATE admin SET pw = ? WHERE idx = ?", [hash, s.adminIdx]);
  await auditLog({
    action: "change_pw",
    entityType: "admin",
    entityIdx: s.adminIdx,
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });

  revalidatePath("/sub/my_account");
  redirect("/sub/my_account?message=" + encodeURIComponent("비밀번호를 변경했습니다."));
}
