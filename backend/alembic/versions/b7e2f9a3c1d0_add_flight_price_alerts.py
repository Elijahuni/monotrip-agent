"""add flight_price_alerts table.

Revision ID: b7e2f9a3c1d0
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "b7e2f9a3c1d0"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "flight_price_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("from_iata", sa.String(3), nullable=False),
        sa.Column("to_iata", sa.String(3), nullable=False),
        sa.Column("depart_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("cabin", sa.String(20), nullable=False, server_default="economy"),
        sa.Column("adults", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("drop_threshold_pct", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("last_alerted_price_krw", sa.Integer(), nullable=True),
        sa.Column("last_alerted_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint(
            "user_id",
            "from_iata",
            "to_iata",
            "depart_date",
            "cabin",
            name="uq_flight_alert_user_route",
        ),
    )
    op.create_index("ix_flight_alert_active", "flight_price_alerts", ["is_active"])
    op.create_index("ix_flight_alert_user", "flight_price_alerts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_flight_alert_user", table_name="flight_price_alerts")
    op.drop_index("ix_flight_alert_active", table_name="flight_price_alerts")
    op.drop_table("flight_price_alerts")
