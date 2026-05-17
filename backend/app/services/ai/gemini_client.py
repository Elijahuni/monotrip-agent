"""Gemini API 클라이언트 — 모델 폴백·에러 분류·파싱·Redis 캐싱 담당."""

import asyncio
import json
import logging
import re

from fastapi import HTTPException, status
from google import genai
from google.genai import types

from app.config import get_settings
from app.services.ai.redis_cache import get_cached_response, set_cached_response

logger = logging.getLogger(__name__)

# ─── 모델 우선순위 목록 ────────────────────────────────────────────────────────
# 상위부터 순서대로 시도 → 404 시 다음 모델로 자동 전환.
CANDIDATE_MODELS: list[str] = [
    "gemini-2.5-flash",  # 최신 안정 (신규 계정 사용 가능 ✅ 실증)
    "gemini-2.5-flash-lite",  # 경량 2.5 (신규 계정 사용 가능 ✅ 실증)
    "gemini-2.5-pro",  # Pro — 위 둘 실패 시 최후 수단
]

_GEMINI_TIMEOUT = 50  # 초 (모바일 클라이언트 60s 타임아웃보다 여유 있게)


def get_client() -> genai.Client:
    """설정에서 Gemini 클라이언트 생성. API 키 미설정 시 503 발생."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini API 키가 설정되지 않았습니다.",
        )
    return genai.Client(api_key=settings.gemini_api_key)


def parse_json_response(raw: str) -> dict:
    """마크다운 코드블록(```json ... ```)을 제거하고 JSON 파싱."""
    cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
    return json.loads(cleaned)


async def call_gemini(client: genai.Client, prompt: str, *, use_cache: bool = True) -> str:
    """Gemini 호출 — CANDIDATE_MODELS 순서대로 시도, 첫 성공 모델의 텍스트 반환.

    use_cache=True(기본): 동일 프롬프트는 Redis에서 6시간 캐시 조회 후 반환.
    에러 분류:
    - 404 / NOT_FOUND  → 해당 계정에서 모델 미지원 → 다음 후보 모델로 재시도
    - 429 / RESOURCE_EXHAUSTED → 월간 billing 한도 초과 → 503 즉시 전파
    - Timeout          → 504 전파
    - 그 외            → 502 전파
    """
    if use_cache:
        cached = await get_cached_response(prompt)
        if cached is not None:
            return cached

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.7,
    )

    last_err: Exception | None = None
    for model in CANDIDATE_MODELS:
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                ),
                timeout=_GEMINI_TIMEOUT,
            )
            if model != CANDIDATE_MODELS[0]:
                logger.warning("Used fallback model %s (primary unavailable)", model)
            result = response.text
            if use_cache:
                await set_cached_response(prompt, result)
            return result

        except asyncio.TimeoutError:
            logger.error("Gemini timeout after %ss (model=%s)", _GEMINI_TIMEOUT, model)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=(
                    "AI 응답이 너무 오래 걸립니다. "
                    "목적지를 짧게 입력하거나 일수를 줄여 다시 시도해 주세요."
                ),
            )

        except Exception as e:
            err_str = str(e)
            # 404 / "not found" → 해당 모델 미지원
            if "404" in err_str or "NOT_FOUND" in err_str or "not found" in err_str.lower():
                logger.warning(
                    "Model %s not available, trying next. err=%s",
                    model,
                    err_str[:150],
                )
                last_err = e
                continue
            # 429 RESOURCE_EXHAUSTED → billing 한도 초과
            if (
                "429" in err_str
                or "RESOURCE_EXHAUSTED" in err_str
                or "spending cap" in err_str.lower()
            ):
                logger.error("Gemini billing cap exceeded (model=%s): %s", model, err_str[:300])
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "AI 서비스 월간 사용량 한도가 초과됐습니다. "
                        "Google AI Studio(https://ai.studio/spend)에서 "
                        "프로젝트 지출 한도를 확인하고 늘려주세요."
                    ),
                )
            # 그 외 오류(500 등) — 즉시 전파
            logger.error("Gemini API error (model=%s): %s", model, e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI 추천 서비스에 일시적인 오류가 발생했습니다.",
            )

    # 모든 후보 모델 실패
    logger.error(
        "All Gemini candidate models unavailable: %s. last_err=%s",
        CANDIDATE_MODELS,
        last_err,
    )
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="AI 서비스를 현재 사용할 수 없습니다. API 키의 모델 접근 권한을 확인해주세요.",
    )
