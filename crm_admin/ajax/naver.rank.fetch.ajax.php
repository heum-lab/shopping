<?php
/**
 * 네이버쇼핑 순위 자동 조회
 *
 * GET/POST:
 *   - work_idx : naver_shopping_work.idx
 *   - max_pages: 검색 최대 페이지 (기본 5, 1페이지=80건)
 *
 * 동작:
 *   1) work_idx → keyword, product_mid 로드
 *   2) https://search.shopping.naver.com/api/search/all 에서 키워드 검색
 *   3) 결과의 product 배열을 nvMid 기준으로 매칭, 등장 순위 계산
 *   4) 찾으면 rank_history INSERT + naver_shopping_work 의 rank_first/rank_yesterday/rank_current 갱신
 *
 * 응답: JSON
 *   { result: 'ok'|'fail', rank: int|null, page: int|null, msg: string }
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

header('Content-Type: application/json; charset=utf-8');

$work_idx  = (int)p('work_idx');
$max_pages = max(1, min((int)p('max_pages', 5), 10));

if ($work_idx <= 0) {
    echo json_encode(['result' => 'fail', 'msg' => 'work_idx 가 필요합니다.']); exit;
}

// 스코프 체크 (대행사는 본인 작업만)
$scope_w = ['idx = ' . $work_idx];
if ($admin_level === 3) $scope_w[] = 'seller_idx = ' . (int)$admin_idx;

$work = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT idx, keyword, product_mid, rank_current, rank_first
     FROM naver_shopping_work
     WHERE " . implode(' AND ', $scope_w) . " LIMIT 1"
));
if (!$work) {
    echo json_encode(['result' => 'fail', 'msg' => '권한이 없거나 존재하지 않는 작업입니다.']); exit;
}

$keyword = trim((string)$work['keyword']);
$mid     = trim((string)$work['product_mid']);
if ($keyword === '' || $mid === '') {
    echo json_encode(['result' => 'fail', 'msg' => '키워드 또는 상품 MID 가 비어 있습니다.']); exit;
}

// ---------------------------------------------------------------
// Naver Shopping 검색 — 공식 Open API 우선, 없으면 검색 페이지 fallback
// 공식 API 응답: { items: [{ productId, mallName, ... }], total, ... }
// 페이지 사이즈가 100 (display 최대) 이라 page 환산 다름.
// ---------------------------------------------------------------
function fetch_naver_open_api($keyword, $start) {
    $url = 'https://openapi.naver.com/v1/search/shop.json'
         . '?query=' . urlencode($keyword)
         . '&display=100'
         . '&start=' . $start
         . '&sort=sim';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'X-Naver-Client-Id: '     . NAVER_API_CLIENT_ID,
            'X-Naver-Client-Secret: ' . NAVER_API_CLIENT_SECRET,
            'Accept: application/json',
        ],
    ]);
    $body = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['body' => $body, 'http' => $http, 'err' => $err];
}

function fetch_naver_shopping_page($keyword, $page) {
    $url = 'https://search.shopping.naver.com/api/search/all'
         . '?query=' . urlencode($keyword)
         . '&pagingIndex=' . $page
         . '&pagingSize=80'
         . '&sort=rel'
         . '&productSet=total';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json, text/plain, */*',
            'Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8',
            'Referer: https://search.shopping.naver.com/search/all?query=' . urlencode($keyword),
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        ],
    ]);
    $body = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    return ['body' => $body, 'http' => $http, 'err' => $err];
}

$use_official = defined('NAVER_API_CLIENT_ID') && NAVER_API_CLIENT_ID !== ''
             && defined('NAVER_API_CLIENT_SECRET') && NAVER_API_CLIENT_SECRET !== '';

$found_rank = null;
$found_page = null;
$last_err   = '';

if ($use_official) {
    // 공식 API: display=100, start=1,101,201,...,401
    $page_size = 100;
    for ($page = 1; $page <= $max_pages; $page++) {
        $start = ($page - 1) * $page_size + 1;
        if ($start > 1000) break;  // 공식 API start 최대 1000
        $res = fetch_naver_open_api($keyword, $start);
        if ($res['err'] || $res['http'] !== 200 || !$res['body']) {
            $last_err = "공식 API HTTP {$res['http']} " . substr((string)$res['err'], 0, 100);
            break;
        }
        $json = json_decode($res['body'], true);
        if (!is_array($json) || !isset($json['items']) || !is_array($json['items'])) {
            $last_err = '공식 API 응답 형식 오류';
            break;
        }
        if (empty($json['items'])) break;
        foreach ($json['items'] as $idx => $p) {
            $cands = [(string)($p['productId'] ?? '')];
            if (in_array($mid, $cands, true)) {
                $found_rank = ($page - 1) * $page_size + ($idx + 1);
                $found_page = $page;
                break 2;
            }
        }
    }
} else {
    for ($page = 1; $page <= $max_pages; $page++) {
        $res = fetch_naver_shopping_page($keyword, $page);
        if ($res['err'] || $res['http'] !== 200 || !$res['body']) {
            $last_err = "스크래핑 차단 가능 (HTTP {$res['http']}). db.php 의 NAVER_API_CLIENT_ID/SECRET 설정을 권장합니다.";
            break;
        }
        $json = json_decode($res['body'], true);
        if (!is_array($json)) { $last_err = 'JSON 파싱 실패 (네이버 응답 형식 변경 가능성)'; break; }

        $products = $json['shoppingResult']['products']
                 ?? $json['products']
                 ?? null;
        if (!is_array($products) || empty($products)) {
            $last_err = '검색 결과가 비어 있음 (차단 가능성)';
            break;
        }

        foreach ($products as $idx => $p) {
            $cands = [
                (string)($p['nvMid']         ?? ''),
                (string)($p['mallProductId'] ?? ''),
                (string)($p['productId']     ?? ''),
                (string)($p['id']            ?? ''),
            ];
            if (in_array($mid, $cands, true)) {
                $found_rank = ($page - 1) * 80 + ($idx + 1);
                $found_page = $page;
                break 2;
            }
        }
    }
}

// ---------------------------------------------------------------
// 결과 처리: 찾았든 못 찾았든 이력 기록
// ---------------------------------------------------------------
if ($found_rank === null && $last_err !== '') {
    echo json_encode([
        'result' => 'fail',
        'rank'   => null,
        'page'   => null,
        'msg'    => '네이버 응답 오류: ' . $last_err,
    ]); exit;
}

$rank_sql = $found_rank === null ? 'NULL' : (int)$found_rank;
mysqli_query($conn, sprintf(
    "INSERT INTO rank_history (channel, work_idx, keyword, `rank`, memo, admin_idx, check_date)
     VALUES ('naver', %d, '%s', %s, %s, %s, CURRENT_TIMESTAMP)",
    $work_idx, esc($keyword), $rank_sql,
    $found_rank === null ? "'자동조회: 진입 안됨'" : "'자동조회'",
    $admin_idx > 0 ? (int)$admin_idx : 'NULL'
));

if ($found_rank !== null) {
    $sets = ["rank_current = " . (int)$found_rank];
    if ($work['rank_first'] === null) $sets[] = "rank_first = " . (int)$found_rank;
    $prev = $work['rank_current'];
    if ($prev !== null && (int)$prev !== (int)$found_rank) {
        $sets[] = "rank_yesterday = " . (int)$prev;
    }
    mysqli_query($conn, "UPDATE naver_shopping_work SET " . implode(', ', $sets) . " WHERE idx = {$work_idx}");
}

audit_log('rank_fetch', 'naver_shopping_work', $work_idx, [
    'keyword' => $keyword, 'mid' => $mid,
    'rank' => $found_rank, 'page' => $found_page,
]);

echo json_encode([
    'result' => 'ok',
    'rank'   => $found_rank,
    'page'   => $found_page,
    'msg'    => $found_rank === null
        ? "상위 {$max_pages}페이지(약 " . ($max_pages * 80) . "건) 내에서 미발견"
        : "현재 {$found_rank}위 (페이지 {$found_page})",
]);
