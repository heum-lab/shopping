"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import { CHANNEL_MAP, channelValid, type ChannelKey } from "@/lib/channels";
import type { RowDataPacket } from "mysql2";

function pagePath(channel: ChannelKey): string {
  return `/sub/info_acc_${channel}`;
}

function safeReturn(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  return url;
}

function okRedirect(channel: ChannelKey, returnUrl?: string) {
  revalidatePath(pagePath(channel));
  redirect(safeReturn(returnUrl, pagePath(channel)));
}

function emptyToNull(v: string): string | null {
  return v === "" ? null : v;
}

function fd(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function channelFromForm(formData: FormData): ChannelKey {
  const v = String(formData.get("channel") ?? "");
  if (!channelValid(v)) throw new Error("INVALID_CHANNEL");
  return v;
}

// ---------------------------------------------------------------------
// 단건 등록
// ---------------------------------------------------------------------
export async function insertWork(formData: FormData) {
  const s = await requireSession();
  const channel = channelFromForm(formData);
  const returnUrl = fd(formData, "return_url");
  const table = CHANNEL_MAP[channel].table;

  const agencyIdx = Number(formData.get("agency_idx") ?? 0);
  const sellerIdx = s.adminLevel === 3 ? s.adminIdx : Number(formData.get("seller_idx") ?? 0);
  const keyword = fd(formData, "keyword");

  if (!keyword || !sellerIdx) {
    redirect(`${pagePath(channel)}?error=${encodeURIComponent("셀러와 키워드는 필수입니다.")}`);
  }

  // 네이버 전용 확장 필드
  const naverExtra = channel === "naver"
    ? {
        ad_product: fd(formData, "ad_product"),
        compare_mid: fd(formData, "compare_mid"),
        compare_url: fd(formData, "compare_url"),
      }
    : { ad_product: "", compare_mid: "", compare_url: "" };

  const res = await execute(
    `INSERT INTO ${table}
       (agency_idx, seller_idx, ad_product, keyword, keyword_sub1, keyword_sub2,
        product_mid, product_url, compare_mid, compare_url, inflow_count, keyword_type,
        start_date, end_date, order_date, status, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agencyIdx,
      sellerIdx,
      naverExtra.ad_product,
      keyword,
      fd(formData, "keyword_sub1"),
      fd(formData, "keyword_sub2"),
      fd(formData, "product_mid"),
      fd(formData, "product_url"),
      naverExtra.compare_mid,
      naverExtra.compare_url,
      Number(formData.get("inflow_count") ?? 0),
      fd(formData, "keyword_type"),
      emptyToNull(fd(formData, "start_date")),
      emptyToNull(fd(formData, "end_date")),
      emptyToNull(fd(formData, "order_date")),
      fd(formData, "status") || "대기",
      fd(formData, "memo"),
    ]
  );
  await auditLog({
    action: "insert",
    entityType: table,
    entityIdx: res.insertId,
    detail: { channel, keyword, product_mid: fd(formData, "product_mid"), agency_idx: agencyIdx, seller_idx: sellerIdx },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(channel, returnUrl);
}

// ---------------------------------------------------------------------
// 일괄 상태 변경
// ---------------------------------------------------------------------
export async function bulkUpdateWork(formData: FormData) {
  const s = await requireSession();
  const channel = channelFromForm(formData);
  const mode = fd(formData, "mode");
  const returnUrl = fd(formData, "return_url");
  const table = CHANNEL_MAP[channel].table;

  const checkIdx = formData
    .getAll("check_idx[]")
    .map((v) => Number(v))
    .filter((v) => v > 0);
  if (checkIdx.length === 0) okRedirect(channel, returnUrl);

  // 대행사는 본인 작업만 대상
  const scope = s.adminLevel === 3 ? ` AND seller_idx = ${Number(s.adminIdx)}` : "";
  const placeholders = checkIdx.map(() => "?").join(",");

  await auditLog({
    action: "bulk_update",
    entityType: table,
    detail: { channel, mode, ids: checkIdx, count: checkIdx.length, extend_days: Number(formData.get("extend_days") ?? 0) },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });

  if (mode === "etc_date_act") {
    const days = Number(formData.get("extend_days") ?? 0);
    if (days > 0) {
      await execute(
        `UPDATE ${table}
            SET status = '연장처리',
                drive_days = ?,
                end_date = DATE_ADD(IFNULL(end_date, CURDATE()), INTERVAL ? DAY)
          WHERE idx IN (${placeholders})${scope}`,
        [String(days), days, ...checkIdx]
      );
    }
  } else if (mode === "move_working") {
    await execute(`UPDATE ${table} SET status = '작업중' WHERE idx IN (${placeholders})${scope}`, checkIdx);
  } else if (mode === "refund_req") {
    await execute(`UPDATE ${table} SET status = '환불요청', refund_date = CURDATE() WHERE idx IN (${placeholders})${scope}`, checkIdx);
  } else if (mode === "delete_req") {
    await execute(`UPDATE ${table} SET status = '삭제요청' WHERE idx IN (${placeholders})${scope}`, checkIdx);
  } else if (mode === "del_mode") {
    if (s.adminLevel !== 1) redirect(`${pagePath(channel)}?error=${encodeURIComponent("완전 삭제는 슈퍼관리자만 가능합니다.")}`);
    await execute(`DELETE FROM ${table} WHERE idx IN (${placeholders})${scope}`, checkIdx);
  }
  okRedirect(channel, returnUrl);
}

// ---------------------------------------------------------------------
// 상세 수정 (edit modal 저장)
// ---------------------------------------------------------------------
export async function updateWork(formData: FormData) {
  const s = await requireSession();
  const channel = channelFromForm(formData);
  const idx = Number(formData.get("idx") ?? 0);
  const returnUrl = fd(formData, "return_url");
  const table = CHANNEL_MAP[channel].table;
  if (idx <= 0) redirect(`${pagePath(channel)}?error=${encodeURIComponent("잘못된 요청입니다.")}`);

  // 대행사 스코프 가드
  if (s.adminLevel === 3) {
    const own = await queryOne<RowDataPacket>(
      `SELECT idx FROM ${table} WHERE idx = ? AND seller_idx = ? LIMIT 1`,
      [idx, s.adminIdx]
    );
    if (!own) redirect(`${pagePath(channel)}?error=${encodeURIComponent("권한이 없는 작업입니다.")}`);
  }

  const naverExtra = channel === "naver"
    ? [fd(formData, "compare_mid"), fd(formData, "compare_url"), fd(formData, "ad_product")]
    : ["", "", ""];

  await execute(
    `UPDATE ${table} SET
       agency_idx   = ?,
       seller_idx   = ?,
       keyword      = ?,
       keyword_sub1 = ?,
       keyword_sub2 = ?,
       product_mid  = ?,
       product_url  = ?,
       compare_mid  = ?,
       compare_url  = ?,
       ad_product   = ?,
       inflow_count = ?,
       keyword_type = ?,
       start_date   = ?,
       end_date     = ?,
       order_date   = ?,
       status       = ?,
       memo         = ?
     WHERE idx = ?`,
    [
      Number(formData.get("agency_idx") ?? 0),
      Number(formData.get("seller_idx") ?? 0),
      fd(formData, "keyword"),
      fd(formData, "keyword_sub1"),
      fd(formData, "keyword_sub2"),
      fd(formData, "product_mid"),
      fd(formData, "product_url"),
      naverExtra[0],
      naverExtra[1],
      naverExtra[2],
      Number(formData.get("inflow_count") ?? 0),
      fd(formData, "keyword_type"),
      emptyToNull(fd(formData, "start_date")),
      emptyToNull(fd(formData, "end_date")),
      emptyToNull(fd(formData, "order_date")),
      fd(formData, "status"),
      fd(formData, "memo"),
      idx,
    ]
  );
  await auditLog({
    action: "update",
    entityType: table,
    entityIdx: idx,
    detail: { channel, keyword: fd(formData, "keyword"), status: fd(formData, "status") },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId },
  });
  okRedirect(channel, returnUrl);
}
