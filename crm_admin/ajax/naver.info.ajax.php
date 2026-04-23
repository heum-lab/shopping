<?php
/**
 * 네이버쇼핑 상품 상세 편집 모달 내부 HTML 반환
 *
 * POST 파라미터:
 *   - idx         : 작업 idx
 *   - return_url  : 저장 후 리다이렉트 URL
 *
 * POST mode=update : 수정 저장 처리 후 JSON 반환
 *   응답: {"result":"ok"} 또는 {"result":"fail","msg":"..."}
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$idx = (int)p('idx');
$return_url = p('return_url', '/crm_admin/sub/info_acc_naver.php');
$mode = p('ajax_mode');

// 대행사(level=3) 스코프 가드: 본인이 등록한 작업만 접근
if ($idx > 0 && $admin_level === 3) {
    $own = mysqli_fetch_assoc(mysqli_query($conn,
        "SELECT idx FROM naver_shopping_work WHERE idx = {$idx} AND seller_idx = " . (int)$admin_idx . " LIMIT 1"
    ));
    if (!$own) {
        if ($mode === 'update') {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['result' => 'fail', 'msg' => '권한이 없는 작업입니다.']);
        } else {
            echo '<p class="text-danger">권한이 없는 작업입니다.</p>';
        }
        exit;
    }
}

// ---------------------------------------------------------------
// 저장 처리 — 모든 권한이 작업 수정 가능
// ---------------------------------------------------------------
if ($mode === 'update' && $idx > 0) {
    header('Content-Type: application/json; charset=utf-8');

    $sets = [
        "agency_idx   = " . (int)p('agency_idx'),
        "seller_idx   = " . (int)p('seller_idx'),
        "keyword      = '" . esc(p('keyword')) . "'",
        "keyword_sub1 = '" . esc(p('keyword_sub1')) . "'",
        "keyword_sub2 = '" . esc(p('keyword_sub2')) . "'",
        "product_mid  = '" . esc(p('product_mid')) . "'",
        "product_url  = '" . esc(p('product_url')) . "'",
        "compare_mid  = '" . esc(p('compare_mid')) . "'",
        "compare_url  = '" . esc(p('compare_url')) . "'",
        "inflow_count = " . (int)p('inflow_count'),
        "keyword_type = '" . esc(p('keyword_type')) . "'",
        "start_date   = " . (p('start_date') !== '' ? "'" . esc(p('start_date')) . "'" : 'NULL'),
        "end_date     = " . (p('end_date')   !== '' ? "'" . esc(p('end_date'))   . "'" : 'NULL'),
        "order_date   = " . (p('order_date') !== '' ? "'" . esc(p('order_date')) . "'" : 'NULL'),
        "status       = '" . esc(p('status')) . "'",
        "memo         = '" . esc(p('memo')) . "'",
    ];
    $sql = "UPDATE naver_shopping_work SET " . implode(', ', $sets) . " WHERE idx = {$idx}";
    if (mysqli_query($conn, $sql)) {
        audit_log('update', 'naver_shopping_work', $idx, [
            'keyword' => p('keyword'), 'status' => p('status'),
        ]);
        echo json_encode(['result' => 'ok']);
    } else {
        echo json_encode(['result' => 'fail', 'msg' => mysqli_error($conn)]);
    }
    exit;
}

// ---------------------------------------------------------------
// 상세 조회 (모달 HTML 반환)
// ---------------------------------------------------------------
if ($idx <= 0) { echo '<p class="text-danger">잘못된 요청입니다.</p>'; exit; }

$res = mysqli_query($conn,
    "SELECT w.*, s.name AS seller_name, a.name AS agency_name
     FROM naver_shopping_work w
     LEFT JOIN seller s ON s.idx = w.seller_idx
     LEFT JOIN agency a ON a.idx = w.agency_idx
     WHERE w.idx = {$idx} LIMIT 1"
);
$row = $res ? mysqli_fetch_assoc($res) : null;
if (!$row) { echo '<p class="text-danger">데이터를 찾을 수 없습니다.</p>'; exit; }

$agency_res = mysqli_query($conn, "SELECT idx, name FROM agency ORDER BY name");
$seller_res = mysqli_query($conn,
    "SELECT idx, name FROM admin WHERE level = 3 ORDER BY name"
);
$status_options = ['대기', '작업중', '중지', '환불요청', '환불완료', '연장처리', '작업완료', '삭제요청'];
$type_options   = ['쇼핑'];
?>
<form id="editForm" onsubmit="return submitNaverEdit(event, <?= $idx ?>, '<?= h($return_url) ?>');">
    <div class="row g-2">
        <div class="col-md-6">
            <label class="form-label small fw-bold">대행사</label>
            <select name="agency_idx" class="form-select form-select-sm">
                <?php while ($a = mysqli_fetch_assoc($agency_res)): ?>
                    <option value="<?= (int)$a['idx'] ?>" <?= (int)$a['idx'] === (int)$row['agency_idx'] ? 'selected' : '' ?>><?= h($a['name']) ?></option>
                <?php endwhile; ?>
            </select>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">셀러</label>
            <select name="seller_idx" class="form-select form-select-sm">
                <?php while ($s = mysqli_fetch_assoc($seller_res)): ?>
                    <option value="<?= (int)$s['idx'] ?>" <?= (int)$s['idx'] === (int)$row['seller_idx'] ? 'selected' : '' ?>><?= h($s['name']) ?></option>
                <?php endwhile; ?>
            </select>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">키워드</label>
            <input type="text" name="keyword" value="<?= h($row['keyword']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">광고 타입</label>
            <select name="keyword_type" class="form-select form-select-sm">
                <?php foreach ($type_options as $t): ?>
                    <option value="<?= h($t) ?>" <?= $t === $row['keyword_type'] ? 'selected' : '' ?>><?= h($t) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">서브 키워드1</label>
            <input type="text" name="keyword_sub1" value="<?= h($row['keyword_sub1']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">서브 키워드2</label>
            <input type="text" name="keyword_sub2" value="<?= h($row['keyword_sub2']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">상품 MID</label>
            <input type="text" name="product_mid" value="<?= h($row['product_mid']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">상품 URL</label>
            <input type="url" name="product_url" value="<?= h($row['product_url']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">가격비교 MID</label>
            <input type="text" name="compare_mid" value="<?= h($row['compare_mid']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-6">
            <label class="form-label small fw-bold">가격비교 URL</label>
            <input type="url" name="compare_url" value="<?= h($row['compare_url']) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-3">
            <label class="form-label small fw-bold">시작일</label>
            <input type="text" name="start_date" value="<?= h($row['start_date']) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-3">
            <label class="form-label small fw-bold">종료일</label>
            <input type="text" name="end_date" value="<?= h($row['end_date']) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-3">
            <label class="form-label small fw-bold">주문일</label>
            <input type="text" name="order_date" value="<?= h($row['order_date']) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-4">
            <label class="form-label small fw-bold">유입수</label>
            <input type="number" name="inflow_count" value="<?= (int)$row['inflow_count'] ?>" class="form-control form-control-sm" min="0">
        </div>
        <div class="col-md-4">
            <label class="form-label small fw-bold">상태</label>
            <select name="status" class="form-select form-select-sm">
                <?php foreach ($status_options as $opt): ?>
                    <option value="<?= h($opt) ?>" <?= $opt === $row['status'] ? 'selected' : '' ?>><?= h($opt) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-4">
            <label class="form-label small fw-bold text-muted">수정일</label>
            <input type="text" value="<?= h($row['mod_date']) ?>" class="form-control form-control-sm" readonly>
        </div>
        <div class="col-12">
            <label class="form-label small fw-bold">비고</label>
            <textarea name="memo" class="form-control form-control-sm" rows="2"><?= h($row['memo']) ?></textarea>
        </div>
    </div>
    <div class="mt-3 text-end">
        <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">닫기</button>
        <button type="submit" class="btn btn-sm btn-dark">저장</button>
    </div>
</form>
<script>
if (window.flatpickr) flatpickr('#editForm .datepicker', { dateFormat: 'Y-m-d', locale: 'ko', allowInput: true });
function submitNaverEdit(e, idx, return_url) {
    e.preventDefault();
    const data = $(e.target).serializeArray();
    data.push({ name: 'idx', value: idx });
    data.push({ name: 'ajax_mode', value: 'update' });
    $.post('/crm_admin/ajax/naver.info.ajax.php', data, function (res) {
        if (res.result === 'ok') {
            location.href = return_url;
        } else {
            alert('저장 실패: ' + (res.msg || '알 수 없는 오류'));
        }
    }, 'json');
    return false;
}
</script>
