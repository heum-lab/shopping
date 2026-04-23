<?php
/**
 * 감사 로그 정리 스크립트 (CLI 전용)
 *
 * 사용 예:
 *   php crm_admin/cron/cleanup_audit_log.php                # 기본: 90일 이상 된 로그 삭제
 *   php crm_admin/cron/cleanup_audit_log.php --days=180     # 180일 보관
 *   php crm_admin/cron/cleanup_audit_log.php --dry-run      # 삭제 없이 건수만 출력
 *
 * cron 예 (매일 새벽 3시):
 *   0 3 * * * /usr/bin/php /var/www/crm_admin/cron/cleanup_audit_log.php --days=90 >> /var/log/crm_audit_cleanup.log 2>&1
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die("CLI only.\n");
}

require_once __DIR__ . '/../include/db.php';
require_once __DIR__ . '/../include/func.php';

// ---------------------------------------------------------------
// 인자 파싱
// ---------------------------------------------------------------
$opts     = getopt('', ['days::', 'dry-run']);
$retain   = isset($opts['days']) ? max(1, (int)$opts['days']) : 90;
$dry_run  = isset($opts['dry-run']);

// ---------------------------------------------------------------
// 중복 실행 방지 (파일 잠금)
// ---------------------------------------------------------------
$lock_path = sys_get_temp_dir() . '/crm_cleanup_audit_log.lock';
$lock_fp   = fopen($lock_path, 'c');
if (!$lock_fp || !flock($lock_fp, LOCK_EX | LOCK_NB)) {
    fwrite(STDERR, "[WARN] already running (lock held).\n");
    exit(1);
}

// ---------------------------------------------------------------
// 카운트 → 삭제
// ---------------------------------------------------------------
$cutoff_expr = "DATE_SUB(NOW(), INTERVAL {$retain} DAY)";

$cnt_row = mysqli_fetch_assoc(mysqli_query($conn,
    "SELECT COUNT(*) AS cnt FROM audit_log WHERE reg_date < {$cutoff_expr}"
));
$target = (int)($cnt_row['cnt'] ?? 0);

$mode_label = $dry_run ? 'DRY RUN' : 'DELETE';
fprintf(STDOUT, "[%s] [%s] retention=%d days, target=%d rows\n",
    date('Y-m-d H:i:s'), $mode_label, $retain, $target);

if ($target === 0) {
    fwrite(STDOUT, "Nothing to clean up.\n");
    exit(0);
}

if ($dry_run) {
    fwrite(STDOUT, "Dry-run complete. No rows deleted.\n");
    exit(0);
}

$ok = mysqli_query($conn,
    "DELETE FROM audit_log WHERE reg_date < {$cutoff_expr}"
);
if (!$ok) {
    fwrite(STDERR, "[ERROR] delete failed: " . mysqli_error($conn) . "\n");
    exit(2);
}
$deleted = mysqli_affected_rows($conn);
fprintf(STDOUT, "Deleted %d rows.\n", $deleted);

// 정리 자체도 감사 로그에 남긴다 (시스템 액터)
audit_log('cleanup', 'audit_log', null,
    ['retain_days' => $retain, 'deleted' => $deleted],
    ['admin_idx' => null, 'admin_id' => 'system.cron']
);

// ---------------------------------------------------------------
// 잠금 해제
// ---------------------------------------------------------------
flock($lock_fp, LOCK_UN);
fclose($lock_fp);
@unlink($lock_path);
