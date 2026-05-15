"""Google Places API 어댑터.

전략:
  1차 시도: Places API (New) — 더 정확한 데이터, FieldMask 지원
  2차 폴백: Places Text Search (레거시) — API 키 제한이 있을 때 자동 사용

사용자가 Google Cloud Console에서 API 키 제한에
"Places API (New)"를 추가하면 1차가 성공합니다.
그 전까지는 레거시 API로 자동 동작합니다.
"""

from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.schemas.place import PlaceSearchResult

logger = logging.getLogger(__name__)

# ── Places API (New) ──────────────────────────────────────────────────────────
_NEW_TEXT_SEARCH_URL   = "https://places.googleapis.com/v1/places:searchText"
_NEW_PHOTO_URL         = "https://places.googleapis.com/v1/{name}/media"
_NEW_FIELD_MASK        = ",".join([
    "places.id", "places.displayName", "places.formattedAddress",
    "places.location", "places.types", "places.photos",
    "places.rating", "places.userRatingCount",
])

# ── Places Text Search (레거시) ───────────────────────────────────────────────
_LEGACY_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_LEGACY_PHOTO_URL       = "https://maps.googleapis.com/maps/api/place/photo"

# Google place type → 앱 카테고리 매핑
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
    ("amusement_park", "액티비티"),
    ("movie_theater", "액티비티"),
    ("tourist_attraction", "관광지"),
    ("point_of_interest", "관광지"),
    ("establishment", "관광지"),
]


def _map_category(types: list[str]) -> str:
    type_set = set(types)
    for google_type, app_category in _CATEGORY_MAP:
        if google_type in type_set:
            return app_category
    return "관광지"


class PlacesService:
    def __init__(self) -> None:
        self._settings = get_settings()

    @property
    def _api_key(self) -> str:
        return self._settings.google_places_api_key

    # ── 공개 메서드 ─────────────────────────────────────────────────────────────

    async def search_text(
        self,
        query: str,
        near_latitude: float | None = None,
        near_longitude: float | None = None,
        language: str = "ko",
    ) -> list[PlaceSearchResult]:
        if not self._api_key:
            raise HTTPException(status_code=503, detail="Places API 키가 설정되지 않았습니다.")
        if not query.strip():
            return []

        # 1차: Places API (New)
        try:
            return await self._search_new(query.strip(), near_latitude, near_longitude, language)
        except _PlacesKeyRestricted:
            logger.warning(
                "Places API (New) 키 제한 감지 → 레거시 API로 폴백. "
                "Google Cloud Console에서 API 키에 'Places API (New)' 추가 권장."
            )
            # 2차: 레거시 API
            return await self._search_legacy(query.strip(), near_latitude, near_longitude, language)

    # ── Places API (New) ────────────────────────────────────────────────────────

    async def _search_new(
        self,
        query: str,
        near_latitude: float | None,
        near_longitude: float | None,
        language: str,
    ) -> list[PlaceSearchResult]:
        payload: dict = {"textQuery": query, "languageCode": language}
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
            "X-Goog-FieldMask": _NEW_FIELD_MASK,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(_NEW_TEXT_SEARCH_URL, json=payload, headers=headers)
        except httpx.RequestError as e:
            raise HTTPException(status_code=504, detail="장소 검색 시간 초과") from e

        if resp.status_code == 403:
            # API 키 제한 또는 API 미활성화 → 폴백 트리거
            raise _PlacesKeyRestricted(resp.text[:200])

        if not resp.is_success:
            logger.error("Places API (New) error: %s — %s", resp.status_code, resp.text[:300])
            raise HTTPException(status_code=502, detail="장소 검색 서비스 오류")

        data = resp.json()
        return [self._normalize_new(p) for p in data.get("places", [])[:10]]

    def _normalize_new(self, place: dict) -> PlaceSearchResult:
        loc = place.get("location") or {}
        photos = place.get("photos")
        photo_url: str | None = None
        if photos:
            name = photos[0].get("name")
            if name:
                photo_url = f"{_NEW_PHOTO_URL.format(name=name)}?key={self._api_key}&maxHeightPx=400&skipHttpRedirect=false"
        return PlaceSearchResult(
            place_id=place.get("id", ""),
            name=(place.get("displayName") or {}).get("text", ""),
            address=place.get("formattedAddress", "") or "",
            latitude=float(loc.get("latitude", 0.0)),
            longitude=float(loc.get("longitude", 0.0)),
            category=_map_category(place.get("types") or []),
            photo_url=photo_url,
            rating=place.get("rating"),
            user_ratings_total=place.get("userRatingCount"),
        )

    # ── 레거시 Places Text Search ────────────────────────────────────────────────

    async def _search_legacy(
        self,
        query: str,
        near_latitude: float | None,
        near_longitude: float | None,
        language: str,
    ) -> list[PlaceSearchResult]:
        params: dict[str, str] = {
            "query": query,
            "key": self._api_key,
            "language": language,
        }
        if near_latitude is not None and near_longitude is not None:
            params["location"] = f"{near_latitude},{near_longitude}"
            params["radius"] = "50000"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(_LEGACY_TEXT_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error("Legacy Places API error: %s — %s", e.response.status_code, e.response.text[:300])
            raise HTTPException(status_code=502, detail="장소 검색 서비스 오류") from e
        except httpx.RequestError as e:
            raise HTTPException(status_code=504, detail="장소 검색 시간 초과") from e

        api_status = data.get("status", "")
        if api_status not in ("OK", "ZERO_RESULTS"):
            logger.error("Legacy Places API status: %s | %s", api_status, data.get("error_message", ""))
            raise HTTPException(status_code=502, detail=f"장소 검색 오류: {api_status}")

        return [self._normalize_legacy(p) for p in data.get("results", [])[:10]]

    def _normalize_legacy(self, place: dict) -> PlaceSearchResult:
        loc = place.get("geometry", {}).get("location", {})
        photos = place.get("photos")
        photo_url: str | None = None
        if photos:
            ref = photos[0].get("photo_reference")
            if ref:
                photo_url = f"{_LEGACY_PHOTO_URL}?photo_reference={ref}&key={self._api_key}&maxwidth=400"
        return PlaceSearchResult(
            place_id=place.get("place_id", ""),
            name=place.get("name", ""),
            address=place.get("formatted_address", "") or "",
            latitude=float(loc.get("lat", 0.0)),
            longitude=float(loc.get("lng", 0.0)),
            category=_map_category(place.get("types") or []),
            photo_url=photo_url,
            rating=place.get("rating"),
            user_ratings_total=place.get("user_ratings_total"),
        )


# ── 내부 예외 (폴백 신호) ──────────────────────────────────────────────────────

class _PlacesKeyRestricted(Exception):
    """API 키 제한으로 Places API (New) 호출이 막혔을 때 레거시 폴백 트리거."""


def get_places_service() -> PlacesService:
    return PlacesService()
