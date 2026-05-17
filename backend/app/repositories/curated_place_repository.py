"""CuratedPlaceRepository — DB 접근만 담당. 비즈니스 로직 금지."""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.curated_place import CuratedPlace


class CuratedPlaceRepository:
    async def list_by_city(
        self,
        db: AsyncSession,
        city: str,
        *,
        category: str | None = None,
        women_friendly: bool | None = None,
        limit: int = 30,
        offset: int = 0,
    ) -> list[CuratedPlace]:
        """city 필터 + 옵션 필터로 published 큐레이션 목록 반환.

        정렬: popularity_score DESC, rating DESC (NULL last).
        vibe 가중 정렬은 service 계층에서 in-memory로 적용 (vibe_tags가 JSON이라
        DB별 SQL이 갈리는 것을 피하기 위함).
        """
        stmt = (
            select(CuratedPlace)
            .where(CuratedPlace.city == city)
            .where(CuratedPlace.is_published.is_(True))
        )
        if category is not None:
            stmt = stmt.where(CuratedPlace.category == category)
        if women_friendly is True:
            stmt = stmt.where(CuratedPlace.women_friendly.is_(True))

        stmt = (
            stmt.order_by(
                CuratedPlace.popularity_score.desc(),
                CuratedPlace.rating.desc().nulls_last(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, db: AsyncSession, place_id: int) -> CuratedPlace | None:
        stmt = select(CuratedPlace).where(CuratedPlace.id == place_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def find_similar(
        self,
        db: AsyncSession,
        *,
        query_vector: list[float],
        exclude_id: int | None = None,
        city: str | None = None,
        limit: int = 6,
    ) -> list[CuratedPlace]:
        """코사인 유사도 기반 유사 큐레이션 검색 (PostgreSQL pgvector 전용).

        SQLite 환경에서는 빈 리스트 반환.
        """
        try:
            dialect_name = db.get_bind().dialect.name  # type: ignore[union-attr]
        except Exception:
            dialect_name = "unknown"
        if dialect_name != "postgresql":
            return []

        vector_literal = f"[{','.join(str(v) for v in query_vector)}]"
        stmt = (
            select(CuratedPlace)
            .where(CuratedPlace.embedding.isnot(None))
            .where(CuratedPlace.is_published.is_(True))
        )
        if exclude_id is not None:
            stmt = stmt.where(CuratedPlace.id != exclude_id)
        if city is not None:
            stmt = stmt.where(CuratedPlace.city == city)
        stmt = stmt.order_by(text(f"embedding <=> '{vector_literal}'::vector")).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def upsert_by_source_id(
        self, db: AsyncSession, source_id: str, defaults: dict
    ) -> CuratedPlace:
        """source_id 기준 upsert. 시드 스크립트에서 사용."""
        stmt = select(CuratedPlace).where(CuratedPlace.source_id == source_id)
        existing = (await db.execute(stmt)).scalars().first()
        if existing:
            for key, value in defaults.items():
                setattr(existing, key, value)
            await db.flush()
            return existing
        obj = CuratedPlace(source_id=source_id, **defaults)
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return obj
