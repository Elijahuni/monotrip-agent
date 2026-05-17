"""CuratedPlace — 운영자가 큐레이션한 감성 장소 카탈로그.

사용자별 SavedPlace(찜)와 분리. city/category/vibe_tags 필터 + 임베딩 유사도 검색용.
2030 여성 타겟 메타데이터(women_friendly, tax_free, safety_score, instagram_hashtag) 포함.
"""

from datetime import datetime

from sqlalchemy import Boolean, Float, Index, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._vector_type import CompatibleVector


class CuratedPlace(Base):
    __tablename__ = "curated_places"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 외부 데이터 소스 식별자 (Google Place ID / 운영자 슬러그). 중복 적재 방지.
    source_id: Mapped[str | None] = mapped_column(String(200), unique=True, nullable=True)

    # ── 지역 ──
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="JP")  # ISO: KR / JP
    city: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 정규화 키: tokyo, osaka, seoul, jeju
    region: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )  # 자유 라벨: 시부야, 강남, 한적한 골목

    # ── 기본 정보 ──
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # ── 분류 ──
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    # cafe | dessert | photospot | shopping | restaurant | bar | culture | nature | hotel
    vibe_tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    # 빈티지 | 모던 | 레트로 | 한적 | 감성 | 인스타 | 야경 | 분위기 등

    # ── 콘텐츠 ──
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    images: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    instagram_hashtag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── 메트릭 ──
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int] = mapped_column(default=0, nullable=False)
    price_level: Mapped[int | None] = mapped_column(nullable=True)  # 1~4 ($, $$, $$$, $$$$)
    popularity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # ── 2030 여성 타겟 메타데이터 ──
    women_friendly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    safety_score: Mapped[int | None] = mapped_column(nullable=True)  # 1~5
    tax_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    solo_female_review_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # ── 운영 ──
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), onupdate=func.now(), nullable=False
    )

    # ── 임베딩 ──
    # 768차원, name + description + vibe_tags 합쳐서 생성. NULL이면 큐레이션만, 의미 검색 제외.
    embedding: Mapped[list[float] | None] = mapped_column(CompatibleVector(768), nullable=True)

    __table_args__ = (
        Index("ix_curated_places_city_category", "city", "category"),
        Index("ix_curated_places_country_city", "country", "city"),
    )
