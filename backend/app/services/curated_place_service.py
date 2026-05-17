"""CuratedPlaceService — 큐레이션 장소 조회 + vibe 가중 랭킹 + 개인화."""

import logging
import math
import unicodedata

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.curated_place import CuratedPlace
from app.repositories.curated_place_repository import CuratedPlaceRepository
from app.repositories.trip_repository import TripRepository
from app.schemas.curated_place import CuratedPlaceResponse, VIBE_TAGS
from app.schemas.trip import LocationCreate, LocationResponse

logger = logging.getLogger(__name__)

# city 별칭 정규화 (사용자가 한글로 입력해도 매핑)
CITY_ALIASES: dict[str, str] = {
    # Japan
    "도쿄": "tokyo",
    "동경": "tokyo",
    "tokyo": "tokyo",
    "오사카": "osaka",
    "osaka": "osaka",
    "교토": "kyoto",
    "kyoto": "kyoto",
    "후쿠오카": "fukuoka",
    "fukuoka": "fukuoka",
    "삿포로": "sapporo",
    "sapporo": "sapporo",
    "오키나와": "okinawa",
    "okinawa": "okinawa",
    "나고야": "nagoya",
    "nagoya": "nagoya",
    "요코하마": "yokohama",
    "yokohama": "yokohama",
    "고베": "kobe",
    "kobe": "kobe",
    "히로시마": "hiroshima",
    "hiroshima": "hiroshima",
    # Korea
    "서울": "seoul",
    "seoul": "seoul",
    "부산": "busan",
    "busan": "busan",
    "제주": "jeju",
    "제주도": "jeju",
    "jeju": "jeju",
    "강릉": "gangneung",
    "gangneung": "gangneung",
    "경주": "gyeongju",
    "gyeongju": "gyeongju",
    "여수": "yeosu",
    "yeosu": "yeosu",
    "전주": "jeonju",
    "jeonju": "jeonju",
    # Southeast Asia
    "방콕": "bangkok",
    "bangkok": "bangkok",
    "발리": "bali",
    "bali": "bali",
    "싱가포르": "singapore",
    "singapore": "singapore",
    "하노이": "hanoi",
    "hanoi": "hanoi",
    "호치민": "hochiminh",
    "호찌민": "hochiminh",
    "hochiminh": "hochiminh",
    "쿠알라룸푸르": "kuala_lumpur",
    "kl": "kuala_lumpur",
    "kuala_lumpur": "kuala_lumpur",
    # Europe
    "파리": "paris",
    "paris": "paris",
    "런던": "london",
    "london": "london",
    "암스테르담": "amsterdam",
    "amsterdam": "amsterdam",
    "바르셀로나": "barcelona",
    "barcelona": "barcelona",
    "로마": "rome",
    "rome": "rome",
    "프라하": "prague",
    "prague": "prague",
}


def normalize_city(city: str) -> str:
    """사용자 입력을 내부 city 키로 정규화. 매핑 없으면 lowercase trim."""
    key = unicodedata.normalize("NFKC", city).strip().lower()
    return CITY_ALIASES.get(key, key)


class CuratedPlaceService:
    def __init__(self) -> None:
        self.repo = CuratedPlaceRepository()
        self.trip_repo = TripRepository()

    async def list_curated(
        self,
        db: AsyncSession,
        city: str,
        *,
        category: str | None = None,
        vibes: list[str] | None = None,
        women_friendly: bool | None = None,
        user_embedding: list[float] | None = None,
        limit: int = 30,
        offset: int = 0,
    ) -> list[CuratedPlaceResponse]:
        """필터에 맞는 큐레이션 장소 목록.

        vibes가 주어지면, DB는 city/category로 좁히고
        vibe 매칭 개수(자카드 유사도 변형)로 in-memory 재정렬한다.
        user_embedding이 있으면 코사인 유사도로 추가 개인화 가중치를 적용한다.
        """
        normalized_city = normalize_city(city)

        # vibes 화이트리스트 필터 — 모르는 태그는 조용히 제거
        clean_vibes: list[str] = []
        if vibes:
            valid = set(VIBE_TAGS)
            clean_vibes = [v for v in vibes if v in valid]
            if len(clean_vibes) != len(vibes):
                logger.info(
                    "Dropped unknown vibe tags: %s",
                    [v for v in vibes if v not in valid],
                )

        # 개인화 또는 vibes 재정렬이 있을 때 더 넓게 가져와서 재정렬 — limit*3 (최대 120)
        needs_rerank = bool(clean_vibes or user_embedding)
        fetch_limit = min(limit * 3, 120) if needs_rerank else limit

        rows = await self.repo.list_by_city(
            db,
            normalized_city,
            category=category,
            women_friendly=women_friendly,
            limit=fetch_limit,
            offset=offset,
        )

        if clean_vibes:
            rows = self._rerank_by_vibes(rows, clean_vibes)

        if user_embedding:
            rows = self._rerank_by_user_embedding(rows, user_embedding)

        return [CuratedPlaceResponse.model_validate(r) for r in rows[:limit]]

    async def find_similar(
        self,
        db: AsyncSession,
        *,
        place_id: int,
        same_city_only: bool = True,
        limit: int = 6,
    ) -> list[CuratedPlaceResponse]:
        """주어진 큐레이션 장소와 의미적으로 유사한 장소들. 임베딩 필요."""
        base = await self.repo.get_by_id(db, place_id)
        if base is None or not base.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="장소를 찾을 수 없습니다."
            )
        # pgvector는 numpy array를 반환할 수 있어 직접 truthy 평가 금지
        if base.embedding is None or len(base.embedding) == 0:
            return []
        # numpy array → list[float] 변환 (DB 리터럴 직렬화 호환)
        query_vec = list(base.embedding) if not isinstance(base.embedding, list) else base.embedding
        rows = await self.repo.find_similar(
            db,
            query_vector=query_vec,
            exclude_id=base.id,
            city=base.city if same_city_only else None,
            limit=limit,
        )
        return [CuratedPlaceResponse.model_validate(r) for r in rows]

    async def get_detail(self, db: AsyncSession, place_id: int) -> CuratedPlaceResponse:
        obj = await self.repo.get_by_id(db, place_id)
        if obj is None or not obj.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="장소를 찾을 수 없습니다."
            )
        return CuratedPlaceResponse.model_validate(obj)

    async def add_to_trip(
        self,
        db: AsyncSession,
        *,
        place_id: int,
        trip_id: int,
        user_id: int,
        day_index: int = 1,
        visit_order: int = 0,
    ) -> LocationResponse:
        """큐레이션 장소를 사용자 여행 일정의 Location으로 복제."""
        place = await self.repo.get_by_id(db, place_id)
        if place is None or not place.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="장소를 찾을 수 없습니다."
            )

        trip = await self.trip_repo.get_by_id(db, trip_id)
        if trip is None or trip.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다."
            )

        # 카테고리 매핑: 큐레이션 카테고리 → Location 카테고리 한글
        category_label = {
            "cafe": "카페",
            "dessert": "카페",
            "restaurant": "음식점",
            "bar": "음식점",
            "shopping": "쇼핑",
            "photospot": "관광지",
            "culture": "문화",
            "nature": "자연",
            "hotel": "숙소",
        }.get(place.category, "관광지")

        loc_data = LocationCreate(
            name=place.name,
            address=place.address,
            latitude=place.latitude,
            longitude=place.longitude,
            category=category_label,
            visit_order=visit_order,
            day_index=day_index,
            notes=place.description,
            website=place.website,
            rating=place.rating,
            images=[place.cover_image] if place.cover_image else None,
        )
        loc = await self.trip_repo.create_location(db, trip_id, loc_data)
        return LocationResponse.model_validate(loc)

    @staticmethod
    def _rerank_by_vibes(rows: list[CuratedPlace], vibes: list[str]) -> list[CuratedPlace]:
        """매칭 vibe 개수 + popularity로 재정렬.

        score = match_count * 10 + popularity_score + (rating or 0)
        매칭이 0개여도 결과에서 배제하지는 않음 (탐색 다양성).
        """
        vibe_set = set(vibes)

        def score(p: CuratedPlace) -> float:
            tags = set(p.vibe_tags or [])
            match = len(tags & vibe_set)
            return match * 10.0 + (p.popularity_score or 0.0) + (p.rating or 0.0)

        return sorted(rows, key=score, reverse=True)

    @staticmethod
    def _rerank_by_user_embedding(
        rows: list[CuratedPlace], user_vec: list[float]
    ) -> list[CuratedPlace]:
        """사용자 선호 임베딩과의 코사인 유사도로 재정렬.

        임베딩이 없는 장소는 유사도 0으로 처리 (목록 뒤로 밀림).
        popularity/rating도 유지하기 위해 혼합 점수 사용:
          final_score = 0.6 * cosine_sim + 0.4 * normalized_popularity
        """
        # 사용자 벡터 norm 계산
        user_norm = math.sqrt(sum(v * v for v in user_vec))
        if user_norm == 0:
            return rows

        max_pop = max((p.popularity_score or 0.0) for p in rows) or 1.0

        def mixed_score(p: CuratedPlace) -> float:
            emb = p.embedding
            if emb is None or len(emb) == 0:
                cosine = 0.0
            else:
                place_vec = list(emb) if not isinstance(emb, list) else emb
                dot = sum(u * v for u, v in zip(user_vec, place_vec))
                place_norm = math.sqrt(sum(v * v for v in place_vec))
                cosine = dot / (user_norm * place_norm) if place_norm > 0 else 0.0
            norm_pop = (p.popularity_score or 0.0) / max_pop
            return 0.6 * cosine + 0.4 * norm_pop

        return sorted(rows, key=mixed_score, reverse=True)
