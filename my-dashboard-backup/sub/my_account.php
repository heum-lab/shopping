<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

define('PAGE_TITLE', '내 계정 — CONTROL');

$message = '';
$error   = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mode = p('mode');

    // 현재 계정 정보 조회
    $me = mysqli_fetch_assoc(mysqli_query($conn,
        "SELECT pw FROM admin WHERE idx = {$admin_idx} LIMIT 1"
    ));

    if ($mode === 'name') {
        $new_name = trim(p('new_name'));
        if ($new_name === '') {
            $error = '이름을 입력하세요.';
        } else {
            mysqli_query($conn, "UPDATE admin SET name = '" . esc($new_name) . "' WHERE idx = {$admin_idx}");
            $_SESSION['admin_name'] = $new_name;
            $admin_name = $new_name;
            $message = '이름을 변경했습니다.';
        }
    } elseif ($mode === 'password') {
        $current = (string)p('current_pw');
        $new1    = (string)p('new_pw');
        $new2    = (string)p('new_pw2');

        if (!$me || !password_verify($current, $me['pw'])) {
            $error = '현재 비밀번호가 일치하지 않습니다.';
        } elseif (strlen($new1) < 8) {
            $error = '새 비밀번호는 8자 이상이어야 합니다.';
        } elseif ($new1 !== $new2) {
            $error = '새 비밀번호 확인이 일치하지 않습니다.';
        } else {
            $hash = password_hash($new1, PASSWORD_DEFAULT);
            mysqli_query($conn, "UPDATE admin SET pw = '" . esc($hash) . "' WHERE idx = {$admin_idx}");
            audit_log('change_pw', 'admin', $admin_idx);
            $message = '비밀번호를 변경했습니다.';
        }
    }
}

// 신 모델: 별도 소속 스코프 없음
$scope_label = '';

include __DIR__ . '/../include/header.php';
?>

<h2 class="page-title">내 계정</h2>

<?php if ($message): ?>
    <div class="alert alert-success py-2 small"><?= h($message) ?></div>
<?php endif; ?>
<?php if ($error): ?>
    <div class="alert alert-danger py-2 small"><?= h($error) ?></div>
<?php endif; ?>

<div class="row g-3">
    <div class="col-md-6">
        <div class="search-box">
            <h5 class="fs-6 fw-bold mb-3">기본 정보</h5>
            <table class="table table-sm mb-3">
                <tbody>
                    <tr><th class="w-25 bg-light">아이디</th><td><?= h($admin_id) ?></td></tr>
                    <tr><th class="bg-light">권한</th><td><?= h(level_label($admin_level)) ?> (level <?= (int)$admin_level ?>)</td></tr>
                    <?php if ($scope_label): ?>
                        <tr><th class="bg-light">소속</th><td><?= h($scope_label) ?></td></tr>
                    <?php endif; ?>
                </tbody>
            </table>

            <form method="post">
                <input type="hidden" name="mode" value="name">
                <label class="form-label small fw-bold">이름</label>
                <div class="input-group input-group-sm">
                    <input type="text" name="new_name" value="<?= h($admin_name) ?>" class="form-control" required>
                    <button type="submit" class="btn btn-dark">이름 변경</button>
                </div>
            </form>
        </div>
    </div>

    <div class="col-md-6">
        <div class="search-box">
            <h5 class="fs-6 fw-bold mb-3">비밀번호 변경</h5>
            <form method="post">
                <input type="hidden" name="mode" value="password">
                <div class="mb-2">
                    <label class="form-label small fw-bold">현재 비밀번호</label>
                    <input type="password" name="current_pw" class="form-control form-control-sm" required autocomplete="current-password">
                </div>
                <div class="mb-2">
                    <label class="form-label small fw-bold">새 비밀번호 (8자 이상)</label>
                    <input type="password" name="new_pw" class="form-control form-control-sm" minlength="8" required autocomplete="new-password">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">새 비밀번호 확인</label>
                    <input type="password" name="new_pw2" class="form-control form-control-sm" minlength="8" required autocomplete="new-password">
                </div>
                <button type="submit" class="btn btn-sm btn-dark">비밀번호 변경</button>
            </form>
        </div>
    </div>
</div>

<?php include __DIR__ . '/../include/footer.php'; ?>
