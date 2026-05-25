"""Initial baseline — all tables created by init_db.py / create_all.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-05-25
"""

from typing import Sequence, Union


revision: str = "0001_baseline"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tables already created by scripts/init_db.py — nothing to do."""
    pass


def downgrade() -> None:
    """No downgrade for initial baseline."""
    pass
