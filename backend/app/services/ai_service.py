import json
import logging
import re

from fastapi import HTTPException, status
from google import genai
from google.genai import types

from app.config import get_settings
from app.schemas.ai import AiTripPlan

logger = logging.getLogger(__name__)

_MODEL_NAME = "gemini-2.0-flash"

_PROMPT_TEMPLATE = """\
다음 조건에 맞는 여행 일정을 JSON 형식으로만 생성해줘. JSON 외의 다른 텍스트는 포함하지 마.

목적지: {destination}
여행 기간: {days}일
여행 스타일: {preferences}

반환할 JSON 스키마:
{{
  "title": "여행 제목 (예: 도쿄 3일 미식 여행)",
  "description": "여행 전반적인 소개 (2~3문장)",
  "locations": [
    {{
      "name": "장소명",
      "address": "전체 주소 (국가 포함)",
      "latitude": 위도(float),
      "longitude": 경도(float),
      "category": "관광지 | 음식점 | 숙소 | 쇼핑 | 액티비티",
      "visit_order": 방문순서(1부터 시작, 전체 일정 기준),
      "notes": "방문 팁 또는 추천 이유"
    }}
  ]
}}

조건:
- 하루에 4~5개 장소 포함 (총 {total_locations}개 내외)
- 실제 존재하는 장소의 정확한 위도/경도 제공
- category는 반드시 "관광지", "음식점", "숙소", "쇼핑", "액티비티" 중 하나
- 숙소는 하루에 1개, 음식점은 하루에 1~2개 포함
- visit_order는 전체 일정에서 방문 순서 (1, 2, 3, ...)
"""


def _get_client() -> genai.Client:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API 키가 설정되지 않았습니다.",
        )
    return genai.Client(api_key=settings.gemini_api_key)


def _parse_json(raw: str) -> dict:
    """마크다운 코드블록(```json ... ```)을 제거하고 JSON 파싱."""
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
    return json.loads(cleaned)


async def generate_trip_plan(
    destination: str,
    days: int,
    preferences: str | None = None,
) -> AiTripPlan:
    client = _get_client()
    prompt = _PROMPT_TEMPLATE.format(
        destination=destination,
        days=days,
        preferences=preferences or "자유 여행",
        total_locations=days * 4,
    )

    try:
        response = await client.aio.models.generate_content(
            model=_MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            ),
        )
        raw = response.text
    except Exception as e:
        logger.error("Gemini API error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 추천 서비스에 일시적인 오류가 발생했습니다.",
        )

    try:
        data = _parse_json(raw)
        return AiTripPlan.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse Gemini response: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 응답 파싱에 실패했습니다.",
        )
