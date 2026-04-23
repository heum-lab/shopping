<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

// 관리자(2) 이상이면 대행사(회사) 등록 가능
require_level(2);

define('PAGE_TITLE', '대행사 관리 — CONTROL');

// -------------------------------------------------------------
// 1. 모드 처리 (POST)
// -------------------------------------------------------------
$mode = p('mode');
$return_url = p('return_url', '/crm_admin/sub/company_manage.php');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mode !== '') {
    if ($mode === 'insert') {
        $name        = trim(p('name'));
        $maketer_idx = (int)p('maketer_idx');
        if ($name !== '') {
            $sql = sprintf(
                "INSERT INTO agency (name, maketer_idx) VALUES ('%s', %s)",
                esc($name),
                $maketer_idx > 0 ? $maketer_idx : 'NULL'
            );
            mysqli_query($conn, $sql);
            $new_idx = (int)mysqli_insert_id($conn);
            audit_log('insert', 'agency', $new_idx, ['name' => $name, 'maketer_idx' => $maketer_idx ?: null]);
        }
    } elseif ($mode === 'delete') {
        $idx = (int)p('idx');
        if ($idx > 0) {
            // 소속 셀러 존재 여부 확인
            $chk = mysqli_fetch_assoc(mysqli_query($conn,
                "SELECT COUNT(*) AS cnt FROM seller WHERE agency_idx = {$idx}"
            ));
            if ((int)$chk['cnt'] > 0) {
                $_SESSION['flash_error'] = '소속 셀러가 존재해 삭제할 수 없습니다. 먼저 셀러를 이동/삭제하세요.';
            } else {
                $before = mysqli_fetch_assoc(mysqli_query($conn,
                    "SELECT name, maketer_idx FROM agency WHERE idx = {$idx} LIMIT 1"
                ));
                mysqli_query($conn, "DELETE FROM agency WHERE idx = {$idx}");
                audit_log('delete', 'agency', $idx, $before);
            }
        }
    }
    header('Location: ' . $return_url);
    exit;
}

// -------------------------------------------------------------
// 2. 검색
// -------------------------------------------------------------
$pass_input = p('pass_input');
$where = ['1=1'];
if ($pass_input !== '') $where[] = "a.name LIKE '%" . esc($pass_input) . "%'";
$where_sql = implode(' AND ', $where);

$list_sql = "SELECT a.*,
                    (SELECT COUNT(*) FROM seller s WHERE s.agency_idx = a.idx) AS seller_cnt,
                    (SELECT COUNT(*) FROM naver_shopping_work w WHERE w.agency_idx = a.idx) AS work_cnt,
                    m.name AS maketer_name
             FROM agency a
             LEFT JOIN admin m ON m.idx = a.maketer_idx
             WHERE {$where_sql}
             ORDER BY a.reg_date DESC";
$list_res = mysqli_query($conn, $list_sql);
$total    = mysqli_num_rows($list_res);

$marketers = mysqli_query($conn, "SELECT idx, name FROM admin WHERE level <= 2 ORDER BY name");

$flash_error = $_SESSION['flash_error'] ?? '';
unset($_SESSION['flash_error']);

include __DIR__ . '/../include/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-2">
    <h2 class="page-title mb-0">대행사 관리 <span class="text-muted small">총 <?= number_format($total) ?>건</span></h2>
    <button type="button" class="btn btn-sm btn-dark" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 대행사 등록</button>
</div>

<?php if ($flash_error): ?>
    <div class="alert alert-danger py-2 small"><?= h($flash_error) ?></div>
<?php endif; ?>

<form name="searchfrm" method="get" class="search-box">
    <div class="row g-2 align-items-end">
        <div class="col-md-4">
            <label>대행사명</label>
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
                <th>대행사명</th>
                <th>담당 마케터</th>
                <th class="text-end">셀러</th>
                <th class="text-end">작업</th>
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
                <td><?= h($r['maketer_name']) ?: '<span class="text-muted">-</span>' ?></td>
                <td class="text-end"><?= number_format((int)$r['seller_cnt']) ?></td>
                <td class="text-end"><?= number_format((int)$r['work_cnt']) ?></td>
                <td><?= h($r['reg_date']) ?></td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1"
                            onclick="companyEdit(<?= (int)$r['idx'] ?>);">수정</button>
                    <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1"
                            onclick="companyDelete(<?= (int)$r['idx'] ?>, '<?= h($r['name']) ?>');">삭제</button>
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
            <form method="post" action="/crm_admin/sub/company_manage.php">
                <input type="hidden" name="mode" value="insert">
                <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
                <div class="modal-header">
                    <h5 class="modal-title">대행사 등록</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-2">
                        <label class="form-label small fw-bold">대행사명 *</label>
                        <input type="text" name="name" class="form-control form-control-sm" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label small fw-bold">담당 마케터</label>
                        <select name="maketer_idx" class="form-select form-select-sm">
                            <option value="">선택 없음</option>
                            <?php while ($m = mysqli_fetch_assoc($marketers)): ?>
                                <option value="<?= (int)$m['idx'] ?>"><?= h($m['name']) ?></option>
                            <?php endwhile; ?>
                        </select>
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
                <h5 class="modal-title">대행사 수정</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modalEditBody"></div>
        </div>
    </div>
</div>

<!-- 삭제 폼 -->
<form id="deleteForm" method="post" action="/crm_admin/sub/company_manage.php" style="display:none;">
    <input type="hidden" name="mode" value="delete">
    <input type="hidden" name="idx" value="">
    <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
</form>

<script>
function companyEdit(idx) {
    $.post('/crm_admin/ajax/company.info.ajax.php',
        { idx: idx, return_url: '<?= h($_SERVER['REQUEST_URI']) ?>' },
        function (html) {
            $('#modalEditBody').html(html);
            $('#showModalEdit').modal('show');
        }
    );
}
function companyDelete(idx, name) {
    if (!confirm('[' + name + '] 대행사를 삭제하시겠습니까?')) return;
    const $f = $('#deleteForm');
    $f.find('input[name=idx]').val(idx);
    $f.submit();
}
</script>

<?php include __DIR__ . '/../include/footer.php'; ?>
