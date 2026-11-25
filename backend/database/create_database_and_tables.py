"""
1. 목적
   MediLog를 처음 실행할 때 PostgreSQL 저장 구조를 준비한다.

2. 입력
   DB 접속 설정과 프로젝트의 스키마 SQL을 읽는다.

3. 주요 기능
   대상 DB가 없으면 생성하고 필요한 테이블과 제약 조건을 적용한다.
"""

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
