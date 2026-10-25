"""실제 PostgreSQL의 격리된 임시 스키마에서 CRUD·재조회·원자성·충돌을 검증한다."""

import base64
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4
from psycopg import sql
from fastapi.testclient import TestClient
import main
import records
from database import connect


class ConfigurationTests(unittest.TestCase):
    def test_missing_password_reports_unavailable_without_leaking_config(self):
        with patch.dict(os.environ, {"DB_PASSWORD": ""}):
            response = TestClient(main.app).get("/api/state")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("password=", response.text)

    def test_invalid_patient_and_schedule_are_rejected(self):
        client = TestClient(main.app)
        self.assertEqual(
            client.post("/api/patients", json={"name": "  "}).status_code, 422
        )
        with self.assertRaises(ValueError):
            records.AppointmentInput(type="검사", date="2026-10-25", examination="")


@unittest.skipUnless(
    os.getenv("DB_PASSWORD"), "DB_PASSWORD 설정 후 실제 PostgreSQL 통합 테스트 가능"
)
class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.schema = "test_" + uuid4().hex
        with connect() as conn:
            conn.execute(
                sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema))
            )

        def isolated_connection():
            conn = connect()
            conn.execute(
                sql.SQL("SET search_path TO {}").format(sql.Identifier(self.schema))
            )
            conn.commit()
            return conn

        self.factory = isolated_connection
        self.patcher = patch.object(records, "connect", isolated_connection)
        self.patcher.start()
        with isolated_connection() as conn:
            conn.execute(
                (Path(__file__).parents[1] / "schema.sql").read_text(
                    encoding="utf-8-sig"
                )
            )
        self.client = TestClient(main.app)

    def tearDown(self):
        self.patcher.stop()
        # 테스트가 직접 생성한 임시 스키마만 삭제한다. 프로젝트 테이블은 건드리지 않는다.
        with connect() as conn:
            conn.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema))
            )

    def document(self, patient_id):
        return dict(
            id=str(uuid4()),
            patientId=patient_id,
            type="진료비 계산서·영수증",
            date=None,
            hospital="테스트 병원",
            filename="synthetic.png",
            url="data:image/png;base64,"
            + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"synthetic").decode(),
            ocrText="synthetic",
            ocrFields=[],
            ocrRawResponse={"images": []},
            parsedReceipt={},
        )

    def test_crud_persistence_conflict_and_transaction_rollback(self):
        c = self.client
        r = c.post("/api/patients", json={"name": "DB 테스트", "memo": "합성 데이터"})
        self.assertEqual(r.status_code, 201, r.text)
        patient = r.json()
        r = c.put(
            "/api/patients/" + patient["id"],
            json={"name": "수정 이름", "label": "본인"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        document = self.document(patient["id"])
        r = c.post("/api/documents", json={"document": document})
        self.assertEqual(r.status_code, 201, r.text)
        document = r.json()
        self.assertEqual(c.delete("/api/patients/" + patient["id"]).status_code, 409)
        document.update(date="2026-10-25", confirmed=True)
        appointment = dict(
            id=str(uuid4()),
            type="진료",
            date="2026-11-01",
            time="09:30",
            department="내과",
        )
        r = c.put(
            "/api/documents/" + document["id"],
            json={"document": document, "appointments": [appointment]},
        )
        self.assertEqual(r.status_code, 200, r.text)
        saved = r.json()["document"]
        # 새로운 클라이언트와 새 DB 연결에서도 원본·일정이 유지되는지 확인한다.
        state = TestClient(main.app).get("/api/state").json()
        self.assertEqual(state["patients"][0]["name"], "수정 이름")
        self.assertEqual(state["documents"][0]["url"], document["url"])
        self.assertEqual(state["appointments"][0]["documentId"], document["id"])
        self.assertEqual(
            c.put(
                "/api/documents/" + document["id"],
                json={"document": document, "appointments": []},
            ).status_code,
            409,
        )
        # 일정 교체 도중 FK 위반을 유도해 문서 변경과 기존 일정 삭제가 함께 롤백되는지 확인한다.
        with self.factory() as conn:
            conn.execute("""CREATE TABLE rollback_guard (id UUID PRIMARY KEY,
                         appointment_id UUID REFERENCES appointments(id))""")
            conn.execute(
                "INSERT INTO rollback_guard VALUES (%s,%s)",
                (uuid4(), appointment["id"]),
            )
        altered = {**saved, "hospital": "롤백돼야 하는 값"}
        r = c.put(
            "/api/documents/" + saved["id"],
            json={"document": altered, "appointments": []},
        )
        self.assertEqual(r.status_code, 409, r.text)
        state = c.get("/api/state").json()
        self.assertEqual(state["documents"][0]["hospital"], saved["hospital"])
        self.assertEqual(len(state["appointments"]), 1)
        with self.factory() as conn:
            conn.execute("DROP TABLE rollback_guard")
        r = c.put(
            "/api/documents/" + saved["id"],
            json={"document": saved, "appointments": []},
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(c.get("/api/state").json()["appointments"], [])
        self.assertEqual(c.delete("/api/documents/" + saved["id"]).status_code, 204)
        self.assertEqual(c.delete("/api/patients/" + patient["id"]).status_code, 204)
        state = c.get("/api/state").json()
        self.assertEqual(state, {"patients": [], "documents": [], "appointments": []})


if __name__ == "__main__":
    unittest.main()
