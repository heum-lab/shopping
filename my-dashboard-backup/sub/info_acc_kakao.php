<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'kakao',
    'label'    => '카카오맵',
    'table'    => 'kakao_work',
    'page_url' => '/crm_admin/sub/info_acc_kakao.php',
];

include __DIR__ . '/../include/channel_page.php';
