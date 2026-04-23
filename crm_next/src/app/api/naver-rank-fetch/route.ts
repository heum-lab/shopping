import { NextResponse, type NextRequest } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { getSession } from "@/lib/session";
import { auditLog } from "@/lib/audit";
import type { RowDataPacket } from "mysql2";

type WorkRow = RowDataPacket & {
  idx: number;
  keyword: string;
  product_mid: string;
  rank_current: number | null;
  rank_first: number | null;
  seller_idx: number;
};

type FetchResult = {
  body: string | null;
  http: number;
  err: string | null;
};

async function fetchJson(url: string, headers: Record<string, string>): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const body = await res.text();
    return { body, http: res.status, err: null };
  } catch (e) {
    return { body: null, http: 0, err: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchNaverOpenApi(keyword: string, start: number): Promise<FetchResult> {
  const clientId = process.env.NAVER_API_CLIENT_ID ?? "";
  const clientSecret = process.env.NAVER_API_CLIENT_SECRET ?? "";
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=100&start=${start}&sort=sim`;
  return fetchJson(url, {
    "X-Naver-Client-Id": clientId,
    "X-Naver-Client-Secret": clientSecret,
    Accept: "application/json",
  });
}

async function fetchNaverShoppingPage(keyword: string, page: number): Promise<FetchResult> {
  const url = `https://search.shopping.naver.com/api/search/all?query=${encodeURIComponent(keyword)}&pagingIndex=${page}&pagingSize=80&sort=rel&productSet=total`;
  return fetchJson(url, {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    Referer: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
}

async function parseForm(req: NextRequest): Promise<URLSearchParams> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) params.set(k, String(v));
    return params;
  }
  return req.nextUrl.searchParams;
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const s = await getSession();
  if (!s.adminIdx) {
    return NextResponse.json({ result: "fail", msg: "UNAUTHORIZED" }, { status: 401 });
  }

  const form = await parseForm(req);
  const workIdx = Number(form.get("work_idx") ?? 0);
  const maxPages = Math.max(1, Math.min(Number(form.get("max_pages") ?? 5), 10));

  if (workIdx <= 0) {
    return NextResponse.json({ result: "fail", msg: "work_idx 가 필요합니다." });
  }

  const scopeSql = s.adminLevel === 3 ? " AND seller_idx = ?" : "";
  const scopeParams = s.adminLevel === 3 ? [s.adminIdx] : [];

  const work = await queryOne<WorkRow>(
    `SELECT idx, keyword, product_mid, rank_current, rank_first, seller_idx
       FROM naver_shopping_work WHERE idx = ?${scopeSql} LIMIT 1`,
    [workIdx, ...scopeParams]
  );
  if (!work) {
    return NextResponse.json({ result: "fail", msg: "권한이 없거나 존재하지 않는 작업입니다." });
  }

  const keyword = String(work.keyword ?? "").trim();
  const mid = String(work.product_mid ?? "").trim();
  if (!keyword || !mid) {
    return NextResponse.json({ result: "fail", msg: "키워드 또는 상품 MID 가 비어 있습니다." });
  }

  const useOfficial = !!process.env.NAVER_API_CLIENT_ID && !!process.env.NAVER_API_CLIENT_SECRET;

  let foundRank: number | null = null;
  let foundPage: number | null = null;
  let lastErr = "";

  if (useOfficial) {
    const pageSize = 100;
    for (let page = 1; page <= maxPages; page++) {
      const start = (page - 1) * pageSize + 1;
      if (start > 1000) break;
      const res = await fetchNaverOpenApi(keyword, start);
      if (res.err || res.http !== 200 || !res.body) {
        lastErr = `공식 API HTTP ${res.http} ${String(res.err ?? "").slice(0, 100)}`;
        break;
      }
      let json: unknown;
      try { json = JSON.parse(res.body); } catch { lastErr = "공식 API 응답 형식 오류"; break; }
      const items = (json as { items?: Array<{ productId?: string }> })?.items;
      if (!Array.isArray(items) || items.length === 0) break;
      for (let i = 0; i < items.length; i++) {
        const cand = String(items[i].productId ?? "");
        if (cand === mid) {
          foundRank = (page - 1) * pageSize + (i + 1);
          foundPage = page;
          break;
        }
      }
      if (foundRank !== null) break;
    }
  } else {
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetchNaverShoppingPage(keyword, page);
      if (res.err || res.http !== 200 || !res.body) {
        lastErr = `스크래핑 차단 가능 (HTTP ${res.http}). NAVER_API_CLIENT_ID/SECRET 환경변수 설정을 권장합니다.`;
        break;
      }
      let json: unknown;
      try { json = JSON.parse(res.body); } catch { lastErr = "JSON 파싱 실패"; break; }
      const jsonObj = json as {
        shoppingResult?: { products?: Array<Record<string, unknown>> };
        products?: Array<Record<string, unknown>>;
      };
      const products = jsonObj.shoppingResult?.products ?? jsonObj.products ?? null;
      if (!Array.isArray(products) || products.length === 0) {
        lastErr = "검색 결과가 비어 있음 (차단 가능성)";
        break;
      }
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const cands = [
          String(p["nvMid"] ?? ""),
          String(p["mallProductId"] ?? ""),
          String(p["productId"] ?? ""),
          String(p["id"] ?? ""),
        ];
        if (cands.includes(mid)) {
          foundRank = (page - 1) * 80 + (i + 1);
          foundPage = page;
          break;
        }
      }
      if (foundRank !== null) break;
    }
  }

  if (foundRank === null && lastErr !== "") {
    return NextResponse.json({
      result: "fail",
      rank: null,
      page: null,
      msg: `네이버 응답 오류: ${lastErr}`,
    });
  }

  // 이력 기록
  await execute(
    `INSERT INTO rank_history (channel, work_idx, keyword, \`rank\`, memo, admin_idx, check_date)
     VALUES ('naver', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      workIdx,
      keyword,
      foundRank,
      foundRank === null ? "자동조회: 진입 안됨" : "자동조회",
      s.adminIdx,
    ]
  );

  if (foundRank !== null) {
    const sets: string[] = ["rank_current = ?"];
    const params: (number | null)[] = [foundRank];
    if (work.rank_first === null) {
      sets.push("rank_first = ?");
      params.push(foundRank);
    }
    if (work.rank_current !== null && Number(work.rank_current) !== foundRank) {
      sets.push("rank_yesterday = ?");
      params.push(Number(work.rank_current));
    }
    params.push(workIdx);
    await execute(`UPDATE naver_shopping_work SET ${sets.join(", ")} WHERE idx = ?`, params);
  }

  await auditLog({
    action: "rank_fetch",
    entityType: "naver_shopping_work",
    entityIdx: workIdx,
    detail: { keyword, mid, rank: foundRank, page: foundPage },
    actor: { adminIdx: s.adminIdx, adminId: s.adminId ?? null },
  });

  return NextResponse.json({
    result: "ok",
    rank: foundRank,
    page: foundPage,
    msg:
      foundRank === null
        ? `상위 ${maxPages}페이지(약 ${maxPages * 80}건) 내에서 미발견`
        : `현재 ${foundRank}위 (페이지 ${foundPage})`,
  });
}
