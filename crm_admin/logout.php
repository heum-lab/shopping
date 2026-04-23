<?php
require_once __DIR__ . '/include/db.php';
require_once __DIR__ . '/include/func.php';

session_start();

if (!empty($_SESSION['admin_idx'])) {
    audit_log('logout', 'auth', (int)$_SESSION['admin_idx']);
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(), '', time() - 42000,
        $params['path'], $params['domain'], $params['secure'], $params['httponly']
    );
}
session_destroy();
header('Location: /crm_admin/login.php');
exit;
