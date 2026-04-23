<?php
/**
 * 대행사 상세 편집 모달 HTML + 저장 처리
 *
 * 파라미터:
 *   - idx         : agency.idx
 *   - return_url  : 저장 후 리다이렉트
 *
 * ajax_mode=update → JSON 응답
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$idx        = (int)p('idx');
$return_url = p('return_url', '/crm_admin/sub/company_manage.php');
$ajax_mode  = p('ajax_mode');

// -------------------------------------------------------------
// 저장
// -------------------------------------------------------------
if ($ajax_mode === 'update' && $idx > 0) {
    header('Content-Type: application/json; charset=utf-8');
    $name        = trim(p('name'));
    $maketer_idx = (int)p('maketer_idx');
    if ($name === '') {
        echo json_encode(['result' => 'fail', 'msg' => '대행사명을 입력하세요.']);
        exit;
    }
    $sql = sprintf(
        "UPDATE agency SET name = '%s', maketer_idx = %s WHERE idx = %d",
        esc($name),
        $maketer_idx > 0 ? $maketer_idx : 'NULL',
        $idx
    );
    if (mysqli_query($conn, $sql)) {
        audit_log('update', 'agency', $idx, ['name' => $name, 'maketer_idx' => $maketer_idx ?: null]);
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
    "SELECT * FROM agency WHERE idx = {$idx} LIMIT 1"
));
if (!$row) { echo '<p class="text-danger">데이터를 찾을 수 없습니다.</p>'; exit; }

$marketers = mysqli_query($conn, "SELECT idx, name FROM admin WHERE level <= 2 ORDER BY name");
?>
<form id="companyEditForm" onsubmit="return submitCompanyEdit(event, <?= $idx ?>, '<?= h($return_url) ?>');">
    <div class="mb-2">
        <label class="form-label small fw-bold">대행사명 *</label>
        <input type="text" name="name" value="<?= h($row['name']) ?>" class="form-control form-control-sm" required>
    </div>
    <div class="mb-2">
        <label class="form-label small fw-bold">담당 마케터</label>
        <select name="maketer_idx" class="form-select form-select-sm">
            <option value="">선택 없음</option>
            <?php while ($m = mysqli_fetch_assoc($marketers)): ?>
                <option value="<?= (int)$m['idx'] ?>" <?= (int)$m['idx'] === (int)$row['maketer_idx'] ? 'selected' : '' ?>>
                    <?= h($m['name']) ?>
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
function submitCompanyEdit(e, idx, return_url) {
    e.preventDefault();
    const data = $(e.target).serializeArray();
    data.push({ name: 'idx', value: idx });
    data.push({ name: 'ajax_mode', value: 'update' });
    $.post('/crm_admin/ajax/company.info.ajax.php', data, function (res) {
        if (res.result === 'ok') {
            location.href = return_url;
        } else {
            alert('저장 실패: ' + (res.msg || '알 수 없는 오류'));
        }
    }, 'json');
    return false;
}
</script>
