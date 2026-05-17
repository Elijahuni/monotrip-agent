"""큐레이션 장소 시드 — 도시별 데이터를 scripts/seed_data/* 에서 로드.

사용법:
    uv run python scripts/seed_curated_places.py
    uv run python scripts/seed_curated_places.py --reset   # 기존 시드 삭제 후 재적재
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.curated_place import CuratedPlace
from app.repositories.curated_place_repository import CuratedPlaceRepository
from scripts.seed_data import ALL_SEEDS


async def main(reset: bool = False) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    repo = CuratedPlaceRepository()

    async with session_factory() as db:
        if reset:
            # source_id가 seed:* 패턴인 것만 안전하게 삭제 (운영 데이터 보호)
            await db.execute(
                delete(CuratedPlace).where(CuratedPlace.source_id.like("seed:%"))
            )
            await db.commit()
            print("🗑️  Reset: seed:* rows deleted")

        for source_id, defaults in ALL_SEEDS:
            await repo.upsert_by_source_id(db, source_id, defaults)
        await db.commit()

    await engine.dispose()
    by_city: dict[str, int] = {}
    for _, d in ALL_SEEDS:
        by_city[d["city"]] = by_city.get(d["city"], 0) + 1
    summary = ", ".join(f"{c}={n}" for c, n in sorted(by_city.items()))
    print(f"✅ Curated places seed complete. total={len(ALL_SEEDS)} ({summary})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="기존 seed:* 행 삭제 후 재적재")
    args = parser.parse_args()
    asyncio.run(main(reset=args.reset))
