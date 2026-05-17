"""CuratedPlace 요청/응답 스키마."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# 운영 가능한 카테고리 화이트리스트 (라우터 Query 검증에 사용)
CuratedCategory = Literal[
    "cafe", "dessert", "photospot", "shopping",
    "restaurant", "bar", "culture", "nature", "hotel",
]

# 운영 가능한 vibe 태그 화이트리스트
VIBE_TAGS: tuple[str, ...] = (
    "빈티지", "모던", "레트로", "한적", "감성", "인스타",
    "야경", "분위기", "조용", "활기", "고급", "가성비",
)


class CuratedPlaceResponse(BaseModel):
    """큐레이션 목록·상세 응답."""
    id: int
    country: str
    city: str
    region: str | None = None
    name: str
    name_en: str | None = None
    address: str
    latitude: float
    longitude: float
    category: str
    vibe_tags: list[str] = Field(default_factory=list)
    description: str | None = None
    cover_image: str | None = None
    images: list[str] | None = None
    instagram_hashtag: str | None = None
    website: str | None = None
    opening_hours: str | None = None
    rating: float | None = None
    review_count: int = 0
    price_level: int | None = None
    women_friendly: bool = False
    safety_score: int | None = None
    tax_free: bool = False

    model_config = {"from_attributes": True}


class CuratedPlaceListQuery(BaseModel):
    """문서화 용도 — 실제 검증은 라우터 Query()에서."""
    city: str
    category: CuratedCategory | None = None
    vibes: list[str] | None = None
    women_friendly: bool | None = None
    limit: int = 30
    offset: int = 0
