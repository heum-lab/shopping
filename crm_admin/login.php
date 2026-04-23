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
    :root {
        --bg-base: #0A0E1A;
        --bg-surface: #121624;
        --bg-elevated: #1A2033;
        --border: #252B3D;
        --border-strong: #2F3650;
        --text-primary: #E8ECF5;
        --text-secondary: #8B93A7;
        --text-muted: #5A6178;
        --accent-cyan: #00E5FF;
        --accent-cyan-glow: rgba(0, 229, 255, 0.25);
        --accent-violet: #8B5CF6;
    }

    body {
        background:
            radial-gradient(1100px 600px at 75% -10%, rgba(139, 92, 246, 0.10), transparent 60%),
            radial-gradient(900px 500px at -10% 110%, rgba(0, 229, 255, 0.08), transparent 60%),
            var(--bg-base);
        color: var(--text-primary);
        font-family: "Pretendard", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        min-height: 100vh;
    }

    .login-wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }

    .login-card {
        width: 100%;
        max-width: 400px;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 36px 32px;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02) inset;
    }

    .login-title {
        text-align: center;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 6px;
        color: var(--text-primary);
        background: linear-gradient(90deg, var(--accent-cyan), var(--accent-violet));
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .login-sub {
        text-align: center;
        color: var(--text-secondary);
        font-size: 14px;
        margin-bottom: 28px;
    }

    .login-card .form-label {
        color: var(--text-secondary);
    }

    .login-card .form-control {
        background: var(--bg-elevated);
        border: 1px solid var(--border-strong);
        color: var(--text-primary);
        border-radius: 10px;
        padding: 10px 12px;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .login-card .form-control::placeholder { color: var(--text-muted); }

    .login-card .form-control:focus {
        background: var(--bg-elevated);
        color: var(--text-primary);
        border-color: var(--accent-cyan);
        box-shadow: 0 0 0 3px var(--accent-cyan-glow);
        outline: none;
    }

    .login-card .form-control:-webkit-autofill {
        -webkit-text-fill-color: var(--text-primary);
        -webkit-box-shadow: 0 0 0 1000px var(--bg-elevated) inset;
        caret-color: var(--text-primary);
    }

    .login-card .btn-dark {
        background: var(--accent-cyan);
        border: 1px solid var(--accent-cyan);
        color: #0A0E1A;
        font-weight: 700;
        letter-spacing: 0.02em;
        border-radius: 10px;
        padding: 10px 14px;
        transition: filter 0.15s ease, box-shadow 0.15s ease, transform 0.05s ease;
    }

    .login-card .btn-dark:hover,
    .login-card .btn-dark:focus {
        background: var(--accent-cyan);
        border-color: var(--accent-cyan);
        color: #0A0E1A;
        filter: brightness(1.08);
        box-shadow: 0 0 0 4px var(--accent-cyan-glow);
    }

    .login-card .btn-dark:active { transform: translateY(1px); }

    .login-card .alert-danger {
        background: rgba(220, 53, 69, 0.10);
        border: 1px solid rgba(220, 53, 69, 0.35);
        color: #ff8a96;
        border-radius: 10px;
    }
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
