"""환자별 청구 파일 보관, 완료 표시, 파일 재다운로드 API."""

import base64
import binascii
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Response
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from database.postgres_connection import transaction

router = APIRouter(prefix="/api")


class ClaimBundleInput(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    documentIds: list[UUID] = Field(min_length=1)
    fileBase64: str = Field(max_length=69905068)


CLAIM_COLUMNS = """
    id, filename, file_type AS "fileType", receipts,
    created_at AS "createdAt", used_at AS "usedAt"
"""


@router.get("/patients/{patient_id}/claim-bundles")
def list_claim_bundles(patient_id: UUID):
    with transaction() as conn:
        return conn.execute(
            f"""SELECT {CLAIM_COLUMNS} FROM claim_bundles
                WHERE patient_id = %s ORDER BY created_at DESC, id DESC""",
            (patient_id,),
        ).fetchall()


@router.post("/patients/{patient_id}/claim-bundles", status_code=201)
def create_claim_bundle(patient_id: UUID, body: ClaimBundleInput):
    file_type = body.filename.rsplit(".", 1)[-1]
    signatures = {"pdf": b"%PDF-", "zip": b"PK\x03\x04"}
    try:
        content = base64.b64decode(body.fileBase64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, "파일을 읽을 수 없습니다.")
    if (
        file_type not in signatures
        or not content.startswith(signatures[file_type])
        or len(content) > 50 * 1024 * 1024
    ):
        raise HTTPException(422, "50MB 이하의 PDF 또는 ZIP 파일을 선택해주세요.")
    with transaction() as conn:
        documents = conn.execute(
            """SELECT id, document_type AS type, document_date AS date, hospital
               FROM documents WHERE patient_id = %s AND document_type <> '처방전' AND id = ANY(%s)
               FOR SHARE""",
            (patient_id, body.documentIds),
        ).fetchall()
        by_id = {item["id"]: item for item in documents}
        if len(by_id) != len(body.documentIds):
            raise HTTPException(409, "이 환자의 영수증을 다시 선택해주세요.")
        # 원본 기록이 바뀌어도 생성 당시 파일과 영수증 구성은 그대로 남긴다.
        receipts = [
            {
                **by_id[item_id],
                "id": str(item_id),
                "date": by_id[item_id]["date"].isoformat()
                if by_id[item_id]["date"]
                else None,
            }
            for item_id in body.documentIds
        ]
        return conn.execute(
            f"""INSERT INTO claim_bundles
                (id, patient_id, filename, file_type, file_bytes, receipts)
                VALUES (%s, %s, %s, %s, %s, %s) RETURNING {CLAIM_COLUMNS}""",
            (uuid4(), patient_id, body.filename, file_type, content, Jsonb(receipts)),
        ).fetchone()


@router.put("/patients/{patient_id}/claim-bundles/{bundle_id}/used")
def mark_claim_bundle_used(patient_id: UUID, bundle_id: UUID):
    with transaction() as conn:
        bundle = conn.execute(
            f"""UPDATE claim_bundles SET used_at = COALESCE(used_at, now())
                WHERE patient_id = %s AND id = %s RETURNING {CLAIM_COLUMNS}""",
            (patient_id, bundle_id),
        ).fetchone()
        if bundle is None:
            raise HTTPException(404, "청구 묶음을 찾을 수 없습니다.")
        return bundle


@router.get("/patients/{patient_id}/claim-bundles/{bundle_id}/file")
def download_claim_bundle(patient_id: UUID, bundle_id: UUID):
    with transaction() as conn:
        bundle = conn.execute(
            """SELECT filename, file_type, file_bytes FROM claim_bundles
               WHERE patient_id = %s AND id = %s""",
            (patient_id, bundle_id),
        ).fetchone()
    if bundle is None:
        raise HTTPException(404, "청구 묶음을 찾을 수 없습니다.")
    return Response(
        content=bundle["file_bytes"],
        media_type=f"application/{bundle['file_type']}",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(bundle['filename'], safe='')}",
            "Cache-Control": "no-store",
        },
    )
