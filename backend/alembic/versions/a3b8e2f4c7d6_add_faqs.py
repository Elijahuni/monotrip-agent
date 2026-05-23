"""add faqs table

Revision ID: a3b8e2f4c7d6
Revises: f7a2c3d9e1b4
Create Date: 2026-05-21 12:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b8e2f4c7d6"
down_revision: Union[str, Sequence[str], None] = "f7a2c3d9e1b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "faqs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("category", sa.String(30), server_default="general", nullable=False),
        sa.Column("question", sa.String(300), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_faqs_listing", "faqs", ["is_published", "order_index", "id"])


def downgrade() -> None:
    op.drop_index("ix_faqs_listing", table_name="faqs")
    op.drop_table("faqs")
