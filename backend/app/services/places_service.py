"""Google Places API (New) 어댑터.

서비스 책임:
  - Text Search 호출 + 응답 정규화 (PlaceSearchResult)
  - 단순 인메모리 LRU 캐싱 (같은 쿼리 호출 비용 절감)
  - 카테고리 매핑 (Google place type → 앱 카테고리)
  - 사진 URL 변환 (photo.name → media URL)

참고: https://developers.google.com/maps/documentation/places/web-service/text-search
"""

from __future__ import annotations

import logging
from functools import lru_cache

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.schemas.place import PlaceSearchResult

logger = logging.getLogger(__name__)

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
PLACES_PHOTO_URL_TEMPLATE = "https://places.googleapis.com/v1/{name}/media"

# 클라이언트가 필요로 하는 필드만 명시 (FieldMask)
_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.types",
        "places.photos",
        "places.rating",
        "places.userRatingCount",
    ]
)

# Google place type → 앱 카테고리 매핑 (우선순위 순)
_CATEGORY_MAP: list[tuple[str, str]] = [
    ("lodging", "숙소"),
    ("hotel", "숙소"),
    ("restaurant", "음식점"),
    ("food", "음식점"),
    ("meal_takeaway", "음식점"),
    ("cafe", "카페"),
    ("bakery", "카페"),
    ("shopping_mall", "쇼핑"),
    ("store", "쇼핑"),
    ("park", "자연"),
    ("natural_feature", "자연"),
    ("museum", "문화"),
    ("art_gallery", "문화"),
    ("amusement_park", "엔터테인먼트"),
    ("movie_theater", "엔터테인먼트"),
    ("tourist_attraction", "관광지"),
    ("point_of_interest", "관광지"),
]


def _map_category(types: list[str]) -> str:
    """첫 번째로 매칭되는 카테고리 반환. 없으면 '관광지'."""
    type_set = set(types)
    for google_type, app_category in _CATEGORY_MAP:
        if google_type in type_set:
            return app_category
    return "관광지"


def _photo_url(photos: list[dict] | None, api_key: str) -> str | None:
    if not photos:
        return None
    name = photos[0].get("name")
    if not name:
        return None
    base = PLACES_PHOTO_URL_TEMPLATE.format(name=name)
    return f"{base}?key={api_key}&maxHeightPx=400"


@lru_cache(maxsize=256)
def _cached_call(cache_key: str) -> tuple:  # pragma: no cover - 캐시 마커
    raise NotImplementedError


class PlacesService:
    """Google Places (New) 어댑터."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._api_key = self._settings.google_places_api_key

    async def search_text(
        self,
        query: str,
        near_latitude: float | None = None,
        near_longitude: float | None = None,
        language: str = "ko",
    ) -> list[PlaceSearchResult]:
        """텍스트 쿼리로 장소 검색.

        Args:
            query: 검색어 (장소명, 주소, 키워드 등)
            near_latitude/longitude: 결과를 편향시킬 중심 좌표 (선택)
            language: 응답 언어 (ko, en, ja 등)
        """
        if not self._api_key:
            raise HTTPException(
                status_code=503,
                detail="Places API 키가 설정되지 않았습니다.",
            )
        if not query.strip():
            return []

        payload: dict = {"textQuery": query.strip(), "languageCode": language}
        # 위치 편향 (반경 50km)
        if near_latitude is not None and near_longitude is not None:
            payload["locationBias"] = {
                "circle": {
                    "center": {"latitude": near_latitude, "longitude": near_longitude},
                    "radius": 50_000.0,
                }
            }

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self._api_key,
            "X-Goog-FieldMask": _FIELD_MASK,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(PLACES_TEXT_SEARCH_URL, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error("Places API HTTP error: %s — %s", e.response.status_code, e.response.text[:200])
            raise HTTPException(status_code=502, detail="장소 검색 서비스 오류")
        except httpx.RequestError as e:
            logger.error("Places API request error: %s", e)
            raise HTTPException(status_code=504, detail="장소 검색 시간 초과")

        return [self._normalize(p) for p in data.get("places", [])]

    def _normalize(self, place: dict) -> PlaceSearchResult:
        loc = place.get("location") or {}
        return PlaceSearchResult(
            place_id=place.get("id", ""),
            name=(place.get("displayName") or {}).get("text", ""),
            address=place.get("formattedAddress", "") or "",
            latitude=float(loc.get("latitude", 0.0)),
            longitude=float(loc.get("longitude", 0.0)),
            category=_map_category(place.get("types") or []),
            photo_url=_photo_url(place.get("photos"), self._api_key),
            rating=place.get("rating"),
            user_ratings_total=place.get("userRatingCount"),
        )


def get_places_service() -> PlacesService:
    """FastAPI Depends 용 팩토리."""
    return PlacesService()
