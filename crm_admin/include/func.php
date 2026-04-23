<?php
/**
 * 공통 유틸 함수
 */

/**
 * DB 입력값 이스케이프
 */
function esc($str) {
    global $conn;
    if ($str === null) return '';
    return mysqli_real_escape_string($conn, (string)$str);
}

/**
 * HTML 출력 이스케이프
 */
function h($str) {
    return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
}

/**
 * URL 파라미터 getter (검색 폼 pass_* 파라미터 공통 처리)
 */
function p($key, $default = '') {
    if (isset($_GET[$key]))  return $_GET[$key];
    if (isset($_POST[$key])) return $_POST[$key];
    return $default;
}

/**
 * 간편 조회 날짜 범위 반환
 * @param string $shortcut today/yesterday/today_yesterday/7days/1m/3m/6m/12m/this_month/last_month
 * @return array{0:string,1:string} [시작일, 종료일] YYYY-MM-DD
 */
function date_shortcut($shortcut) {
    $today = date('Y-m-d');
    switch ($shortcut) {
        case 'today':
            return [$today, $today];
        case 'yesterday':
            $d = date('Y-m-d', strtotime('-1 day'));
            return [$d, $d];
        case 'today_yesterday':
            return [date('Y-m-d', strtotime('-1 day')), $today];
        case '7days':
            return [date('Y-m-d', strtotime('-7 days')), $today];
        case '1m':
            return [date('Y-m-d', strtotime('-1 month')), $today];
        case '3m':
            return [date('Y-m-d', strtotime('-3 months')), $today];
        case '6m':
            return [date('Y-m-d', strtotime('-6 months')), $today];
        case '12m':
            return [date('Y-m-d', strtotime('-12 months')), $today];
        case 'this_month':
            return [date('Y-m-01'), date('Y-m-t')];
        case 'last_month':
            $first = date('Y-m-01', strtotime('first day of last month'));
            $last  = date('Y-m-t',  strtotime('last day of last month'));
            return [$first, $last];
        default:
            return ['', ''];
    }
}

/**
 * 순위 변동 표시 (상승: ▲ 빨강 / 하락: ▼ 파랑)
 */
function rank_diff_html($current, $previous) {
    if ($current === null || $previous === null || $current === '' || $previous === '') {
        return '';
    }
    $diff = (int)$previous - (int)$current;
    if ($diff > 0) {
        return '<span style="color:#dc3545;">▲' . abs($diff) . '</span>';
    } elseif ($diff < 0) {
        return '<span style="color:#0d6efd;">▼' . abs($diff) . '</span>';
    }
    return '<span style="color:#6c757d;">-</span>';
}

/**
 * 상태 뱃지 HTML
 */
function status_badge($status, $drive_days = '') {
    $color_map = [
        '대기'       => '#6c757d',
        '작업중'     => '#0d6efd',
        '중지'       => '#fd7e14',
        '환불요청'   => '#dc3545',
        '환불완료'   => '#adb5bd',
        '연장처리'   => '#198754',
        '작업완료'   => '#20c997',
        '삭제요청'   => '#6f42c1',
    ];
    $color = $color_map[$status] ?? '#6c757d';
    $label = $status;
    if ($status === '연장처리' && trim((string)$drive_days) !== '') {
        $label .= ' ' . trim((string)$drive_days) . '일';
    }
    return '<span class="badge" style="background:' . $color . ';color:#fff;padding:3px 8px;border-radius:10px;font-size:12px;">' . h($label) . '</span>';
}

/**
 * 쿼리스트링 유지용: 현재 GET을 base로, $overrides로 덮어쓰기
 */
function build_qs($overrides = []) {
    $qs = array_merge($_GET, $overrides);
    foreach ($qs as $k => $v) {
        if ($v === '' || $v === null) unset($qs[$k]);
    }
    return http_build_query($qs);
}

// audit_log() 헬퍼를 모든 페이지에서 사용 가능하게 함께 로드
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/channels.php';
