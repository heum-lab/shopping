<?php
/**
 * 공통 헤더 (네비게이션)
 * session.php 이후에 include 한다.
 */
if (!defined('PAGE_TITLE')) define('PAGE_TITLE', 'CONTROL Admin');

$current_script = basename($_SERVER['SCRIPT_NAME']);

// min_level: 숫자가 작을수록 상위 권한. 1=슈퍼관리자, 2=관리자, 3=대행사.
// 계정관리: 슈퍼관리자/관리자 (대행사는 메뉴 없음). 감사로그: 슈퍼관리자만.
$nav_items = [
    ['file' => 'dashboard.php',        'label' => '대시보드',   'min_level' => 3],
    ['file' => 'info_acc_naver.php',   'label' => '네이버쇼핑', 'min_level' => 3],
    ['file' => 'admin_manage.php',     'label' => '계정관리',   'min_level' => 2],
    ['file' => 'audit_log.php',        'label' => '감사로그',   'min_level' => 1],
];

$visible_nav = array_filter($nav_items, fn($it) => $admin_level <= $it['min_level']);
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= h(PAGE_TITLE) ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css">
<link rel="stylesheet" href="/crm_admin/assets/css/admin.css">
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="/crm_admin/sub/dashboard.php">CONTROL</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto">
                <?php foreach ($visible_nav as $item): ?>
                    <li class="nav-item">
                        <a class="nav-link <?= $current_script === $item['file'] ? 'active' : '' ?>"
                           href="/crm_admin/sub/<?= h($item['file']) ?>">
                            <?= h($item['label']) ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
            <ul class="navbar-nav">
                <li class="nav-item">
                    <span class="navbar-text me-3">
                        <?= h($admin_name) ?>(<?= h($admin_id) ?>)
                        <span class="badge bg-secondary"><?= h(level_label($admin_level)) ?></span>
                    </span>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= $current_script === 'my_account.php' ? 'active' : '' ?>" href="/crm_admin/sub/my_account.php">내 계정</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/crm_admin/logout.php">로그아웃</a>
                </li>
            </ul>
        </div>
    </div>
</nav>
<main class="container-fluid py-3">
