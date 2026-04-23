<?php
/**
 * 감사 로그 헬퍼
 *
 * 사용 예:
 *   audit_log('login',   'auth');
 *   audit_log('insert',  'agency', $new_idx, ['name' => $name]);
 *   audit_log('update',  'naver_shopping_work', $idx, ['before' => $old, 'after' => $new]);
 *   audit_log('bulk_update', 'place_work', null, ['mode' => 'etc_date_act', 'ids' => $ids, 'days' => 10]);
 *
 * $actor 는 세션에서 자동 수집. 로그인 직전(아직 세션이 없을 때)에는
 * $actor = ['admin_idx' => $idx, 'admin_id' => $id] 를 명시적으로 전달한다.
 */

if (!function_exists('audit_log')) {

function audit_log($action, $entity_type, $entity_idx = null, $detail = null, array $actor = null) {
    global $conn;

    if ($actor === null) {
        $actor_idx = isset($_SESSION['admin_idx']) ? (int)$_SESSION['admin_idx'] : null;
        $actor_id  = $_SESSION['admin_id'] ?? null;
    } else {
        $actor_idx = isset($actor['admin_idx']) ? (int)$actor['admin_idx'] : null;
        $actor_id  = $actor['admin_id'] ?? null;
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

    $detail_json = '';
    if ($detail !== null) {
        $detail_json = json_encode($detail, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    }

    $sql = sprintf(
        "INSERT INTO audit_log
            (admin_idx, admin_id, action, entity_type, entity_idx, detail, ip, user_agent)
         VALUES
            (%s, %s, '%s', '%s', %s, %s, '%s', '%s')",
        $actor_idx !== null ? $actor_idx : 'NULL',
        $actor_id  !== null ? "'" . esc($actor_id) . "'" : 'NULL',
        esc($action),
        esc($entity_type),
        $entity_idx !== null ? (int)$entity_idx : 'NULL',
        $detail_json !== '' ? "'" . esc($detail_json) . "'" : 'NULL',
        esc($ip),
        esc($ua)
    );

    @mysqli_query($conn, $sql);
}

}
