-- 기존 DB에 admin 테이블 스코프 컬럼 추가
-- 신규 설치는 schema.sql 에 이미 반영되어 있음 (이 파일 실행 불필요)

ALTER TABLE `admin`
    ADD COLUMN `agency_idx` INT NULL COMMENT 'level=2인 경우 소속 대행사' AFTER `level`,
    ADD COLUMN `seller_idx` INT NULL COMMENT 'level=3인 경우 본인 셀러' AFTER `agency_idx`,
    ADD KEY `idx_level` (`level`);
