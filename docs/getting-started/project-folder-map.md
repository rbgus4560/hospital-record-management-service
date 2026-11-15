# 프로젝트 폴더 구조와 전체 파일 설명

2026-11-16에 프런트 파일을 frontend/로 옮긴 구조를 반영했다.

프로젝트 위치: `C:\Users\rbgus\OneDrive\바탕 화면\hospital-record-management-service`

이 문서는 소스·설정·문서·정적 자산과 로컬 생성 폴더의 역할을 설명한다. 비밀번호와 실제 의료 파일 내용은 포함하지 않는다.

## 1. 전체 관리 파일 구조

```text
hospital-record-management-service/
├── frontend/
│   ├── public/                    브라우저 탭 아이콘
│   └── src/
│       ├── startReactApp.jsx
│       ├── HospitalRecordsApp.jsx
│       ├── screens/
│       ├── api/
│       ├── shared-components/
│       └── shared-styles/
├── backend/
│   ├── main.py                    FastAPI 실행 진입점
│   ├── init_db.py                 DB 초기화 명령
│   ├── patient_document_records_api.py
│   ├── insurance_claim_files_api.py
│   ├── ocr/
│   │   ├── clova_ocr_api.py
│   │   └── snuh_receipt_parser.py
│   ├── database/
│   │   ├── postgres_connection.py
│   │   ├── create_database_and_tables.py
│   │   └── hospital_records_schema.sql
│   └── tests/
├── docs/
│   ├── README.md                  문서 목차
│   ├── getting-started/           개요·폴더 구조·학교 PC 실행
│   ├── architecture/              DB 설계·구성도·설계 결정
│   ├── development/               코드 안내·검증·문제 해결 기록
│   └── archive/                   이전 README 보관
└── README.md
```

로컬 설치·생성 폴더는 아래 4절에 별도로 표시한다. 위 트리는 GitHub 업로드가 완료됐다는 뜻은 아니다. 현재 작업 폴더의 설명 대상 목록이다.

## 2. 공통 설정과 프런트 실행 파일

| 파일 | 존재 이유 | 무엇을 하며 어디와 연결되는가 |
|---|---|---|
| `README.md` | 프로젝트의 첫 안내서 | 목표·기능·실행 방법·검증 범위와 상세 문서 링크를 제공한다. 환경이나 구현 범위가 바뀌면 갱신한다. |
| `frontend/package.json` | 프런트 실행과 의존성 선언 | React·Vite·PDF·ZIP 패키지 및 dev/build/lint/format 명령을 정의한다. |
| `frontend/package-lock.json` | 패키지 버전 재현 | npm이 의존성의 실제 버전·무결성·하위 관계를 기록한다. npm ci가 사용하며 직접 편집하지 않는다. |
| `frontend/index.html` | 브라우저가 읽는 HTML 입구 | root 요소와 frontend/src/startReactApp.jsx를 연결하고 제목·favicon을 지정한다. 화면 본문은 React가 그린다. |
| `frontend/vite.config.js` | 개발·빌드 도구 설정 | Vite에 React 플러그인을 적용한다. 개발 서버·번들 설정을 변경할 때 확인한다. |
| `frontend/eslint.config.js` | 프런트 오류 검사 기준 | JavaScript·React Hooks 규칙과 브라우저 전역을 지정하고 로컬 도구·생성물을 제외한다. |
| `.editorconfig` | 편집기 간 들여쓰기 통일 | 일반 파일 2칸, Python 4칸, UTF-8·LF·마지막 개행을 지정한다. 지원 편집기에서 적용된다. |
| `.gitattributes` | Git 줄바꿈·바이너리 처리 | 텍스트 LF 규칙과 PNG/JPG/PDF/PPTX 바이너리 속성을 정의한다. |
| `.gitignore` | 공유하면 안 되는 파일 제외 | 비밀번호 설정·가상환경·패키지·빌드·의료 원본과 캐시가 커밋되지 않게 한다. 이미 추적한 파일을 자동 제거하지는 않는다. |
| `frontend/.prettierrc.json` | 프런트 자동 포맷 기준 | 공백 2칸·작은따옴표·세미콜론 생략·줄 길이 등 Prettier 규칙을 고정한다. |
| `frontend/.prettierignore` | 포맷 제외 대상 | 의존성·빌드·로컬 도구·잠금 파일·비밀 설정·과거 문서를 자동 편집에서 제외한다. |

## 3-1. 프런트엔드 코드·스타일

| 파일 | 존재 이유 | 무엇을 하며 어디와 연결되는가 |
|---|---|---|
| `frontend/src/startReactApp.jsx` | React 시작점 | 전역 CSS와 App을 불러와 index.html의 root에 마운트한다. 개발 중 StrictMode를 적용한다. |
| `frontend/src/HospitalRecordsApp.jsx` | 화면과 업무 흐름의 조율 | 메뉴·환자 선택·캘린더·모달·검수 상태를 관리한다. api.js를 통해 DB 초기 조회와 저장·수정·삭제를 호출한다. |
| `frontend/src/api/hospitalRecordsApi.js` | 백엔드 통신 창구 | API 기본 주소, JSON 요청/응답, 실패 메시지를 통일한다. 날짜·시간의 빈 값을 서버 입력에 맞게 null로 변환한다. |
| `frontend/src/shared-components/ModalDialog.jsx` | 여러 폼이 공유하는 팝업 틀 | 등록·검수 폼의 제목·닫기·배경 클릭·Escape·Tab 포커스 순환을 제공한다. 실제 저장 로직은 App에 있다. |
| `frontend/src/shared-components/NavigationIcon.jsx` | 일관된 메뉴 아이콘 | 병원·홈·환자·일정·문서·보험 SVG를 제공한다. 색과 크기는 CSS가 정하고 접근성 이름은 옆 텍스트가 담당한다. |
| `frontend/src/shared-components/DocumentAndAppointmentLists.jsx` | 문서·일정 표시 재사용 | DocumentList와 AppointmentList를 내보낸다. 목록 표시·선택·원본 열기 콜백을 담당하고 DB를 직접 변경하지 않는다. |
| `frontend/src/screens/hospital-records/OcrImageViewer.jsx` | OCR 근거 확인 화면 | 원본 크기에 맞춘 SVG 좌표를 겹쳐 그린다. 글자 영역 선택 시 인식 문자·신뢰도를 보여주며 추출 결과를 자동 확정하지 않는다. |
| `frontend/src/screens/insurance-claims/InsuranceClaimsPage.jsx` | 다운로드 준비 화면 | 영수증 선택·원본 미리보기·파일명 편집·PDF 합치기·개별 PDF ZIP 생성을 조율한다. 실제 보험사 청구 전송은 없다. |
| `frontend/src/screens/insurance-claims/receiptPdfExport.js` | 화면 밖으로 분리한 파일 생성 기능 | 이미지를 로드해 원본 비율의 A4 PDF를 만든다. Blob과 임시 링크로 일반 다운로드를 요청하고 URL을 해제한다. |
| `frontend/src/screens/insurance-claims/claimDownloadFilenames.js` | 저장 파일명 규칙 | 환자·진료일·병원·종류/건수로 기본 이름을 만들고 직접 입력한 이름의 금지 문자를 정리한다. PDF/ZIP 확장자를 적용한다. |
| `frontend/src/shared-styles/global.css` | 앱 전체 기본 디자인 | 전역 색상·글꼴·박스 크기·기본 여백·포커스 스타일을 정한다. main.jsx에서 불러온다. |
| `frontend/src/shared-styles/appLayout.css` | 주 화면의 레이아웃 | 사이드바·메뉴·캘린더·홈 패널·목록·일정·공통 버튼을 꾸민다. 최소 너비를 유지하고 작은 창에서는 스크롤한다. |
| `frontend/src/shared-styles/managementForms.css` | 등록·관리·검수 UI 스타일 | 환자 표 중앙 정렬, 수정/삭제 버튼, 문서 관리, 모달·좌우 OCR 검수창·폼 입력을 구성한다. |
| `frontend/src/screens/hospital-records/OcrImageViewer.css` | OCR 좌표 표시 스타일 | 원본 이미지 위 SVG 위치, 인식 다각형·선택 색상, 문자와 신뢰도 영역을 꾸민다. |
| `frontend/src/screens/insurance-claims/InsuranceClaimsPage.css` | 보험 청구 준비 화면 스타일 | 영수증 목록·미리보기·다운로드 옵션·파일명 입력·상태 메시지 배치를 정한다. |

## 3-2. 백엔드·DB·테스트

| 파일 | 존재 이유 | 무엇을 하며 어디와 연결되는가 |
|---|---|---|
| `backend/main.py` | FastAPI 실행 진입점 | FastAPI 앱, CORS와 기능별 라우터를 설정한다. |
| `backend/ocr/snuh_receipt_parser.py` | OCR 결과를 업무 후보로 변환 | 좌표·행·제목 위치 규칙으로 기본 정보·진료비·결제·일정 후보를 만든다. 특정 영수증 서식용이며 원본 인덱스와 검수 경고를 보존한다. |
| `backend/patient_document_records_api.py` | 환자·문서·일정 저장 API | Pydantic 입력 모델, CRUD, 이미지 해독, DB 행→화면 데이터 변환, 문서 버전 확인·일정 교체 트랜잭션을 구현한다. |
| `backend/database/postgres_connection.py` | PostgreSQL 연결 설정 분리 | backend/.env를 읽어 DB 연결 인자를 구성하고 비밀번호 누락을 차단한다. 실제 값은 로그·응답에 출력하지 않는다. |
| `backend/init_db.py` | 최초 DB 준비 명령 | DB 존재 여부 확인 후 없으면 생성하고 hospital_records_schema.sql을 실행한다. 기존 데이터 삭제나 이후 스키마 변경 마이그레이션을 수행하지 않는다. |
| `backend/database/hospital_records_schema.sql` | 테이블 설계 원본 | patients/documents/appointments의 컬럼·타입·CHECK·PK·FK·인덱스를 정의한다. Python init_db.py가 읽어 실행한다. |
| `backend/requirements.txt` | 서버 실행 패키지 목록 | FastAPI·Uvicorn·Requests·dotenv·Pydantic·psycopg 버전을 지정해 API 실행 환경을 재현한다. |
| `backend/requirements-dev.txt` | 개발 검사 패키지 목록 | HTTP 테스트용 httpx와 Python 포맷터 Ruff를 지정한다. 서비스 실행용 의존성과 구분한다. |
| `backend/.env.example` | 공유 가능한 설정 양식 | CLOVA·DB 변수 이름과 기본 연결 예시를 제공한다. 실제 비밀번호·키는 넣지 않는다. .env 작성 시 참고한다. |
| `backend/tests/test_patient_document_records_api.py` | 저장 기능의 회귀 검증 | 설정 누락·잘못된 입력과 실제 PostgreSQL CRUD·새 연결 재조회·삭제 보호·버전 충돌·롤백을 검사한다. 자체 임시 스키마만 만들고 정리한다. |

## 3-3. 정적 이미지·아이콘

| 파일 | 존재 이유 | 무엇을 하며 어디와 연결되는가 |
|---|---|---|
| `frontend/public/favicon.svg` | 브라우저 탭 아이콘 | index.html이 /favicon.svg로 참조하는 정적 SVG다. Vite가 public 파일을 원래 이름으로 제공한다. |

## 3-4. 문서·구성도·과거 자료

| 파일 | 존재 이유 | 무엇을 하며 어디와 연결되는가 |
|---|---|---|
| `docs/README.md` | 상세 문서 탐색 목차 | 프로젝트·DB·코드 안내·구성도·검증·과거 문서로 이동하는 색인이다. |
| `docs/getting-started/project-folder-map.md` | 전체 폴더·파일 설명 | 현재 구조, 각 파일의 존재 이유·역할·연결 관계, 로컬 생성물과 읽는 순서를 정리한 이 문서다. |
| `docs/development/source-code-guide.md` | 개발자용 코드·포맷 안내 | 주요 코드 책임과 들여쓰기·검사 명령을 간략히 제공한다. 전체 목록은 project-structure.md가 담당한다. |
| `docs/getting-started/project-overview.md` | 기존 프로젝트의 구현 요약 | 주요 코드의 책임·저장 방식·미구현 범위·확인 근거를 정리한다. 구현 상태 변경 시 갱신한다. |
| `docs/architecture/postgresql-schema-and-api.md` | DB 설계·사용 안내 | 네 테이블의 관계·컬럼, BYTEA/JSONB 선택, 설정·초기화·API·검증과 운영 한계를 설명한다. |
| `docs/development/development-timeline.md` | 변경 과정 기록 | DB 도입·UI 수정·다운로드 방식·리팩토링 등의 실제 작업 경과를 기록한다. |
| `docs/architecture/design-decisions.md` | 설계 선택 근거 | OCR 검수·서버 키 관리·DB 저장 등 선택 이유와 범위를 남긴다. 기능 사용법보다 왜 선택했는지를 다룬다. |
| `docs/development/troubleshooting-log.md` | 문제·해결·미해결 기록 | 증상·원인 근거·시도·수정·검증을 보존한다. 발표의 문제 해결 사례를 준비할 때 확인한다. |
| `docs/development/test-and-validation-log.md` | 검증 증거와 한계 | 실행한 빌드·린트·포맷·DB 테스트와 사용자 확인·미실행 항목을 구분해 기록한다. |
| `docs/development/source-publication-log.md` | 이전 소스 공개 범위 기록 | 2026-10-23 공유 대상과 제외 파일을 남긴 과거 문서다. 이후 DB·리팩토링 파일까지 반영한 최신 전체 목록은 아니다. |
| `docs/archive/original-vite-readme.md` | 최초 템플릿 안내 보존 | React+Vite 초기 README를 보관한다. 현재 서비스 실행 지침은 루트 README를 따른다. |
| `docs/archive/previous-github-readme.md` | 수정 전 소개 자료 보존 | 과거 GitHub 설명을 남긴다. 당시 계획과 실제 구현을 구분하는 참고 자료이며 최신 사양이 아니다. |
| `docs/architecture/diagrams/generate_system_architecture.py` | 구성도 생성 소스 | 구성도 이미지의 텍스트·좌표·배치 등을 코드로 정의한다. 이미지만 수정하는 대신 재생성 근거를 남긴다. |
| `docs/architecture/images/system-architecture.svg` | 편집·확대 가능한 구성도 | README에서 연결하는 벡터 그림이다. 현재 파일은 DB 도입 전 구조 자료이므로 발표 전 최신 DB 흐름 반영이 필요하다. |
| `docs/architecture/images/system-architecture.png` | README 표시용 구성도 | SVG와 같은 구성의 래스터 이미지다. 실행 코드가 아니며 최신 DB 구조는 database.md와 실제 코드가 기준이다. |

## 4. 로컬 전용·자동 생성 파일

아래는 실제 로컬 폴더와 알려진 생성 패턴이다. 의존성 내부의 수천 개 파일은 우리가 작성한 업무 코드가 아니므로 개별 설명 대상에서 제외한다.

| 경로 | 존재 이유·역할 | 관리 시 주의 |
|---|---|---|
| `.git/` | Git 커밋·브랜치·인덱스·원격 설정 등 저장소 내부 정보 | 직접 수정하지 않는다. Git 명령으로 관리 |
| `frontend/node_modules/` | npm으로 설치한 React·Vite·PDF·ZIP·검사 도구 | frontend/package.json/lock을 기준으로 재설치. Git 제외 |
| `frontend/dist/` | Vite가 만든 배포용 HTML·CSS·JS 묶음 | 원본은 src. 직접 고치지 말고 빌드로 갱신 |
| `.ruff_cache/`, `backend/.ruff_cache/` | Ruff 검사·포맷 캐시 | 소스나 DB가 아니다. 자동 생성 |
| `backend/.venv/` | 프로젝트 Python·라이브러리·실행 도구 격리 환경 | 이 컴퓨터 전용. Git 제외 |
| `backend/__pycache__/`, `backend/tests/__pycache__/` | Python이 만든 바이트코드 캐시 | 자동 생성. 소스는 .py |
| `backend/.env` | 실제 CLOVA 키·URL, PostgreSQL 연결 정보 | 비밀 파일. 값을 공유하거나 Git에 올리지 않음 |
| `backend/ocr_results/` | OCR API 원본 응답을 남기는 디버그 JSON | 실제 의료 정보 포함 가능. DB 영구 기록과 구분, Git 제외 |
| `.vscode/settings.json` | 이 프로젝트 VS Code 터미널에서 Node/npm을 찾도록 하는 로컬 PATH | 사용자 PC 절대 경로이므로 Git 제외 |
| `.setup.local/package/` | 초기 환경에서 사용한 로컬 npm 배포본 | 현재 일반 Node/npm 설치 후에는 기존 실행 도우미와의 관계 확인 필요 |
| `.setup.local/python/` | Python 3.13 배포본 | backend/.venv가 이 런타임을 참조할 수 있으므로 임의 삭제 금지 |
| `.setup.local/npm-cache/`, `.setup.local/uv-cache/` | 초기 설치 중 생성된 패키지 다운로드 캐시 | 애플리케이션 소스·의료 DB가 아님 |
| `.setup.local/npm.tgz` | 초기 npm 설치용 압축 파일 | 설치 자료이며 실행 업무 코드 아님 |
| `.setup.local/start-frontend.cmd` | 초기 Node/npm 경로로 프런트 개발 서버 실행 | 일반 VS Code에서는 npm.cmd --prefix frontend run dev 사용 가능 |
| `.setup.local/start-backend.cmd` | backend 가상환경으로 Uvicorn 실행 | 백엔드 터미널 명령의 편의 실행 파일 |
| `.setup.local/verification.txt` | 초기 설치 당시의 검사 결과 | 과거 기록이며 최신 결과는 docs/development/test-and-validation-log.md |

`backend/uploads/`, 루트 `uploads/`, `logs/`, `*.log`는 생성될 경우 Git에서 제외하는 경로/패턴이다. 현재 저장 구현은 이미지를 DB의 BYTEA에 넣으므로 uploads 폴더가 반드시 필요한 구조는 아니다.

## 5. 실제 DB는 어디에 저장되는가

- `hospital_records_schema.sql`은 테이블을 만드는 설계 문서이지 등록 데이터 자체가 아니다.
- 실제 환자·문서·일정과 이미지는 PostgreSQL의 `hospital_records` DB 안에 저장된다. 프로젝트 폴더를 복사하는 것만으로 DB 데이터까지 옮겨지지는 않는다.
- PostgreSQL 물리 데이터 폴더의 실제 위치는 이 문서에서 확인하지 않았으며 추측하지 않는다. DBeaver나 PostgreSQL 도구로 DB를 조회·백업한다.
- `patients` 1명 → `documents` N개 → 문서별 `appointments` N개 관계다.
- 문서에는 OCR 원본·좌표·분석 결과(JSONB), 이미지(BYTEA), 검수 여부와 수정 버전을 함께 보관한다.
- 연결 문서가 있는 환자 삭제는 차단한다. 문서를 삭제하면 연결 일정도 함께 삭제한다.

## 6. 코드가 연결되는 순서

### 앱을 켰을 때

`frontend/index.html` → `frontend/src/startReactApp.jsx` → `frontend/src/HospitalRecordsApp.jsx` → `frontend/src/api/hospitalRecordsApi.js` → `backend/main.py`에 연결된 `patient_document_records_api.py`의 `/api/state` → `database.py` → PostgreSQL → 환자·문서·일정 표시.

### 문서를 등록할 때

1. App에서 환자와 이미지를 선택하고 이미지 형식·크기를 확인한다.
2. api.js가 `/api/ocr`로 전송한다.
3. main.py가 입력을 검증하고 서버의 .env 설정으로 CLOVA OCR을 호출한다.
4. snuh_receipt_parser.py가 응답 좌표·문자를 업무 항목과 일정 후보로 해석한다.
5. App이 `/api/documents`를 호출해 원본과 OCR 결과를 미확정 문서로 저장한다.
6. Modal과 OcrImageViewer에서 원본·인식 근거를 보면서 값을 수정한다.
7. patient_document_records_api.py가 검수 문서와 포함할 일정을 하나의 트랜잭션으로 확정한다.
8. 저장 성공 뒤 화면 목록과 캘린더를 갱신한다. 중간 실패는 DB 롤백하며 성공으로 표시하지 않는다.

### 파일을 내려받을 때

`InsuranceClaimsPage.jsx`의 선택 문서 → `claimDownloadFilenames.js`의 이름 결정 → `lib/pdfExport.js`의 PDF 생성 → 필요 시 JSZip 묶음 → 일반 브라우저 다운로드. 파일명은 화면에서 바꿀 수 있고 저장 위치는 브라우저 설정이 결정한다.

## 7. 무엇을 고치려면 어느 파일을 볼까

| 변경 목적 | 먼저 확인할 파일 |
|---|---|
| 홈 캘린더·메뉴·페이지 흐름 | HospitalRecordsApp.jsx, App.css |
| 메뉴 아이콘 | components/NavigationIcon.jsx |
| 환자 표·관리 버튼·검수창 배치 | Management.css, HospitalRecordsApp.jsx |
| OCR 인식 영역·선택 표시 | OcrImageViewer.jsx, OcrImageViewer.css |
| 날짜·진료과·금액 추출 규칙 | backend/ocr/snuh_receipt_parser.py |
| 외부 OCR 오류·요청 검증 | backend/ocr/clova_ocr_api.py |
| 환자·문서·일정 저장 API | backend/patient_document_records_api.py |
| DB 연결 설정 | backend/database/postgres_connection.py, 로컬 .env |
| 테이블 컬럼·관계 | backend/database/hospital_records_schema.sql, docs/architecture/postgresql-schema-and-api.md |
| PDF 비율·페이지·다운로드 | frontend/src/screens/insurance-claims/receiptPdfExport.js |
| 파일명 규칙 | frontend/src/screens/insurance-claims/claimDownloadFilenames.js |
| 의존성·실행 명령 | frontend/package.json, backend/requirements*.txt |
| 기능이 왜 이렇게 설계됐는지 | docs/architecture/design-decisions.md, docs/architecture/postgresql-schema-and-api.md |
| 실패 원인·실제 확인 범위 | docs/development/troubleshooting-log.md, docs/development/test-and-validation-log.md |

## 8. 권장 읽는 순서

처음에는 루트 README → 이 문서 → HospitalRecordsApp.jsx → hospitalRecordsApi.js → backend/main.py → patient_document_records_api.py/database.py/hospital_records_schema.sql → snuh_receipt_parser.py 순서로 읽는다. 세부 화면은 frontend/src/screens/에서 메뉴별로 찾아보고, 설계 이유와 검증 근거는 docs에서 확인한다.

## 9. 현재 상태와 구분해야 할 내용

- 실제 OCR 서비스는 CLOVA이며, Python 좌표 파서는 자체 학습 모델이 아닌 규칙 코드다.
- 로그인·사용자별 접근 권한·실제 보험사 제출·LLM 요약은 현재 기능이 아니다.
- 저장 API의 실제 DB 통합 테스트와 브라우저 새로고침 후 기록 유지는 확인됐지만, 이후 UI 변경 전체를 에이전트가 브라우저에서 재검증했다고 주장하지 않는다.
- 과거 history 문서와 DB 도입 전 구성도는 최신 구현과 구분해 사용한다.
- 현재 참조되지 않는 이미지 자산은 위 표에 표시했고, 이 문서 작업에서 삭제하지 않았다.


## 2026-10-26 추가 파일

- `docs/getting-started/run-on-school-pc.md`: 학교 Windows PC의 설치·환경 설정·DB 초기화·두 서버 실행·기존 DB 백업/복원 순서를 안내한다. 코드와 데이터의 이동을 구분하며 실제 백업은 포함하지 않는다.
