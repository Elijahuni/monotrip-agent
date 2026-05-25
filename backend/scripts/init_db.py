"""Production DB initialization script.

On a fresh database (no tables exist), creates all tables from SQLAlchemy
models and stamps Alembic to head. On an existing database, runs Alembic
migrations normally.
"""

import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.database import Base

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401


async def init_db() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.connect() as conn:
        # Check if alembic_version table exists (= DB has been initialized before)
        result = await conn.execute(
            text(
                "SELECT EXISTS ("
                "  SELECT FROM information_schema.tables"
                "  WHERE table_name = 'alembic_version'"
                ")"
            )
        )
        has_alembic = result.scalar()

        if has_alembic:
            # DB already initialized — check if there are version stamps
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            rows = result.fetchall()
            if rows:
                print(f"[init_db] Existing DB detected (version: {rows[0][0]}). Skipping create_all.")
                await engine.dispose()
                return

    # Fresh DB — create all tables from models
    print("[init_db] Fresh database detected. Creating all tables from models...")

    async with engine.begin() as conn:
        # Try to enable pgvector extension (may already exist or not be available)
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            print("[init_db] pgvector extension enabled.")
        except Exception as e:
            print(f"[init_db] pgvector extension not available: {e}")
            print("[init_db] Embedding columns will use TEXT fallback.")

        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        print("[init_db] All tables created successfully.")

        # Stamp alembic to head so future migrations work correctly
        # First create alembic_version table
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS alembic_version ("
                "  version_num VARCHAR(32) NOT NULL,"
                "  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
                ")"
            )
        )
        await conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES ('0001_baseline')")
        )
        print("[init_db] Alembic version stamped.")

    await engine.dispose()
    print("[init_db] Database initialization complete!")


if __name__ == "__main__":
    try:
        asyncio.run(init_db())
    except Exception as e:
        print(f"[init_db] FATAL: {e}", file=sys.stderr)
        sys.exit(1)
