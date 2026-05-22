"""add direct_messages table

Revision ID: d8b3f6a1c4e2
Revises: c1e7a5b3f9d8
Create Date: 2026-05-21 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d8b3f6a1c4e2"
down_revision: Union[str, Sequence[str], None] = "c1e7a5b3f9d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "direct_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dm_pair", "direct_messages", ["sender_id", "recipient_id", "id"])
    op.create_index("ix_dm_recipient_unread", "direct_messages", ["recipient_id", "read_at"])


def downgrade() -> None:
    op.drop_index("ix_dm_recipient_unread", table_name="direct_messages")
    op.drop_index("ix_dm_pair", table_name="direct_messages")
    op.drop_table("direct_messages")
