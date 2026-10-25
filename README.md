# 병원 영수증 OCR 기록·일정 관리 웹

**병원 영수증 사진을 OCR로 읽고, 추출된 정보·진료/검사 일정을 사용자가 확인·수정한 뒤 환자별로 확인하고 PDF로 내보내는 웹 과제입니다.**

> 2026-10-26 기준 **React + FastAPI + CLOVA OCR + PostgreSQL** 구현을 반영했습니다. 환자별 문서·일정 DB 저장, 재조회, 원본 검수, UI 개선과 PDF·ZIP 다운로드를 포함합니다. Java·Spring Boot·LLM 요약은 구현하지 않았습니다.

## 대표 화면

개인정보를 제거한 테스트 영수증으로 촬영 후 추가할 예정입니다.

| 화면 | 보여줄 내용 |
|---|---|
| 문서 등록 | 환자 선택·영수증 이미지 업로드 |
| OCR 확인 | 원본 위 인식 영역·텍스트·신뢰도와 추출 후보 확인 |
| 기록·일정 | 사용자 확인 후 환자별 문서·진료/검사 일정 조회 |
| 보험 청구 준비 | 선택 영수증 PDF 합치기·개별 PDF ZIP 다운로드 |

## 프로젝트 개요

영수증에 흩어진 진료비·결제 정보·다음 진료/검사 일정을 직접 다시 입력하는 흐름을 줄이는 과제입니다. OCR 결과를 곧바로 확정하지 않고 **추출 후보 → 원본 확인·수정 → 반영**으로 구분합니다.

| 항목 | 내용 |
|---|---|
| 개발 기간 | 2주 — 사용자 확인 |
| 형태 | 개인 웹 과제 — 사용자 확인 |
| 구현 범위 | React 화면, Python OCR 중계·영수증 파서, 사용자 검수, 일정·PDF 출력 |
| 현재 저장 | PostgreSQL 저장·초기화 및 실제 DB 통합 테스트 통과 (2026-10-25) |

### 개발 환경

| 항목 | 내용 |
|---|---|
| 운영체제 | Windows |
| 프런트엔드 | Node.js v24.22.1으로 빌드 확인 / Vite 개발 서버 |
| 백엔드 | 로컬 `.venv` Python 3.13.12 |
| API | FastAPI, 기본 실행 안내 `127.0.0.1:8000` |
| OCR | CLOVA OCR V2 외부 HTTPS API |
| 저장 방식 | PostgreSQL 저장·초기 조회, React 상태는 화면 표시용 캐시 |

### 개발 도구

| 구분 | 도구 | 용도 |
|---|---|---|
| 프런트 패키지·빌드 | npm, Vite | 의존성 설치·개발 서버·정적 빌드 |
| 백엔드 실행 | venv, pip, Uvicorn | Python 격리 환경·ASGI 서버 |
| 문서 보조 | Codex | 코드 분석·구성도·문서 작성 |
| 저장소 | GitHub | 구현 코드·설정 예시·문서 버전 관리 |
| IDE | 미확인 | 확인 전 특정 제품을 기재하지 않음 |

### 라이브러리·프레임워크

| 구분 | 이름 | 버전·범위 | 용도 |
|---|---|---|---|
| UI | React / React DOM | package.json `^19.2.8` | 환자·문서·일정과 검수 화면 |
| 프런트 빌드 | Vite | 선언 `^8.3.0`, 이번 빌드 8.3.4 | 개발 서버·프로덕션 번들 |
| PDF | jsPDF | `^4.2.1` | 선택 영수증 이미지를 A4 PDF로 변환 |
| 압축 | JSZip | `^3.10.2` | 개별 PDF 묶음 ZIP 생성 |
| API | FastAPI / Uvicorn | 기존 환경 0.143.0 / 0.54.0 | OCR 요청·재분석 API |
| 입력 모델 | Pydantic | 기존 환경 2.14.1 | 요청 데이터 형식·크기 검증 |
| 외부 호출 | Requests | 기존 환경 2.34.2 | CLOVA OCR HTTPS 요청 |
| 환경 설정 | python-dotenv | 기존 환경 1.2.4 | 백엔드 OCR URL·Secret 로딩 |
| 파서·화면 | Python re·datetime / SVG | 표준 기능 | 좌표 기반 필드·일정 추출, OCR 영역 표시 |

프런트는 선언된 범위와 실제 빌드 버전을 구분했습니다. 백엔드는 기존 환경 메타데이터 확인값이며 배포 잠금 파일이 아닙니다. CLOVA는 외부 OCR 서비스로, 자체 학습 모델이나 LLM 요약을 구현했다는 뜻이 아닙니다.

## 전체 시스템 구성도

![영수증 업로드·OCR·확인·일정·PDF 흐름](docs/images/system-architecture.png)

[SVG 원본](docs/images/system-architecture.svg) · [이미지 생성 소스](docs/diagrams/build_architecture.py)

**React 업로드 → FastAPI 입력 검증 → CLOVA OCR → 좌표 기반 규칙 파서 → 사용자 확인·수정 → FastAPI 저장 API → PostgreSQL → React 재조회 / PDF 다운로드** 흐름입니다. OCR 원본 JSON은 백엔드 디버그용이며 환자 기록의 DB 저장소가 아닙니다. 위 이미지 구성도는 DB 도입 전 자료이며, 현재 저장 흐름은 검수 결과 → FastAPI 저장 API → PostgreSQL입니다.

## 핵심 기능

### 문서 업로드와 OCR 중계

- JPG·PNG 이미지와 요청 크기를 확인하고 실제 파일 시그니처도 검증합니다. 이미지 바이트 기준 10MB 상한입니다.
- Secret은 백엔드 `.env`에서 읽고 React에 넣지 않습니다.
- `POST /api/ocr`에서 OCR 결과·좌표·신뢰도와 추출 후보를 반환합니다. 타임아웃·연결 실패·잘못된 응답을 구분합니다.
- `POST /api/ocr/parse`는 이미 받은 OCR JSON을 재분석합니다. CLOVA를 재호출하지 않습니다.

### 원본을 보며 검수하는 영수증 파싱

- 토큰 좌표로 기본 정보·항목별 진료비·금액/결제·진료/검사 일정 영역을 해석합니다.
- SVG 다각형으로 인식 영역을 표시하고 선택한 텍스트·신뢰도를 확인합니다.
- 금액·날짜·시간과 원본 필드 인덱스를 연결하고 확정하지 못한 후보·경고를 보존합니다.
- 파서는 **특정 서울대 영수증 배치용 초기 규칙**입니다. 모든 병원 양식 지원이나 추출 정확도를 보장하지 않습니다.

### 확인된 일정과 환자별 문서

- 환자·문서·일정을 React 상태로 관리하고 사용자 확인 후 문서와 일정을 같은 DB 트랜잭션으로 저장합니다.
- 문서 삭제 시 관련 기록도 관리합니다. PostgreSQL 저장 코드를 연결했습니다. 이 컴퓨터에서는 DB 설정·초기화 및 통합 테스트를 완료했습니다. 다른 환경에서는 별도 설정과 초기화가 필요합니다.
- OCR 원본 JSON은 `backend/ocr_results/`에 디버그 저장될 수 있으며 저장 실패 상태도 응답합니다. 실제 의료 자료는 저장소에 올리지 않습니다.

### 보험 청구용 파일 준비

- 영수증을 선택하고 날짜 순으로 하나의 PDF로 합치거나 개별 PDF를 ZIP으로 받습니다.
- 브라우저에서 파일을 생성합니다. 보험사로 청구를 전송하거나 자격·지급 여부를 판단하지 않습니다.

## PostgreSQL 저장 설정

기존 OCR 설정과 별도로 DB 연결 정보와 초기화가 필요합니다. [테이블 설계·DB 설정·API·테스트](docs/database.md)를 참고하세요.
실제 DB 비밀번호와 의료 자료는 Git에 올리지 않습니다. 현재 로그인·사용자별 접근 권한은 미구현이므로 로컬 시연 범위입니다.

## 실행 방법

다른 PC의 전체 설치와 기존 DB 기록 이동은 [학교 PC 실행 안내](docs/school-pc-setup.md)를 참고하세요. Git clone은 실제 기록이나 `.env`를 복사하지 않습니다. PostgreSQL 18.x와 Node.js 24.x, Python 3.13.x를 먼저 준비합니다. DBeaver는 선택 사항입니다.

### 최초 준비

프로젝트 루트의 PowerShell에서 실행합니다. `.env` 복사는 처음 한 번만 하며 기존 파일을 덮어쓰지 않습니다.

```powershell
npm.cmd ci
py -3.13 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

`backend/.env`에서 CLOVA OCR URL·Secret과 **현재 PC의** DB 비밀번호를 입력한 뒤 초기화합니다. Secret을 프런트나 Git에 넣지 않습니다. PostgreSQL 서비스 실행과 DB 생성 권한이 필요합니다.

```powershell
.\backend\.venv\Scripts\python.exe backend\init_db.py
```

### 백엔드

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

API 문서는 `http://127.0.0.1:8000/docs`입니다. 루트 `/`의 404는 정상입니다. 실제 OCR 호출에는 외부 인터넷과 유효한 CLOVA 설정이 필요합니다.

### 프런트엔드

다른 터미널에서 프로젝트 루트 기준으로 실행합니다.

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

화면은 `http://127.0.0.1:5173`입니다. API 기본 주소는 `http://127.0.0.1:8000`이며 `VITE_API_BASE_URL`로 변경할 수 있습니다. 현재 CORS는 로컬 5173/5174를 허용합니다. `npm.cmd`를 사용하면 PowerShell의 `npm.ps1` 실행 정책 오류를 피할 수 있습니다.

## 검증 결과

| 항목 | 확인 범위 |
|---|---|
| 프런트 | 전체 ESLint·Prettier 검사·프로덕션 빌드 통과 |
| Python | Ruff 포맷 검사 및 실제 PostgreSQL 테스트 3개 통과 |
| DB 통합 테스트 | CRUD·다른 클라이언트 재조회·환자 삭제 보호·버전 충돌·문서/일정 롤백 |
| 사용자 실행 | 업로드·실제 OCR·일정 반영·수정 및 저장된 기록 확인 |
| 남은 검증 | 최신 UI·PDF/ZIP 전체 시연, 표본별 OCR 정확도, 학교 PC 실제 실행 |
| 기존 경고 | 500kB 초과 번들 경고, TestClient의 httpx 사용 중단 예정 안내 |

자동 테스트는 자체 임시 스키마의 합성 데이터만 사용합니다. 테스트 3개는 OCR 평가 표본 수가 아닙니다. 실제 의료 자료나 비밀 설정은 저장소에 올리지 않습니다. 자세한 날짜별 결과는 [검증 기록](docs/validation.md)에 보존합니다.

## 코드 정리와 검사

파일별 역할은 [코드 안내](docs/code-guide.md)를 참고하세요. JS/JSX는 공백 2칸(Prettier), Python은 공백 4칸(Ruff)으로 정리합니다. 프런트는 `npm.cmd run format:check`, `npm.cmd run lint`, `npm.cmd run build`로 확인합니다.

## 상세 문서

- [학교 PC 설치·실행과 DB 기록 이동](docs/school-pc-setup.md)

- [전체 폴더 구조·파일별 존재 이유와 역할](docs/project-structure.md)

- [PostgreSQL 테이블·저장 API](docs/database.md)
- [프로젝트 분석·코드 근거](docs/project-summary.md)
- [개발 과정](docs/development-history.md)
- [설계 결정](docs/decisions.md)
- [트러블슈팅·제한 기록](docs/troubleshooting.md)
- [검증 기록](docs/validation.md)
- [기존 안내 보관](docs/history/README_TEMPLATE.md)

## 문제 해결 경험·배운 점

### OCR 텍스트를 원본 위치와 함께 해석

날짜·금액을 단순 문자열로만 추출하면 서로 다른 영역의 값이 섞일 수 있습니다. 현재 코드는 제목 위치·토큰 좌표·행 그룹과 원본 필드 인덱스를 활용하며, 결정하지 못한 항목은 경고와 함께 남깁니다.

**배운 점:** OCR의 텍스트와 화면 위치를 함께 다뤄야 구조화 결과를 검수할 수 있습니다. 특정 영수증 배치 규칙을 일반적인 병원 문서 인식 성능으로 확대하면 안 됩니다.

### 추출 결과와 사용자 확정을 분리

파서 결과에는 검수 필요 상태를 남기고, React는 사용자가 확인한 일정만 반영합니다. 이미 받은 OCR 결과의 재분석은 외부 API를 다시 호출하지 않습니다.

**배운 점:** 자동 추출을 최종 사실로 취급하지 않고 원본·후보·확정 상태를 구분하는 것이 중요합니다. 과거 실패 횟수·정확도·비용 절감 수치는 확인하지 않아 기재하지 않았습니다.

### 실제 구현과 소개 문서의 차이 정리

기존 GitHub 소개는 Spring Boot·PostgreSQL·LLM 요약을 제안했지만, 초기 구현은 FastAPI·규칙 파서·React 임시 상태였습니다. 이후 PostgreSQL 저장·초기 조회와 통합 테스트를 추가했습니다.

**배운 점:** 계획한 기술과 구현한 기술을 구분하고 현재 저장 범위를 정확히 설명해야 합니다. 현재는 PostgreSQL 저장을 구현했지만, LLM 요약·로그인·공개 배포는 미구현입니다.
