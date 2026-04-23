<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

require_level(2);

define('PAGE_TITLE', '셀러 관리 — CONTROL');

// 대행사 레벨은 자신의 대행사 셀러만 취급
$force_agency = ($admin_level === 2 && $admin_agency_idx > 0) ? $admin_agency_idx : 0;

// -------------------------------------------------------------
// 1. 모드 처리 (POST)
// -------------------------------------------------------------
$mode = p('mode');
$return_url = p('return_url', '/crm_admin/sub/seller_manage.php');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mode !== '') {
    if ($mode === 'insert') {
        $name         = trim(p('name'));
        $manager_name = trim(p('manager_name'));
        $agency_idx   = $force_agency > 0 ? $force_agency : (int)p('agency_idx');
        if ($name !== '' && $agency_idx > 0) {
            mysqli_query($conn, sprintf(
                "INSERT INTO seller (name, manager_name, agency_idx) VALUES ('%s', '%s', %d)",
                esc($name), esc($manager_name), $agency_idx
            ));
            $new_idx = (int)mysqli_insert_id($conn);
            audit_log('insert', 'seller', $new_idx, ['name' => $name, 'manager_name' => $manager_name, 'agency_idx' => $agency_idx]);
        }
    } elseif ($mode === 'delete') {
        $idx = (int)p('idx');
        if ($idx > 0) {
            // 권한 레벨 2는 본인 대행사 소속 셀러만 삭제 가능
            if ($force_agency > 0) {
                $own = mysqli_fetch_assoc(mysqli_query($conn,
                    "SELECT idx FROM seller WHERE idx = {$idx} AND agency_idx = {$force_agency}"
                ));
                if (!$own) {
                    $_SESSION['flash_error'] = '권한이 없는 셀러입니다.';
                    header('Location: ' . $return_url);
                    exit;
                }
            }
            $chk = mysqli_fetch_assoc(mysqli_query($conn,
                "SELECT COUNT(*) AS cnt FROM naver_shopping_work WHERE seller_idx = {$idx}"
            ));
            if ((int)$chk['cnt'] > 0) {
                $_SESSION['flash_error'] = '진행 중인 작업이 존재해 삭제할 수 없습니다. 먼저 작업을 정리하세요.';
            } else {
                $before = mysqli_fetch_assoc(mysqli_query($conn,
                    "SELECT name, agency_idx FROM seller WHERE idx = {$idx} LIMIT 1"
                ));
                mysqli_query($conn, "DELETE FROM seller WHERE idx = {$idx}");
                audit_log('delete', 'seller', $idx, $before);
            }
        }
    }
    header('Location: ' . $return_url);
    exit;
}

// -------------------------------------------------------------
// 2. 검색
// -------------------------------------------------------------
$pass_assign3 = p('pass_assign3');
$pass_input   = p('pass_input');

$where = ['1=1'];
if ($force_agency > 0) {
    $where[] = "s.agency_idx = {$force_agency}";   // 대행사 레벨은 본인 대행사로 고정
} elseif ($pass_assign3 !== '') {
    $where[] = "s.agency_idx = " . (int)$pass_assign3;
}
if ($pass_input !== '') {
    $kw = esc($pass_input);
    $where[] = "(s.name LIKE '%{$kw}%' OR s.manager_name LIKE '%{$kw}%')";
}
$where_sql = implode(' AND ', $where);

$list_sql = "SELECT s.*,
                    a.name AS agency_name,
                    (SELECT COUNT(*) FROM naver_shopping_work w WHERE w.seller_idx = s.idx) AS work_cnt
             FROM seller s
             LEFT JOIN agency a ON a.idx = s.agency_idx
             WHERE {$where_sql}
             ORDER BY s.reg_date DESC";
$list_res = mysqli_query($conn, $list_sql);
$total    = mysqli_num_rows($list_res);

$agency_res = mysqli_query($conn, "SELECT idx, name FROM agency ORDER BY name");

$flash_error = $_SESSION['flash_error'] ?? '';
unset($_SESSION['flash_error']);

include __DIR__ . '/../include/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-2">
    <h2 class="page-title mb-0">셀러 관리 <span class="text-muted small">총 <?= number_format($total) ?>건</span></h2>
    <button type="button" class="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 셀러 등록</button>
</div>

<?php if ($flash_error): ?>
    <div class="alert alert-danger py-2 small"><?= h($flash_error) ?></div>
<?php endif; ?>

<form name="searchfrm" method="get" class="search-box">
    <div class="row g-2 align-items-end">
        <?php if ($force_agency === 0): ?>
            <div class="col-md-3">
                <label>대행사</label>
                <select name="pass_assign3" class="form-select form-select-sm">
                    <option value="">전체</option>
                    <?php while ($a = mysqli_fetch_assoc($agency_res)): ?>
                        <option value="<?= (int)$a['idx'] ?>" <?= (string)$pass_assign3 === (string)$a['idx'] ? 'selected' : '' ?>>
                            <?= h($a['name']) ?>
                        </option>
                    <?php endwhile; ?>
                </select>
            </div>
        <?php endif; ?>
        <div class="col-md-4">
            <label>셀러명/담당자</label>
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
                <th>셀러명</th>
                <th>담당자</th>
                <th>소속 대행사</th>
                <th class="text-end">작업 수</th>
                <th>등록일</th>
                <th style="width:140px;">관리</th>
            </tr>
        </thead>
        <tbody>
        <?php if ($total === 0): ?>
            <tr><td colspan="7" class="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
        <?php else:
            $no = $total;
            while ($r = mysqli_fetch_assoc($list_res)):
        ?>
            <tr>
                <td><?= $no-- ?></td>
                <td><?= h($r['name']) ?></td>
                <td><?= h($r['manager_name']) ?: '<span class="text-muted">-</span>' ?></td>
                <td><?= h($r['agency_name']) ?: '<span class="text-muted">-</span>' ?></td>
                <td class="text-end"><?= number_format((int)$r['work_cnt']) ?></td>
                <td><?= h($r['reg_date']) ?></td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1"
                            onclick="sellerEdit(<?= (int)$r['idx'] ?>);">수정</button>
                    <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1"
                            onclick="sellerDelete(<?= (int)$r['idx'] ?>, '<?= h($r['name']) ?>');">삭제</button>
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
            <form method="post" action="/crm_admin/sub/seller_manage.php">
                <input type="hidden" name="mode" value="insert">
                <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
                <div class="modal-header">
                    <h5 class="modal-title">셀러 등록</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-2">
                        <label class="form-label small fw-bold">셀러명 *</label>
                        <input type="text" name="name" class="form-control form-control-sm" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small fw-bold">담당자</label>
                        <input type="text" name="manager_name" class="form-control form-control-sm" placeholder="담당자 이름">
                    </div>
                    <?php if ($force_agency > 0): ?>
                        <input type="hidden" name="agency_idx" value="<?= $force_agency ?>">
                    <?php else: ?>
                        <div class="mb-2">
                            <label class="form-label small fw-bold">소속 대행사 *</label>
                            <select name="agency_idx" class="form-select form-select-sm" required>
                                <option value="">선택</option>
                                <?php mysqli_data_seek($agency_res, 0); while ($a = mysqli_fetch_assoc($agency_res)): ?>
                                    <option value="<?= (int)$a['idx'] ?>"><?= h($a['name']) ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>
                    <?php endif; ?>
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
                <h5 class="modal-title">셀러 수정</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modalEditBody"></div>
        </div>
    </div>
</div>

<!-- 삭제 폼 -->
<form id="deleteForm" method="post" action="/crm_admin/sub/seller_manage.php" style="display:none;">
    <input type="hidden" name="mode" value="delete">
    <input type="hidden" name="idx" value="">
    <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
</form>

<script>
function sellerEdit(idx) {
    $.post('/crm_admin/ajax/seller.info.ajax.php',
        { idx: idx, return_url: '<?= h($_SERVER['REQUEST_URI']) ?>' },
        function (html) {
            $('#modalEditBody').html(html);
            $('#showModalEdit').modal('show');
        }
    );
}
function sellerDelete(idx, name) {
    if (!confirm('[' + name + '] 셀러를 삭제하시겠습니까?')) return;
    const $f = $('#deleteForm');
    $f.find('input[name=idx]').val(idx);
    $f.submit();
}
</script>

<?php include __DIR__ . '/../include/footer.php'; ?>
