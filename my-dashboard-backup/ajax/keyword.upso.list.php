<?php
/**
 * 대행사/셀러 동적 셀렉트 목록
 *
 * 파라미터:
 *   - maketer  : 마케터 ID → 해당 마케터 소속 대행사 목록
 *   - agencys  : 대행사 ID → 해당 대행사 소속 셀러 목록
 *
 * 응답: JSON [{"id":1,"name":"..."}, ...]
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

header('Content-Type: application/json; charset=utf-8');

$maketer = p('maketer');
$agencys = p('agencys');

$rows = [];

if ($agencys !== '') {
    // 신 모델: 대행사 계정 = level=3 admin
    $res = mysqli_query($conn,
        "SELECT idx AS id, name FROM admin WHERE level = 3 ORDER BY name"
    );
    while ($row = mysqli_fetch_assoc($res)) $rows[] = $row;
} elseif ($maketer !== '') {
    $res = mysqli_query($conn,
        "SELECT idx AS id, name
         FROM agency
         WHERE maketer_idx = " . (int)$maketer . "
         ORDER BY name"
    );
    while ($row = mysqli_fetch_assoc($res)) $rows[] = $row;
} else {
    $res = mysqli_query($conn, "SELECT idx AS id, name FROM agency ORDER BY name");
    while ($row = mysqli_fetch_assoc($res)) $rows[] = $row;
}

echo json_encode($rows, JSON_UNESCAPED_UNICODE);
