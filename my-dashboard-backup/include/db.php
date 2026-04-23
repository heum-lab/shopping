<?php
/**
 * DB 연결 설정
 * 실제 배포 시 아래 상수를 환경에 맞게 수정하세요.
 */

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'onepickacount_crm');
define('DB_CHARSET', 'utf8mb4');

// 네이버 Open API (https://developers.naver.com 에서 앱 등록 후 발급)
//   - 미설정 시: 비공식 검색 페이지 스크래핑 시도 (현재 네이버가 차단하여 실패할 수 있음)
//   - 설정 시  : 공식 쇼핑 검색 API 사용 (일 25,000건 무료)
define('NAVER_API_CLIENT_ID', '');
define('NAVER_API_CLIENT_SECRET', '');

$conn = @mysqli_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);

if (!$conn) {
    http_response_code(500);
    die('DB 연결 실패: ' . mysqli_connect_error());
}

mysqli_set_charset($conn, DB_CHARSET);
