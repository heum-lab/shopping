<?php
require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/session.php';
require_once __DIR__ . '/../include/func.php';

define('PAGE_TITLE', '네이버쇼핑 — CONTROL');

// -------------------------------------------------------------
// 1. 모드 처리 (POST): 단건 등록 / 일괄 상태 변경 / 삭제
// -------------------------------------------------------------
$mode = p('mode');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mode !== '') {
    // 모든 권한(슈퍼관리자/관리자/대행사)이 작업 등록·수정 가능
    $return_url = p('return_url', '/crm_admin/sub/info_acc_naver.php');

    if ($mode === 'insert') {
        $fields = [
            'agency_idx'   => (int)p('agency_idx'),
            'seller_idx'   => (int)p('seller_idx'),
            'ad_product'   => esc(p('ad_product')),
            'keyword'      => esc(p('keyword')),
            'keyword_sub1' => esc(p('keyword_sub1')),
            'keyword_sub2' => esc(p('keyword_sub2')),
            'product_mid'  => esc(p('product_mid')),
            'product_url'  => esc(p('product_url')),
            'compare_mid'  => esc(p('compare_mid')),
            'compare_url'  => esc(p('compare_url')),
            'inflow_count' => (int)p('inflow_count'),
            'keyword_type' => esc(p('keyword_type')),
            'start_date'   => esc(p('start_date')),
            'end_date'     => esc(p('end_date')),
            'order_date'   => esc(p('order_date')),
            'status'       => esc(p('status', '대기')),
            'memo'         => esc(p('memo')),
        ];
        $cols = implode(',', array_keys($fields));
        $vals = "'" . implode("','", array_map(fn($v) => (string)$v, $fields)) . "'";
        mysqli_query($conn, "INSERT INTO naver_shopping_work ({$cols}) VALUES ({$vals})");
        $new_idx = (int)mysqli_insert_id($conn);
        audit_log('insert', 'naver_shopping_work', $new_idx, [
            'keyword' => $fields['keyword'], 'product_mid' => $fields['product_mid'],
            'agency_idx' => (int)$fields['agency_idx'], 'seller_idx' => (int)$fields['seller_idx'],
        ]);
        header('Location: ' . $return_url);
        exit;
    }

    // 일괄 상태 변경
    $check_idx = $_POST['check_idx'] ?? [];
    $check_idx = array_map('intval', (array)$check_idx);
    $check_idx = array_filter($check_idx, fn($v) => $v > 0);

    if (!empty($check_idx)) {
        $idx_in = implode(',', $check_idx);

        audit_log('bulk_update', 'naver_shopping_work', null, [
            'mode' => $mode, 'ids' => $check_idx, 'count' => count($check_idx),
            'extend_days' => (int)p('extend_days', 0),
        ]);

        switch ($mode) {
            case 'etc_date_act':
                $days = (int)p('extend_days', 0);
                if ($days > 0) {
                    mysqli_query($conn,
                        "UPDATE naver_shopping_work
                         SET status = '연장처리',
                             drive_days = '{$days}',
                             end_date = DATE_ADD(IFNULL(end_date, CURDATE()), INTERVAL {$days} DAY)
                         WHERE idx IN ({$idx_in})"
                    );
                }
                break;
            case 'move_working':
                mysqli_query($conn, "UPDATE naver_shopping_work SET status = '작업중' WHERE idx IN ({$idx_in})");
                break;
            case 'refund_req':
                mysqli_query($conn, "UPDATE naver_shopping_work SET status = '환불요청', refund_date = CURDATE() WHERE idx IN ({$idx_in})");
                break;
            case 'delete_req':
                mysqli_query($conn, "UPDATE naver_shopping_work SET status = '삭제요청' WHERE idx IN ({$idx_in})");
                break;
            case 'del_mode':
                mysqli_query($conn, "DELETE FROM naver_shopping_work WHERE idx IN ({$idx_in})");
                break;
        }
    }
    header('Location: ' . $return_url);
    exit;
}

// -------------------------------------------------------------
// 2. 검색 파라미터 수집 (pass_* 규약)
// -------------------------------------------------------------
$pass_assign    = p('pass_assign');      // 셀러
$pass_assign3   = p('pass_assign3');     // 대행사
$pass_status    = p('pass_status');
$pass_date_type = p('pass_date_type', 'start_date');
$pass_date      = p('pass_date');
$pass_date2     = p('pass_date2');
$pass_input_type = p('pass_input_type', 'seller_name');
$pass_input     = p('pass_input');
$pass_shortcut  = p('pass_shortcut');
$per_page       = (int)p('per_page', 50);
if (!in_array($per_page, [50, 70, 100, 130, 150], true)) $per_page = 50;
$sort           = p('sort', 'reg_date');
$sort_dir       = p('sort_dir', 'desc') === 'asc' ? 'ASC' : 'DESC';
$page           = max(1, (int)p('page', 1));

if ($pass_shortcut !== '') {
    [$sd, $ed] = date_shortcut($pass_shortcut);
    if ($sd) { $pass_date = $sd; $pass_date2 = $ed; }
}

// -------------------------------------------------------------
// 3. WHERE 구성
// -------------------------------------------------------------
$where = ['1=1'];

// 레벨 스코프 자동 적용 (슈퍼=1 은 무제한)
// 대행사(level=3) 는 본인이 등록한 작업만 조회
if ($admin_level === 3) $where[] = "w.seller_idx = " . (int)$admin_idx;

// 슈퍼만 대행사 필터 사용 가능 (하위 레벨은 스코프로 고정)
if (is_super() && $pass_assign3 !== '') {
    $where[] = "w.agency_idx = " . (int)$pass_assign3;
}
// 슈퍼 + 대행사(level 2)는 셀러 필터 추가 사용 가능 (레벨 2는 본인 소속 셀러만 드롭다운에 노출됨)
if ($admin_level <= 3 && $pass_assign !== '') {
    $where[] = "w.seller_idx = " . (int)$pass_assign;
}
if ($pass_status !== '') $where[] = "w.status = '" . esc($pass_status) . "'";

$date_col_map = [
    'start_date'  => 'w.start_date',
    'end_date'    => 'w.end_date',
    'order_date'  => 'w.order_date',
    'refund_date' => 'w.refund_date',
];
$date_col = $date_col_map[$pass_date_type] ?? 'w.start_date';
if ($pass_date  !== '') $where[] = "{$date_col} >= '" . esc($pass_date)  . "'";
if ($pass_date2 !== '') $where[] = "{$date_col} <= '" . esc($pass_date2) . "'";

if ($pass_input !== '') {
    $kw = esc($pass_input);
    switch ($pass_input_type) {
        case 'seller_name': $where[] = "s.name LIKE '%{$kw}%'"; break;
        case 'keyword':     $where[] = "w.keyword LIKE '%{$kw}%'"; break;
        case 'product_mid': $where[] = "w.product_mid = '{$kw}'"; break;
    }
}

$where_sql = implode(' AND ', $where);

// -------------------------------------------------------------
// 4. 정렬 허용 화이트리스트
// -------------------------------------------------------------
$sort_white = ['reg_date', 'start_date', 'end_date', 'refund_date'];
if (!in_array($sort, $sort_white, true)) $sort = 'reg_date';

// -------------------------------------------------------------
// 5. 카운트 + 목록 조회
// -------------------------------------------------------------
$count_sql = "SELECT COUNT(*) AS cnt
              FROM naver_shopping_work w
              LEFT JOIN admin  s ON s.idx = w.seller_idx
              LEFT JOIN agency a ON a.idx = w.agency_idx
              WHERE {$where_sql}";
$cnt_row   = mysqli_fetch_assoc(mysqli_query($conn, $count_sql));
$total     = (int)($cnt_row['cnt'] ?? 0);
$total_pg  = max(1, (int)ceil($total / $per_page));
if ($page > $total_pg) $page = $total_pg;
$offset    = ($page - 1) * $per_page;

$list_sql = "SELECT w.*, s.name AS seller_name, a.name AS agency_name
             FROM naver_shopping_work w
             LEFT JOIN admin  s ON s.idx = w.seller_idx
             LEFT JOIN agency a ON a.idx = w.agency_idx
             WHERE {$where_sql}
             ORDER BY w.{$sort} {$sort_dir}, w.idx DESC
             LIMIT {$per_page} OFFSET {$offset}";
$list_res  = mysqli_query($conn, $list_sql);

// -------------------------------------------------------------
// 6. 셀렉트 박스용 데이터
// -------------------------------------------------------------
$agency_res = mysqli_query($conn, "SELECT idx, name FROM agency ORDER BY name");
// 셀러(=대행사 계정) = level=3 admin. 본인(대행사 권한자)는 자기 자신만 노출.
$seller_where_sql = "WHERE level = 3";
if ($admin_level === 3) {
    $seller_where_sql .= " AND idx = " . (int)$admin_idx;
}
$seller_res = mysqli_query($conn,
    "SELECT idx, name FROM admin {$seller_where_sql} ORDER BY name"
);

$status_options   = ['대기', '작업중', '중지', '환불요청', '환불완료', '연장처리', '작업완료', '삭제요청'];
$date_type_labels = ['start_date' => '시작일', 'end_date' => '종료일', 'order_date' => '주문일', 'refund_date' => '환불요청일'];
$input_type_labels = ['seller_name' => '셀러명', 'keyword' => '키워드', 'product_mid' => '상품MID'];
$shortcuts         = [
    'today' => '오늘', 'yesterday' => '어제', 'today_yesterday' => '오늘·어제',
    '7days' => '7일전', '1m' => '1개월', '3m' => '3개월', '6m' => '6개월',
    '12m' => '12개월', 'this_month' => '이번달', 'last_month' => '이전달',
];

include __DIR__ . '/../include/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-2">
    <h2 class="page-title mb-0">네이버쇼핑 작업 관리 <span class="text-muted small">총 <?= number_format($total) ?>건</span></h2>
    <div>
        <?php if ($admin_level <= 3): ?>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#showModalInsert">+ 상품 등록</button>
            <a class="btn btn-sm btn-outline-secondary" href="/crm_admin/ajax/xls.download.ajax.php?xls_mode=template">엑셀 양식</a>
        <?php endif; ?>
        <a class="btn btn-sm btn-outline-secondary" href="/crm_admin/ajax/xls.download.ajax.php?<?= h(build_qs(['xls_mode' => 'search'])) ?>">검색결과 다운로드</a>
        <?php if ($admin_level <= 3): ?>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#showModalUpload">엑셀 대량등록</button>
        <?php endif; ?>
    </div>
</div>

<!-- 검색 폼 -->
<form name="searchfrm" method="get" class="search-box">
    <input type="hidden" name="pass_shortcut" value="">
    <div class="row g-2 align-items-end">
        <?php if (is_super()): ?>
            <div class="col-md-2">
                <label>대행사</label>
                <select name="pass_assign3" class="form-select form-select-sm">
                    <option value="">전체</option>
                    <?php mysqli_data_seek($agency_res, 0); while ($a = mysqli_fetch_assoc($agency_res)): ?>
                        <option value="<?= (int)$a['idx'] ?>" <?= (string)$pass_assign3 === (string)$a['idx'] ? 'selected' : '' ?>>
                            <?= h($a['name']) ?>
                        </option>
                    <?php endwhile; ?>
                </select>
            </div>
        <?php endif; ?>
        <?php if ($admin_level <= 3): ?>
            <div class="col-md-2">
                <label>셀러</label>
                <select name="pass_assign" class="form-select form-select-sm">
                    <option value="">전체</option>
                    <?php mysqli_data_seek($seller_res, 0); while ($s = mysqli_fetch_assoc($seller_res)): ?>
                        <option value="<?= (int)$s['idx'] ?>" <?= (string)$pass_assign === (string)$s['idx'] ? 'selected' : '' ?>>
                            <?= h($s['name']) ?>
                        </option>
                    <?php endwhile; ?>
                </select>
            </div>
        <?php endif; ?>
        <div class="col-md-2">
            <label>상태</label>
            <select name="pass_status" class="form-select form-select-sm">
                <option value="">전체</option>
                <?php foreach ($status_options as $opt): ?>
                    <option value="<?= h($opt) ?>" <?= $pass_status === $opt ? 'selected' : '' ?>><?= h($opt) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label>날짜 타입</label>
            <select name="pass_date_type" class="form-select form-select-sm">
                <?php foreach ($date_type_labels as $k => $v): ?>
                    <option value="<?= h($k) ?>" <?= $pass_date_type === $k ? 'selected' : '' ?>><?= h($v) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-2">
            <label>시작일</label>
            <input type="text" name="pass_date" value="<?= h($pass_date) ?>" class="form-control form-control-sm datepicker" placeholder="YYYY-MM-DD">
        </div>
        <div class="col-md-2">
            <label>종료일</label>
            <input type="text" name="pass_date2" value="<?= h($pass_date2) ?>" class="form-control form-control-sm datepicker" placeholder="YYYY-MM-DD">
        </div>
    </div>

    <div class="row g-2 align-items-end mt-1">
        <div class="col-md-2">
            <label>검색 구분</label>
            <select name="pass_input_type" class="form-select form-select-sm">
                <?php foreach ($input_type_labels as $k => $v): ?>
                    <option value="<?= h($k) ?>" <?= $pass_input_type === $k ? 'selected' : '' ?>><?= h($v) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="col-md-3">
            <label>검색어</label>
            <input type="text" name="pass_input" value="<?= h($pass_input) ?>" class="form-control form-control-sm">
        </div>
        <div class="col-md-5">
            <label>간편 조회</label>
            <div class="d-flex flex-wrap gap-1">
                <?php foreach ($shortcuts as $k => $v): ?>
                    <button type="button" class="btn btn-sm btn-outline-secondary btn-date-shortcut" data-shortcut="<?= h($k) ?>"><?= h($v) ?></button>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="col-md-2 d-flex gap-1">
            <button type="submit" class="btn btn-sm btn-dark flex-grow-1">검색</button>
            <a href="/crm_admin/sub/info_acc_naver.php" class="btn btn-sm btn-outline-secondary">초기화</a>
        </div>
    </div>
</form>

<!-- 일괄 처리 폼 -->
<form name="check_form2" method="post" action="/crm_admin/sub/info_acc_naver.php">
    <input type="hidden" name="mode" value="">
    <input type="hidden" name="extend_days" value="">
    <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">

    <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="bulk-actions">
            <?php if ($admin_level <= 3): ?>
                <button type="button" class="btn btn-sm btn-outline-success" onclick="$('input[name=extend_days]').val(10); Submit_Check('etc_date_act','10일 연장');">선택 10일 연장</button>
                <button type="button" class="btn btn-sm btn-outline-success" onclick="$('input[name=extend_days]').val(7);  Submit_Check('etc_date_act','7일 연장');">선택 7일 연장</button>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="Submit_Check('move_working','작업중 전환');">작업중 전환</button>
                <button type="button" class="btn btn-sm btn-outline-warning" onclick="Submit_Check('refund_req','환불요청');">환불요청</button>
                <button type="button" class="btn btn-sm btn-outline-danger"  onclick="Submit_Check('delete_req','삭제요청');">삭제요청</button>
                <?php if (is_super()): ?>
                    <button type="button" class="btn btn-sm btn-outline-dark" onclick="Submit_Check('del_mode','완전 삭제');">완전 삭제</button>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <div class="d-flex align-items-center gap-2">
            <label class="small text-muted mb-0">표시</label>
            <select name="per_page" class="form-select form-select-sm" style="width:auto;" onchange="window.location.href='?<?= h(build_qs(['per_page' => '__V__', 'page' => 1])) ?>'.replace('__V__', this.value)">
                <?php foreach ([50, 70, 100, 130, 150] as $pp): ?>
                    <option value="<?= $pp ?>" <?= $per_page === $pp ? 'selected' : '' ?>><?= $pp ?>개</option>
                <?php endforeach; ?>
            </select>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-bordered table-hover data-table align-middle">
            <thead>
                <tr>
                    <?php if ($admin_level <= 3): ?>
                        <th style="width:32px;"><input type="checkbox" class="check-all form-check-input"></th>
                    <?php endif; ?>
                    <th style="width:60px;">번호</th>
                    <th>대행사</th>
                    <th>셀러</th>
                    <th>키워드</th>
                    <th>상품MID</th>
                    <th>광고타입</th>
                    <th><a href="?<?= h(build_qs(['sort' => 'start_date', 'sort_dir' => ($sort === 'start_date' && $sort_dir === 'ASC') ? 'desc' : 'asc'])) ?>">시작일 <span class="sort-arrow <?= $sort === 'start_date' ? 'active' : '' ?>"><?= $sort === 'start_date' ? ($sort_dir === 'ASC' ? '▲' : '▼') : '⇅' ?></span></a></th>
                    <th><a href="?<?= h(build_qs(['sort' => 'end_date', 'sort_dir' => ($sort === 'end_date' && $sort_dir === 'ASC') ? 'desc' : 'asc'])) ?>">종료일 <span class="sort-arrow <?= $sort === 'end_date' ? 'active' : '' ?>"><?= $sort === 'end_date' ? ($sort_dir === 'ASC' ? '▲' : '▼') : '⇅' ?></span></a></th>
                    <th>유입수</th>
                    <th>상태</th>
                    <th style="width:120px;">관리</th>
                </tr>
            </thead>
            <tbody>
            <?php
                $col_count = $admin_level <= 3 ? 12 : 11;
            ?>
            <?php if ($total === 0): ?>
                <tr><td colspan="<?= $col_count ?>" class="text-center text-muted py-4">조회된 데이터가 없습니다.</td></tr>
            <?php else:
                $row_no = $total - $offset;
                while ($r = mysqli_fetch_assoc($list_res)):
            ?>
                <tr>
                    <?php if ($admin_level <= 3): ?>
                        <td><input type="checkbox" name="check_idx[]" value="<?= (int)$r['idx'] ?>" class="form-check-input"></td>
                    <?php endif; ?>
                    <td><?= $row_no-- ?></td>
                    <td><?= h($r['agency_name']) ?></td>
                    <td><?= h($r['seller_name']) ?></td>
                    <td>
                        <?= h($r['keyword']) ?>
                        <?php if ($r['keyword_sub1']): ?><div class="small text-muted"><?= h($r['keyword_sub1']) ?></div><?php endif; ?>
                    </td>
                    <td><?= h($r['product_mid']) ?></td>
                    <td><?= h($r['keyword_type']) ?></td>
                    <td><?= h($r['start_date']) ?></td>
                    <td><?= h($r['end_date']) ?></td>
                    <td class="text-end"><?= number_format((int)$r['inflow_count']) ?></td>
                    <td class="text-center"><?= status_badge($r['status'], $r['drive_days'] ?? '') ?></td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-outline-primary py-0 px-1" onclick="modalpop(<?= (int)$r['idx'] ?>, '<?= h($_SERVER['REQUEST_URI']) ?>');">상세</button>
                    </td>
                </tr>
            <?php endwhile; endif; ?>
            </tbody>
        </table>
    </div>
</form>

<!-- 페이지네이션 -->
<?php if ($total_pg > 1): ?>
<div class="pagination-wrapper">
    <ul class="pagination pagination-sm">
        <?php
        $range = 5;
        $start_pg = max(1, $page - $range);
        $end_pg   = min($total_pg, $page + $range);
        ?>
        <?php if ($page > 1): ?>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => 1])) ?>">«</a></li>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $page - 1])) ?>">‹</a></li>
        <?php endif; ?>
        <?php for ($i = $start_pg; $i <= $end_pg; $i++): ?>
            <li class="page-item <?= $i === $page ? 'active' : '' ?>">
                <a class="page-link" href="?<?= h(build_qs(['page' => $i])) ?>"><?= $i ?></a>
            </li>
        <?php endfor; ?>
        <?php if ($page < $total_pg): ?>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $page + 1])) ?>">›</a></li>
            <li class="page-item"><a class="page-link" href="?<?= h(build_qs(['page' => $total_pg])) ?>">»</a></li>
        <?php endif; ?>
    </ul>
</div>
<?php endif; ?>

<!-- 상세 편집 모달 -->
<div class="modal fade" id="showModalEdit" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">상품 상세</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modalEditBody"></div>
        </div>
    </div>
</div>

<!-- 단건 등록 모달 -->
<div class="modal fade" id="showModalInsert" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <form method="post" action="/crm_admin/sub/info_acc_naver.php">
                <input type="hidden" name="mode" value="insert">
                <input type="hidden" name="return_url" value="<?= h($_SERVER['REQUEST_URI']) ?>">
                <div class="modal-header">
                    <h5 class="modal-title">상품 등록</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-2">
                        <input type="hidden" name="agency_idx" value="0">
                        <?php if ($admin_level === 3): ?>
                            <input type="hidden" name="seller_idx" value="<?= (int)$admin_idx ?>">
                        <?php else: ?>
                            <div class="col-md-6">
                                <label class="form-label small fw-bold">대행사 *</label>
                                <select name="seller_idx" class="form-select form-select-sm" required>
                                    <option value="">선택</option>
                                    <?php mysqli_data_seek($seller_res, 0); while ($s = mysqli_fetch_assoc($seller_res)): ?>
                                        <option value="<?= (int)$s['idx'] ?>"><?= h($s['name']) ?></option>
                                    <?php endwhile; ?>
                                </select>
                            </div>
                        <?php endif; ?>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">키워드 *</label>
                            <input type="text" name="keyword" class="form-control form-control-sm" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">광고 타입 *</label>
                            <select name="keyword_type" class="form-select form-select-sm" required>
                                <option value="쇼핑">쇼핑</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">서브 키워드1</label>
                            <input type="text" name="keyword_sub1" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">서브 키워드2</label>
                            <input type="text" name="keyword_sub2" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">상품 MID *</label>
                            <input type="text" name="product_mid" class="form-control form-control-sm" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">상품 URL *</label>
                            <input type="url" name="product_url" class="form-control form-control-sm" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">가격비교 MID</label>
                            <input type="text" name="compare_mid" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label small fw-bold">가격비교 URL</label>
                            <input type="url" name="compare_url" class="form-control form-control-sm">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">시작일 *</label>
                            <input type="text" name="start_date" class="form-control form-control-sm datepicker" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">종료일 *</label>
                            <input type="text" name="end_date" class="form-control form-control-sm datepicker" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">주문일</label>
                            <input type="text" name="order_date" class="form-control form-control-sm datepicker">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">유입수 *</label>
                            <input type="number" name="inflow_count" class="form-control form-control-sm" value="0" min="0" required>
                        </div>
                        <div class="col-md-4">
                            <label class="form-label small fw-bold">상태 *</label>
                            <select name="status" class="form-select form-select-sm" required>
                                <?php foreach ($status_options as $opt): ?>
                                    <option value="<?= h($opt) ?>" <?= $opt === '대기' ? 'selected' : '' ?>><?= h($opt) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-12">
                            <label class="form-label small fw-bold">비고</label>
                            <textarea name="memo" class="form-control form-control-sm" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">취소</button>
                    <button type="submit" class="btn btn-sm btn-dark">등록하기</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- 엑셀 대량등록 모달 -->
<div class="modal fade" id="showModalUpload" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">엑셀 대량 등록</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="alert alert-light small">
                    <strong>안내:</strong>
                    <ol class="mb-0 ps-3">
                        <li><a href="/crm_admin/ajax/xls.download.ajax.php?xls_mode=template">엑셀 양식 다운로드</a> 후 작성하세요.</li>
                        <li>Excel에서 <strong>다른 이름으로 저장 → CSV UTF-8(쉼표로 분리)</strong> 형식으로 내보내세요.</li>
                        <li>대행사/셀러명은 사전에 시스템에 등록되어 있어야 합니다.</li>
                        <li>날짜는 <code>YYYY-MM-DD</code> 형식을 권장합니다.</li>
                    </ol>
                </div>
                <form id="uploadForm" enctype="multipart/form-data">
                    <div class="mb-2">
                        <label class="form-label small fw-bold">CSV 파일 선택</label>
                        <input type="file" name="excel_file" accept=".csv,.txt" class="form-control form-control-sm" required>
                    </div>
                    <button type="submit" class="btn btn-sm btn-dark" id="uploadSubmitBtn">업로드 실행</button>
                </form>
                <hr>
                <div id="uploadResult" class="small"></div>
            </div>
        </div>
    </div>
</div>

<script>
$('#uploadForm').on('submit', function (e) {
    e.preventDefault();
    const fd = new FormData(this);
    const $btn = $('#uploadSubmitBtn');
    const $result = $('#uploadResult');

    $btn.prop('disabled', true).text('처리 중...');
    $result.html('<span class="text-muted">업로드 중입니다. 잠시만 기다려주세요.</span>');
    showLoading('대량 등록 처리 중...');

    $.ajax({
        url: '/crm_admin/ajax/xls.upload.ajax.php',
        type: 'POST',
        data: fd,
        dataType: 'json',
        processData: false,
        contentType: false,
        success: function (res) {
            if (res.result === 'ok') {
                let html = '<div class="alert alert-success py-2 mb-2">';
                html += '<strong>' + res.inserted + '건</strong> 등록 완료';
                if (res.skipped > 0) html += ', <strong>' + res.skipped + '건</strong> 실패';
                html += '</div>';
                if (res.errors && res.errors.length) {
                    html += '<div class="border rounded p-2 bg-light" style="max-height:200px;overflow:auto;">';
                    html += '<strong>오류 상세:</strong><ul class="mb-0 ps-3">';
                    res.errors.forEach(function (e) { html += '<li>' + e + '</li>'; });
                    html += '</ul></div>';
                }
                if (res.inserted > 0) {
                    html += '<div class="mt-2 text-end"><button type="button" class="btn btn-sm btn-primary" onclick="location.reload();">목록 새로고침</button></div>';
                }
                $result.html(html);
            } else {
                $result.html('<div class="alert alert-danger py-2">' + (res.msg || '업로드 실패') + '</div>');
            }
        },
        error: function () {
            $result.html('<div class="alert alert-danger py-2">서버 오류가 발생했습니다.</div>');
        },
        complete: function () {
            $btn.prop('disabled', false).text('업로드 실행');
            hideLoading();
        },
    });
});
</script>

<?php include __DIR__ . '/../include/footer.php'; ?>
