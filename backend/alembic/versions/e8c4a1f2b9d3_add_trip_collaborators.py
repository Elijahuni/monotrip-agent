"""add trip_collaborators and trip_invites

Revision ID: e8c4a1f2b9d3
Revises: d2b3e9f7a4c1
Create Date: 2026-05-17 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8c4a1f2b9d3"
down_revision: Union[str, Sequence[str], None] = "d2b3e9f7a4c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trip_collaborators",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="edit"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator"),
    )
    op.create_index("ix_collaborator_user", "trip_collaborators", ["user_id"])

    op.create_table(
        "trip_invites",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inviter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False, unique=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="edit"),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("accepted_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invite_token", "trip_invites", ["token"])
    op.create_index("ix_invite_trip", "trip_invites", ["trip_id"])


def downgrade() -> None:
    op.drop_index("ix_invite_trip", table_name="trip_invites")
    op.drop_index("ix_invite_token", table_name="trip_invites")
    op.drop_table("trip_invites")
    op.drop_index("ix_collaborator_user", table_name="trip_collaborators")
    op.drop_table("trip_collaborators")
