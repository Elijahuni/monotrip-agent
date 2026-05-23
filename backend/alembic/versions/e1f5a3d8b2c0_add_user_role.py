"""add role column to users

Revision ID: e1f5a3d8b2c0
Revises: d4e8f2a9c3b1
Create Date: 2026-05-20 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f5a3d8b2c0"
down_revision: Union[str, Sequence[str], None] = "d4e8f2a9c3b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(20),
            nullable=False,
            server_default="user",  # 기존 유저 전부 "user"로 초기화
        ),
    )
    op.create_index("ix_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "role")
