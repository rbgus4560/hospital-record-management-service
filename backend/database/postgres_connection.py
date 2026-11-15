"""로컬 PostgreSQL 연결. 연결 정보나 의료 데이터를 오류 응답에 노출하지 않는다."""

import os
from contextlib import contextmanager
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


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
