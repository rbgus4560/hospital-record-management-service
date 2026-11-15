"""기존 명령에서 사용하는 DB 초기화 진입점."""

import psycopg

from database.create_database_and_tables import initialize


if __name__ == "__main__":
    try:
        initialize()
    except (psycopg.Error, RuntimeError):
        print(
            "DB 초기화 실패: PostgreSQL 실행 상태, DB_* 설정 및 생성 권한을 확인해주세요."
        )
        raise SystemExit(1)
