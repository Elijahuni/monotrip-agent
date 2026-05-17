"""add moderation_status / moderation_categories to community tables

Revision ID: a5e1d8c3b4f0
Revises: f3d9b7e2c4a1
Create Date: 2026-05-17 03:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a5e1d8c3b4f0"
down_revision: Union[str, Sequence[str], None] = "f3d9b7e2c4a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "community_posts",
        sa.Column(
            "moderation_status", sa.String(length=20), nullable=False, server_default="pending"
        ),
    )
    op.add_column("community_posts", sa.Column("moderation_categories", sa.JSON(), nullable=True))
    op.create_index("ix_post_moderation_status", "community_posts", ["moderation_status"])

    op.add_column(
        "community_comments",
        sa.Column(
            "moderation_status", sa.String(length=20), nullable=False, server_default="pending"
        ),
    )
    op.add_column(
        "community_comments", sa.Column("moderation_categories", sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("community_comments", "moderation_categories")
    op.drop_column("community_comments", "moderation_status")
    op.drop_index("ix_post_moderation_status", table_name="community_posts")
    op.drop_column("community_posts", "moderation_categories")
    op.drop_column("community_posts", "moderation_status")
