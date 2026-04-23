-- 6개 추가 채널 작업 테이블
-- 네이버쇼핑 작업 테이블과 동일 구조 (추후 채널별 특화 컬럼이 필요해지면 ALTER 로 확장)

CREATE TABLE IF NOT EXISTS `place_work`  LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `blog_work`   LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `inflow_work` LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `ohouse_work` LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `kakao_work`  LIKE `naver_shopping_work`;
CREATE TABLE IF NOT EXISTS `auto_work`   LIKE `naver_shopping_work`;
