<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

define('PAGE_TITLE', '대시보드 — CONTROL');

// ------------------------------------------------------------------
// 1. 기간 필터
// ------------------------------------------------------------------
$pass_date  = p('pass_date',  date('Y-m-d', strtotime('-29 days')));
$pass_date2 = p('pass_date2', date('Y-m-d'));

// ------------------------------------------------------------------
// 2. 채널 정의 + 레벨 스코프
// ------------------------------------------------------------------
$channels = [
    'naver'  => ['table' => 'naver_shopping_work', 'label' => '네이버쇼핑'],
    'place'  => ['table' => 'place_work',          'label' => '플레이스'],
    'inflow' => ['table' => 'inflow_work',         'label' => '유입플'],
    'blog'   => ['table' => 'blog_work',           'label' => '블로그'],
    'ohouse' => ['table' => 'ohouse_work',         'label' => '오늘의집'],
    'kakao'  => ['table' => 'kakao_work',          'label' => '카카오맵'],
    'auto'   => ['table' => 'auto_work',           'label' => '자동완성'],
];

// 레벨 스코프 공통 WHERE — 대행사(level=3) 는 본인 작업만
$scope_where = [];
if ($admin_level === 3) $scope_where[] = "seller_idx = " . (int)$admin_idx;

function build_where($extra_where, $scope_where) {
    $w = array_merge(['1=1'], $scope_where, $extra_where);
    return implode(' AND ', $w);
}

// ------------------------------------------------------------------
// 3. 채널별 집계 (UNION ALL 한 번에)
//    - total, active(작업중), refund_request(환불요청), today_new
// ------------------------------------------------------------------
$union_parts = [];
foreach ($channels as $key => $c) {
    $w_base   = build_where([], $scope_where);
    $w_active = build_where(["status = '작업중'"], $scope_where);
    $w_refund = build_where(["status = '환불요청'"], $scope_where);
    $w_today  = build_where(["DATE(reg_date) = CURDATE()"], $scope_where);

    $union_parts[] = "SELECT '{$key}' AS ch,
        (SELECT COUNT(*) FROM {$c['table']} WHERE {$w_base})   AS total,
        (SELECT COUNT(*) FROM {$c['table']} WHERE {$w_active}) AS active,
        (SELECT COUNT(*) FROM {$c['table']} WHERE {$w_refund}) AS refund_req,
        (SELECT COUNT(*) FROM {$c['table']} WHERE {$w_today})  AS today_new";
}
$sum_sql = implode(' UNION ALL ', $union_parts);
$sum_res = mysqli_query($conn, $sum_sql);

$by_channel = [];
$kpi = ['total' => 0, 'active' => 0, 'refund_req' => 0, 'today_new' => 0];
while ($r = mysqli_fetch_assoc($sum_res)) {
    $by_channel[$r['ch']] = $r;
    foreach ($kpi as $k => &$v) $v += (int)$r[$k];
    unset($v);
}

// ------------------------------------------------------------------
// 4. 상태별 분포 (전 채널 합산, 기간 내 등록된 작업)
// ------------------------------------------------------------------
$status_parts = [];
foreach ($channels as $key => $c) {
    $w = build_where([
        "reg_date >= '" . esc($pass_date)  . " 00:00:00'",
        "reg_date <= '" . esc($pass_date2) . " 23:59:59'",
    ], $scope_where);
    $status_parts[] = "SELECT status, COUNT(*) AS cnt FROM {$c['table']} WHERE {$w} GROUP BY status";
}
$status_sql = "SELECT status, SUM(cnt) AS cnt FROM (" . implode(' UNION ALL ', $status_parts) . ") x GROUP BY status ORDER BY cnt DESC";
$status_res = mysqli_query($conn, $status_sql);
$by_status = [];
while ($r = mysqli_fetch_assoc($status_res)) {
    if ($r['status'] !== null && $r['status'] !== '') $by_status[$r['status']] = (int)$r['cnt'];
}

// ------------------------------------------------------------------
// 5. 일별 신규 등록 추이 (기간 내)
// ------------------------------------------------------------------
$trend_parts = [];
foreach ($channels as $key => $c) {
    $w = build_where([
        "reg_date >= '" . esc($pass_date)  . " 00:00:00'",
        "reg_date <= '" . esc($pass_date2) . " 23:59:59'",
    ], $scope_where);
    $trend_parts[] = "SELECT DATE(reg_date) AS d, COUNT(*) AS cnt FROM {$c['table']} WHERE {$w} GROUP BY DATE(reg_date)";
}
$trend_sql = "SELECT d, SUM(cnt) AS cnt FROM (" . implode(' UNION ALL ', $trend_parts) . ") x GROUP BY d ORDER BY d";
$trend_res = mysqli_query($conn, $trend_sql);
$trend_map = [];
while ($r = mysqli_fetch_assoc($trend_res)) $trend_map[$r['d']] = (int)$r['cnt'];

// 기간의 모든 일자 채우기 (0 포함)
$trend_labels = [];
$trend_data   = [];
$start_ts = strtotime($pass_date);
$end_ts   = strtotime($pass_date2);
for ($t = $start_ts; $t <= $end_ts; $t += 86400) {
    $d = date('Y-m-d', $t);
    $trend_labels[] = date('m-d', $t);
    $trend_data[]   = $trend_map[$d] ?? 0;
}

// ------------------------------------------------------------------
// 6. 대행사 Top 10 / 셀러 Top 10
// ------------------------------------------------------------------
$top_agency_sql = "";
$top_seller_sql = "";
if ($admin_level <= 2) {
    // 슈퍼관리자(1) / 관리자(2) 만 Top 대행사/셀러 표시
    $agency_parts = [];
    $seller_parts = [];
    foreach ($channels as $c) {
        $w = build_where([], $scope_where);
        $agency_parts[] = "SELECT agency_idx, COUNT(*) AS cnt FROM {$c['table']} WHERE {$w} GROUP BY agency_idx";
        $seller_parts[] = "SELECT seller_idx, COUNT(*) AS cnt FROM {$c['table']} WHERE {$w} GROUP BY seller_idx";
    }
    $top_agency_sql = "SELECT a.name, SUM(x.cnt) AS cnt
                       FROM (" . implode(' UNION ALL ', $agency_parts) . ") x
                       LEFT JOIN agency a ON a.idx = x.agency_idx
                       GROUP BY a.name
                       ORDER BY cnt DESC
                       LIMIT 10";
    $top_seller_sql = "SELECT s.name, a.name AS agency_name, SUM(x.cnt) AS cnt
                       FROM (" . implode(' UNION ALL ', $seller_parts) . ") x
                       LEFT JOIN seller s ON s.idx = x.seller_idx
                       LEFT JOIN agency a ON a.idx = s.agency_idx
                       GROUP BY s.name, a.name
                       ORDER BY cnt DESC
                       LIMIT 10";
}

$top_agency_rows = [];
$top_seller_rows = [];
if ($top_agency_sql) {
    $r1 = mysqli_query($conn, $top_agency_sql);
    while ($row = mysqli_fetch_assoc($r1)) if ($row['name']) $top_agency_rows[] = $row;
    $r2 = mysqli_query($conn, $top_seller_sql);
    while ($row = mysqli_fetch_assoc($r2)) if ($row['name']) $top_seller_rows[] = $row;
}

// ------------------------------------------------------------------
// 7. 순위 변동 TOP 10 (상승/하락) — 전 채널 UNION
// ------------------------------------------------------------------
$rank_parts = [];
foreach ($channels as $key => $c) {
    $w = build_where([
        'w.rank_yesterday IS NOT NULL',
        'w.rank_current IS NOT NULL',
        'w.rank_yesterday != w.rank_current',
    ], $scope_where);
    $rank_parts[] = "SELECT '{$key}' AS ch, w.idx AS work_idx, w.keyword, s.name AS seller_name,
        w.rank_yesterday, w.rank_current,
        (w.rank_yesterday - w.rank_current) AS delta
        FROM {$c['table']} w
        LEFT JOIN seller s ON s.idx = w.seller_idx
        WHERE {$w}";
}
$rank_union = implode(' UNION ALL ', $rank_parts);

$rank_up_rows = [];
$rank_dn_rows = [];
$r_up = mysqli_query($conn, "SELECT * FROM ({$rank_union}) x WHERE delta > 0 ORDER BY delta DESC LIMIT 10");
while ($row = mysqli_fetch_assoc($r_up)) $rank_up_rows[] = $row;
$r_dn = mysqli_query($conn, "SELECT * FROM ({$rank_union}) x WHERE delta < 0 ORDER BY delta ASC  LIMIT 10");
while ($row = mysqli_fetch_assoc($r_dn)) $rank_dn_rows[] = $row;

// ------------------------------------------------------------------
// 7. 차트용 JSON 데이터
// ------------------------------------------------------------------
$channel_labels = [];
$channel_totals = [];
foreach ($channels as $key => $c) {
    $channel_labels[] = $c['label'];
    $channel_totals[] = (int)($by_channel[$key]['total'] ?? 0);
}

$status_labels = array_keys($by_status);
$status_values = array_values($by_status);

include __DIR__ . '/../include/header.php';
?>

<h2 class="page-title">대시보드</h2>

<!-- 기간 필터 -->
<form method="get" class="search-box">
    <div class="row g-2 align-items-end">
        <div class="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" value="<?= h($pass_date) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" value="<?= h($pass_date2) ?>" class="form-control form-control-sm datepicker">
        </div>
        <div class="col-md-2">
            <button type="submit" class="btn btn-sm btn-dark w-100">조회</button>
        </div>
        <div class="col-md-6 text-end small text-muted">
            KPI는 전체 데이터 기준 · 상태/추이 차트는 선택 기간 내 등록 기준
        </div>
    </div>
</form>

<!-- KPI 카드 -->
<div class="row g-2 mb-3">
    <?php
    $kpi_cards = [
        ['label' => '총 작업',     'value' => $kpi['total'],      'color' => '#0d6efd'],
        ['label' => '작업중',      'value' => $kpi['active'],     'color' => '#198754'],
        ['label' => '오늘 신규',   'value' => $kpi['today_new'],  'color' => '#fd7e14'],
        ['label' => '환불요청',    'value' => $kpi['refund_req'], 'color' => '#dc3545'],
    ];
    foreach ($kpi_cards as $c): ?>
        <div class="col-md-3 col-6">
            <div class="search-box" style="border-left: 4px solid <?= $c['color'] ?>;">
                <div class="small text-muted mb-1"><?= h($c['label']) ?></div>
                <div style="font-size:26px;font-weight:700;color:<?= $c['color'] ?>;"><?= number_format($c['value']) ?></div>
            </div>
        </div>
    <?php endforeach; ?>
</div>

<!-- 차트 영역 -->
<div class="row g-2 mb-3">
    <div class="col-md-7">
        <div class="search-box">
            <h6 class="fw-bold mb-3">채널별 작업 수</h6>
            <canvas id="channelChart" height="220"></canvas>
        </div>
    </div>
    <div class="col-md-5">
        <div class="search-box">
            <h6 class="fw-bold mb-3">상태 분포 <small class="text-muted">(<?= h($pass_date) ?> ~ <?= h($pass_date2) ?> 등록)</small></h6>
            <canvas id="statusChart" height="220"></canvas>
        </div>
    </div>
</div>

<div class="row g-2 mb-3">
    <div class="col-12">
        <div class="search-box">
            <h6 class="fw-bold mb-3">일별 신규 등록 추이</h6>
            <canvas id="trendChart" height="80"></canvas>
        </div>
    </div>
</div>

<!-- 채널별 상세 표 -->
<div class="row g-2 mb-3">
    <div class="col-12">
        <div class="search-box">
            <h6 class="fw-bold mb-3">채널별 현황 상세</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered align-middle data-table mb-0">
                    <thead>
                        <tr>
                            <th>채널</th>
                            <th class="text-end">총 작업</th>
                            <th class="text-end">작업중</th>
                            <th class="text-end">환불요청</th>
                            <th class="text-end">오늘 신규</th>
                            <th style="width:100px;">바로가기</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($channels as $key => $c):
                        $r = $by_channel[$key] ?? ['total' => 0, 'active' => 0, 'refund_req' => 0, 'today_new' => 0];
                        $link = ($key === 'naver') ? 'info_acc_naver.php' : "info_acc_{$key}.php";
                    ?>
                        <tr>
                            <td><?= h($c['label']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['total']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['active']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['refund_req']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['today_new']) ?></td>
                            <td><a class="btn btn-sm btn-outline-secondary py-0 px-2" href="/crm_admin/sub/<?= h($link) ?>">보기</a></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- 순위 변동 TOP -->
<?php if ($rank_up_rows || $rank_dn_rows): ?>
<div class="row g-2 mb-3">
    <div class="col-md-6">
        <div class="search-box">
            <h6 class="fw-bold mb-3">순위 상승 TOP 10 <small class="text-muted">(어제 대비)</small></h6>
            <div class="table-responsive">
                <table class="table table-sm data-table mb-0">
                    <thead>
                        <tr>
                            <th style="width:36px;">#</th>
                            <th style="width:70px;">채널</th>
                            <th>키워드 / 셀러</th>
                            <th class="text-end" style="width:110px;">어제 → 현재</th>
                            <th class="text-end" style="width:70px;">변동</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php if (!$rank_up_rows): ?>
                        <tr><td colspan="5" class="text-center text-muted py-3">상승 데이터가 없습니다.</td></tr>
                    <?php else: foreach ($rank_up_rows as $i => $r):
                        $ch_label = $channels[$r['ch']]['label'] ?? $r['ch'];
                        $link = ($r['ch'] === 'naver') ? 'info_acc_naver.php' : "info_acc_{$r['ch']}.php";
                    ?>
                        <tr>
                            <td><?= $i + 1 ?></td>
                            <td><a class="badge text-decoration-none" style="background:#0d6efd;color:#fff;" href="/crm_admin/sub/<?= h($link) ?>"><?= h($ch_label) ?></a></td>
                            <td>
                                <div><?= h($r['keyword']) ?></div>
                                <div class="small text-muted"><?= h($r['seller_name']) ?></div>
                            </td>
                            <td class="text-end"><?= (int)$r['rank_yesterday'] ?> → <strong><?= (int)$r['rank_current'] ?></strong></td>
                            <td class="text-end rank-up fw-bold">▲<?= (int)$r['delta'] ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="search-box">
            <h6 class="fw-bold mb-3">순위 하락 TOP 10 <small class="text-muted">(어제 대비)</small></h6>
            <div class="table-responsive">
                <table class="table table-sm data-table mb-0">
                    <thead>
                        <tr>
                            <th style="width:36px;">#</th>
                            <th style="width:70px;">채널</th>
                            <th>키워드 / 셀러</th>
                            <th class="text-end" style="width:110px;">어제 → 현재</th>
                            <th class="text-end" style="width:70px;">변동</th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php if (!$rank_dn_rows): ?>
                        <tr><td colspan="5" class="text-center text-muted py-3">하락 데이터가 없습니다.</td></tr>
                    <?php else: foreach ($rank_dn_rows as $i => $r):
                        $ch_label = $channels[$r['ch']]['label'] ?? $r['ch'];
                        $link = ($r['ch'] === 'naver') ? 'info_acc_naver.php' : "info_acc_{$r['ch']}.php";
                    ?>
                        <tr>
                            <td><?= $i + 1 ?></td>
                            <td><a class="badge text-decoration-none" style="background:#6c757d;color:#fff;" href="/crm_admin/sub/<?= h($link) ?>"><?= h($ch_label) ?></a></td>
                            <td>
                                <div><?= h($r['keyword']) ?></div>
                                <div class="small text-muted"><?= h($r['seller_name']) ?></div>
                            </td>
                            <td class="text-end"><?= (int)$r['rank_yesterday'] ?> → <strong><?= (int)$r['rank_current'] ?></strong></td>
                            <td class="text-end rank-down fw-bold">▼<?= abs((int)$r['delta']) ?></td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ($top_agency_rows || $top_seller_rows): ?>
<div class="row g-2 mb-3">
    <?php if ($top_agency_rows): ?>
    <div class="col-md-6">
        <div class="search-box">
            <h6 class="fw-bold mb-3">대행사 Top 10 <small class="text-muted">(총 작업 기준)</small></h6>
            <div class="table-responsive">
                <table class="table table-sm table-striped data-table mb-0">
                    <thead><tr><th style="width:50px;">#</th><th>대행사</th><th class="text-end">작업 수</th></tr></thead>
                    <tbody>
                    <?php foreach ($top_agency_rows as $i => $r): ?>
                        <tr>
                            <td><?= $i + 1 ?></td>
                            <td><?= h($r['name']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['cnt']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <?php endif; ?>
    <?php if ($top_seller_rows): ?>
    <div class="col-md-6">
        <div class="search-box">
            <h6 class="fw-bold mb-3">셀러 Top 10 <small class="text-muted">(총 작업 기준)</small></h6>
            <div class="table-responsive">
                <table class="table table-sm table-striped data-table mb-0">
                    <thead><tr><th style="width:50px;">#</th><th>셀러</th><th>대행사</th><th class="text-end">작업 수</th></tr></thead>
                    <tbody>
                    <?php foreach ($top_seller_rows as $i => $r): ?>
                        <tr>
                            <td><?= $i + 1 ?></td>
                            <td><?= h($r['name']) ?></td>
                            <td class="small text-muted"><?= h($r['agency_name']) ?></td>
                            <td class="text-end"><?= number_format((int)$r['cnt']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>
<?php endif; ?>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
const palette = ['#0d6efd','#198754','#fd7e14','#dc3545','#6f42c1','#20c997','#0dcaf0','#ffc107','#6c757d','#6610f2'];

new Chart(document.getElementById('channelChart'), {
    type: 'bar',
    data: {
        labels: <?= json_encode($channel_labels, JSON_UNESCAPED_UNICODE) ?>,
        datasets: [{
            label: '총 작업',
            data: <?= json_encode($channel_totals) ?>,
            backgroundColor: palette,
            borderRadius: 4,
        }],
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
});

new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
        labels: <?= json_encode($status_labels, JSON_UNESCAPED_UNICODE) ?>,
        datasets: [{
            data: <?= json_encode($status_values) ?>,
            backgroundColor: palette,
            borderWidth: 0,
        }],
    },
    options: {
        responsive: true,
        plugins: { legend: { position: 'right' } },
    },
});

new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
        labels: <?= json_encode($trend_labels) ?>,
        datasets: [{
            label: '신규 등록',
            data: <?= json_encode($trend_data) ?>,
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.12)',
            tension: 0.35,
            fill: true,
            pointRadius: 2,
        }],
    },
    options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
});
</script>

<?php include __DIR__ . '/../include/footer.php'; ?>
