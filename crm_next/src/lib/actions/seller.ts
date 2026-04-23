"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { queryOne, execute } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

const PAGE = "/sub/seller_manage";

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

function forceAgency(level: number, agencyIdx: number): number {
  return level === 2 && agencyIdx > 0 ? agencyIdx : 0;
}

export async function createSeller(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const name = String(formData.get("name") ?? "").trim();
  const managerName = String(formData.get("manager_name") ?? "").trim();
  const fa = forceAgency(s.adminLevel, s.adminAgencyIdx);
  const agencyIdx = fa > 0 ? fa : Number(formData.get("agency_idx") ?? 0);

  if (!name || agencyIdx <= 0) flashRedirect("셀러명과 대행사는 필수입니다.", returnUrl);

  const res = await execute(
    "INSERT INTO seller (name, manager_name, agency_idx) VALUES (?, ?, ?)",
    [name, managerName, agencyIdx]
  );
  await auditLog({
    action: "insert",
    entityType: "seller",
    entityIdx: res.insertId,
    detail: { name, manager_name: managerName, agency_idx: agencyIdx },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function updateSeller(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx = Number(formData.get("idx") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  const managerName = String(formData.get("manager_name") ?? "").trim();
  const fa = forceAgency(s.adminLevel, s.adminAgencyIdx);
  const agencyIdx = fa > 0 ? fa : Number(formData.get("agency_idx") ?? 0);

  if (idx <= 0 || !name || agencyIdx <= 0) flashRedirect("셀러명과 대행사는 필수입니다.", returnUrl);

  if (fa > 0) {
    const own = await queryOne<RowDataPacket>(
      "SELECT idx FROM seller WHERE idx = ? AND agency_idx = ?",
      [idx, fa]
    );
    if (!own) flashRedirect("권한이 없는 셀러입니다.", returnUrl);
  }

  await execute(
    "UPDATE seller SET name=?, manager_name=?, agency_idx=? WHERE idx=?",
    [name, managerName, agencyIdx, idx]
  );
  await auditLog({
    action: "update",
    entityType: "seller",
    entityIdx: idx,
    detail: { name, manager_name: managerName, agency_idx: agencyIdx },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}

export async function deleteSeller(formData: FormData) {
  const s = await requireSession();
  if (s.adminLevel > 2) flashRedirect("권한이 없습니다.");
  const returnUrl = String(formData.get("return_url") ?? PAGE);
  const idx = Number(formData.get("idx") ?? 0);
  if (idx <= 0) flashRedirect("잘못된 요청입니다.", returnUrl);

  const fa = forceAgency(s.adminLevel, s.adminAgencyIdx);
  if (fa > 0) {
    const own = await queryOne<RowDataPacket>(
      "SELECT idx FROM seller WHERE idx = ? AND agency_idx = ?",
      [idx, fa]
    );
    if (!own) flashRedirect("권한이 없는 셀러입니다.", returnUrl);
  }

  const chk = await queryOne<RowDataPacket & { cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM naver_shopping_work WHERE seller_idx = ?",
    [idx]
  );
  if (Number(chk?.cnt ?? 0) > 0) {
    flashRedirect("진행 중인 작업이 존재해 삭제할 수 없습니다. 먼저 작업을 정리하세요.", returnUrl);
  }

  const before = await queryOne<RowDataPacket & { name: string; agency_idx: number }>(
    "SELECT name, agency_idx FROM seller WHERE idx = ? LIMIT 1",
    [idx]
  );
  await execute("DELETE FROM seller WHERE idx = ?", [idx]);
  await auditLog({
    action: "delete",
    entityType: "seller",
    entityIdx: idx,
    detail: before,
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(returnUrl);
}
