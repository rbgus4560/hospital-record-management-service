"""FastAPI 진입점. OCR 입력 검증·CLOVA 중계·재분석과 DB 기록 라우터를 연결한다."""

import base64
import binascii
import json
import os
import re
import time
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from snuh_receipt import extract_receipt
from records import router as records_router

BACKEND_DIR = Path(__file__).resolve().parent
OCR_RESULT_DIR = BACKEND_DIR / "ocr_results"
load_dotenv(BACKEND_DIR / ".env")

app = FastAPI(title="Hospital Record OCR API")
app.include_router(records_router)
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


class OcrRequest(BaseModel):
    image_data: str = Field(max_length=14_000_000)


class ParseRequest(BaseModel):
    # 저장된 OCR 결과로 테스트할 때 사용합니다. CLOVA를 다시 호출하지 않습니다.
    raw_response: dict


def get_fields(result):
    """CLOVA 응답의 성공 상태와 fields 배열 형태를 확인한다."""
    images = result.get("images")
    if not isinstance(images, list) or not images or not isinstance(images[0], dict):
        raise HTTPException(status_code=422, detail="OCR 이미지 결과가 없습니다.")
    if images[0].get("inferResult") != "SUCCESS":
        raise HTTPException(
            status_code=422, detail="OCR 인식에 성공한 결과가 아닙니다."
        )
    fields = images[0].get("fields")
    if not isinstance(fields, list):
        raise HTTPException(status_code=422, detail="OCR fields 배열이 없습니다.")
    return fields


@app.post("/api/ocr/parse")
def parse_saved_result(body: ParseRequest):
    """이미 받은 OCR 응답만 재분석하며 외부 서비스에는 전송하지 않는다."""
    return extract_receipt(get_fields(body.raw_response))


@app.post("/api/ocr")
def extract_text(body: OcrRequest):
    """이미지 검증 후 CLOVA를 호출하고 원본 응답·좌표·파서 후보를 반환한다."""
    api_url = os.getenv("CLOVA_OCR_URL", "").strip()
    secret = os.getenv("CLOVA_OCR_SECRET", "").strip()
    if not api_url.startswith("https://") or not secret:
        raise HTTPException(
            status_code=500,
            detail="backend/.env의 OCR URL과 Secret Key를 확인해 주세요.",
        )
    match = re.fullmatch(
        r"data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)", body.image_data
    )
    if not match:
        raise HTTPException(
            status_code=400, detail="JPG 또는 PNG 사진을 등록해 주세요."
        )
    mime_type, encoded = match.groups()
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=400, detail="사진 데이터가 올바르지 않습니다.")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="사진은 10MB 이하로 등록해 주세요.")
    signature = b"\xff\xd8\xff" if mime_type == "jpeg" else b"\x89PNG\r\n\x1a\n"
    if not image_bytes.startswith(signature):
        raise HTTPException(
            status_code=400, detail="사진 형식과 내용이 일치하지 않습니다."
        )
    request_id = str(uuid.uuid4())
    payload = {
        "version": "V2",
        "requestId": request_id,
        "timestamp": int(time.time() * 1000),
        "lang": "ko",
        "images": [
            {
                "format": "jpg" if mime_type == "jpeg" else "png",
                "name": "hospital_document",
                "data": encoded,
            }
        ],
    }
    try:
        response = requests.post(
            api_url, headers={"X-OCR-SECRET": secret}, json=payload, timeout=(10, 90)
        )
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="OCR 응답 시간이 초과되었습니다.")
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="OCR 서버에 연결하지 못했습니다.")
    if not response.ok:
        raise HTTPException(
            status_code=502, detail=f"OCR 요청 실패: HTTP {response.status_code}"
        )
    try:
        result = response.json()
    except ValueError:
        raise HTTPException(
            status_code=502, detail="OCR 서버 응답이 JSON 형식이 아닙니다."
        )
    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502, detail="OCR 서버 응답 형식이 올바르지 않습니다."
        )
    result_filename = f"{uuid.uuid4().hex}.json"
    saved = False
    try:
        OCR_RESULT_DIR.mkdir(parents=True, exist_ok=True)
        (OCR_RESULT_DIR / result_filename).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        saved = True
    except OSError:
        pass
    fields = get_fields(result)
    parts = []
    for field in fields:
        if isinstance(field, dict):
            parts.append(str(field.get("inferText", "")))
            parts.append("\n" if field.get("lineBreak") else " ")
    parsed = extract_receipt(fields)
    return {
        "text": "".join(parts).strip(),
        "fields": fields,
        "request_id": result.get("requestId", request_id),
        "raw_response": result,
        "debug_saved": saved,
        "debug_filename": result_filename if saved else None,
        **parsed,
    }
