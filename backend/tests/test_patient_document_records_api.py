"""
1. 목적
   환자·문서·일정 API가 수정 후에도 같은 방식으로 동작하는지 확인한다.

2. 입력
   테스트용 요청을 만들며, PostgreSQL 연결 설정이 있으면 임시 스키마를 사용한다.

3. 주요 기능
   입력 오류와 DB 설정 오류, 저장·조회·수정·삭제, 완료 상태 및 트랜잭션 롤백을 검사한다.
"""

import base64
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4
from psycopg import sql
from fastapi.testclient import TestClient
import main
import patient_document_records_api
from database import postgres_connection
from database.postgres_connection import connect


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
            patient_document_records_api.AppointmentInput(
                type="검사", date="2026-10-25", examination=""
            )


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
        self.patcher = patch.object(postgres_connection, "connect", isolated_connection)
        self.patcher.start()
        with isolated_connection() as conn:
            conn.execute(
                (
                    Path(__file__).parents[1]
                    / "database"
                    / "hospital_records_schema.sql"
                ).read_text(encoding="utf-8-sig")
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

    def test_completion_persistence_resave_and_reset(self):
        c = self.client
        patient = c.post("/api/patients", json={"name": "완료 테스트"}).json()
        document = c.post(
            "/api/documents", json={"document": self.document(patient["id"])}
        ).json()
        document.update(date="2026-11-23", confirmed=True)
        appointment = dict(
            id=str(uuid4()),
            type="검사",
            date="2026-11-24",
            time="10:00",
            examination="합성 검사",
        )
        result = c.put(
            "/api/documents/" + document["id"],
            json={"document": document, "appointments": [appointment]},
        )
        self.assertEqual(result.status_code, 200, result.text)
        saved = result.json()["document"]
        path = "/api/appointments/" + appointment["id"] + "/completion"
        self.assertFalse(result.json()["appointments"][0]["completed"])
        completed = c.put(path, json={"completed": True})
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertTrue(
            TestClient(main.app)
            .get("/api/state")
            .json()["appointments"][0]["completed"]
        )
        # 재시도는 같은 상태를 유지하고 버전을 불필요하게 올리지 않는다.
        retried = c.put(path, json={"completed": True})
        self.assertEqual(
            retried.json()["document"]["version"],
            completed.json()["document"]["version"],
        )
        # 오래된 검수 화면은 완료 처리 이후 기록을 덮어쓸 수 없다.
        stale = c.put(
            "/api/documents/" + document["id"],
            json={"document": saved, "appointments": [appointment]},
        )
        self.assertEqual(stale.status_code, 409, stale.text)
        saved = completed.json()["document"]
        current = c.put(
            "/api/documents/" + saved["id"],
            json={"document": saved, "appointments": [appointment]},
        )
        self.assertEqual(current.status_code, 200, current.text)
        self.assertTrue(current.json()["appointments"][0]["completed"])
        # 같은 원본을 다시 분석해 UUID가 바뀌어도 유일하게 같은 일정은 완료를 유지한다.
        appointment["id"] = str(uuid4())
        current = c.put(
            "/api/documents/" + saved["id"],
            json={
                "document": current.json()["document"],
                "appointments": [appointment],
            },
        )
        self.assertEqual(current.status_code, 200, current.text)
        self.assertTrue(current.json()["appointments"][0]["completed"])
        reset = c.put(
            "/api/appointments/" + appointment["id"] + "/completion",
            json={"completed": False},
        )
        self.assertEqual(reset.status_code, 200, reset.text)
        self.assertFalse(
            TestClient(main.app)
            .get("/api/state")
            .json()["appointments"][0]["completed"]
        )
        self.assertEqual(
            c.put(
                "/api/appointments/" + str(uuid4()) + "/completion",
                json={"completed": True},
            ).status_code,
            404,
        )
        # 스키마 초기화를 반복해도 저장한 상태가 유지된다.
        c.put(
            "/api/appointments/" + appointment["id"] + "/completion",
            json={"completed": True},
        )
        with self.factory() as conn:
            conn.execute(
                (
                    Path(__file__).parents[1]
                    / "database"
                    / "hospital_records_schema.sql"
                ).read_text(encoding="utf-8-sig")
            )
        self.assertTrue(c.get("/api/state").json()["appointments"][0]["completed"])

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
