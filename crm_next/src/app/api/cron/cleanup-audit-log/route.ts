import { NextResponse, type NextRequest } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

// Vercel Cron 또는 수동 호출용. 프로덕션에서는 Authorization: Bearer <CRON_SECRET> 요구.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authz = req.headers.get("authorization") ?? "";
    if (authz !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const retain = Math.max(1, Number(sp.get("days") ?? 90));
  const dryRun = sp.get("dry_run") === "1" || sp.get("dryrun") === "1";

  const cntRow = await queryOne<RowDataPacket & { cnt: number }>(
    "SELECT COUNT(*) AS cnt FROM audit_log WHERE reg_date < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [retain]
  );
  const target = Number(cntRow?.cnt ?? 0);
  const mode = dryRun ? "DRY RUN" : "DELETE";
  const now = new Date().toISOString();

  if (target === 0) {
    return NextResponse.json({ ok: true, mode, retain_days: retain, target, deleted: 0, now });
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, mode, retain_days: retain, target, deleted: 0, now, note: "Dry-run complete. No rows deleted." });
  }

  const res = await execute(
    "DELETE FROM audit_log WHERE reg_date < DATE_SUB(NOW(), INTERVAL ? DAY)",
    [retain]
  );
  const deleted = res.affectedRows;

  // 정리 자체도 감사 로그에 기록 (시스템 액터)
  await auditLog({
    action: "cleanup",
    entityType: "audit_log",
    detail: { retain_days: retain, deleted },
    actor: { adminIdx: null, adminId: "system.cron" },
  });

  return NextResponse.json({ ok: true, mode, retain_days: retain, target, deleted, now });
}
