# 검증 기록 · 2026-10-22

- 프런트: npm run build 통과(Vite 8.3.4, Node 24.19.0). 224 modules transformed.
- 빌드 경고: 메인 청크 약 746.61kB, 500kB 경고. 배포 성능 측정은 아님.
- Python 2개 파일 AST parse 통과.
- 합성 입력: extract_receipt([])가 후보 없음·검수 필요·경고를 반환함 확인. money_value('1,234') == 1234 확인.
- 파서 검사는 별도 Python 3.11.17에서 수행. 백엔드 기존 .venv 설정은 Python 3.13.9이며 API 전체 실행을 의미하지 않음.
- 실 OCR API·실제 환자 JSON·비밀값·의료 사진은 읽거나 사용하지 않음.
- DB 저장·LLM 요약이 현재 구현에 없음을 정적 분석으로 구분.
- PNG/SVG 구성도 생성, 시각 확인·SVG parse 및 README 상대 링크 확인.
- UI 상호작용·PDF 다운로드·OCR 정확도·외부 API 전체 통합은 미검증.

업로드 전 공백 검사에서 과거 GitHub README 보관본의 후행 공백·빈 EOF가 검출됐다. 보관 사본의 공백만 정리하고 재검사했다. 실행 코드나 설정 문제는 아니다.


2026-10-23 소스 공개 준비: 실행 코드·정적 자산·패키지 선언과 빈 설정 예시만 선별했다. 비밀 환경 파일·의료 OCR 원본·로그·가상환경·node_modules·dist는 제외한다. 기존 문서 기록은 보존하며 크롤러 requirements 줄바꿈 수정·버전 고정, 실행 스크립트 경로 이식성과 Python 인자 지원, 병원 백엔드 requirements 추가 및 ignore 보완을 수행했다. 설치·외부 API·실사이트·운영 DB는 실행하지 않았다.


## 2026-10-25 · PostgreSQL 저장 코드
- 프런트: npm.cmd run build 통과 (225 modules). 기존 500kB 초과 청크 경고 유지.
- 변경 프런트 코드: ESLint src/App.jsx src/api.js 통과. 프로젝트 전체 린트의 기존 InsuranceClaims.jsx no-control-regex 항목은 별도.
- Python: 소스 AST 검사 및 main 앱 import 통과.
- TestClient: DB 설정 누락의 503 응답, 잘못된 환자/일정 입력 거부 2개 테스트 통과.
- 실제 PostgreSQL 통합 테스트는 DB_PASSWORD 미설정으로 1개 skip. 스키마 생성, DB CRUD, 트랜잭션 롤백, 다른 클라이언트 재조회 및 실제 브라우저 새로고침은 아직 검증되지 않음.
- 사용자 확인: 업로드·실제 OCR 인식·일정 반영·수정 성공. 에이전트 직접 수행 결과는 아님.
- 기존 OCR .env 값 수정 및 외부 OCR 요청 없음. GitHub 커밋·푸시 없음.


### 2026-10-25 · DB 설정 후 실연결 검증
- 사용자 DB 설정 이후 hospital_records DB 및 public.patients/documents/appointments 생성 확인.
- 실제 PostgreSQL의 테스트 전용 임시 스키마에서 3개 테스트 모두 통과: 환자·문서·일정 CRUD, 새 클라이언트 재조회, 연결 환자 삭제 보호, 오래된 버전 수정 거부, 일정 교체 실패의 문서/일정 롤백, 삭제 후 빈 상태 확인.
- 테스트 전용 스키마 정리 완료. 사용자 의료 데이터·OCR 외부 API를 테스트에 사용하지 않음.
- 브라우저 실제 새로고침·서버 재시작 시연은 별도 사용자 확인 필요. 실행 중인 기존 백엔드는 새 API 반영을 위해 재시작해야 함.


## 2026-10-25 · GitHub 업로드 전 리팩토링
- 공통 Modal·NavigationIcon·문서/일정 목록을 src/components로 분리, PDF 생성·다운로드는 src/lib/pdfExport.js로 분리.
- OCR 요청·재분석도 src/api.js를 사용해 API 주소·오류 처리를 통일.
- 프런트·CSS·설정 파일 상단 한국어 역할 주석, DB/OCR 주요 함수 docstring과 의도 주석 추가. 파일별 책임은 docs/code-guide.md에 기록.
- Prettier 2칸·Ruff 4칸 포맷 적용, .editorconfig/.gitattributes/Prettier 설정과 반복 실행 명령 추가.
- 검증: 전체 ESLint, Prettier check, 프로덕션 빌드, Ruff format check 통과. PostgreSQL 임시 스키마의 3개 테스트 전부 통과.
- OCR 파서·구성도 생성 코드의 AST를 기존 Git 버전과 비교해 docstring·포맷 이외 로직 변경 없음 확인. 합성 빈 OCR·쉼표 금액 변환 확인.
- 기존 번들 500kB 초과 경고·TestClient httpx 사용 중단 예정 안내는 유지. 실제 브라우저 UI·PDF 다운로드·외부 OCR 재호출은 이번 검증에서 수행하지 않음.
- .env·가상환경·로컬 도구·VS Code 개인 설정은 Git 제외 확인. 커밋·푸시는 하지 않음.

## 2026-10-26 · GitHub 반영과 학교 PC 실행 준비
- 기존 환경: Node 24.22.1/npm 11.19.1/Python 3.13.12. 전체 Prettier·ESLint·프로덕션 빌드·Ruff 포맷 검사 통과.
- 실제 PostgreSQL 임시 스키마에서 테스트 메서드 3개 모두 통과. 사용자 실제 의료 데이터와 외부 OCR 요청은 검사에 사용하지 않음.
- 별도 Python 3.13.12 가상환경에 requirements.txt 및 requirements-dev.txt 설치 후 동일 3개 테스트 통과. 기본 uv 캐시 권한 오류는 작업 폴더 캐시와 copy 링크 방식으로 해결.
- 깨끗한 프런트 설치 점검: 별도 폴더의 npm ci가 sandbox의 node_modules 디렉터리 생성 EPERM으로 두 번 실패. 기존 프로젝트의 의존성에서는 전체 검사·빌드 통과했지만 새 PC 설치 성공으로 확대하지 않음.
- 학교 Windows PC의 실제 설치·실행·DB 백업/복원은 미수행. docs/school-pc-setup.md에 설정·초기화·서버 실행·데이터 이동과 확인 항목을 기록.
- 현재 API 주소는 VITE_API_BASE_URL 지원. README의 예전 고정 주소 안내와 DB 초기화 누락을 수정.
- 실제 .env·OCR 원본·DB 백업·영수증·발표자료는 업로드 대상에서 제외. 원격 반영 여부는 해당 커밋과 원격 브랜치에서 확인.
- 기존 500kB 번들 경고와 TestClient httpx 사용 중단 예정 안내 유지. 최신 브라우저 UI·실제 PDF/ZIP 출력·OCR 정확도 측정은 별도.
