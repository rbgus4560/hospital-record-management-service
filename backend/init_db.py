"""
1. 목적
   명령 한 번으로 프로젝트의 DB 초기화를 시작한다.

2. 입력
   환경 변수에 설정된 PostgreSQL 연결 정보를 사용한다.

3. 주요 기능
   DB와 테이블을 준비하는 초기화 함수를 실행한다.
"""

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
