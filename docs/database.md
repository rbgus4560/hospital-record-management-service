# PostgreSQL 저장 설계

2026-10-25 구현. 로컬 단일 사용자 시연 범위이며 로그인·사용자별 접근 권한은 미구현이다.

## 테이블

| 테이블 | 주요 컬럼 | 관계·역할 |
|---|---|---|
| patients | id(UUID PK), name, label, memo, created_at | 환자 프로필. 이름 중복을 허용하고 UUID로 구분 |
| documents | id(UUID PK), patient_id(FK), document_type, document_date, hospital, filename, image_mime, image_bytes, ocr_text, ocr_fields, ocr_raw_response, parsed_receipt, confirmed, version, created_at, updated_at | 환자 1명 : 문서 N개 |
| appointments | id(UUID PK), document_id(FK), appointment_type, appointment_date, appointment_time, department, doctor, examination, location | 문서 1개 : 확정 일정 N개 |

- 일정의 환자·병원은 문서에서 JOIN하므로 서로 다른 환자 ID가 중복 저장되는 문제를 방지한다.
- 문서에 연결된 환자 삭제는 RESTRICT. 문서 삭제 시 연결 일정은 CASCADE 삭제한다.
- OCR 원본·좌표·분석 후보는 JSONB, 확정 날짜와 일정은 DATE/TIME 컬럼에 저장한다.
- 현재 소규모 시연에서는 이미지를 BYTEA(10MB 상한)에 함께 저장한다. 이미지와 문서를 한 트랜잭션으로 보존할 수 있지만, 전체 목록 API가 이미지를 포함하므로 대규모 운영 전에는 페이지네이션·이미지 별도 API·객체 저장소를 검토한다.
- confirmed=false인 문서도 저장되므로 검수 화면을 닫거나 새로고침한 뒤 다시 검수할 수 있다. 일정은 확정 시에만 저장한다.
- 문서 변경과 일정 전체 교체는 단일 트랜잭션이다. 중간 실패 시 모두 롤백한다.
- 문서 version을 비교해 다른 탭에서 변경한 내용을 오래된 편집 화면이 덮어쓰면 409를 반환한다.

## 설정과 초기화

기존 backend/.env의 OCR 설정은 유지하고 다음을 추가한다. 실제 비밀번호는 채팅·문서·Git에 넣지 않는다.

```dotenv
DB_HOST="127.0.0.1"
DB_PORT="5432"
DB_NAME="hospital_records"
DB_USER="postgres"
DB_PASSWORD=""
```

프로젝트 루트의 PowerShell에서:

```powershell
uv pip install --python backend/.venv/Scripts/python.exe -r backend/requirements.txt
cd backend
.\.venv\Scripts\python.exe init_db.py
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

uv가 없는 일반 터미널에서는 가상환경의 pip가 준비된 경우 `python -m pip`로 설치한다. 이 컴퓨터에는 에이전트가 psycopg 의존성을 설치했다.
초기화는 기존 DB/테이블을 삭제하지 않는다. 기존 스키마를 자동 변경하는 마이그레이션 도구는 아니며, 이후 스키마 변경은 별도 SQL 마이그레이션이 필요하다.
`postgres`는 로컬 초기 설정용 계정이다. 공개 배포 전에는 별도 앱 계정과 사용자 인증·접근 제어를 적용한다.

DBeaver 연결: PostgreSQL / Host 127.0.0.1 / Port 5432 / Database hospital_records / User postgres / 로컬에서 입력한 비밀번호.

## API

- GET /api/state: 환자·문서·일정을 동일 스냅샷으로 조회 (no-store)
- POST /api/patients, PUT/DELETE /api/patients/{id}
- POST /api/documents: OCR 수행 후 미검수 문서 저장
- PUT /api/documents/{id}: 검수 결과 및 확정 일정 원자적 저장, 또는 OCR 재분석 저장
- DELETE /api/documents/{id}: 원본·OCR·연결 일정 삭제
- 기존 POST /api/ocr 및 /api/ocr/parse 유지

UI는 DB 초기 조회 실패 시 등록을 차단하고 재연결 버튼을 표시한다. 저장 응답을 받기 전에 성공 메시지를 표시하거나 React 목록에 반영하지 않는다. 과거 메모리에서 사라진 기록을 복구하거나 자동 이관하지 않는다.

## 검증

backend에서 `python -m unittest discover -s tests -v`로 실행한다. requirements-dev.txt의 httpx가 필요하다.
DB_PASSWORD가 없으면 실제 DB 테스트는 명시적으로 skip된다. 실제 DB 테스트는 무작위 이름의 자체 임시 스키마만 만들고 정리한다.
DB CRUD, 새 클라이언트 재조회, 환자 삭제 보호, 버전 충돌, 문서/일정 트랜잭션 롤백, 삭제를 검증한다. 실제 OCR은 테스트에서 호출하지 않는다.
