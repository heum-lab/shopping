<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'place',
    'label'    => '플레이스',
    'table'    => 'place_work',
    'page_url' => '/crm_admin/sub/info_acc_place.php',
];

include __DIR__ . '/../include/channel_page.php';
