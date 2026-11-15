"""FastAPI 앱 설정과 기능별 라우터 연결."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from insurance_claim_files_api import router as claims_router
from ocr.clova_ocr_api import router as ocr_router
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
