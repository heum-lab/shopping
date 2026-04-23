-- 셀러 테이블에 담당자명 컬럼 추가
-- 셀러명은 계정/브랜드 식별용이고, 실제 담당자(사람)는 별도로 구분 표기한다.

ALTER TABLE `seller`
    ADD COLUMN `manager_name` VARCHAR(50) NULL COMMENT '담당자명' AFTER `name`;
