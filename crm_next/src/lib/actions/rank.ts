"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import { CHANNEL_MAP, channelValid, type ChannelKey } from "@/lib/channels";
import type { RowDataPacket } from "mysql2";

type WorkRow = RowDataPacket & {
  idx: number;
  rank_first: number | null;
  rank_current: number | null;
  seller_idx: number;
};

export async function addRank(formData: FormData) {
  const s = await requireSession();
  const channel = String(formData.get("channel") ?? "");
  if (!channelValid(channel)) return;
  const workIdx = Number(formData.get("work_idx") ?? 0);
  const keywordRaw = String(formData.get("keyword") ?? "").trim();
  const rankRaw = String(formData.get("rank") ?? "").trim();
  const checkDateRaw = String(formData.get("check_date") ?? "").trim();
  const memoRaw = String(formData.get("memo") ?? "").trim();
  if (workIdx <= 0) return;

  const ch = channel as ChannelKey;
  const table = CHANNEL_MAP[ch].table;

  // 스코프 가드
  const scopeSql = s.adminLevel === 3 ? " AND seller_idx = ?" : "";
  const scopeParams = s.adminLevel === 3 ? [s.adminIdx] : [];
  const work = await queryOne<WorkRow>(
    `SELECT idx, rank_first, rank_current, seller_idx FROM ${table} WHERE idx = ?${scopeSql} LIMIT 1`,
    [workIdx, ...scopeParams]
  );
  if (!work) {
    redirect(`/rank?channel=${ch}&work_idx=${workIdx}&error=${encodeURIComponent("권한이 없거나 존재하지 않는 작업입니다.")}`);
  }

  if (rankRaw === "" && memoRaw === "") {
    redirect(`/rank?channel=${ch}&work_idx=${workIdx}&keyword=${encodeURIComponent(keywordRaw)}&warn=${encodeURIComponent("순위 또는 메모 중 하나는 입력해야 합니다.")}`);
  }

  const rankNum = rankRaw === "" ? null : Number(rankRaw);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(checkDateRaw);

  if (validDate) {
    await execute(
      `INSERT INTO rank_history (channel, work_idx, keyword, \`rank\`, memo, admin_idx, check_date)
       VALUES (?, ?, ?, ?, ?, ?, CONCAT(?, ' ', CURRENT_TIME()))`,
      [ch, workIdx, keywordRaw, rankNum, memoRaw || null, s.adminIdx, checkDateRaw]
    );
  } else {
    await execute(
      `INSERT INTO rank_history (channel, work_idx, keyword, \`rank\`, memo, admin_idx, check_date)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [ch, workIdx, keywordRaw, rankNum, memoRaw || null, s.adminIdx]
    );
  }

  if (rankNum !== null) {
    const sets: string[] = ["rank_current = ?"];
    const params: (number | null)[] = [rankNum];
    if (work!.rank_first === null) {
      sets.push("rank_first = ?");
      params.push(rankNum);
    }
    if (work!.rank_current !== null && Number(work!.rank_current) !== rankNum) {
      sets.push("rank_yesterday = ?");
      params.push(Number(work!.rank_current));
    }
    params.push(workIdx);
    await execute(`UPDATE ${table} SET ${sets.join(", ")} WHERE idx = ?`, params);
  }

  await auditLog({
    action: "rank_add",
    entityType: "rank_history",
    detail: { channel: ch, work_idx: workIdx, rank: rankNum, memo: memoRaw },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId ?? null },
  });

  revalidatePath("/rank");
  redirect(`/rank?channel=${ch}&work_idx=${workIdx}&keyword=${encodeURIComponent(keywordRaw)}&saved=1`);
}
