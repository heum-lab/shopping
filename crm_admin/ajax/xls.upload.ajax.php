<?php
/**
 * CSV 대량 등록 업로드 핸들러 (전 채널 지원)
 *
 * POST
 *   - excel_file : CSV 파일 (UTF-8, BOM 자동 처리)
 *   - channel    : naver | place | inflow | blog | ohouse | kakao | auto (기본 naver)
 *
 * 응답: JSON { result, inserted, skipped, errors[] }
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

header('Content-Type: application/json; charset=utf-8');

// 모든 권한이 엑셀 업로드 가능

function fail($msg, $extra = []) {
    echo json_encode(array_merge(['result' => 'fail', 'msg' => $msg], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

$channel = p('channel', 'naver');
if (!channel_valid($channel)) fail('알 수 없는 채널입니다.');
$table = channel_table($channel);

if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
    fail('파일 업로드에 실패했습니다.');
}

$file = $_FILES['excel_file'];
$ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['csv', 'txt'], true)) {
    fail('CSV 파일만 업로드 가능합니다. (Excel에서 "CSV UTF-8"으로 내보내기 하세요)');
}
if ($file['size'] > 10 * 1024 * 1024) {
    fail('파일 크기는 10MB를 초과할 수 없습니다.');
}

$fp = fopen($file['tmp_name'], 'r');
if (!$fp) fail('파일을 열 수 없습니다.');

// UTF-8 BOM 건너뛰기
$bom = fread($fp, 3);
if ($bom !== "\xEF\xBB\xBF") rewind($fp);

// 1행: 헤더 (무시, 순서 기준으로 읽음)
$header = fgetcsv($fp);
if (!$header) fail('파일이 비어있습니다.');

// -------------------------------------------------------------
// 대행사/셀러 이름 → idx 매핑 캐시
// -------------------------------------------------------------
$agency_map = [];
$res = mysqli_query($conn, "SELECT idx, name FROM agency");
while ($a = mysqli_fetch_assoc($res)) $agency_map[trim($a['name'])] = (int)$a['idx'];

$seller_map = [];
$res = mysqli_query($conn, "SELECT idx, name, agency_idx FROM seller");
while ($s = mysqli_fetch_assoc($res)) {
    $seller_map[trim($s['name']) . '::' . (int)$s['agency_idx']] = (int)$s['idx'];
}

// -------------------------------------------------------------
// 유효성 체크용 화이트리스트
// - 상태는 전 채널 공통
// - 광고타입은 네이버쇼핑만 엄격 검증 (다른 채널은 자유 텍스트 허용)
// -------------------------------------------------------------
$valid_status = ['대기','작업중','중지','환불요청','환불완료','연장처리','작업완료','삭제요청'];
$valid_type   = ['통검','쇼검','통+쇼검','랜딩페이지','플러스스토어','기타유입','기타유입L','원픽플러스','팝콘','팝핀'];
$strict_type_check = ($channel === 'naver');

$errors   = [];
$rows     = [];
$line_no  = 1;

while (($row = fgetcsv($fp)) !== false) {
    $line_no++;
    if (count(array_filter($row, fn($v) => trim((string)$v) !== '')) === 0) continue; // 빈 줄

    // 컬럼 순서 (템플릿과 동일)
    [$agency_name, $seller_name, $keyword, $keyword_sub1, $keyword_sub2,
     $keyword_type, $product_mid, $product_url, $compare_mid, $compare_url,
     $inflow_count, $start_date, $end_date, $order_date, $payment_date,
     $status, $memo] = array_pad($row, 17, '');

    $agency_name  = trim($agency_name);
    $seller_name  = trim($seller_name);
    $keyword      = trim($keyword);
    $keyword_type = trim($keyword_type);
    $product_mid  = trim($product_mid);
    $product_url  = trim($product_url);
    $status       = trim($status) !== '' ? trim($status) : '대기';

    // 필수값 검증
    $missing = [];
    if ($agency_name === '') $missing[] = '대행사';
    if ($seller_name === '') $missing[] = '셀러';
    if ($keyword     === '') $missing[] = '키워드';
    if ($product_mid === '') $missing[] = '상품MID';
    if ($product_url === '') $missing[] = '상품URL';
    if ($keyword_type === '') $missing[] = '광고타입';
    if (!empty($missing)) {
        $errors[] = "{$line_no}행: 필수값 누락 (" . implode(', ', $missing) . ")";
        continue;
    }

    // 대행사 매핑
    if (!isset($agency_map[$agency_name])) {
        $errors[] = "{$line_no}행: 존재하지 않는 대행사 '{$agency_name}'";
        continue;
    }
    $agency_idx = $agency_map[$agency_name];

    // 셀러 매핑
    $seller_key = $seller_name . '::' . $agency_idx;
    if (!isset($seller_map[$seller_key])) {
        $errors[] = "{$line_no}행: 대행사 '{$agency_name}' 소속이 아닌 셀러 '{$seller_name}'";
        continue;
    }
    $seller_idx = $seller_map[$seller_key];

    // 광고타입 검증 (네이버쇼핑만 엄격)
    if ($strict_type_check && !in_array($keyword_type, $valid_type, true)) {
        $errors[] = "{$line_no}행: 지원하지 않는 광고타입 '{$keyword_type}'";
        continue;
    }

    // 상태 검증
    if (!in_array($status, $valid_status, true)) {
        $errors[] = "{$line_no}행: 지원하지 않는 상태 '{$status}'";
        continue;
    }

    $rows[] = [
        'agency_idx'   => $agency_idx,
        'seller_idx'   => $seller_idx,
        'keyword'      => esc($keyword),
        'keyword_sub1' => esc(trim($keyword_sub1)),
        'keyword_sub2' => esc(trim($keyword_sub2)),
        'keyword_type' => esc($keyword_type),
        'product_mid'  => esc($product_mid),
        'product_url'  => esc($product_url),
        'compare_mid'  => esc(trim($compare_mid)),
        'compare_url'  => esc(trim($compare_url)),
        'inflow_count' => (int)$inflow_count,
        'start_date'   => trim($start_date),
        'end_date'     => trim($end_date),
        'order_date'   => trim($order_date),
        'payment_date' => trim($payment_date),
        'status'       => esc($status),
        'memo'         => esc(trim($memo)),
    ];
}
fclose($fp);

// -------------------------------------------------------------
// 배치 INSERT (100건 단위)
// -------------------------------------------------------------
$inserted = 0;
$batch_size = 100;

$null_if_empty = fn($v) => $v === '' ? 'NULL' : "'" . esc($v) . "'";

for ($i = 0; $i < count($rows); $i += $batch_size) {
    $chunk = array_slice($rows, $i, $batch_size);
    $values = [];
    foreach ($chunk as $r) {
        $values[] = sprintf(
            "(%d, %d, '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', %d, %s, %s, %s, %s, '%s', '%s')",
            $r['agency_idx'], $r['seller_idx'],
            $r['keyword'], $r['keyword_sub1'], $r['keyword_sub2'],
            $r['keyword_type'], $r['product_mid'], $r['product_url'],
            $r['compare_mid'], $r['compare_url'],
            $r['inflow_count'],
            $null_if_empty($r['start_date']),
            $null_if_empty($r['end_date']),
            $null_if_empty($r['order_date']),
            $null_if_empty($r['payment_date']),
            $r['status'], $r['memo']
        );
    }
    $sql = "INSERT INTO {$table}
            (agency_idx, seller_idx, keyword, keyword_sub1, keyword_sub2,
             keyword_type, product_mid, product_url, compare_mid, compare_url,
             inflow_count, start_date, end_date, order_date, payment_date,
             status, memo)
            VALUES " . implode(',', $values);
    if (mysqli_query($conn, $sql)) {
        $inserted += count($chunk);
    } else {
        $errors[] = 'DB 저장 실패: ' . mysqli_error($conn);
    }
}

audit_log('upload_bulk', $table, null, [
    'channel'  => $channel,
    'inserted' => $inserted,
    'skipped'  => count($errors),
    'filename' => $file['name'],
]);

echo json_encode([
    'result'   => 'ok',
    'inserted' => $inserted,
    'skipped'  => count($errors),
    'errors'   => $errors,
], JSON_UNESCAPED_UNICODE);
