"""Google Search Grounding 기반 실시간 트렌딩 장소 조회."""

import asyncio
import logging
from datetime import datetime, timezone

from google import genai
from google.genai import types

from .gemini_client import CANDIDATE_MODELS

logger = logging.getLogger(__name__)


async def fetch_trending_spots(
    client: genai.Client,
    destination: str,
    style_context: str,
) -> str | None:
    """Google Search Grounding으로 목적지의 최신 인기 장소를 조회.

    - 10초 타임아웃 내 실패 시 None 반환 (메인 호출에 영향 없음)
    - 반환값: "장소명1, 장소명2, ..." 형태의 짧은 텍스트, 없으면 None
    """
    style_hint = f"({style_context} 위주)" if style_context != "자유 여행" else ""
    now = datetime.now(timezone.utc)
    prompt = (
        f"{destination}에서 {now.year}년 {now.month}월 기준 "
        f"SNS·구글 리뷰에서 인기 있는 장소{style_hint} 최대 6곳 이름만 쉼표로 나열해줘. "
        "설명 없이 이름만."
    )
    try:
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.2,
        )
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=CANDIDATE_MODELS[0],
                contents=prompt,
                config=config,
            ),
            timeout=10,
        )
        text = (response.text or "").strip()
        if text:
            logger.info("Trending spots fetched for %s: %s", destination, text[:100])
        return text or None
    except Exception as exc:
        logger.debug("Trending fetch skipped (non-critical): %s", str(exc)[:120])
        return None
