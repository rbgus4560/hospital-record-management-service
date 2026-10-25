# 학교 컴퓨터에서 실행하기

Windows PowerShell 기준. **코드, 실행 환경, 비밀 설정, DB 기록은 서로 별개**다. Git clone으로 `.env`나 집 PC의 PostgreSQL 데이터가 복사되지는 않는다.

## 1. 필요한 프로그램

| 항목 | 준비 |
|---|---|
| Git | `git --version`으로 확인 |
| Node.js | 24.x. 현재 점검 환경 24.22.1 / npm 11.19.1 |
| Python | 3.13.x. 현재 점검 환경 3.13.12 |
| PostgreSQL | 18.x 서버 설치·실행, 설치 비밀번호 보관 |
| CLOVA OCR 설정 | 기존 OCR URL·Secret을 안전하게 별도 준비 |
| 인터넷 | 최초 의존성 설치와 실제 OCR 호출에 필요 |
| DBeaver | 선택 사항. DB 확인 도구이며 앱 실행에는 필수 아님 |

설치 후 VS Code를 완전히 닫았다가 다시 연다. 학교 PC의 설치·네트워크 제한은 미리 확인한다. 집의 `node_modules`, `.venv`, `.setup.local`은 옮기지 않고 다시 설치한다.

```powershell
git --version
node --version
npm.cmd --version
py -3.13 --version
```

Python이 설치되어 있는데 `py`만 없다면 `python --version`이 3.13.x인지 확인한 후 아래의 `py -3.13`을 `python`으로 바꾼다.

## 2. 코드와 의존성 설치

쓰기 가능한 폴더에서 처음 한 번 실행한다. 특정 사용자의 바탕화면 절대 경로를 복사하지 않는다.

```powershell
git clone https://github.com/rbgus4560/hospital-record-management-service.git
cd hospital-record-management-service
code .
npm.cmd ci
py -3.13 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

- 이미 클론했다면 `git status`로 수정 사항을 먼저 확인하고, 수정 사항이 없을 때 `git pull --ff-only`로 갱신한다.
- `npm.cmd`와 가상환경 Python 직접 호출로 `npm.ps1`·`Activate.ps1` 실행 정책 문제를 피한다. 보안 정책 변경은 불필요하다.
- `npm ci`는 `package-lock.json`의 버전으로 설치한다. Python은 `requirements.txt`에 고정한 패키지를 설치한다.

## 3. 학교 PC 환경 설정

처음 설치할 때만 예시를 복사한다. 기존 `.env`는 덮어쓰지 않는다.

```powershell
Copy-Item backend\.env.example backend\.env
```

`backend/.env`의 빈 값을 채운다. 실제 비밀값은 채팅이나 Git에 넣지 않는다.

```dotenv
CLOVA_OCR_URL=""
CLOVA_OCR_SECRET=""
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_NAME="hospital_records"
DB_USER="postgres"
DB_PASSWORD=""
```

- OCR URL·Secret은 기존 CLOVA 설정을 사용한다. 프런트에 넣지 않는다.
- DB_PASSWORD는 **학교 PC PostgreSQL의 비밀번호**다. 집 PC와 같을 필요는 없다.
- `127.0.0.1`은 현재 학교 PC 자신을 뜻하며 집 DB에 연결하는 주소가 아니다.
- OCR 설정 없이도 DB가 준비되면 기록 관리는 실행되지만 새 사진의 실제 OCR 호출은 실패한다.

## 4. DB와 테이블 만들기

PostgreSQL 서비스가 실행 중인지 확인하고 프로젝트 루트에서 실행한다.

```powershell
.\backend\.venv\Scripts\python.exe backend\init_db.py
```

성공 메시지: `DB 및 테이블 준비 완료: patients, documents, appointments`

DB가 없으면 만들고 테이블을 준비한다. DB 생성 권한이 필요하며 기존 기록을 삭제하지 않는다. `schema.sql`은 구조이지 기존 기록이 아니다. 새 PC는 빈 DB로 시작한다.

## 5. 서버 두 개 실행

터미널 A:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

터미널 B를 추가하고 **프로젝트 루트**에서:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

- 화면: `http://127.0.0.1:5173`
- API 문서: `http://127.0.0.1:8000/docs`
- `8000/`의 404는 루트 API 미정의이며 서버 시작 실패가 아니다.
- 두 터미널을 켜 두며 종료는 각각 `Ctrl+C`다.
- 5173이 사용 중이면 기존 서버인지 확인한다. 임의의 포트는 CORS 허용 범위를 벗어날 수 있다.

프런트 API 기본 주소는 `http://127.0.0.1:8000`이다. 같은 PC에서 실행하면 변경할 필요가 없다. 별도 서버를 쓸 때만 루트 `.env.local`의 `VITE_API_BASE_URL`과 백엔드 CORS를 함께 조정한다.

## 6. 발표 전 확인

1. 환자 등록 → 정보 수정.
2. 개인정보 없는 테스트 영수증 업로드 → OCR 결과 확인.
3. 날짜·진료/검사 항목 수정 → 일정 선택 후 저장.
4. 새로고침 → 환자·원본·문서·일정 유지 확인.
5. PDF·ZIP 각각 내려받고 실제 파일 열기.

생성형 이미지로 만든 가상 영수증도 모든 파싱 규칙을 통과한다고 가정하지 말고 미리 확인한다.

## 7. 집에서 등록한 기록도 필요한 경우

**코드는 GitHub로, 기록은 PostgreSQL 백업으로 옮긴다.** 원본 이미지도 DB의 BYTEA에 들어 있으므로 백업에 포함된다. `backend/ocr_results/`는 디버그 출력이며 DB 백업이 아니다.

아래는 PostgreSQL 18 기본 설치 경로·로컬 계정 예시다. 자신의 계정·포트·경로에 맞춘다. `-W`로 표시되는 프롬프트에서 비밀번호를 입력한다. 이 문서 작성 및 Git 업로드 과정에서는 실제 DB 백업을 생성하거나 업로드하지 않는다.

집 PC에서:

```powershell
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
& "$pgBin\pg_dump.exe" -h 127.0.0.1 -p 5432 -U postgres -W -Fc --no-owner --no-acl -f "$env:USERPROFILE\Documents\hospital_records.backup" hospital_records
if ($LASTEXITCODE -ne 0) { throw "DB 백업 실패" }
```

백업 파일은 안전한 별도 방법으로 이동한다. **백업에는 의료 자료가 들어갈 수 있어 GitHub에 올리지 않는다.** 가능하면 학교 발표는 가상 자료만 새로 등록해 진행한다.

학교에서는 기존 DB를 덮어쓰지 않고 **새 빈 DB**에 복원한다. `hospital_records_demo`가 이미 있으면 다른 새 이름을 사용한다.

```powershell
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 5432 -U postgres -W hospital_records_demo
if ($LASTEXITCODE -ne 0) { throw "새 DB 생성 실패" }
& "$pgBin\pg_restore.exe" -h 127.0.0.1 -p 5432 -U postgres -W --no-owner --no-acl --exit-on-error -d hospital_records_demo "C:\백업을옮긴폴더\hospital_records.backup"
if ($LASTEXITCODE -ne 0) { throw "DB 복원 실패" }
```

복원 완료 후 `.env`의 `DB_NAME="hospital_records_demo"`로 바꾸고 백엔드를 재시작한다. 복원 DB에는 테이블이 포함되므로 미리 `init_db.py`로 빈 테이블을 만들지 않는다. 실제 학교 PC의 복원은 아직 검증하지 않았다.

## 8. 자주 발생하는 문제

| 증상 | 확인 |
|---|---|
| npm 스크립트 차단 | `npm` 대신 `npm.cmd` |
| Python 미인식 | 3.13 설치·PATH·`py -3.13 --version` |
| DB 연결 실패 | PostgreSQL 서비스·학교 PC 비밀번호·초기화 |
| 서버 연결 실패 | 백엔드 터미널·8000 포트 |
| OCR만 실패 | CLOVA URL·Secret·외부 HTTPS·서비스 사용 상태 |
| 기록이 비어 있음 | 새 DB 또는 다른 DB 연결. Git clone은 기록을 복사하지 않음 |
| 작은 화면에서 가로 스크롤 | 최소 화면 너비를 유지하는 현재 UI의 의도된 동작 |

공용 PC에 비밀 설정이나 의료 기록이 남지 않도록 관리한다. 코드만 커밋하고 `.env`·백업·실제 사진은 포함하지 않는다.
