"""add user preference_embedding column

Revision ID: a1b2c3d4e5f6
Revises: f3d9b7e2c4a1
Create Date: 2026-05-18 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f3d9b7e2c4a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector 확장이 이미 enable되어 있다고 가정 (기존 마이그레이션에서 설정됨)
    op.add_column(
        "users",
        sa.Column(
            "preference_embedding",
            sa.Text(),  # 마이그레이션에서는 Text로 추가 후 ALTER로 vector로 변환
            nullable=True,
        ),
    )
    # Text 컬럼을 vector(768)로 변환
    op.execute("ALTER TABLE users ALTER COLUMN preference_embedding TYPE vector(768) USING NULL")


def downgrade() -> None:
    op.drop_column("users", "preference_embedding")
