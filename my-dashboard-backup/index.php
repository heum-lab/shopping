<?php
session_start();
if (!empty($_SESSION['admin_idx'])) {
    header('Location: /crm_admin/sub/dashboard.php');
} else {
    header('Location: /crm_admin/login.php');
}
exit;
