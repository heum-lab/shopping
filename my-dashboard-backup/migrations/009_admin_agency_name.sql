-- admin.agency_name 컬럼 추가
-- 계정 등록 시 대행사명(브랜드/회사명) 입력용. 대행사 권한자에게 의미가 있음.

ALTER TABLE `admin`
    ADD COLUMN `agency_name` VARCHAR(100) NULL COMMENT '대행사명 (대행사 계정용)' AFTER `name`;
