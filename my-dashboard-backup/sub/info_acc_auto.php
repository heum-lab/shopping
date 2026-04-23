<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'auto',
    'label'    => '자동완성',
    'table'    => 'auto_work',
    'page_url' => '/crm_admin/sub/info_acc_auto.php',
];

include __DIR__ . '/../include/channel_page.php';
