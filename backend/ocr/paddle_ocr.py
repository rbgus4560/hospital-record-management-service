"""
1. 목적
   영수증 사진에서 한글과 숫자, 글자 위치를 읽는다.

2. 입력
   사진 바이트와 요청 식별자를 받는다.

3. 주요 기능
   브라우저가 표시하는 방향으로 사진을 열고, 재사용하는 한국어 모델의 결과를 텍스트·좌표·신뢰도 필드로 변환한다.
"""

import os
from pathlib import Path
from threading import Lock
from time import perf_counter

_pipeline = None
_pipeline_lock = Lock()


class InvalidImageError(ValueError):
    """시그니처는 맞지만 디코딩할 수 없는 이미지."""


def recognize(image_bytes, request_id):
    """한국어 OCR을 실행하고 파서와 검수 화면에 필요한 필드를 반환한다."""
    import cv2
    import numpy as np

    global _pipeline
    # 브라우저 미리보기와 같은 방향으로 OCR 좌표를 얻도록 EXIF 방향을 적용한다.
    image = cv2.imdecode(
        np.frombuffer(image_bytes, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if image is None:
        raise InvalidImageError

    with _pipeline_lock:
        # 동시 요청에서 모델이 중복 초기화되거나 추론 상태를 공유하지 않게 한다.
        if _pipeline is None:
            # Windows의 Paddle 네이티브 런타임이 한글 모델 경로를 열지 못한다.
            if os.name == "nt" and (local_app_data := os.getenv("LOCALAPPDATA")):
                os.environ.setdefault(
                    "PADDLE_PDX_CACHE_HOME",
                    str(Path(local_app_data) / "HospitalRecordOCR"),
                )
            os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
            from paddleocr import PaddleOCR

            _pipeline = PaddleOCR(
                device="cpu",
                text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="korean_PP-OCRv5_mobile_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                enable_mkldnn=False,
                return_word_box=True,
            )
        started = perf_counter()
        page = _pipeline.predict(image)[0]
        elapsed_ms = round((perf_counter() - started) * 1000)

    return {
        "version": "V2",
        "provider": "paddleocr",
        "requestId": request_id,
        "inference_ms": elapsed_ms,
        "images": [{"inferResult": "SUCCESS", "fields": to_fields(page)}],
    }


def to_fields(page):
    """단어별 좌표를 우선 사용하고, 단어 좌표가 없는 줄은 한 필드로 보존한다."""
    fields = []
    texts = page["rec_texts"]
    word_texts = page.get("text_word", [None] * len(texts))
    word_boxes = page.get("text_word_region", [None] * len(texts))
    for text, score, polygon, words, boxes in zip(
        texts,
        page["rec_scores"],
        page["rec_polys"],
        word_texts,
        word_boxes,
        strict=True,
    ):
        if not text.strip():
            continue
        # 좌표 기반 파서는 날짜와 제목을 개별 필드로 읽는다.
        if (
            words is not None
            and boxes is not None
            and len(words)
            and len(words) == len(boxes)
        ):
            tokens = list(zip(words, boxes, strict=True))
        else:
            tokens = [(text, polygon)]
        for index, (token, vertices) in enumerate(tokens):
            fields.append(
                {
                    "inferText": token,
                    "inferConfidence": float(score),
                    "boundingPoly": {
                        "vertices": [{"x": int(x), "y": int(y)} for x, y in vertices],
                    },
                    "lineBreak": index == len(tokens) - 1,
                }
            )
    return fields
