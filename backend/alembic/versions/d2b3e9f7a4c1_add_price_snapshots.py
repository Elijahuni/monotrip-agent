"""add price snapshot tables (flight + hotel)

Revision ID: d2b3e9f7a4c1
Revises: c1a7d9e3b2f0
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2b3e9f7a4c1"
down_revision: Union[str, Sequence[str], None] = "c1a7d9e3b2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flight_price_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("from_iata", sa.String(length=3), nullable=False),
        sa.Column("to_iata", sa.String(length=3), nullable=False),
        sa.Column("depart_date", sa.Date(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=True),
        sa.Column("cabin", sa.String(length=20), nullable=False, server_default="economy"),
        sa.Column("min_price_krw", sa.Integer(), nullable=False),
        sa.Column("median_price_krw", sa.Integer(), nullable=True),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("captured_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_flight_snapshot_route_depart",
        "flight_price_snapshots",
        ["from_iata", "to_iata", "depart_date"],
    )
    op.create_index("ix_flight_snapshot_captured_at", "flight_price_snapshots", ["captured_at"])

    op.create_table(
        "hotel_price_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("city", sa.String(length=50), nullable=False),
        sa.Column("checkin", sa.Date(), nullable=False),
        sa.Column("checkout", sa.Date(), nullable=False),
        sa.Column("min_price_per_night_krw", sa.Integer(), nullable=False),
        sa.Column("median_price_per_night_krw", sa.Integer(), nullable=True),
        sa.Column("sample_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("captured_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_hotel_snapshot_city_checkin", "hotel_price_snapshots", ["city", "checkin"])
    op.create_index("ix_hotel_snapshot_captured_at", "hotel_price_snapshots", ["captured_at"])


def downgrade() -> None:
    op.drop_index("ix_hotel_snapshot_captured_at", table_name="hotel_price_snapshots")
    op.drop_index("ix_hotel_snapshot_city_checkin", table_name="hotel_price_snapshots")
    op.drop_table("hotel_price_snapshots")
    op.drop_index("ix_flight_snapshot_captured_at", table_name="flight_price_snapshots")
    op.drop_index("ix_flight_snapshot_route_depart", table_name="flight_price_snapshots")
    op.drop_table("flight_price_snapshots")
