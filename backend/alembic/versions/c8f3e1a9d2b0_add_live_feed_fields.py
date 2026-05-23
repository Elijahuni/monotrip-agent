"""add post_type and expires_at to community_posts.

Revision ID: c8f3e1a9d2b0
Revises: b7e2f9a3c1d0
Create Date: 2026-05-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "c8f3e1a9d2b0"
down_revision = "b7e2f9a3c1d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "community_posts",
        sa.Column("post_type", sa.String(20), nullable=False, server_default="regular"),
    )
    op.add_column(
        "community_posts",
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_post_type", "community_posts", ["post_type"])
    op.create_index("ix_post_expires_at", "community_posts", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_post_expires_at", table_name="community_posts")
    op.drop_index("ix_post_type", table_name="community_posts")
    op.drop_column("community_posts", "expires_at")
    op.drop_column("community_posts", "post_type")
