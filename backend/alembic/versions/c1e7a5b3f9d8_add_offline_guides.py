"""add offline_guides table

Revision ID: c1e7a5b3f9d8
Revises: b9d4f1a8e2c7
Create Date: 2026-05-21 13:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1e7a5b3f9d8"
down_revision: Union[str, Sequence[str], None] = "b9d4f1a8e2c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "offline_guides",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("city", sa.String(60), nullable=False),
        sa.Column("country", sa.String(60), server_default="", nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), server_default="", nullable=False),
        sa.Column("sections", sa.JSON(), nullable=True),
        sa.Column("cover_image", sa.String(500), nullable=True),
        sa.Column("language", sa.String(5), server_default="ko", nullable=False),
        sa.Column("file_size_kb", sa.Integer(), server_default="0", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_offline_guides_listing", "offline_guides", ["is_published", "city"])


def downgrade() -> None:
    op.drop_index("ix_offline_guides_listing", table_name="offline_guides")
    op.drop_table("offline_guides")
