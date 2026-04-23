-- 전 채널 통합 순위 이력 테이블
-- 기존 naver_rank_history 는 유지(하위 호환) 하되, 신규 기록은 rank_history 로 저장한다.

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
