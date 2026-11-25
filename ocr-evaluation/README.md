# 영수증 하단 진료·검사 일정 OCR 평가

서울대병원 영수증 표본을 대상으로 OCR 결과의 문자 오류율과 프로젝트 파서의 일정 단위 추출 정확도를 측정한다. 이미 저장된 OCR 응답 JSON으로 평가한다.

## 1. 영수증 한 장으로 시작하기

1. `local/ground-truth.json`을 연다. 파일이 없으면 프로젝트 루트의 PowerShell에서 아래 명령으로 예시를 복사한다.
2. 원본 영수증 사진을 보고 `transcript`에 표시된 문자와 문장부호를 옮겨 적는다. 영수증 하단의 ‘다음에 오실 진료일’과 ‘다음에 오실 검사일’ 영역을 평가한다. 두 영역의 읽기 순서가 섞이면 `regions`에 영역을 따로 적는다. 사람 이름 등 평가에 필요 없는 개인정보가 들어간 영역은 피한다.
3. 이미지 편집기에서 영역을 선택하고 원본 사진 기준 픽셀 좌표를 확인한다. `box`에 `[왼쪽, 위, 오른쪽, 아래]` 순서로 적는다. 문서 전체를 비교할 때는 `box`를 `null`로 둔다.
4. `expected_schedules`에 하단에 인쇄된 일정을 **한 건씩** 적는다. 진료는 날짜·시간·진료과·의사, 검사는 날짜·시간·검사명·장소를 적고, 인쇄되어 있지 않은 항목은 `null`로 둔다. 날짜는 `YYYY-MM-DD`, 시간은 `HH:MM`으로 적는다. 예시의 두 행은 실제 일정 수에 맞게 추가하거나 빼고, 일정이 없으면 `[]`로 둔다.
5. `ocr_json`에는 **그 사진을 분석한** `backend/ocr_results/`의 JSON 파일명을 연결한다. 파일 순서만 보고 연결하기 어렵다면 OCR 등록 직후 생성된 파일을 기록한다.

```powershell
New-Item -ItemType Directory -Force ocr-evaluation/local | Out-Null
if (!(Test-Path ocr-evaluation/local/ground-truth.json)) { Copy-Item ocr-evaluation/ground-truth.example.json ocr-evaluation/local/ground-truth.json }
.ackend.venvScriptspython.exe ocr-evaluation/evaluate_receipts.py ocr-evaluation/local/ground-truth.json --output ocr-evaluation/local/results.json
```

정답표 안의 상대 경로는 **정답표 파일이 있는 폴더 기준**이다. 입력과 결과는 `local/`에만 보관하며 Git에서 제외한다. 같은 형식으로 `receipts` 배열에 나머지 영수증을 추가한다. 표본이 6장이라면 가능하면 모두 같은 종류의 영역과 항목을 비교한다.

## 2. 결과 읽기

- **문자 오류율(CER)**은 정답에 맞추기 위해 필요한 최소 글자 삽입·삭제·치환 횟수를 정답 글자 수로 나눈 값이다. 양쪽에 NFC 정규화를 적용하고 공백을 제외한다. OCR 토큰 중심이 지정 영역 안에 있는 토큰을 OCR 응답 순서로 연결한다. 보고서에는 영역별·영수증별 오류 수와 전체 문자 수, 전체 CER이 나온다. 응답의 읽기 순서가 뒤섞인 영역은 별도로 확인한다.
- **일정 완전 일치**는 일정 종류와 해당 날짜·시간·상세 값이 모두 일치한 건수다. 일정 순서와 앞뒤·연속 공백은 무시한다. 같은 일정이 두 번 나오면 두 건으로 계산한다.
- **정밀도**는 파서가 뽑은 일정 중 완전 일치한 비율이고, **재현율**은 영수증에 인쇄된 일정 중 완전 일치한 비율이다. 출력이 없으면 정밀도, 정답 일정이 없으면 재현율을 `null`로 표시한다. 값이 틀린 일정은 해당 정답의 누락 한 건과 잘못 추가된 출력 한 건으로 표시된다. 결과 파일에서 두 목록을 대조할 수 있다.
- 파서가 낸 검수 전 후보를 평가한다. 발표에서는 영수증 수, 비교 영역, 정답 문자 수, 정답 일정 건수와 완전 일치 건수를 함께 적는다.


복제본은 PaddleOCR 결과를 기존 JSON 형식으로 저장하므로 같은 평가 스크립트를 사용할 수 있다. 같은 비식별 이미지와 정답을 사용해 OCR 엔진별 JSON으로 각각 평가한다. PaddleOCR JSON의 `inference_ms`는 모델 초기화 시간을 제외한다. 사용자 대기 시간은 첫 요청과 후속 요청을 별도로 측정한다.
