"""SQLite/PostgreSQL 호환 Vector TypeDecorator.

PostgreSQL: pgvector native `vector(dim)` 타입 사용 (코사인 유사도 인덱스 가능).
SQLite:     JSON TEXT로 직렬화 (테스트 환경 — 벡터 연산 불가, 단순 저장만).
"""

import json

from sqlalchemy import Dialect, Text
from sqlalchemy.types import TypeDecorator

try:
    from pgvector.sqlalchemy import Vector as PgVector

    _PG_VECTOR_AVAILABLE = True
except ImportError:
    _PG_VECTOR_AVAILABLE = False


class CompatibleVector(TypeDecorator):
    """PostgreSQL에서는 pgvector Vector, SQLite에서는 JSON TEXT."""

    impl = Text
    cache_ok = True

    def __init__(self, dim: int) -> None:
        super().__init__()
        self.dim = dim
        self._pg_type = PgVector(dim) if _PG_VECTOR_AVAILABLE else None

    def load_dialect_impl(self, dialect: Dialect):
        if dialect.name == "postgresql" and self._pg_type is not None:
            return dialect.type_descriptor(self._pg_type)
        return dialect.type_descriptor(Text())

    def process_bind_param(
        self, value: list[float] | None, dialect: Dialect
    ) -> str | list[float] | None:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value  # pgvector driver가 list[float]를 그대로 수용
        return json.dumps(value)

    def process_result_value(self, value, dialect: Dialect) -> list[float] | None:
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value  # pgvector driver가 이미 list로 반환
        if isinstance(value, str):
            return json.loads(value)
        return value
