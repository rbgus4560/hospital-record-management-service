"""환자·문서·일정 영구 저장 API. 문서 확정과 일정 교체를 같은 트랜잭션으로 처리한다."""

import base64
import binascii
import re
from contextlib import contextmanager
from datetime import date as Date, time as Time
from uuid import UUID, uuid4

import psycopg
from psycopg.types.json import Jsonb
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
from database import connect

router = APIRouter(prefix="/api")


@contextmanager
def transaction():
    """정상 종료 시 커밋, 실패 시 롤백하며 DB 오류는 비밀값 없는 HTTP 오류로 변환한다."""
    try:
        with connect() as conn:
            yield conn
    except (psycopg.errors.ForeignKeyViolation, psycopg.errors.RestrictViolation):
        raise HTTPException(409, "연결된 기록이 있거나 대상 환자·문서가 없습니다.")
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 저장된 ID입니다. 목록을 다시 불러와주세요.")
    except psycopg.IntegrityError:
        raise HTTPException(422, "저장할 데이터의 관계·형식을 확인해주세요.")
    except (psycopg.Error, RuntimeError):
        raise HTTPException(
            503,
            "DB에 연결할 수 없습니다. PostgreSQL 실행 상태·DB 설정·초기화를 확인해주세요.",
        )


class PatientInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    label: str = Field(default="", max_length=100)
    memo: str = Field(default="", max_length=3000)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value):
        if not value.strip():
            raise ValueError("이름을 입력해주세요.")
        return value.strip()


class AppointmentInput(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    type: str
    date: Date
    time: Time | None = None
    department: str = Field(default="", max_length=200)
    doctor: str = Field(default="", max_length=200)
    examination: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def check_details(self):
        if self.type not in ("진료", "검사"):
            raise ValueError("진료 또는 검사 일정을 선택해주세요.")
        if not (self.examination if self.type == "검사" else self.department).strip():
            raise ValueError("진료과 또는 검사명이 필요합니다.")
        return self


class DocumentInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: UUID
    patient_id: UUID = Field(alias="patientId")
    type: str
    date: Date | None = None
    hospital: str = Field(default="", max_length=300)
    filename: str = Field(max_length=500)
    url: str = Field(max_length=14_000_000)
    ocr_text: str = Field(default="", alias="ocrText", max_length=1_000_000)
    ocr_fields: list = Field(default_factory=list, alias="ocrFields", max_length=10000)
    ocr_raw: dict = Field(default_factory=dict, alias="ocrRawResponse")
    parsed: dict = Field(default_factory=dict, alias="parsedReceipt")
    confirmed: bool = False
    version: int = Field(default=1, ge=1)

    @model_validator(mode="after")
    def check_document(self):
        if self.type not in ("진료비 계산서·영수증", "약제비 계산서·영수증", "처방전"):
            raise ValueError("지원하지 않는 문서 종류입니다.")
        if self.confirmed and (not self.date or not self.hospital.strip()):
            raise ValueError("확정 문서는 날짜와 병원명이 필요합니다.")
        return self


class DocumentSave(BaseModel):
    document: DocumentInput
    appointments: list[AppointmentInput] | None = Field(default=None, max_length=100)


def image_data(url):
    """이미지 Data URL을 해독하고 실제 시그니처·10MB 제한을 검증한다."""
    match = re.fullmatch(r"data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)", url)
    if not match:
        raise HTTPException(422, "JPG 또는 PNG 이미지가 필요합니다.")
    try:
        data = base64.b64decode(match[2], validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, "사진 데이터가 올바르지 않습니다.")
    signature = b"\xff\xd8\xff" if match[1] == "jpeg" else b"\x89PNG\r\n\x1a\n"
    if len(data) > 10 * 1024 * 1024 or not data.startswith(signature):
        raise HTTPException(422, "사진 크기 또는 형식이 올바르지 않습니다.")
    return match[1], data


def document_view(row):
    """DB 행을 기존 React 문서 형태로 변환한다. 저장 시각은 서버 값을 사용한다."""
    return dict(
        id=str(row["id"]),
        patientId=str(row["patient_id"]),
        type=row["document_type"],
        date=row["document_date"].isoformat() if row["document_date"] else "",
        hospital=row["hospital"],
        filename=row["filename"],
        url=f"data:image/{row['image_mime']};base64,"
        + base64.b64encode(bytes(row["image_bytes"])).decode(),
        ocrText=row["ocr_text"],
        ocrFields=row["ocr_fields"],
        ocrRawResponse=row["ocr_raw_response"],
        parsedReceipt=row["parsed_receipt"],
        confirmed=row["confirmed"],
        version=row["version"],
        createdAt=int(row["created_at"].timestamp() * 1000),
    )


def appointment_views(conn):
    """일정의 환자·병원은 문서에서 조인해 중복된 소유 관계 저장을 피한다."""
    rows = conn.execute("""SELECT a.*, d.patient_id, d.hospital FROM appointments a
                          JOIN documents d ON d.id=a.document_id ORDER BY appointment_date, appointment_time""").fetchall()
    return [
        dict(
            id=str(r["id"]),
            documentId=str(r["document_id"]),
            patientId=str(r["patient_id"]),
            hospital=r["hospital"],
            type=r["appointment_type"],
            date=r["appointment_date"].isoformat(),
            time=r["appointment_time"].strftime("%H:%M")
            if r["appointment_time"]
            else "",
            department=r["department"],
            doctor=r["doctor"],
            examination=r["examination"],
            location=r["location"],
            title=r["examination"]
            if r["appointment_type"] == "검사"
            else r["department"],
            needs_review=False,
        )
        for r in rows
    ]


@router.get("/state")
def read_state(response: Response):
    """환자·문서·일정을 동일한 읽기 스냅샷으로 반환한다."""
    response.headers["Cache-Control"] = "no-store"
    with transaction() as conn:
        # 세 목록을 한 스냅샷에서 읽어 저장 도중의 서로 다른 상태가 섞이지 않게 한다.
        conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        patients = conn.execute(
            "SELECT id,name,label,memo FROM patients ORDER BY created_at,id"
        ).fetchall()
        documents = conn.execute(
            "SELECT * FROM documents ORDER BY created_at,id"
        ).fetchall()
        return dict(
            patients=[{**r, "id": str(r["id"])} for r in patients],
            documents=[document_view(r) for r in documents],
            appointments=appointment_views(conn),
        )


@router.post("/patients", status_code=201)
def create_patient(body: PatientInput):
    """새 UUID로 환자를 등록한다. 이름이 같아도 별도 환자로 구분한다."""
    with transaction() as conn:
        row = conn.execute(
            "INSERT INTO patients(id,name,label,memo) VALUES (%s,%s,%s,%s) RETURNING id,name,label,memo",
            (uuid4(), body.name, body.label, body.memo),
        ).fetchone()
        return {**row, "id": str(row["id"])}


@router.put("/patients/{patient_id}")
def update_patient(patient_id: UUID, body: PatientInput):
    """환자 프로필만 수정하며 연결 문서의 소유 관계는 유지한다."""
    with transaction() as conn:
        row = conn.execute(
            "UPDATE patients SET name=%s,label=%s,memo=%s WHERE id=%s RETURNING id,name,label,memo",
            (body.name, body.label, body.memo, patient_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "환자를 찾을 수 없습니다.")
        return {**row, "id": str(row["id"])}


@router.delete("/patients/{patient_id}", status_code=204)
def delete_patient(patient_id: UUID):
    """연결 문서가 있으면 외래 키가 삭제를 거부한다."""
    with transaction() as conn:
        if not conn.execute(
            "DELETE FROM patients WHERE id=%s RETURNING id", (patient_id,)
        ).fetchone():
            raise HTTPException(404, "환자를 찾을 수 없습니다.")
    return Response(status_code=204)


@router.post("/documents", status_code=201)
def create_document(body: DocumentSave):
    """OCR 결과를 미확정 문서로 저장한다. 일정 확정은 별도 검수 단계에서 처리한다."""
    d = body.document
    if d.confirmed or body.appointments:
        raise HTTPException(422, "문서를 먼저 등록한 후 검수·확정해주세요.")
    mime, data = image_data(d.url)
    with transaction() as conn:
        row = conn.execute(
            """INSERT INTO documents
            (id,patient_id,document_type,document_date,hospital,filename,image_mime,image_bytes,
             ocr_text,ocr_fields,ocr_raw_response,parsed_receipt)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (
                d.id,
                d.patient_id,
                d.type,
                d.date,
                d.hospital,
                d.filename,
                mime,
                data,
                d.ocr_text,
                Jsonb(d.ocr_fields),
                Jsonb(d.ocr_raw),
                Jsonb(d.parsed),
            ),
        ).fetchone()
        return document_view(row)


@router.put("/documents/{document_id}")
def update_document(document_id: UUID, body: DocumentSave):
    """버전과 환자 소유 관계를 확인하고 문서·일정 교체를 원자적으로 저장한다."""
    d = body.document
    if d.id != document_id:
        raise HTTPException(422, "문서 ID가 일치하지 않습니다.")
    if body.appointments is not None and not d.confirmed:
        raise HTTPException(422, "확정한 문서에만 일정을 저장할 수 있습니다.")
    if body.appointments is not None and len({a.id for a in body.appointments}) != len(
        body.appointments
    ):
        raise HTTPException(422, "중복된 일정 ID입니다.")
    with transaction() as conn:
        existing = conn.execute(
            "SELECT * FROM documents WHERE id=%s FOR UPDATE", (document_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "문서를 찾을 수 없습니다.")
        if existing["version"] != d.version:
            raise HTTPException(
                409, "다른 화면에서 문서가 변경됐습니다. 새로고침 후 다시 수정해주세요."
            )
        if (
            existing["patient_id"] != d.patient_id
            or existing["confirmed"]
            and not d.confirmed
        ):
            raise HTTPException(422, "환자를 바꾸거나 확정 상태를 되돌릴 수 없습니다.")
        if d.confirmed and not existing["confirmed"] and body.appointments is None:
            raise HTTPException(422, "문서 확정 시 확인된 일정 목록이 필요합니다.")
        row = conn.execute(
            """UPDATE documents SET document_date=%s,hospital=%s,parsed_receipt=%s,
            confirmed=%s,version=version+1,updated_at=now() WHERE id=%s RETURNING *""",
            (d.date, d.hospital.strip(), Jsonb(d.parsed), d.confirmed, document_id),
        ).fetchone()
        if body.appointments is not None:
            conn.execute(
                "DELETE FROM appointments WHERE document_id=%s", (document_id,)
            )
            for a in body.appointments:
                conn.execute(
                    """INSERT INTO appointments
                    (id,document_id,appointment_type,appointment_date,appointment_time,department,doctor,examination,location)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (
                        a.id,
                        document_id,
                        a.type,
                        a.date,
                        a.time,
                        a.department.strip(),
                        a.doctor,
                        a.examination.strip(),
                        a.location,
                    ),
                )
        return dict(
            document=document_view(row),
            appointments=[
                a
                for a in appointment_views(conn)
                if a["documentId"] == str(document_id)
            ],
        )


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: UUID):
    """문서 삭제 시 연결 일정도 DB 외래 키의 CASCADE 규칙으로 함께 삭제한다."""
    with transaction() as conn:
        if not conn.execute(
            "DELETE FROM documents WHERE id=%s RETURNING id", (document_id,)
        ).fetchone():
            raise HTTPException(404, "문서를 찾을 수 없습니다.")
    return Response(status_code=204)
