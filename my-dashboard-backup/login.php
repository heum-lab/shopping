<?php
require_once __DIR__ . '/include/db.php';
require_once __DIR__ . '/include/func.php';

session_start();

$error = '';
$return_url = $_GET['return'] ?? '/crm_admin/sub/dashboard.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = trim($_POST['id'] ?? '');
    $pw = (string)($_POST['pw'] ?? '');

    if ($id === '' || $pw === '') {
        $error = '아이디와 비밀번호를 입력하세요.';
    } else {
        $id_esc = esc($id);
        $sql    = "SELECT idx, id, pw, name, level, agency_idx, seller_idx
                   FROM admin WHERE id = '{$id_esc}' LIMIT 1";
        $res    = mysqli_query($conn, $sql);
        $row    = $res ? mysqli_fetch_assoc($res) : null;

        if ($row && password_verify($pw, $row['pw'])) {
            $_SESSION['admin_idx']        = (int)$row['idx'];
            $_SESSION['admin_id']         = $row['id'];
            $_SESSION['admin_name']       = $row['name'];
            $_SESSION['admin_level']      = (int)$row['level'];
            $_SESSION['admin_agency_idx'] = (int)($row['agency_idx'] ?? 0);
            $_SESSION['admin_seller_idx'] = (int)($row['seller_idx'] ?? 0);

            audit_log('login', 'auth', (int)$row['idx'], ['level' => (int)$row['level']]);

            $safe_return = filter_var($return_url, FILTER_SANITIZE_URL);
            if (strpos($safe_return, '/crm_admin/') !== 0) {
                $safe_return = '/crm_admin/sub/dashboard.php';
            }
            header('Location: ' . $safe_return);
            exit;
        }
        $error = '아이디 또는 비밀번호가 올바르지 않습니다.';

        // 실패한 로그인 시도도 기록 (세션 없이 actor 수동 지정)
        audit_log('login_fail', 'auth', null, ['attempted_id' => $id],
            ['admin_idx' => null, 'admin_id' => null]);
    }
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>로그인 — CONTROL</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
    body { background: #f5f6f8; font-family: "Noto Sans KR", sans-serif; }
    .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .login-card { width: 100%; max-width: 400px; background: #fff; border-radius: 12px; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .login-title { text-align: center; font-weight: 700; margin-bottom: 6px; }
    .login-sub   { text-align: center; color: #6c757d; font-size: 14px; margin-bottom: 28px; }
</style>
</head>
<body>
<div class="login-wrap">
    <div class="login-card">
        <h1 class="login-title h4">CONTROL</h1>
        <p class="login-sub">관리자 로그인</p>
        <?php if ($error): ?>
            <div class="alert alert-danger py-2 small"><?= h($error) ?></div>
        <?php endif; ?>
        <form method="post" autocomplete="off">
            <div class="mb-3">
                <label class="form-label small fw-bold">아이디</label>
                <input type="text" name="id" class="form-control" required autofocus>
            </div>
            <div class="mb-3">
                <label class="form-label small fw-bold">비밀번호</label>
                <input type="password" name="pw" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-dark w-100">로그인</button>
        </form>
    </div>
</div>
</body>
</html>
