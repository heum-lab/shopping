-- admin.created_by 컬럼 추가
-- 관리자(level=2) 권한자가 자기가 만든 대행사 계정만 볼 수 있도록 추적용 FK 컬럼.
-- 슈퍼관리자 등 직접 등록한 최상위 계정은 NULL 유지.

ALTER TABLE `admin`
    ADD COLUMN `created_by` INT NULL COMMENT '계정을 등록한 admin.idx' AFTER `seller_idx`,
    ADD KEY `idx_created_by` (`created_by`);
