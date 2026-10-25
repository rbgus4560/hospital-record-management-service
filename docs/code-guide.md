# 코드 파일 안내와 정리 규칙

## 프런트엔드

| 파일 | 책임 |
|---|---|
| src/main.jsx | React 진입점·전역 스타일·StrictMode |
| src/App.jsx | 메뉴·환자·문서·검수 상태와 DB 저장 흐름 조율 |
| src/components/Modal.jsx | 공통 모달·포커스 순환·닫기 |
| src/components/NavigationIcon.jsx | 메뉴·병원 제목 SVG 아이콘 |
| src/components/RecordLists.jsx | 문서·확정 일정 목록 표시 및 선택 콜백 |
| src/OcrImageViewer.jsx | 원본 위 OCR 좌표 표시·선택·신뢰도 확인 |
| src/InsuranceClaims.jsx | 영수증 선택·미리보기·파일명 입력·PDF/ZIP 다운로드 조율 |
| src/lib/pdfExport.js | 이미지 로딩·원본 비율 A4 PDF·Blob 다운로드 |
| src/api.js | API 주소·JSON 통신·오류 메시지·DB 입력 변환 |
| src/downloadNames.js | 자동 파일명·사용자 파일명·금지 문자 처리 |
| src/index.css | 전역 글꼴·색상·기본 요소 |
| src/App.css | 화면·사이드바·캘린더·공통 목록 |
| src/Management.css | 환자 표·등록 폼·OCR 검수창 |
| src/OcrImageViewer.css | 원본 이미지·OCR SVG 오버레이 |
| src/InsuranceClaims.css | 보험 청구 목록·미리보기·다운로드 배치 |

## 백엔드

| 파일 | 책임 |
|---|---|
| backend/main.py | FastAPI 진입점·CORS·OCR 호출·재분석·기록 라우터 연결 |
| backend/snuh_receipt.py | 특정 영수증 서식의 좌표 기반 필드·금액·일정 후보 추출 |
| backend/records.py | 입력 모델·DB CRUD·문서와 일정 트랜잭션·편집 충돌 처리 |
| backend/database.py | .env 연결 설정·비밀번호 누락 검사·DB 연결 팩토리 |
| backend/init_db.py | 기존 데이터 삭제 없이 DB·초기 테이블 생성 |
| backend/schema.sql | 테이블·자료형·외래 키·인덱스 정의 |
| backend/tests/test_records.py | 임시 스키마에서 실제 DB CRUD·재조회·롤백 검증 |
| backend/requirements.txt | API 실행 의존성 |
| backend/requirements-dev.txt | 테스트·Python 포맷터 의존성 |

package.json은 프런트 의존성과 명령, package-lock.json은 재현 가능한 버전 잠금 파일이다.
JSON/잠금 파일은 설명 주석을 직접 넣지 않고 이 문서를 참고한다. vite.config.js는 React 빌드, eslint.config.js는 코드 검사 설정이다.
.env는 비밀 설정이며 커밋하지 않는다. .env.example에 변수 이름만 공유한다.

## 들여쓰기·검사

- JS/JSX/CSS/JSON: 공백 2칸, Prettier. Python: 공백 4칸, Ruff 기본 포맷.
- .editorconfig는 편집기 들여쓰기, .gitattributes는 Git 줄바꿈 LF를 지정한다.
- 코드만 반복 설명하는 주석 대신 파일 책임·입출력·비직관적인 결정 이유를 한국어로 기록한다.
- 자동 생성 lock 파일은 수동으로 정리하지 않는다.

프로젝트 루트:

```powershell
npm.cmd run format
npm.cmd run format:check
npm.cmd run lint
npm.cmd run build
```

backend에서:

```powershell
.\.venv\Scripts\ruff.exe format .
.\.venv\Scripts\ruff.exe format --check .
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

DB 통합 테스트는 DB_PASSWORD가 필요하며 테스트 전용 임시 스키마를 생성·정리한다. 실제 OCR 호출은 테스트에 포함하지 않는다.
