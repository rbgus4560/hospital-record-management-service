"""로컬 PostgreSQL 연결. 연결 정보나 의료 데이터를 오류 응답에 노출하지 않는다."""

import os
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def settings():
    """비밀값을 출력하지 않고 연결 인자를 구성한다. 비밀번호 누락은 연결 전에 차단한다."""
    if not os.getenv("DB_PASSWORD"):
        raise RuntimeError("backend/.env에 DB_PASSWORD를 설정해주세요.")
    return dict(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "hospital_records"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.environ["DB_PASSWORD"],
        connect_timeout=5,
    )


def connect():
    """호출마다 연결을 만들며 커밋·롤백·닫기는 호출자의 with 문에 위임한다."""
    return psycopg.connect(**settings(), row_factory=dict_row)
