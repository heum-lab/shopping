# ARCHITECTURE.md — System Architecture Document

## 프로젝트명
ONEPICKACOUNT CRM Admin

---

## 1. 전체 시스템 구조

```
[관리자 브라우저]
       │ HTTP 요청
       ▼
[Web Server: Apache/Nginx]
       │
       ▼
[PHP Application Layer]
 ├── /crm_admin/sub/          # 페이지 라우팅 (채널별 페이지)
 ├── /crm_admin/ajax/         # Ajax API 핸들러
 └── /crm_admin/include/      # 공통 모듈 (DB, 세션, 유틸)
       │
       ▼
[MySQL Database]
 ├── 상품(작업) 테이블
 ├── 대행사 테이블
 ├── 셀러 테이블
 └── 관리자 계정 테이블
```

---

## 2. 기술 스택

| 구분 | 기술 |
|------|------|
| 서버 | PHP (Apache 또는 Nginx) |
| 데이터베이스 | MySQL |
| 프론트엔드 | HTML5, jQuery, Bootstrap |
| 날짜 피커 | flatpickr (한국어 로케일) |
| 아이콘 | Font Awesome 또는 Bootstrap Icons |
| 차트 | (향후 대시보드 추가 시 Chart.js 권장) |
| 배포 환경 | 공유 호스팅 또는 단독 서버 (onepickk.co.kr) |

---

## 3. 디렉터리 구조

```
/crm_admin/
├── index.php                    # 메인 진입점 (로그인 후 리다이렉트)
├── sub/
│   ├── info_acc_naver.php       # 네이버쇼핑 작업 관리
│   ├── info_acc_place.php       # 플레이스 작업 관리
│   ├── info_acc_blog.php        # 블로그 작업 관리
│   ├── info_acc_ohouse.php      # 오늘의집 작업 관리
│   ├── info_acc_kakao.php       # 카카오맵 작업 관리
│   ├── info_acc_auto.php        # 자동완성 작업 관리
│   ├── info_acc_inflow.php      # 유입플 작업 관리
│   ├── company_manage.php       # 대행사 관리
│   └── seller_manage.php        # 셀러 관리
├── ajax/
│   ├── naver.info.ajax.php      # 네이버 상품 상세 모달 데이터
│   ├── naver.rank.ajax.php      # 네이버 순위 팝업 데이터
│   ├── keyword.upso.list.php    # 대행사·셀러 동적 셀렉트 목록
│   └── xls.upload.ajax.php      # 엑셀 업로드 처리
├── include/
│   ├── db.php                   # DB 연결 설정
│   ├── session.php              # 세션 인증 체크
│   ├── header.php               # 공통 헤더 (네비게이션)
│   ├── footer.php               # 공통 푸터
│   └── func.php                 # 공통 유틸 함수
└── assets/
    ├── css/
    ├── js/
    └── img/
```

---

## 4. 데이터베이스 설계

### 4.1 테이블: `naver_shopping_work` (네이버쇼핑 작업)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `idx` | INT, PK, AUTO_INCREMENT | 고유 번호 |
| `agency_idx` | INT, FK | 대행사 ID |
| `seller_idx` | INT, FK | 셀러 ID |
| `ad_product` | VARCHAR(100) | 광고상품명 |
| `keyword` | VARCHAR(100) | 메인 키워드 |
| `keyword_sub1` | VARCHAR(100) | 서브 키워드1 |
| `keyword_sub2` | VARCHAR(100) | 서브 키워드2 |
| `product_mid` | VARCHAR(50) | 상품 MID |
| `product_url` | TEXT | 상품 URL |
| `compare_mid` | VARCHAR(50) | 가격비교 MID |
| `compare_url` | TEXT | 가격비교 URL |
| `inflow_count` | INT | 유입수 |
| `keyword_type` | VARCHAR(20) | 광고 타입 (통검/쇼검 등) |
| `order_date` | DATE | 주문일 |
| `start_date` | DATE | 작업 시작일 |
| `end_date` | DATE | 작업 종료일 |
| `drive_days` | VARCHAR(10) | 구동일수 |
| `payment_date` | DATE | 입금일 |
| `rank_first` | INT | 최초 순위 |
| `rank_current` | INT | 현재 순위 |
| `rank_yesterday` | INT | 어제 순위 |
| `status` | VARCHAR(20) | 상태 |
| `refund_date` | DATE | 환불요청일 |
| `memo` | TEXT | 비고 |
| `reg_date` | DATETIME | 등록일 |
| `mod_date` | DATETIME | 수정일 |

### 4.2 테이블: `agency` (대행사)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `idx` | INT, PK | 고유 ID |
| `name` | VARCHAR(100) | 대행사명 |
| `maketer_idx` | INT, FK | 소속 마케터(상위) ID |
| `reg_date` | DATETIME | 등록일 |

### 4.3 테이블: `seller` (셀러)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `idx` | INT, PK | 고유 ID |
| `name` | VARCHAR(100) | 셀러명 |
| `agency_idx` | INT, FK | 소속 대행사 ID |
| `reg_date` | DATETIME | 등록일 |

### 4.4 테이블: `admin` (관리자 계정)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `idx` | INT, PK | 고유 ID |
| `id` | VARCHAR(50) | 로그인 ID |
| `pw` | VARCHAR(255) | 비밀번호 (해시) |
| `name` | VARCHAR(50) | 이름 |
| `level` | TINYINT | 권한 레벨 |
| `reg_date` | DATETIME | 등록일 |

---

## 5. 주요 플로우

### 5.1 상품 등록 플로우 (단건)
```
[어드민] → 네이버쇼핑 상품 등록 버튼 클릭
        → 등록 모달 팝업 (Bootstrap Modal)
        → 대행사 선택 → Ajax로 셀러 목록 로드 (keyword.upso.list.php)
        → 폼 입력 완료 → 등록하기 클릭
        → info_acc_naver.php?mode=insert POST 요청
        → DB INSERT → 목록 페이지 리다이렉트
```

### 5.2 상품 등록 플로우 (엑셀 대량)
```
[어드민] → 엑셀 셀러 선택 → 파일 선택 → 엑셀 대량 상품등록 클릭
        → handleSubmit() 호출 → 버튼 비활성화 + 로딩 표시
        → xls.upload.ajax.php로 파일 업로드
        → 파싱 후 DB BULK INSERT
        → 결과 반환 → 목록 새로고침
```

### 5.3 상태 일괄 변경 플로우
```
[어드민] → 체크박스 선택 (check_idx[])
        → 일괄 버튼 클릭 (예: 선택 10일 연장처리)
        → Submit_Check() 호출 → 확인 다이얼로그
        → check_form2 폼 submit
        → info_acc_naver.php?mode=etc_date_act POST
        → DB UPDATE (status, end_date)
        → 목록 페이지 리다이렉트
```

### 5.4 순위 팝업 플로우
```
[어드민] → 순위조회 버튼 클릭
        → rank_popup(idx, keyword) 호출
        → window.open('naver.rank.ajax.php?cr_idx=...&keyword=...')
        → 700×500 팝업 창에 순위 이력 테이블 표시
```

---

## 6. Ajax API 명세

### GET/POST `/crm_admin/ajax/keyword.upso.list.php`
- **역할**: 대행사 또는 셀러 목록 동적 로드
- **파라미터**:
  - `maketer`: 마케터 ID (대행사 목록 요청 시)
  - `agencys`: 대행사 ID (셀러 목록 요청 시)
- **응답**: JSON 배열 `[{"id": 1, "name": "셀러명"}, ...]`

### POST `/crm_admin/ajax/naver.info.ajax.php`
- **역할**: 상품 상세 정보 로드 (편집 모달)
- **파라미터**: `idx`, `return_url`
- **응답**: HTML 문자열 (모달 내부 삽입)

### GET `/crm_admin/ajax/naver.rank.ajax.php`
- **역할**: 순위 이력 팝업 데이터
- **파라미터**: `cr_idx`, `keyword`
- **응답**: HTML 페이지 (팝업 창 직접 렌더링)

---

## 7. 보안 고려사항

- 모든 페이지 상단에 `session.php` include로 로그인 여부 검증
- DB 입력값 `mysqli_real_escape_string()` 또는 Prepared Statement 적용
- 엑셀 업로드 시 파일 확장자 및 MIME 타입 검증 (`.xlsx`, `.xls`만 허용)
- 관리자 비밀번호 `password_hash()` / `password_verify()` 사용

---

## 8. 확장성 고려사항

- 채널 추가 시 `sub/info_acc_{채널}.php` + 대응 Ajax 파일 추가하는 패턴 유지
- 대규모 데이터 증가 시 `reg_date`, `status`, `seller_idx` 컬럼 인덱스 추가 권장
- 향후 REST API 분리 시 `/crm_admin/ajax/` 디렉터리를 API 라우터로 전환 가능
