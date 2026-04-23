<?php
/**
 * 셀러 상세 편집 모달 HTML + 저장 처리
 *
 * 파라미터:
 *   - idx         : seller.idx
 *   - return_url  : 저장 후 리다이렉트
 *
 * ajax_mode=update → JSON 응답
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

require_level(2);

$idx        = (int)p('idx');
$return_url = p('return_url', '/crm_admin/sub/seller_manage.php');
$ajax_mode  = p('ajax_mode');

// 레벨 2: 본인 대행사 소속 셀러만 접근 가능
$force_agency = ($admin_level === 2 && $admin_agency_idx > 0) ? $admin_agency_idx : 0;

if ($force_agency > 0 && $idx > 0) {
    $own = mysqli_fetch_assoc(mysqli_query($conn,
        "SELECT idx FROM seller WHERE idx = {$idx} AND agency_idx = {$force_agency}"
    ));
    if (!$own) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['result' => 'fail', 'msg' => '권한이 없는 셀러입니다.']);
        exit;
    }
}

// -------------------------------------------------------------
// 저장
// -------------------------------------------------------------
if ($ajax_mode === 'update' && $idx > 0) {
    header('Content-Type: application/json; charset=utf-8');
    $name         = trim(p('name'));
    $manager_name = trim(p('manager_name'));
    $agency_idx   = $force_agency > 0 ? $force_agency : (int)p('agency_idx');
    if ($name === '' || $agency_idx <= 0) {
        echo json_encode(['result' => 'fail', 'msg' => '셀러명과 대행사는 필수입니다.']);
        exit;
    }
    $sql = sprintf(
        "UPDATE seller SET name = '%s', manager_name = '%s', agency_idx = %d WHERE idx = %d",
        esc($name), esc($manager_name), $agency_idx, $idx
    );
    if (mysqli_query($conn, $sql)) {
        audit_log('update', 'seller', $idx, ['name' => $name, 'manager_name' => $manager_name, 'agency_idx' => $agency_idx]);
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

$row = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT * FROM seller WHERE idx = {$idx} LIMIT 1"
));
if (!$row) { echo '<p class="text-danger">데이터를 찾을 수 없습니다.</p>'; exit; }

$agencies = mysqli_query($conn, "SELECT idx, name FROM agency ORDER BY name");
?>
<form id="sellerEditForm" onsubmit="return submitSellerEdit(event, <?= $idx ?>, '<?= h($return_url) ?>');">
    <div class="mb-2">
        <label class="form-label small fw-bold">셀러명 *</label>
        <input type="text" name="name" value="<?= h($row['name']) ?>" class="form-control form-control-sm" required>
    </div>
    <div class="mb-2">
        <label class="form-label small fw-bold">담당자</label>
        <input type="text" name="manager_name" value="<?= h($row['manager_name']) ?>" class="form-control form-control-sm" placeholder="담당자 이름">
    </div>
    <div class="mb-2">
        <label class="form-label small fw-bold">소속 대행사 *</label>
        <select name="agency_idx" class="form-select form-select-sm" required>
            <option value="">선택</option>
            <?php while ($a = mysqli_fetch_assoc($agencies)): ?>
                <option value="<?= (int)$a['idx'] ?>" <?= (int)$a['idx'] === (int)$row['agency_idx'] ? 'selected' : '' ?>>
                    <?= h($a['name']) ?>
                </option>
            <?php endwhile; ?>
        </select>
    </div>
    <div class="mb-2 small text-muted">
        등록일: <?= h($row['reg_date']) ?>
    </div>
    <div class="text-end mt-3">
        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">닫기</button>
        <button type="submit" class="btn btn-sm btn-dark">저장</button>
    </div>
</form>
<script>
function submitSellerEdit(e, idx, return_url) {
    e.preventDefault();
    const data = $(e.target).serializeArray();
    data.push({ name: 'idx', value: idx });
    data.push({ name: 'ajax_mode', value: 'update' });
    $.post('/crm_admin/ajax/seller.info.ajax.php', data, function (res) {
        if (res.result === 'ok') {
            location.href = return_url;
        } else {
            alert('저장 실패: ' + (res.msg || '알 수 없는 오류'));
        }
    }, 'json');
    return false;
}
</script>
