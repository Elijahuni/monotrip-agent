"""add notices table

Revision ID: f7a2c3d9e1b4
Revises: e1f5a3d8b2c0
Create Date: 2026-05-21 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a2c3d9e1b4"
down_revision: Union[str, Sequence[str], None] = "e1f5a3d8b2c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("category", sa.String(30), server_default="general", nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("published_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_notices_published",
        "notices",
        ["is_published", "is_pinned", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notices_published", table_name="notices")
    op.drop_table("notices")
