"""
1. 목적
   업로드한 사진을 읽고 검수할 영수증 후보를 웹 화면에 전달한다.

2. 입력
   새 요청은 JPG·PNG 이미지 데이터를, 재분석 요청은 저장된 OCR 응답을 받는다.

3. 주요 기능
   이미지 형식과 크기를 검증하고, 글자·좌표와 파서가 추출한 일정·금액 후보를 반환한다.
"""

import base64
import json
import logging
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .paddle_ocr import InvalidImageError, recognize
from .snuh_receipt_parser import extract_receipt

BACKEND_DIR = Path(__file__).resolve().parents[1]
OCR_RESULT_DIR = BACKEND_DIR / "ocr_results"
load_dotenv(BACKEND_DIR / ".env")

router = APIRouter()
logger = logging.getLogger(__name__)


class OcrRequest(BaseModel):
    image_data: str = Field(max_length=14_000_000)


class ParseRequest(BaseModel):
    # 저장된 OCR 결과로 테스트할 때 사용합니다. OCR을 다시 실행하지 않습니다.
    raw_response: dict


def get_fields(result):
    """OCR 응답의 성공 상태와 fields 배열 형태를 확인한다."""
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


@router.post("/api/ocr/parse")
def parse_saved_result(body: ParseRequest):
    """이미 받은 OCR 응답만 재분석하며 외부 서비스에는 전송하지 않는다."""
    return extract_receipt(get_fields(body.raw_response))


def decode_image(data_url):
    """JPG·PNG 업로드의 형식과 크기를 확인하고 이미지 바이트를 반환한다."""
    match = re.fullmatch(r"data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)", data_url)
    if not match:
        raise HTTPException(
            status_code=400, detail="JPG 또는 PNG 사진을 등록해 주세요."
        )
    mime_type, encoded = match.groups()
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except ValueError:
        raise HTTPException(status_code=400, detail="사진 데이터가 올바르지 않습니다.")
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="사진은 10MB 이하로 등록해 주세요.")
    signature = b"\xff\xd8\xff" if mime_type == "jpeg" else b"\x89PNG\r\n\x1a\n"
    if not image_bytes.startswith(signature):
        raise HTTPException(
            status_code=400, detail="사진 형식과 내용이 일치하지 않습니다."
        )
    return image_bytes


@router.post("/api/ocr")
def extract_text(body: OcrRequest):
    """이미지를 읽고 OCR 필드와 영수증 후보를 함께 반환한다."""
    image_bytes = decode_image(body.image_data)
    request_id = str(uuid.uuid4())
    try:
        result = recognize(image_bytes, request_id)
    except InvalidImageError:
        raise HTTPException(status_code=400, detail="사진을 열 수 없습니다.") from None
    except Exception as exc:  # noqa: BLE001 - 외부 추론 실패를 API 오류로 변환
        logger.error("PaddleOCR failed (%s)", type(exc).__name__)
        raise HTTPException(
            status_code=503,
            detail="로컬 OCR 실행에 실패했습니다. 서버 환경을 확인해 주세요.",
        ) from None
    # OCR 응답 파일 저장에 실패해도 화면에서 결과를 검수할 수 있다.
    result_filename = f"{uuid.uuid4().hex}.json"
    try:
        OCR_RESULT_DIR.mkdir(parents=True, exist_ok=True)
        (OCR_RESULT_DIR / result_filename).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except OSError:
        result_filename = None
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
        "debug_saved": result_filename is not None,
        "debug_filename": result_filename,
        **parsed,
    }
