<?php
/**
 * 세션 인증 가드
 * 로그인 필수 페이지 상단에서 include 한다.
 */

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (empty($_SESSION['admin_idx'])) {
    $return_url = urlencode($_SERVER['REQUEST_URI'] ?? '/crm_admin/');
    header('Location: /crm_admin/login.php?return=' . $return_url);
    exit;
}

$admin_idx        = (int)$_SESSION['admin_idx'];
$admin_id         = $_SESSION['admin_id']    ?? '';
$admin_name       = $_SESSION['admin_name']  ?? '';
$admin_level      = (int)($_SESSION['admin_level'] ?? 3);
$admin_agency_idx = (int)($_SESSION['admin_agency_idx'] ?? 0);
$admin_seller_idx = (int)($_SESSION['admin_seller_idx'] ?? 0);

/**
 * 권한 헬퍼
 * level: 1=슈퍼관리자(모든 계정/상품), 2=관리자(본인이 만든 대행사 관리), 3=대행사(본인 상품만)
 *  - 숫자가 작을수록 권한이 크다.
 */
function is_super() {
    global $admin_level;
    return $admin_level === 1;
}

function level_label($lv) {
    switch ((int)$lv) {
        case 1: return '슈퍼관리자';
        case 2: return '관리자';
        case 3: return '대행사';
        default: return '-';
    }
}

/**
 * 최소 권한 요구. 미달이면 403 처리.
 * 예) require_level(1) → 슈퍼 어드민만 통과
 */
function require_level($min_level) {
    global $admin_level;
    if ($admin_level > (int)$min_level) {
        http_response_code(403);
        echo '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>접근 거부</title>'
           . '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"></head>'
           . '<body class="p-5 text-center"><div class="container"><h3>403 접근 권한이 없습니다.</h3>'
           . '<p class="text-muted">이 페이지는 상위 권한 관리자만 이용할 수 있습니다.</p>'
           . '<a href="/crm_admin/sub/dashboard.php" class="btn btn-sm btn-dark">홈으로</a>'
           . '</div></body></html>';
        exit;
    }
}

function require_super() { require_level(1); }
