<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

require_super();

define('PAGE_TITLE', '감사 로그 — CONTROL');

// -------------------------------------------------------------
// 검색 파라미터
// -------------------------------------------------------------
$pass_admin  = p('pass_admin');
$pass_action = p('pass_action');
$pass_entity = p('pass_entity');
$pass_date   = p('pass_date',  date('Y-m-d', strtotime('-7 days')));
$pass_date2  = p('pass_date2', date('Y-m-d'));
$per_page    = (int)p('per_page', 50);
if (!in_array($per_page, [50, 100, 200], true)) $per_page = 50;
$page = max(1, (int)p('page', 1));

// -------------------------------------------------------------
// WHERE
// -------------------------------------------------------------
$where = ['1=1'];
if ($pass_admin  !== '') $where[] = "l.admin_idx = " . (int)$pass_admin;
if ($pass_action !== '') $where[] = "l.action = '" . esc($pass_action) . "'";
if ($pass_entity !== '') $where[] = "l.entity_type = '" . esc($pass_entity) . "'";
if ($pass_date   !== '') $where[] = "l.reg_date >= '" . esc($pass_date)  . " 00:00:00'";
if ($pass_date2  !== '') $where[] = "l.reg_date <= '" . esc($pass_date2) . " 23:59:59'";
$where_sql = implode(' AND ', $where);

// -------------------------------------------------------------
// 카운트 + 목록
// -------------------------------------------------------------
$cnt = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT COUNT(*) AS cnt FROM audit_log l WHERE {$where_sql}"
));
$total    = (int)($cnt['cnt'] ?? 0);
$total_pg = max(1, (int)ceil($total / $per_page));
if ($page > $total_pg) $page = $total_pg;
$offset   = ($page - 1) * $per_page;

$list_res = mysqli_query($conn,
    "SELECT l.*, m.name AS admin_name
     FROM audit_log l
     LEFT JOIN admin m ON m.idx = l.admin_idx
     WHERE {$where_sql}
     ORDER BY l.reg_date DESC, l.idx DESC
     LIMIT {$per_page} OFFSET {$offset}"
);

// -------------------------------------------------------------
// 필터 옵션
// -------------------------------------------------------------
$admins = mysqli_query($conn, "SELECT idx, id, name FROM admin ORDER BY name");
$actions = mysqli_query($conn, "SELECT DISTINCT action FROM audit_log ORDER BY action");
$entities = mysqli_query($conn, "SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type");

$action_label_map = [
    'login'        => '로그인',
    'login_fail'   => '로그인 실패',
    'logout'       => '로그아웃',
    'insert'       => '등록',
    'update'       => '수정',
    'delete'       => '삭제',
    'bulk_update'  => '일괄처리',
    'upload_bulk'  => '엑셀 업로드',
    'change_pw'    => '비밀번호 변경',
];
$action_color_map = [
    'login'       => '#198754', 'login_fail' => '#dc3545', 'logout' => '#6c757d',
    'insert'      => '#0d6efd', 'update'     => '#0dcaf0', 'delete' => '#dc3545',
    'bulk_update' => '#fd7e14', 'upload_bulk' => '#6f42c1', 'change_pw' => '#ffc107',
];

function action_badge($a, $map, $color_map) {
    $label = $map[$a] ?? $a;
    $color = $color_map[$a] ?? '#6c757d';
    return '<span class="badge" style="background:' . $color . ';color:#fff;">' . h($label) . '</span>';
}

include __DIR__ . '/../include/header.php';
?>

<h2 class="page-title">감사 로그 <span class="text-muted small">총 <?= number_format($total) ?>건</span></h2>

<form method="get" class="search-box">
    <div class="row g-2 align-items-end">
        <div class="col-md-2">
            <label>관리자</label>
            <select name="pass_admin" class="form-select form-select-sm">
                <option value="">전체</option>
                <?php while ($m = mysqli_fetch_assoc($admins)): ?>
                    <option value="<?= (int)$m['idx'] ?>" <?= (string)$pass_admin === (string)$m['idx'] ? 'selected' : '' ?>>
                        <?= h($m['name']) ?> (<?= h($m['id']) ?>)
                    </option>
                <?php endwhile; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label>액션</label>
            <select name="pass_action" class="form-select form-select-sm">
                <option value="">전체</option>
                <?php while ($a = mysqli_fetch_assoc($actions)): ?>
                    <option value="<?= h($a['action']) ?>" <?= $pass_action === $a['action'] ? 'selected' : '' ?>>
                        <?= h($action_label_map[$a['action']] ?? $a['action']) ?>
                    </option>
                <?php endwhile; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label>엔티티</label>
            <select name="pass_entity" class="form-select form-select-sm">
                <option value="">전체</option>
                <?php while ($e = mysqli_fetch_assoc($entities)): ?>
                    <option value="<?= h($e['entity_type']) ?>" <?= $pass_entity === $e['entity_type'] ? 'selected' : '' ?>>
                        <?= h($e['entity_type']) ?>
                    </option>
                <?php endwhile; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" value="<?= h($pass_date) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" value="<?= h($pass_date2) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-2 d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-dark flex-grow-1">검색</button>
            <a href="/crm_admin/sub/audit_log.php" class="btn btn-sm btn-outline-secondary">초기화</a>
        </div>
    </div>
</form>

<div class="d-flex justify-content-end align-items-center mb-2">
    <label class="small text-muted mb-0 me-2">표시</label>
    <select class="form-select form-select-sm" style="width:auto;"
            onchange="window.location.href='?<?= h(build_qs(['per_page' => '__V__', 'page' => 1])) ?>'.replace('__V__', this.value)">
        <?php foreach ([50, 100, 200] as $pp): ?>
            <option value="<?= $pp ?>" <?= $per_page === $pp ? 'selected' : '' ?>><?= $pp ?>개</option>
        <?php endforeach; ?>
    </select>
</div>

<div class="table-responsive">
    <table class="table table-bordered table-hover data-table align-middle" style="font-size:12px;">
        <thead>
            <tr>
                <th style="width:160px;">시각</th>
                <th style="width:140px;">관리자</th>
                <th style="width:110px;">액션</th>
                <th style="width:160px;">엔티티</th>
                <th style="width:80px;">대상 idx</th>
                <th>상세</th>
                <th style="width:110px;">IP</th>
            </tr>
        </thead>
        <tbody>
        <?php if ($total === 0): ?>
            <tr><td colspan="7" class="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
        <?php else: while ($r = mysqli_fetch_assoc($list_res)): ?>
            <tr>
                <td><?= h($r['reg_date']) ?></td>
                <td><?= h($r['admin_name'] ?: $r['admin_id']) ?: '<span class="text-muted">-</span>' ?></td>
                <td><?= action_badge($r['action'], $action_label_map, $action_color_map) ?></td>
                <td><code><?= h($r['entity_type']) ?></code></td>
                <td class="text-end"><?= $r['entity_idx'] !== null ? h($r['entity_idx']) : '<span class="text-muted">-</span>' ?></td>
                <td>
                    <?php if ($r['detail']): ?>
                        <code class="small" style="word-break:break-all;"><?= h($r['detail']) ?></code>
                    <?php else: ?>
                        <span class="text-muted">-</span>
                    <?php endif; ?>
                </td>
                <td class="small text-muted"><?= h($r['ip']) ?></td>
            </tr>
        <?php endwhile; endif; ?>
        </tbody>
    </table>
</div>

<?php if ($total_pg > 1): ?>
<div class="pagination-wrapper">
    <ul class="pagination pagination-sm">
        <?php $range = 5; $start_pg = max(1, $page - $range); $end_pg = min($total_pg, $page + $range); ?>
        <?php if ($page > 1): ?>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => 1])) ?>">«</a></li>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $page - 1])) ?>">‹</a></li>
        <?php endif; ?>
        <?php for ($i = $start_pg; $i <= $end_pg; $i++): ?>
            <li class="page-item <?= $i === $page ? 'active' : '' ?>"><a class="page-link" href="?<?= h(build_qs(['page' => $i])) ?>"><?= $i ?></a></li>
        <?php endfor; ?>
        <?php if ($page < $total_pg): ?>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $page + 1])) ?>">›</a></li>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $total_pg])) ?>">»</a></li>
        <?php endif; ?>
    </ul>
</div>
<?php endif; ?>

<?php include __DIR__ . '/../include/footer.php'; ?>
