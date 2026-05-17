"""큐레이션 장소 임베딩 백필.

사용법:
    uv run python scripts/embed_curated_places.py            # 임베딩 없는 것만
    uv run python scripts/embed_curated_places.py --all      # 강제 재생성
    uv run python scripts/embed_curated_places.py --city tokyo

text-embedding-004 (768차원). vibe_tags도 입력 텍스트에 포함하여
"빈티지 카페" 같은 검색이 매칭되도록 한다.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.curated_place import CuratedPlace
from app.services.ai.embedding_service import embed_place


def _enriched_notes(p: CuratedPlace) -> str:
    """vibe_tags + description을 합쳐 임베딩 텍스트를 풍부하게."""
    parts = []
    if p.vibe_tags:
        parts.append("vibe: " + ", ".join(p.vibe_tags))
    if p.region:
        parts.append(f"지역: {p.region}")
    if p.description:
        parts.append(p.description)
    return " | ".join(parts)


async def main(force_all: bool, city_filter: str | None) -> None:
    settings = get_settings()
    if not settings.gemini_api_key:
        print("❌ GEMINI_API_KEY가 설정되어 있지 않습니다.")
        return

    engine = create_async_engine(settings.database_url)
    SF = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SF() as db:
        stmt = select(CuratedPlace).where(CuratedPlace.is_published.is_(True))
        if not force_all:
            stmt = stmt.where(CuratedPlace.embedding.is_(None))
        if city_filter:
            stmt = stmt.where(CuratedPlace.city == city_filter)
        rows: list[CuratedPlace] = list((await db.execute(stmt)).scalars().all())

        if not rows:
            print("✅ 임베딩 대상 없음 (이미 모두 완료)")
            await engine.dispose()
            return

        print(f"⚙️  임베딩 생성: {len(rows)}개...")
        done = failed = 0
        # API rate limit 보호: 동시 호출 5개로 제한
        sem = asyncio.Semaphore(5)

        async def process(p: CuratedPlace) -> None:
            nonlocal done, failed
            async with sem:
                vec = await embed_place(
                    name=p.name,
                    category=p.category,
                    address=p.address,
                    notes=_enriched_notes(p),
                )
                if vec is None:
                    failed += 1
                    print(f"  ⚠️  실패: {p.name}")
                    return
                p.embedding = vec
                done += 1
                if done % 10 == 0:
                    print(f"  ... {done}/{len(rows)}")

        await asyncio.gather(*[process(p) for p in rows])
        await db.commit()

    await engine.dispose()
    print(f"✅ 완료: 성공 {done}, 실패 {failed}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--all", dest="force_all", action="store_true", help="이미 임베딩 있어도 재생성"
    )
    parser.add_argument("--city", help="특정 도시만 (tokyo/osaka/seoul/...)")
    args = parser.parse_args()
    asyncio.run(main(force_all=args.force_all, city_filter=args.city))
