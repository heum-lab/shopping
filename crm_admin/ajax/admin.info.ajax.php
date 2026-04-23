<?php
/**
 * 관리자 계정 상세 편집 모달 + 저장
 *  - 슈퍼관리자(1): 모든 계정 수정 가능
 *  - 관리자(2)   : 본인이 등록한 대행사(level=3) 계정만 수정 가능
 *  - 대행사(3)   : 차단
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

require_level(2);

$allowed_admin_levels = ($admin_level === 1) ? [1, 2, 3] : [3];

$idx        = (int)p('idx');
$return_url = p('return_url', '/crm_admin/sub/admin_manage.php');
$ajax_mode  = p('ajax_mode');

// 대상 계정 권한 체크 (관리자는 본인이 만든 계정만)
function ensure_can_modify($conn, $admin_level, $admin_idx, $idx) {
    if ($admin_level === 1) return null;  // 슈퍼관리자 — 모두 가능
    $row = mysqli_fetch_assoc(mysqli_query($conn,
        "SELECT level, created_by FROM admin WHERE idx = {$idx} LIMIT 1"
    ));
    if (!$row) return '대상 계정을 찾을 수 없습니다.';
    if ((int)$row['created_by'] !== (int)$admin_idx) return '본인이 등록한 계정만 수정할 수 있습니다.';
    return null;
}

// -------------------------------------------------------------
// 저장
// -------------------------------------------------------------
if ($ajax_mode === 'update' && $idx > 0) {
    header('Content-Type: application/json; charset=utf-8');

    $err = ensure_can_modify($conn, $admin_level, $admin_idx, $idx);
    if ($err) { echo json_encode(['result' => 'fail', 'msg' => $err]); exit; }

    $name        = trim(p('name'));
    $agency_name = trim(p('agency_name'));
    $level       = (int)p('level', 3);
    $new_pw      = (string)p('new_pw');

    if (!in_array($level, $allowed_admin_levels, true)) {
        echo json_encode(['result' => 'fail', 'msg' => '해당 권한 등록 권한이 없습니다.']);
        exit;
    }
    if ($name === '') {
        echo json_encode(['result' => 'fail', 'msg' => '이름은 필수입니다.']);
        exit;
    }
    if ($new_pw !== '' && strlen($new_pw) < 8) {
        echo json_encode(['result' => 'fail', 'msg' => '비밀번호는 8자 이상이어야 합니다.']);
        exit;
    }

    $sets = [
        "name = '" . esc($name) . "'",
        "agency_name = " . ($agency_name !== '' ? "'" . esc($agency_name) . "'" : 'NULL'),
        "level = " . $level,
        "agency_idx = NULL",
        "seller_idx = NULL",
    ];
    if ($new_pw !== '') {
        $hash = password_hash($new_pw, PASSWORD_DEFAULT);
        $sets[] = "pw = '" . esc($hash) . "'";
    }
    $sql = "UPDATE admin SET " . implode(', ', $sets) . " WHERE idx = {$idx}";
    if (mysqli_query($conn, $sql)) {
        audit_log('update', 'admin', $idx, [
            'name' => $name, 'agency_name' => $agency_name, 'level' => $level,
            'pw_changed' => $new_pw !== '',
        ]);
        echo json_encode(['result' => 'ok']);
    } else {
        echo json_encode(['result' => 'fail', 'msg' => mysqli_error($conn)]);
    }
    exit;
}

// -------------------------------------------------------------
// 상세 조회
// -------------------------------------------------------------
if ($idx <= 0) { echo '<p class="text-danger">잘못된 요청입니다.</p>'; exit; }

$err = ensure_can_modify($conn, $admin_level, $admin_idx, $idx);
if ($err) { echo '<p class="text-danger">' . h($err) . '</p>'; exit; }

$row = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT * FROM admin WHERE idx = {$idx} LIMIT 1"
));
if (!$row) { echo '<p class="text-danger">데이터를 찾을 수 없습니다.</p>'; exit; }
?>
<form id="adminEditForm" onsubmit="return submitAdminEdit(event, <?= $idx ?>, '<?= h($return_url) ?>');">
    <div class="row g-2">
        <div class="col-md-6">
            <label class="form-label small fw-bold">아이디</label>
            <input type="text" value="<?= h($row['id']) ?>" class="form-control form-control-sm" readonly>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">이름 *</label>
            <input type="text" name="name" value="<?= h($row['name']) ?>" class="form-control form-control-sm" required>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">새 비밀번호</label>
            <input type="password" name="new_pw" class="form-control form-control-sm" minlength="8" placeholder="변경 시에만 입력 (8자 이상)">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">대행사명</label>
            <input type="text" name="agency_name" value="<?= h($row['agency_name'] ?? '') ?>" class="form-control form-control-sm" placeholder="대행사/회사명">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">권한 *</label>
            <select name="level" class="form-select form-select-sm" required>
                <?php foreach ([1 => '슈퍼관리자', 2 => '관리자', 3 => '대행사'] as $lv => $lb):
                    if (!in_array($lv, $allowed_admin_levels, true)) continue; ?>
                    <option value="<?= $lv ?>" <?= (int)$row['level'] === $lv ? 'selected' : '' ?>><?= h($lb) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-12 small text-muted mt-2">등록일: <?= h($row['reg_date']) ?></div>
    </div>
    <div class="text-end mt-3">
        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">닫기</button>
        <button type="submit" class="btn btn-sm btn-dark">저장</button>
    </div>
</form>
<script>
function submitAdminEdit(e, idx, return_url) {
    e.preventDefault();
    const data = $(e.target).serializeArray();
    data.push({ name: 'idx', value: idx });
    data.push({ name: 'ajax_mode', value: 'update' });
    $.post('/crm_admin/ajax/admin.info.ajax.php', data, function (res) {
        if (res.result === 'ok') {
            location.href = return_url;
        } else {
            alert('저장 실패: ' + (res.msg || '알 수 없는 오류'));
        }
    }, 'json');
    return false;
}
</script>
