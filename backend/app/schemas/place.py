"""장소 검색 응답 스키마."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PlaceSearchResult(BaseModel):
    """Google Places (New) Text Search 결과 1건을 클라이언트 친화 포맷으로 정규화."""

    place_id: str = Field(..., description="Google Place ID (e.g. ChIJ...)")
    name: str = Field(..., description="장소 표시 이름")
    address: str = Field("", description="포맷된 주소")
    latitude: float
    longitude: float
    category: str = Field("관광지", description="앱 카테고리 (숙소/음식점/관광지 등)")
    photo_url: str | None = Field(None, description="대표 사진 URL (있으면)")
    rating: float | None = Field(None, ge=0, le=5)
    user_ratings_total: int | None = Field(None, ge=0)


class PlaceSearchResponse(BaseModel):
    results: list[PlaceSearchResult]
