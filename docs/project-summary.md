# 프로젝트 분석 · 2026-10-22

사용자 확인: 개인 웹 과제·2주. 구현 근거는 React 소스와 Python 백엔드이며 환자별 OCR JSON 파일은 읽지 않았다.

## 책임과 데이터 흐름

- `src/App.jsx`: 환자·문서·일정 useState, JPG/PNG 업로드, OCR API, 검수·수정 및 확인된 일정 반영. DB 저장 성공 후 목록·일정을 갱신하며 초기 조회 실패 시 등록을 차단.
- `src/OcrImageViewer.jsx`: 이미지 원본 비율에 OCR polygon을 표시하고 텍스트·신뢰도 선택.
- `src/InsuranceClaims.jsx`: 영수증 선택·정렬, jsPDF의 이미지 PDF 및 JSZip의 개별 PDF 묶음.
- `backend/main.py`: 이미지 형식·크기·시그니처 확인, CLOVA V2 호출, 원본 OCR JSON 디버그 저장, 결과 파싱 반환.
- `backend/snuh_receipt.py`: 기준 제목·상대 좌표·행 그룹으로 기본/진료비/결제/일정 후보 구성. 특정 서울대 영수증 배치 규칙이며 검수 필요 경고를 유지.

## 저장과 미구현 구분

2026-10-25 PostgreSQL 저장 API와 React 초기 조회·저장 연결을 추가했다. DB 설정·초기화 후 영구 저장을 사용하며, 실제 DB 연결 검증 상태는 docs/validation.md에 기록한다. backend/ocr_results의 원본 OCR JSON은 디버그 자료다. Java/Spring Boot·LLM 요약은 미구현이다. 테이블과 관계는 docs/database.md를 참고한다. 보험 청구는 다운로드 준비이며 보험사 제출·지급 판정이 아니다.

## 개인정보와 환경

`.env`, `.venv`, node_modules, OCR 원본·의료 사진은 업로드 대상이 아니다. 프런트가 고정한 localhost API와 CORS 범위는 로컬용이다. 모든 병원 서식 지원·정확도·운영용 접근 제어/인증을 주장하지 않는다.
