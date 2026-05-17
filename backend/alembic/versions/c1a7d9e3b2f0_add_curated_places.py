"""add curated_places table

Revision ID: c1a7d9e3b2f0
Revises: add_location_embeddings
Create Date: 2026-05-16 19:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1a7d9e3b2f0"
down_revision: Union[str, Sequence[str], None] = "add_location_embeddings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "curated_places",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(length=200), nullable=True, unique=True),
        sa.Column("country", sa.String(length=2), nullable=False, server_default="JP"),
        sa.Column("city", sa.String(length=50), nullable=False),
        sa.Column("region", sa.String(length=80), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("name_en", sa.String(length=200), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("vibe_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_image", sa.String(length=500), nullable=True),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("instagram_hashtag", sa.String(length=100), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("opening_hours", sa.Text(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price_level", sa.Integer(), nullable=True),
        sa.Column("popularity_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("women_friendly", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("safety_score", sa.Integer(), nullable=True),
        sa.Column("tax_free", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("solo_female_review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_curated_places_city_category", "curated_places", ["city", "category"])
    op.create_index("ix_curated_places_country_city", "curated_places", ["country", "city"])

    # pgvector embedding (PostgreSQL 전용; SQLite는 컬럼 추가 불가능하므로 raw SQL로 분기)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("ALTER TABLE curated_places ADD COLUMN embedding vector(768)")
        op.execute(
            """
            CREATE INDEX IF NOT EXISTS ix_curated_places_embedding_cos
            ON curated_places
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
            WHERE embedding IS NOT NULL
            """
        )
    else:
        # SQLite (테스트): TEXT JSON 컬럼
        with op.batch_alter_table("curated_places") as batch_op:
            batch_op.add_column(sa.Column("embedding", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_curated_places_embedding_cos")
    op.drop_index("ix_curated_places_country_city", table_name="curated_places")
    op.drop_index("ix_curated_places_city_category", table_name="curated_places")
    op.drop_table("curated_places")
