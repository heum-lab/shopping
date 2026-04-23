"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryOne, execute } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

const PAGE = "/sub/company_manage";

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

export async function createAgency(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const name = String(formData.get("name") ?? "").trim();
  const maketerIdx = Number(formData.get("maketer_idx") ?? 0);

  if (!name) flashRedirect("대행사명을 입력하세요.", returnUrl);
  const res = await execute(
    "INSERT INTO agency (name, maketer_idx) VALUES (?, ?)",
    [name, maketerIdx > 0 ? maketerIdx : null]
  );
  await auditLog({
    action: "insert",
    entityType: "agency",
    entityIdx: res.insertId,
    detail: { name, maketer_idx: maketerIdx || null },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function updateAgency(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx = Number(formData.get("idx") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const maketerIdx = Number(formData.get("maketer_idx") ?? 0);

  if (idx <= 0 || !name) flashRedirect("대행사명을 입력하세요.", returnUrl);
  await execute(
    "UPDATE agency SET name=?, maketer_idx=? WHERE idx=?",
    [name, maketerIdx > 0 ? maketerIdx : null, idx]
  );
  await auditLog({
    action: "update",
    entityType: "agency",
    entityIdx: idx,
    detail: { name, maketer_idx: maketerIdx || null },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function deleteAgency(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx = Number(formData.get("idx") ?? 0);
  if (idx <= 0) flashRedirect("잘못된 요청입니다.", returnUrl);

  const chk = await queryOne<RowDataPacket & { cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM seller WHERE agency_idx = ?",
    [idx]
  );
  if (Number(chk?.cnt ?? 0) > 0) {
    flashRedirect("소속 셀러가 존재해 삭제할 수 없습니다. 먼저 셀러를 이동/삭제하세요.", returnUrl);
  }

  const before = await queryOne<RowDataPacket & { name: string; maketer_idx: number | null }>(
    "SELECT name, maketer_idx FROM agency WHERE idx = ? LIMIT 1",
    [idx]
  );
  await execute("DELETE FROM agency WHERE idx = ?", [idx]);
  await auditLog({
    action: "delete",
    entityType: "agency",
    entityIdx: idx,
    detail: before,
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}
