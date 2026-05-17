"""add OAuth fields to users (auth_provider, provider_user_id) + nullable password

Revision ID: c9a4b1e7f6d2
Revises: b6f2d4e9c7a3
Create Date: 2026-05-17 05:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9a4b1e7f6d2"
down_revision: Union[str, Sequence[str], None] = "b6f2d4e9c7a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users",
        sa.Column("auth_provider", sa.String(length=20), nullable=False, server_default="local"))
    op.add_column("users", sa.Column("provider_user_id", sa.String(length=64), nullable=True))
    op.create_index("ix_users_provider_user_id", "users", ["provider_user_id"])
    # 기존 local 사용자는 password 필수 유지. OAuth 사용자만 NULL 허용.
    op.alter_column("users", "hashed_password",
                    existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "hashed_password",
                    existing_type=sa.String(length=255), nullable=False)
    op.drop_index("ix_users_provider_user_id", table_name="users")
    op.drop_column("users", "provider_user_id")
    op.drop_column("users", "auth_provider")
