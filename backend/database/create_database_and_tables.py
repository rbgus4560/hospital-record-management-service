"""명시적으로 실행할 때만 DB와 테이블을 생성한다. 기존 데이터는 삭제하지 않는다."""

from pathlib import Path
import psycopg
from psycopg import sql
from .postgres_connection import settings, connect


def initialize():
    """기존 데이터를 지우지 않고 DB 존재 여부를 확인한 뒤 초기 테이블을 준비한다."""
    config = settings()
    name = config["dbname"]
    config["dbname"] = "postgres"
    with psycopg.connect(**config, autocommit=True) as conn:
        if not conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (name,)
        ).fetchone():
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    with connect() as conn:
        conn.execute(
            (Path(__file__).parent / "hospital_records_schema.sql").read_text(encoding="utf-8-sig")
        )
    print("DB 및 테이블 준비 완료: patients, documents, appointments, claim_bundles")
