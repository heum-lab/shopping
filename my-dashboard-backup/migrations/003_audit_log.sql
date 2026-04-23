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
