<?php
/**
 * CSV 다운로드 핸들러 (UTF-8 with BOM, Excel에서 바로 열림)
 *
 * 파라미터:
 *   - channel  : naver | place | inflow | blog | ohouse | kakao | auto (기본 naver)
 *   - xls_mode : template → 빈 양식 + 샘플 행
 *                search   → 현재 검색 조건 목록 전체 내보내기
 *
 * search 모드는 각 채널 페이지와 동일한 pass_* 파라미터를 사용한다.
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel  = p('channel', 'naver');
$xls_mode = p('xls_mode', 'template');

if (!channel_valid($channel)) {
    http_response_code(400);
    die('Invalid channel.');
}
$table = channel_table($channel);
$label = channel_label($channel);

$columns = [
    'agency_name'  => '대행사',
    'seller_name'  => '셀러',
    'keyword'      => '키워드',
    'keyword_sub1' => '서브키워드1',
    'keyword_sub2' => '서브키워드2',
    'keyword_type' => '광고타입',
    'product_mid'  => '상품MID',
    'product_url'  => '상품URL',
    'compare_mid'  => '가격비교MID',
    'compare_url'  => '가격비교URL',
    'inflow_count' => '유입수',
    'start_date'   => '시작일',
    'end_date'     => '종료일',
    'order_date'   => '주문일',
    'payment_date' => '입금일',
    'status'       => '상태',
    'memo'         => '비고',
];

$filename_prefix = ($xls_mode === 'template') ? "{$channel}_template" : "{$channel}_list";
$filename        = $filename_prefix . '_' . date('Ymd_His') . '.csv';

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache');

// UTF-8 BOM → Excel 한글 정상 표시
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');
fputcsv($out, array_values($columns));

if ($xls_mode === 'template') {
    // 샘플 행 한 줄 (채널 라벨만 조금 반영)
    fputcsv($out, [
        '샘플대행사', '샘플셀러', '여름 원피스', '쉬폰원피스', '',
        ($channel === 'naver' ? '쇼검' : $label . '타입'),
        '12345678',
        ($channel === 'naver' ? 'https://smartstore.naver.com/sample/products/12345678' : 'https://example.com/target-url'),
        '', '', '500',
        date('Y-m-d'), date('Y-m-d', strtotime('+30 days')),
        '', '', '대기', '엑셀 대량 등록 샘플',
    ]);
    fclose($out);
    exit;
}

// ------------------------------------------------------------
// search mode: 각 채널 페이지의 WHERE 구성 재사용
// ------------------------------------------------------------
$pass_assign     = p('pass_assign');
$pass_assign3    = p('pass_assign3');
$pass_status     = p('pass_status');
$pass_date_type  = p('pass_date_type', 'start_date');
$pass_date       = p('pass_date');
$pass_date2      = p('pass_date2');
$pass_input_type = p('pass_input_type', 'seller_name');
$pass_input      = p('pass_input');

$where = ['1=1'];

// 대행사(level=3) 는 본인이 등록한 작업만 다운로드
if ($admin_level === 3) $where[] = "w.seller_idx = " . (int)$admin_idx;

if (is_super() && $pass_assign3 !== '')       $where[] = "w.agency_idx = " . (int)$pass_assign3;
if ($admin_level <= 3 && $pass_assign !== '') $where[] = "w.seller_idx = " . (int)$pass_assign;
if ($pass_status !== '')                      $where[] = "w.status = '" . esc($pass_status) . "'";

$date_col_map = [
    'start_date'  => 'w.start_date',
    'end_date'    => 'w.end_date',
    'order_date'  => 'w.order_date',
    'refund_date' => 'w.refund_date',
];
$date_col = $date_col_map[$pass_date_type] ?? 'w.start_date';
if ($pass_date  !== '') $where[] = "{$date_col} >= '" . esc($pass_date)  . "'";
if ($pass_date2 !== '') $where[] = "{$date_col} <= '" . esc($pass_date2) . "'";

if ($pass_input !== '') {
    $kw = esc($pass_input);
    switch ($pass_input_type) {
        case 'seller_name': $where[] = "s.name LIKE '%{$kw}%'"; break;
        case 'keyword':     $where[] = "w.keyword LIKE '%{$kw}%'"; break;
        case 'product_mid': $where[] = "w.product_mid = '{$kw}'"; break;
    }
}
$where_sql = implode(' AND ', $where);

$sql = "SELECT w.*, s.name AS seller_name, a.name AS agency_name
        FROM {$table} w
        LEFT JOIN seller s ON s.idx = w.seller_idx
        LEFT JOIN agency a ON a.idx = w.agency_idx
        WHERE {$where_sql}
        ORDER BY w.reg_date DESC";
$res = mysqli_query($conn, $sql);

while ($r = mysqli_fetch_assoc($res)) {
    fputcsv($out, [
        $r['agency_name'],
        $r['seller_name'],
        $r['keyword'],
        $r['keyword_sub1'],
        $r['keyword_sub2'],
        $r['keyword_type'],
        $r['product_mid'],
        $r['product_url'],
        $r['compare_mid'],
        $r['compare_url'],
        $r['inflow_count'],
        $r['start_date'],
        $r['end_date'],
        $r['order_date'],
        $r['payment_date'],
        $r['status'],
        $r['memo'],
    ]);
}

fclose($out);
