"""add version + updated_at to locations for optimistic concurrency

Revision ID: b6f2d4e9c7a3
Revises: a5e1d8c3b4f0
Create Date: 2026-05-17 04:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6f2d4e9c7a3"
down_revision: Union[str, Sequence[str], None] = "a5e1d8c3b4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("locations",
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_column("locations", "updated_at")
    op.drop_column("locations", "version")
