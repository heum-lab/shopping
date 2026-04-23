<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'inflow',
    'label'    => '유입플',
    'table'    => 'inflow_work',
    'page_url' => '/crm_admin/sub/info_acc_inflow.php',
];

include __DIR__ . '/../include/channel_page.php';
