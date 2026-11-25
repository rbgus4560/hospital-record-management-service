"""
1. 목적
   웹 화면이 호출할 FastAPI 앱을 구성한다.

2. 입력
   기록·보험 청구·OCR 라우터와 허용할 웹 주소를 사용한다.

3. 주요 기능
   라우터를 등록하고 브라우저의 교차 출처 요청을 허용한다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from insurance_claim_files_api import router as claims_router
from ocr.ocr_api import router as ocr_router
from patient_document_records_api import router as records_router

app = FastAPI(title="Hospital Record OCR API")
app.include_router(records_router)
app.include_router(claims_router)
app.include_router(ocr_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
