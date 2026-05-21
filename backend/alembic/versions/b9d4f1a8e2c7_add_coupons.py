"""add coupons and user_coupons tables

Revision ID: b9d4f1a8e2c7
Revises: a3b8e2f4c7d6
Create Date: 2026-05-21 13:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b9d4f1a8e2c7"
down_revision: Union[str, Sequence[str], None] = "a3b8e2f4c7d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coupons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("discount_type", sa.String(10), server_default="amount", nullable=False),
        sa.Column("discount_value", sa.Integer(), nullable=False),
        sa.Column("min_order_amount", sa.Integer(), server_default="0", nullable=False),
        sa.Column("valid_until", sa.DateTime(), nullable=True),
        sa.Column("max_claims", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_coupon_code"),
    )
    op.create_index("ix_coupons_active", "coupons", ["is_active", "valid_until"])

    op.create_table(
        "user_coupons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("coupon_id", sa.Integer(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["coupon_id"], ["coupons.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "coupon_id", name="uq_user_coupon"),
    )
    op.create_index("ix_user_coupons_user", "user_coupons", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_coupons_user", table_name="user_coupons")
    op.drop_table("user_coupons")
    op.drop_index("ix_coupons_active", table_name="coupons")
    op.drop_table("coupons")
