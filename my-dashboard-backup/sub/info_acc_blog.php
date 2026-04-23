<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel_config = [
    'key'      => 'blog',
    'label'    => '블로그',
    'table'    => 'blog_work',
    'page_url' => '/crm_admin/sub/info_acc_blog.php',
];

include __DIR__ . '/../include/channel_page.php';
