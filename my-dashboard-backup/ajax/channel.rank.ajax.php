<?php
/**
 * 전 채널 통합 순위 이력 팝업 + 수동 입력
 *
 * GET (팝업):
 *   - channel  : naver/place/inflow/blog/ohouse/kakao/auto
 *   - work_idx : 작업 idx
 *   - keyword  : 표시용 키워드
 *
 * POST (기록 추가):
 *   - rank        : 순위 (숫자, 선택 — 비우면 진입 안됨으로 기록)
 *   - check_date  : 조회 일자 (YYYY-MM-DD, 선택 — 기본 오늘)
 *   - memo        : 메모 (선택)
 *
 * 응답: 전체 HTML (window.open 팝업). POST 처리 후 같은 팝업으로 리다이렉트.
 */
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

$channel  = p('channel');
$work_idx = (int)p('work_idx', p('cr_idx'));  // 레거시 cr_idx 호환
$keyword  = p('keyword');

if (!channel_valid($channel) || $work_idx <= 0) {
    http_response_code(400);
    die('Invalid rank popup request.');
}

$table = channel_table($channel);
$label = channel_label($channel);

// ---------------------------------------------------------------
// 작업 조회 + 스코프 가드
// ---------------------------------------------------------------
$scope_w = ['w.idx = ' . $work_idx];
if ($admin_level === 3) $scope_w[] = "w.seller_idx = " . (int)$admin_idx;

$work = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT w.*, s.name AS seller_name
     FROM {$table} w
     LEFT JOIN admin s ON s.idx = w.seller_idx
     WHERE " . implode(' AND ', $scope_w) . " LIMIT 1"
));

if (!$work) {
    http_response_code(403);
    die('권한이 없거나 존재하지 않는 작업입니다.');
}

$readonly = false;

// ---------------------------------------------------------------
// POST: 새 순위 기록
// ---------------------------------------------------------------
$flash = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$readonly) {
    $rank_in       = p('rank');
    $check_date_in = trim(p('check_date'));
    $memo_in       = trim(p('memo'));

    if ($rank_in === '' && $memo_in === '') {
        $flash = ['type' => 'warning', 'msg' => '순위 또는 메모 중 하나는 입력해야 합니다.'];
    } else {
        $rank_sql  = $rank_in === '' ? 'NULL' : (int)$rank_in;
        $date_sql  = ($check_date_in !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $check_date_in))
                     ? "'" . esc($check_date_in) . " " . date('H:i:s') . "'"
                     : 'CURRENT_TIMESTAMP';

        mysqli_query($conn, sprintf(
            "INSERT INTO rank_history (channel, work_idx, keyword, `rank`, memo, admin_idx, check_date)
             VALUES ('%s', %d, '%s', %s, %s, %s, %s)",
            esc($channel), $work_idx, esc($keyword !== '' ? $keyword : $work['keyword']),
            $rank_sql,
            $memo_in !== '' ? "'" . esc($memo_in) . "'" : 'NULL',
            $admin_idx > 0 ? $admin_idx : 'NULL',
            $date_sql
        ));

        // 작업 테이블의 rank_first / rank_yesterday / rank_current 업데이트
        if ($rank_in !== '') {
            $new_rank = (int)$rank_in;
            // 이전 current 를 yesterday 로 승격 (현재와 비교해 다른 날짜일 때만 자연스럽지만 단순화)
            $prev_current = $work['rank_current'];
            $sets = ["rank_current = {$new_rank}"];
            if ($work['rank_first'] === null) $sets[] = "rank_first = {$new_rank}";
            if ($prev_current !== null && (int)$prev_current !== $new_rank) {
                $sets[] = "rank_yesterday = " . (int)$prev_current;
            }
            mysqli_query($conn, "UPDATE {$table} SET " . implode(', ', $sets) . " WHERE idx = {$work_idx}");
        }

        audit_log('rank_add', 'rank_history', null, [
            'channel' => $channel, 'work_idx' => $work_idx,
            'rank' => $rank_in !== '' ? (int)$rank_in : null,
            'memo' => $memo_in,
        ]);

        // POST → GET 리다이렉트 (새로고침 시 중복 방지)
        $qs = http_build_query(['channel' => $channel, 'work_idx' => $work_idx, 'keyword' => $keyword]);
        header('Location: /crm_admin/ajax/channel.rank.ajax.php?' . $qs . '&saved=1');
        exit;
    }
}
if (isset($_GET['saved'])) $flash = ['type' => 'success', 'msg' => '순위 기록이 추가되었습니다.'];

// ---------------------------------------------------------------
// 이력 조회 (통합 + 레거시 naver_rank_history 합산)
// ---------------------------------------------------------------
$legacy_union = '';
if ($channel === 'naver') {
    $legacy_union = "UNION ALL
        SELECT idx, 'naver' AS channel, work_idx, keyword, `rank`, NULL AS memo, NULL AS admin_idx, check_date
        FROM naver_rank_history WHERE work_idx = {$work_idx}";
}

$hist_sql = "SELECT * FROM (
    SELECT idx, channel, work_idx, keyword, `rank`, memo, admin_idx, check_date
    FROM rank_history WHERE channel = '" . esc($channel) . "' AND work_idx = {$work_idx}
    {$legacy_union}
) x ORDER BY check_date DESC LIMIT 300";
$hist_res = mysqli_query($conn, $hist_sql);
$rows = [];
while ($r = mysqli_fetch_assoc($hist_res)) $rows[] = $r;

// 관리자 이름 매핑
$admin_name_map = [];
$ids = array_filter(array_unique(array_column($rows, 'admin_idx')));
if ($ids) {
    $in = implode(',', array_map('intval', $ids));
    $r  = mysqli_query($conn, "SELECT idx, name FROM admin WHERE idx IN ({$in})");
    while ($a = mysqli_fetch_assoc($r)) $admin_name_map[(int)$a['idx']] = $a['name'];
}

// 차트 데이터 준비 (순위가 있는 것만, 오래된 순 → 최신 순)
$chart_points = array_values(array_filter($rows, fn($r) => $r['rank'] !== null && $r['rank'] !== ''));
$chart_points = array_reverse($chart_points);
$chart_labels = array_map(fn($r) => date('m-d H:i', strtotime($r['check_date'])), $chart_points);
$chart_data   = array_map(fn($r) => (int)$r['rank'], $chart_points);
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>순위 이력 — <?= h($keyword ?: $work['keyword']) ?></title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
    body { font-family: "Noto Sans KR", sans-serif; padding: 16px; background: #f5f6f8; }
    .box { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    table { font-size: 13px; }
    .rank-up   { color: #dc3545; }
    .rank-down { color: #0d6efd; }
</style>
</head>
<body>

<div class="box">
    <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
            <h5 class="mb-1"><span class="badge bg-secondary"><?= h($label) ?></span>
                순위 이력 <small class="text-muted"><?= h($keyword ?: $work['keyword']) ?></small>
            </h5>
            <div class="small text-muted">
                셀러: <strong><?= h($work['seller_name']) ?></strong>
                · MID: <?= h($work['product_mid']) ?>
                · 최초: <?= h($work['rank_first']) ?>
                · 어제: <?= h($work['rank_yesterday']) ?>
                · <strong>현재: <?= h($work['rank_current']) ?></strong>
            </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="window.close();">닫기</button>
    </div>
    <?php if ($flash): ?>
        <div class="alert alert-<?= h($flash['type']) ?> py-2 px-3 small mb-0"><?= h($flash['msg']) ?></div>
    <?php endif; ?>
</div>

<?php if (!$readonly && $channel === 'naver'): ?>
<div class="box">
    <div class="d-flex justify-content-between align-items-center">
        <div class="small fw-bold">네이버 자동 순위 조회</div>
        <button type="button" class="btn btn-sm btn-dark" id="autoFetchBtn">현재 순위 자동 조회</button>
    </div>
    <div class="small text-muted mt-1">상위 5페이지(약 400건)에서 등록된 상품 MID 매칭. 조회 결과는 자동으로 이력에 기록됩니다.</div>
    <div id="autoFetchResult" class="mt-2 small"></div>
</div>
<script>
document.getElementById('autoFetchBtn').addEventListener('click', function () {
    const btn = this;
    const out = document.getElementById('autoFetchResult');
    btn.disabled = true; btn.textContent = '조회중…';
    out.innerHTML = '';
    fetch('/crm_admin/ajax/naver.rank.fetch.ajax.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'work_idx=' + encodeURIComponent(<?= (int)$work_idx ?>),
    })
    .then(r => r.json())
    .then(res => {
        const cls = res.result === 'ok' ? (res.rank ? 'text-success' : 'text-warning') : 'text-danger';
        out.innerHTML = '<span class="' + cls + '">' + (res.msg || '') + '</span>';
        if (res.result === 'ok') {
            setTimeout(() => location.reload(), 800);
        }
    })
    .catch(e => { out.innerHTML = '<span class="text-danger">네트워크 오류: ' + e + '</span>'; })
    .finally(() => { btn.disabled = false; btn.textContent = '현재 순위 자동 조회'; });
});
</script>
<?php endif; ?>

<?php if (!$readonly): ?>
<div class="box">
    <div class="small fw-bold mb-2">새 순위 기록 (수동)</div>
    <form method="post">
        <div class="row g-2 align-items-end">
            <div class="col-md-3">
                <label class="form-label small">조회 일자</label>
                <input type="date" name="check_date" value="<?= date('Y-m-d') ?>" class="form-control form-control-sm">
            </div>
            <div class="col-md-3">
                <label class="form-label small">순위 (숫자)</label>
                <input type="number" name="rank" min="1" placeholder="예: 3" class="form-control form-control-sm">
            </div>
            <div class="col-md-4">
                <label class="form-label small">메모</label>
                <input type="text" name="memo" class="form-control form-control-sm" maxlength="200" placeholder="선택">
            </div>
            <div class="col-md-2">
                <button type="submit" class="btn btn-sm btn-dark w-100">기록 추가</button>
            </div>
        </div>
        <div class="small text-muted mt-1">순위가 비어있어도 메모만 남길 수 있습니다. (예: "진입 실패")</div>
    </form>
</div>
<?php endif; ?>

<?php if (count($chart_data) >= 2): ?>
<div class="box">
    <div class="small fw-bold mb-2">순위 추이 <span class="text-muted">(<?= count($chart_data) ?>개 데이터 포인트, Y축 반전: 위쪽이 상위 순위)</span></div>
    <canvas id="rankTrend" height="90"></canvas>
</div>
<?php elseif (count($chart_data) === 1): ?>
<div class="box small text-muted">단일 기록이라 추이 차트를 그리지 않습니다. 2건 이상 쌓이면 그래프로 표시됩니다.</div>
<?php endif; ?>

<div class="box">
    <div class="small fw-bold mb-2">기록 이력 <span class="text-muted">(<?= count($rows) ?>건, 최대 300건)</span></div>
    <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
                <tr>
                    <th style="width:50px;">#</th>
                    <th style="width:150px;">조회일시</th>
                    <th>키워드</th>
                    <th style="width:80px;">순위</th>
                    <th>메모</th>
                    <th style="width:90px;">기록자</th>
                </tr>
            </thead>
            <tbody>
            <?php if (!$rows): ?>
                <tr><td colspan="6" class="text-center text-muted py-3">조회된 이력이 없습니다.</td></tr>
            <?php else:
                $no = count($rows);
                foreach ($rows as $h):
                    $rec_by = $h['admin_idx'] ? ($admin_name_map[(int)$h['admin_idx']] ?? '-') : '<span class="text-muted">-</span>';
            ?>
                <tr>
                    <td class="text-center"><?= $no-- ?></td>
                    <td><?= h($h['check_date']) ?></td>
                    <td><?= h($h['keyword']) ?></td>
                    <td class="text-end"><?= $h['rank'] !== null ? h($h['rank']) : '<span class="text-muted">-</span>' ?></td>
                    <td class="small"><?= h($h['memo']) ?></td>
                    <td class="small text-muted"><?= $rec_by ?></td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
</div>

<?php if (count($chart_data) >= 2): ?>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
new Chart(document.getElementById('rankTrend'), {
    type: 'line',
    data: {
        labels: <?= json_encode($chart_labels) ?>,
        datasets: [{
            label: '순위',
            data: <?= json_encode($chart_data) ?>,
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.12)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
        }],
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                reverse: true,  // 1위가 위쪽
                beginAtZero: false,
                ticks: { precision: 0, callback: (v) => v + '위' },
            },
        },
    },
});
</script>
<?php endif; ?>

</body>
</html>
