<?php
/**
 * 초기 슈퍼 어드민 계정 생성 스크립트
 * 브라우저에서 /crm_admin/setup_admin.php 로 한 번 접속 후 파일 삭제 또는 이름 변경 권장.
 *
 * 기본 계정: admin / admin1234
 * 기존 admin 계정이 있으면 아무 작업도 하지 않음.
 */

require_once __DIR__ . '/include/db.php';
require_once __DIR__ . '/include/func.php';

header('Content-Type: text/html; charset=utf-8');

$default_id   = 'admin';
$default_pw   = 'admin1234';
$default_name = '슈퍼관리자';

$check = mysqli_query($conn, "SELECT idx FROM admin WHERE id = '" . esc($default_id) . "' LIMIT 1");
if ($check && mysqli_num_rows($check) > 0) {
    echo "<p>이미 '<code>{$default_id}</code>' 계정이 존재합니다. 추가 작업 없음.</p>";
    echo "<p><strong>보안상 이 파일(setup_admin.php)을 삭제하세요.</strong></p>";
    exit;
}

$hash = password_hash($default_pw, PASSWORD_DEFAULT);
$sql  = sprintf(
    "INSERT INTO admin (id, pw, name, level) VALUES ('%s', '%s', '%s', 1)",
    esc($default_id), esc($hash), esc($default_name)
);

if (mysqli_query($conn, $sql)) {
    echo "<h3>슈퍼 어드민 계정 생성 완료</h3>";
    echo "<ul>";
    echo "<li>ID: <code>{$default_id}</code></li>";
    echo "<li>PW: <code>{$default_pw}</code></li>";
    echo "</ul>";
    echo "<p><a href='/crm_admin/login.php'>로그인 페이지로 이동</a></p>";
    echo "<p><strong style='color:#dc3545;'>⚠ 보안상 반드시 이 파일(setup_admin.php)을 삭제하세요.</strong></p>";
} else {
    echo "<p>계정 생성 실패: " . h(mysqli_error($conn)) . "</p>";
}
