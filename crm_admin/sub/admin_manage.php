<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

// 슈퍼관리자(1), 관리자(2) 진입. 대행사(3) 차단.
require_level(2);

define('PAGE_TITLE', '계정관리 — CONTROL');

// 등록 가능한 권한
//  - 슈퍼관리자(1): 관리자(2) + 대행사(3) 등록 가능
//  - 관리자(2)   : 대행사(3) 만 등록 가능
$allowed_admin_levels = ($admin_level === 1) ? [2, 3] : [3];

$mode       = p('mode');
$return_url = p('return_url', '/crm_admin/sub/admin_manage.php');

// -------------------------------------------------------------
// 등록
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mode === 'insert') {
    $id          = trim(p('id'));
    $pw          = (string)p('pw');
    $name        = trim(p('admin_name'));
    $agency_name = trim(p('agency_name'));
    $level       = (int)p('level', 3);

    if (!in_array($level, $allowed_admin_levels, true)) {
        $_SESSION['flash_error'] = '해당 권한 등록 권한이 없습니다.';
    } elseif ($id === '' || $pw === '' || $name === '') {
        $_SESSION['flash_error'] = '아이디/비밀번호/이름은 필수입니다.';
    } elseif (strlen($pw) < 8) {
        $_SESSION['flash_error'] = '비밀번호는 8자 이상이어야 합니다.';
    } else {
        $chk = mysqli_fetch_assoc(mysqli_query($conn,
            "SELECT idx FROM admin WHERE id = '" . esc($id) . "' LIMIT 1"
        ));
        if ($chk) {
            $_SESSION['flash_error'] = '이미 존재하는 아이디입니다.';
        } else {
            $hash = password_hash($pw, PASSWORD_DEFAULT);
            mysqli_query($conn, sprintf(
                "INSERT INTO admin (id, pw, name, agency_name, level, created_by) VALUES ('%s', '%s', '%s', %s, %d, %d)",
                esc($id), esc($hash), esc($name),
                $agency_name !== '' ? "'" . esc($agency_name) . "'" : 'NULL',
                $level, (int)$admin_idx
            ));
            $new_idx = (int)mysqli_insert_id($conn);
            audit_log('insert', 'admin', $new_idx, [
                'id' => $id, 'name' => $name, 'agency_name' => $agency_name,
                'level' => $level, 'created_by' => $admin_idx,
            ]);
        }
    }
    header('Location: ' . $return_url);
    exit;
}

// -------------------------------------------------------------
// 삭제 — 슈퍼관리자: 누구든. 관리자: 본인이 만든 계정만.
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mode === 'delete') {
    $idx = (int)p('idx');
    if ($idx > 0) {
        if ($idx === $admin_idx) {
            $_SESSION['flash_error'] = '본인 계정은 삭제할 수 없습니다.';
        } else {
            $target = mysqli_fetch_assoc(mysqli_query($conn,
                "SELECT id, name, level, created_by FROM admin WHERE idx = {$idx} LIMIT 1"
            ));
            if (!$target) {
                $_SESSION['flash_error'] = '대상 계정을 찾을 수 없습니다.';
            } elseif ($admin_level === 2 && (int)($target['created_by'] ?? 0) !== $admin_idx) {
                $_SESSION['flash_error'] = '본인이 등록한 계정만 삭제할 수 있습니다.';
            } else {
                mysqli_query($conn, "DELETE FROM admin WHERE idx = {$idx}");
                audit_log('delete', 'admin', $idx, $target);
            }
        }
    }
    header('Location: ' . $return_url);
    exit;
}

// -------------------------------------------------------------
// 목록 — 슈퍼관리자: 전체. 관리자: 본인이 만든 계정만 (본인 포함).
// -------------------------------------------------------------
$pass_input = p('pass_input');
$pass_level = p('pass_level');

$where = ['1=1'];
if ($admin_level === 2) {
    $where[] = "(created_by = " . (int)$admin_idx . " OR idx = " . (int)$admin_idx . ")";
}
if ($pass_input !== '') {
    $kw = esc($pass_input);
    $where[] = "(id LIKE '%{$kw}%' OR name LIKE '%{$kw}%')";
}
if ($pass_level !== '') $where[] = "level = " . (int)$pass_level;
$where_sql = implode(' AND ', $where);

$list_res = mysqli_query($conn,
    "SELECT idx, id, name, level, reg_date, created_by
     FROM admin
     WHERE {$where_sql}
     ORDER BY level, reg_date DESC"
);
$total    = $list_res ? mysqli_num_rows($list_res) : 0;

$flash_error = $_SESSION['flash_error'] ?? '';
unset($_SESSION['flash_error']);

include __DIR__ . '/../include/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-2">
    <h2 class="page-title mb-0">계정관리 <span class="text-muted small">총 <?= number_format($total) ?>건</span></h2>
    <button type="button" class="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 계정 등록</button>
</div>

<?php if ($flash_error): ?>
    <div class="alert alert-danger py-2 small"><?= h($flash_error) ?></div>
<?php endif; ?>

<form name="searchfrm" method="get" class="search-box">
    <div class="row g-2 align-items-end">
        <div class="col-md-3">
            <label>권한</label>
            <select name="pass_level" class="form-select form-select-sm">
                <option value="">전체</option>
                <?php if ($admin_level === 1): ?>
                    <option value="1" <?= (string)$pass_level === '1' ? 'selected' : '' ?>>슈퍼관리자</option>
                    <option value="2" <?= (string)$pass_level === '2' ? 'selected' : '' ?>>관리자</option>
                <?php endif; ?>
                <option value="3" <?= (string)$pass_level === '3' ? 'selected' : '' ?>>대행사</option>
            </select>
        </div>
        <div class="col-md-4">
            <label>아이디/이름</label>
            <input type="text" name="pass_input" value="<?= h($pass_input) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-2">
            <button type="submit" class="btn btn-sm btn-dark w-100">검색</button>
        </div>
    </div>
</form>

<div class="table-responsive">
    <table class="table table-bordered table-hover data-table align-middle">
        <thead>
            <tr>
                <th style="width:60px;">번호</th>
                <th style="width:110px;">권한</th>
                <th>아이디</th>
                <th>이름</th>
                <th>등록일</th>
                <th style="width:140px;">관리</th>
            </tr>
        </thead>
        <tbody>
        <?php if ($total === 0): ?>
            <tr><td colspan="6" class="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
        <?php else:
            $no = $total;
            while ($r = mysqli_fetch_assoc($list_res)):
                $is_self        = (int)$r['idx'] === $admin_idx;
                // 관리자(2)는 본인이 만든 계정만 수정/삭제 가능
                $can_modify = ($admin_level === 1)
                    || ($admin_level === 2 && (int)$r['created_by'] === $admin_idx);
        ?>
            <tr>
                <td><?= $no-- ?></td>
                <td><span class="badge bg-secondary"><?= h(level_label($r['level'])) ?></span></td>
                <td>
                    <?= h($r['id']) ?>
                    <?= $is_self ? ' <span class="badge bg-info text-white small">나</span>' : '' ?>
                </td>
                <td><?= h($r['name']) ?></td>
                <td><?= h($r['reg_date']) ?></td>
                <td class="text-center">
                    <?php if ($can_modify): ?>
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1"
                                onclick="adminEdit(<?= (int)$r['idx'] ?>);">수정</button>
                        <?php if (!$is_self): ?>
                            <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1"
                                    onclick="adminDelete(<?= (int)$r['idx'] ?>, '<?= h($r['id']) ?>');">삭제</button>
                        <?php endif; ?>
                    <?php else: ?>
                        <span class="text-muted small">-</span>
                    <?php endif; ?>
                </td>
            </tr>
        <?php endwhile; endif; ?>
        </tbody>
    </table>
</div>

<!-- 등록 모달 -->
<div class="modal fade" id="showModalInsert" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <form method="post" action="/crm_admin/sub/admin_manage.php">
                <input type="hidden" name="mode" value="insert">
                <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
                <div class="modal-header">
                    <h5 class="modal-title">계정 등록</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-2">
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">아이디 *</label>
                            <input type="text" name="id" class="form-control form-control-sm" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">비밀번호 * (8자 이상)</label>
                            <input type="password" name="pw" class="form-control form-control-sm" minlength="8" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">이름 *</label>
                            <input type="text" name="admin_name" class="form-control form-control-sm" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">대행사명</label>
                            <input type="text" name="agency_name" class="form-control form-control-sm" placeholder="대행사/회사명">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">권한 *</label>
                            <select name="level" class="form-select form-select-sm" required>
                                <?php if (in_array(2, $allowed_admin_levels, true)): ?>
                                    <option value="2">관리자</option>
                                <?php endif; ?>
                                <?php if (in_array(3, $allowed_admin_levels, true)): ?>
                                    <option value="3" selected>대행사</option>
                                <?php endif; ?>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">취소</button>
                    <button type="submit" class="btn btn-sm btn-dark">등록</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- 수정 모달 -->
<div class="modal fade" id="showModalEdit" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">계정 수정</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modalEditBody"></div>
        </div>
    </div>
</div>

<form id="deleteForm" method="post" action="/crm_admin/sub/admin_manage.php" style="display:none;">
    <input type="hidden" name="mode" value="delete">
    <input type="hidden" name="idx" value="">
    <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
</form>

<script>
function adminEdit(idx) {
    $.post('/crm_admin/ajax/admin.info.ajax.php',
        { idx: idx, return_url: '<?= h($_SERVER['REQUEST_URI']) ?>' },
        function (html) {
            $('#modalEditBody').html(html);
            $('#showModalEdit').modal('show');
        }
    );
}
function adminDelete(idx, label) {
    if (!confirm('[' + label + '] 계정을 삭제하시겠습니까?')) return;
    $('#deleteForm input[name=idx]').val(idx);
    $('#deleteForm').submit();
}
</script>

<?php include __DIR__ . '/../include/footer.php'; ?>
