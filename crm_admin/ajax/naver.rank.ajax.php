<?php
/**
 * 레거시 엔트리 — 통합 핸들러 channel.rank.ajax.php 로 리다이렉트.
 * 외부 북마크나 오래된 링크 호환을 위해 유지한다.
 */
$qs = http_build_query([
    'channel'  => 'naver',
    'work_idx' => $_GET['cr_idx']  ?? ($_GET['work_idx'] ?? ''),
    'keyword'  => $_GET['keyword'] ?? '',
]);
header('Location: /crm_admin/ajax/channel.rank.ajax.php?' . $qs);
exit;
