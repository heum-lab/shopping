# CONVENTIONS.md

## 프로젝트 개요
ONEPICKACOUNT CRM Admin — 네이버 쇼핑·플레이스·블로그 등 다채널 마케팅 작업을 관리하는 어드민 시스템.

---

## 1. 언어 및 기술 스택 규칙

- **백엔드**: PHP (절차적 스타일, 파일 단위 페이지)
- **프론트엔드**: HTML + jQuery + Bootstrap (모달, 테이블 등)
- **DB**: MySQL (변수 접두사 `pass_*` 패턴 확인)
- **Ajax**: jQuery `$.ajax()` 사용, 응답 형식은 JSON

---

## 2. 파일 및 디렉터리 네이밍

```
/crm_admin/
├── sub/            # 각 채널별 메인 페이지 (info_acc_naver.php 등)
├── ajax/           # Ajax 핸들러 파일
│   ├── naver.info.ajax.php
│   ├── naver.rank.ajax.php
│   └── keyword.upso.list.php
├── assets/         # CSS, JS, 이미지
└── include/        # 공통 헤더·푸터·DB 연결
```

- **파일명**: `소문자 + 언더스코어 + 점(.) 구분`, 예: `info_acc_naver.php`, `naver.rank.ajax.php`
- **Ajax 파일명 패턴**: `{도메인}.{기능}.ajax.php`
- **Sub 페이지 패턴**: `info_acc_{채널}.php`

---

## 3. PHP 코딩 컨벤션

- **인코딩**: UTF-8
- **들여쓰기**: 4칸 스페이스
- **변수명**: `snake_case` (예: `pass_assign`, `pass_status`, `pass_date_type`)
- **URL 파라미터**: `pass_` 접두사로 검색/필터 파라미터 구분
- **폼 name 속성**: URL 파라미터명과 동일하게 유지
- **DB 쿼리**: 직접 쿼리 방식 사용, 입력값 반드시 이스케이프 처리

### URL 파라미터 네이밍 규칙
```
pass_assign    → 담당자(셀러) idx
pass_assign3   → 대행사 idx
pass_status    → 상태 필터
pass_date_type → 날짜 타입 (시작일/종료일/주문일/환불요청일)
pass_date      → 시작 날짜
pass_date2     → 종료 날짜
pass_input_type→ 검색 구분 (셀러명/키워드/상품MID)
pass_input     → 검색어
xls_mode       → 엑셀 다운로드 모드 플래그
del_mode       → 삭제 모드 플래그
```

---

## 4. JavaScript / jQuery 컨벤션

- **이벤트 바인딩**: `$(document).delegate()` 또는 `addEventListener` 사용
- **함수명**: `camelCase` (예: `agency_list()`, `modalpop()`, `rank_popup()`)
- **Ajax 응답 처리**: `JSON.parse(response)` 후 `$.each()` 순회
- **모달**: Bootstrap modal `$('#showModalEdit').modal('show')` 방식
- **팝업**: `window.open()` — 고정 사이즈 `width=700, height=500`
- **날짜 피커**: `flatpickr` 라이브러리, 한국어 로케일 (`flatpickr.l10ns.ko`)

```javascript
// 함수 네이밍 패턴
function modalpop(idx, return_url) { ... }       // 상세 편집 모달
function rank_popup(idx, keyword) { ... }         // 순위 팝업
function agency_list(maketer, agencys, midx) { ...} // 동적 셀렉트 로드
function submitWithDate() { ... }                 // 날짜 일괄 저장
```

---

## 5. HTML / 폼 컨벤션

- **폼 이름**: `searchfrm` (검색 폼), `check_form` (체크박스 일괄처리), `check_form2` (날짜 저장)
- **체크박스 name**: `check_idx[]` (배열 방식)
- **정렬 버튼 class**: `.sort-btn`, `.sort-btn2`, `.sort-btn3` + `data-sort`, `data-sort2`, `data-sort3` 속성
- **상태 컬러 구분**: 순위 상승 빨간색(▲), 하락 파란색(▼) — CSS 인라인 또는 클래스 적용

---

## 6. DB 컬럼 네이밍

- `snake_case` 사용
- 날짜 필드: `_date` 접미사 (예: `start_date`, `end_date`, `order_date`)
- 상태 필드: `status` (값: `대기`, `작업중`, `중지`, `환불요청`, `환불완료`, `연장처리`, `작업완료`, `삭제요청`)
- MID 필드: `mid` (네이버 상품 ID)
- 순위 필드: `rank_first`, `rank_current`, `rank_yesterday`

---

## 7. Git 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
style: UI/CSS 변경
docs: 문서 수정
chore: 기타 설정 변경
```

예시: `feat: 네이버 쇼핑 7일 연장처리 일괄 기능 추가`
