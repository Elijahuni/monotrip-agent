"""날씨 조건 기반 세계 여행지 추천 (generate_by_weather_plan)."""

import json
import logging
import re

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, field_validator

from .gemini_client import call_gemini, get_client, parse_json_response
from .prompt_builder import BY_WEATHER_TEMPLATE, get_current_date_str

logger = logging.getLogger(__name__)

# 날씨 조건 키 → 한국어/영어 레이블 매핑 (routes/ai.py에서 import)
WEATHER_CONDITION_LABELS: dict[str, str] = {
    "sunny_warm": "맑고 따뜻한 날씨 (20~28°C, 봄/가을)",
    "spring": "벚꽃 피는 봄날씨 (15~20°C, 꽃구경)",
    "snow": "눈 덮인 설경 (0°C 이하, 겨울 설원)",
    "cool": "선선한 날씨 (10~18°C, 단풍/가을 하이킹)",
    "hot_summer": "뜨거운 열대 여름 (30°C 이상, 해변/풀장)",
}

# 문자열 필드 최대 길이
_MAX_CITY = 80
_MAX_COUNTRY = 80
_MAX_REASON = 500
_MAX_WEATHER = 200
_MAX_LOCATION = 100
_MAX_SPOTS = 5  # sample_locations 최대 개수
_MIN_DEST = 1
_MAX_DEST = 5  # destinations 최대 개수 (프롬프트는 3개 요청)

# HTML 태그 / 잠재적 인젝션 패턴
_HTML_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"(?i)(javascript|<script|onerror|onload)\s*[:=(]")


def _clean(text: str, max_len: int) -> str:
    """HTML 태그·스크립트 패턴 제거 후 길이 제한."""
    text = _HTML_RE.sub("", text)
    text = _SCRIPT_RE.sub("", text)
    return text.strip()[:max_len]


# ─── Pydantic 검증 모델 ───────────────────────────────────────────────────────


class _DestinationItem(BaseModel):
    """AI가 반환한 여행지 한 항목. 필드 검증 + 정제 담당."""

    city: str = Field(min_length=1, max_length=_MAX_CITY)
    country: str = Field(min_length=1, max_length=_MAX_COUNTRY)
    reason: str = Field(min_length=1, max_length=_MAX_REASON)
    weather_desc: str = Field(min_length=1, max_length=_MAX_WEATHER)
    sample_locations: list[str] = Field(default_factory=list)

    @field_validator("city", "country", "reason", "weather_desc", mode="before")
    @classmethod
    def sanitize_str(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("문자열이어야 합니다")
        return _clean(v, _MAX_REASON)  # 상한은 Field에서 재적용

    @field_validator("sample_locations", mode="before")
    @classmethod
    def sanitize_locations(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        cleaned: list[str] = []
        for item in v[:_MAX_SPOTS]:
            if isinstance(item, str):
                s = _clean(item, _MAX_LOCATION)
                if s:
                    cleaned.append(s)
        return cleaned


class _WeatherPlanResponse(BaseModel):
    destinations: list[_DestinationItem] = Field(
        min_length=_MIN_DEST,
        max_length=_MAX_DEST,
    )


# ─── 서비스 함수 ──────────────────────────────────────────────────────────────


async def generate_by_weather_plan(weather_condition: str) -> dict:
    """날씨 조건으로 최적의 세계 여행지 3곳 추천.

    weather_condition: "sunny_warm" | "spring" | "snow" | "cool" | "hot_summer"
    반환: { "destinations": [...] } 형태의 검증·정제된 dict
    """
    condition_label = WEATHER_CONDITION_LABELS.get(
        weather_condition,
        weather_condition,
    )
    current_date = get_current_date_str()
    client = get_client()
    prompt = BY_WEATHER_TEMPLATE.format(
        condition_label=condition_label,
        current_date=current_date,
    )

    raw = await call_gemini(client, prompt)

    # ── 1단계: JSON 파싱 ──────────────────────────────────────────────────────
    try:
        raw_data = parse_json_response(raw)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("by-weather JSON 파싱 실패: %s | raw=%s", e, raw[:300])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="날씨 기반 여행지 추천 응답 파싱에 실패했습니다.",
        )

    # ── 2단계: Pydantic 스키마 검증 + 필드 정제 ──────────────────────────────
    try:
        validated = _WeatherPlanResponse.model_validate(raw_data)
    except Exception as e:
        logger.error(
            "by-weather 스키마 검증 실패: %s | raw_data=%s",
            e,
            str(raw_data)[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 응답이 예상 형식과 다릅니다. 잠시 후 다시 시도해주세요.",
        )

    # ── 3단계: 정제된 dict 반환 (model_dump → JSON 직렬화 안전) ──────────────
    return validated.model_dump()
