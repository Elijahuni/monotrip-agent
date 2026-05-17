"""add location embeddings (pgvector)

Revision ID: add_location_embeddings
Revises: 6ae1afe5b308
Create Date: 2026-05-16 18:06:54.405195

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "add_location_embeddings"
down_revision: Union[str, Sequence[str], None] = "6ae1afe5b308"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector 익스텐션 활성화 (이미 있으면 무시)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # embedding 컬럼 추가: 768차원 (text-embedding-004 기본 차원)
    op.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS embedding vector(768)")

    # 코사인 유사도 검색용 IVFFlat 인덱스 (100개 이상 데이터 기준 권장)
    # lists=100: 클러스터 수, probes는 쿼리 시 SET ivfflat.probes 로 조정
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_locations_embedding_cos
        ON locations
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        WHERE embedding IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_locations_embedding_cos")
    op.execute("ALTER TABLE locations DROP COLUMN IF EXISTS embedding")
