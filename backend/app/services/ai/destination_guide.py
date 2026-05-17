"""여행지 가이드 생성 (generate_destination_guide)."""

import json
import logging

from fastapi import HTTPException, status

from app.schemas.ai import DestinationGuide

from .gemini_client import call_gemini, get_client, parse_json_response
from .prompt_builder import DESTINATION_GUIDE_TEMPLATE, sanitize_user_input

logger = logging.getLogger(__name__)


async def generate_destination_guide(destination: str) -> DestinationGuide:
    """여행지 가이드를 AI로 생성. (통화·시간대·비자·교통·음식·꿀팁)

    24시간 TTL 캐시 권장 — 자주 변하지 않는 정보.
    """
    client = get_client()
    safe_destination = sanitize_user_input(destination, max_len=100)
    prompt = DESTINATION_GUIDE_TEMPLATE.format(destination=safe_destination)

    raw = await call_gemini(client, prompt)

    try:
        data = parse_json_response(raw)
        return DestinationGuide.model_validate(data)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse destination guide: %s | raw=%s", e, raw[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 가이드 응답 파싱에 실패했습니다.",
        )
