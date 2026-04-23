<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'ohouse',
    'label'    => '오늘의집',
    'table'    => 'ohouse_work',
    'page_url' => '/crm_admin/sub/info_acc_ohouse.php',
];

include __DIR__ . '/../include/channel_page.php';
