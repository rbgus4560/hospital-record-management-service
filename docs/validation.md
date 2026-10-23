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
