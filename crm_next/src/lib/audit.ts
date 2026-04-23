import { headers } from "next/headers";
import { execute } from "@/lib/db";

export type AuditActor = {
  adminIdx: number | null;
  adminId: string | null;
};

export async function auditLog(opts: {
  action: string;
  entityType: string;
  entityIdx?: number | null;
  detail?: unknown;
  actor: AuditActor;
}): Promise<void> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "";
  const ua = (h.get("user-agent") ?? "").slice(0, 255);

  const detailJson =
    opts.detail == null ? null : JSON.stringify(opts.detail);

  try {
    await execute(
      `INSERT INTO audit_log
        (admin_idx, admin_id, action, entity_type, entity_idx, detail, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.actor.adminIdx,
        opts.actor.adminId,
        opts.action,
        opts.entityType,
        opts.entityIdx ?? null,
        detailJson,
        ip,
        ua,
      ]
    );
  } catch {
    // 감사 로그 실패는 무시 (원본 PHP도 @mysqli_query로 suppress)
  }
}
