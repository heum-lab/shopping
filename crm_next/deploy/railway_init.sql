-- ============================================================
-- Railway (또는 다른 매니지드 MySQL)용 초기 스키마
-- schema.sql + migration 008, 009 통합본
-- Railway Data 탭의 Query 창에 전체 복사 → Run 한 번이면 끝
--
-- 주의: 기존 schema.sql 에 있던
--   CREATE DATABASE IF NOT EXISTS onepickacount_crm;
--   USE onepickacount_crm;
-- 두 줄은 Railway에 권한이 없어 실패하므로 제외했습니다.
-- Railway가 제공하는 기본 DB(보통 `railway`) 안에 그대로 생성됩니다.
-- ============================================================

-- ------------------------------------------------------------
-- 관리자 계정
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin` (
    `idx`         INT AUTO_INCREMENT PRIMARY KEY,
    `id`          VARCHAR(50)  NOT NULL UNIQUE,
    `pw`          VARCHAR(255) NOT NULL,
    `name`        VARCHAR(50)  NOT NULL,
    `agency_name` VARCHAR(100) NULL COMMENT '대행사명 (대행사 계정용)',
    `level`       TINYINT      NOT NULL DEFAULT 1 COMMENT '1=슈퍼, 2=대행사, 3=셀러',
    `agency_idx`  INT          NULL COMMENT 'level=2인 경우 소속 대행사',
    `seller_idx`  INT          NULL COMMENT 'level=3인 경우 본인 셀러',
    `created_by`  INT          NULL COMMENT '계정을 등록한 admin.idx',
    `reg_date`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_level` (`level`),
    KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 대행사
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agency` (
    `idx`         INT AUTO_INCREMENT PRIMARY KEY,
    `name`        VARCHAR(100) NOT NULL,
    `maketer_idx` INT          NULL COMMENT '상위 마케터 admin.idx',
    `reg_date`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_maketer` (`maketer_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 셀러
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `seller` (
    `idx`          INT AUTO_INCREMENT PRIMARY KEY,
    `name`         VARCHAR(100) NOT NULL,
    `manager_name` VARCHAR(50)  NULL COMMENT '담당자명',
    `agency_idx`   INT          NOT NULL,
    `reg_date`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_agency` (`agency_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 네이버쇼핑 작업
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `naver_shopping_work` (
    `idx`             INT AUTO_INCREMENT PRIMARY KEY,
    `agency_idx`      INT          NOT NULL,
    `seller_idx`      INT          NOT NULL,
    `ad_product`      VARCHAR(100) NULL,
    `keyword`         VARCHAR(100) NOT NULL,
    `keyword_sub1`    VARCHAR(100) NULL,
    `keyword_sub2`    VARCHAR(100) NULL,
    `product_mid`     VARCHAR(50)  NOT NULL,
    `product_url`     TEXT         NOT NULL,
    `compare_mid`     VARCHAR(50)  NULL,
    `compare_url`     TEXT         NULL,
    `inflow_count`    INT          NOT NULL DEFAULT 0,
    `keyword_type`    VARCHAR(20)  NOT NULL COMMENT '통검/쇼검/통+쇼검/랜딩페이지/플러스스토어/기타유입/원픽플러스/팝콘/팝핀',
    `order_date`      DATE         NULL,
    `start_date`      DATE         NULL,
    `end_date`        DATE         NULL,
    `drive_days`      VARCHAR(10)  NULL,
    `payment_date`    DATE         NULL,
    `rank_first`      INT          NULL,
    `rank_current`    INT          NULL,
    `rank_yesterday`  INT          NULL,
    `status`          VARCHAR(20)  NOT NULL DEFAULT '대기',
    `refund_date`     DATE         NULL,
    `memo`            TEXT         NULL,
    `reg_date`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `mod_date`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_agency`  (`agency_idx`),
    KEY `idx_seller`  (`seller_idx`),
    KEY `idx_status`  (`status`),
    KEY `idx_reg`     (`reg_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 추가 6개 채널 (동일 스키마)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `place_work`  LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `blog_work`   LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `inflow_work` LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `ohouse_work` LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `kakao_work`  LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `auto_work`   LIKE `naver_shopping_work`;

-- ------------------------------------------------------------
-- 순위 이력
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rank_history` (
    `idx`        INT AUTO_INCREMENT PRIMARY KEY,
    `channel`    VARCHAR(20)  NOT NULL COMMENT 'naver/place/inflow/blog/ohouse/kakao/auto',
    `work_idx`   INT          NOT NULL,
    `keyword`    VARCHAR(100) NOT NULL,
    `rank`       INT          NULL,
    `memo`       VARCHAR(200) NULL,
    `admin_idx`  INT          NULL COMMENT '기록한 관리자',
    `check_date` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_ch_work` (`channel`, `work_idx`),
    KEY `idx_check`   (`check_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `naver_rank_history` (
    `idx`         INT AUTO_INCREMENT PRIMARY KEY,
    `work_idx`    INT          NOT NULL COMMENT 'naver_shopping_work.idx',
    `keyword`     VARCHAR(100) NOT NULL,
    `rank`        INT          NULL,
    `check_date`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_work` (`work_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 감사 로그
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
    `idx`         INT AUTO_INCREMENT PRIMARY KEY,
    `admin_idx`   INT          NULL,
    `admin_id`    VARCHAR(50)  NULL COMMENT '행동 시점의 ID 스냅샷',
    `action`      VARCHAR(50)  NOT NULL COMMENT 'login/logout/insert/update/delete/bulk_update/change_pw/upload_bulk',
    `entity_type` VARCHAR(50)  NOT NULL COMMENT '테이블명 또는 auth',
    `entity_idx`  INT          NULL,
    `detail`      TEXT         NULL COMMENT 'JSON (before/after, counts 등)',
    `ip`          VARCHAR(45)  NULL,
    `user_agent`  VARCHAR(255) NULL,
    `reg_date`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_admin`  (`admin_idx`),
    KEY `idx_reg`    (`reg_date`),
    KEY `idx_entity` (`entity_type`, `entity_idx`),
    KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
