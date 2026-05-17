"""AI 관련 Redis 캐시 유틸리티.

두 가지 용도:
1. Gemini 응답 캐시 — prompt hash → 응답 텍스트 (TTL 6h)
2. 사용자 최근 추천 캐시 — user_id → 최근 3회 목적지 이름 목록 (TTL 7일)

Redis 미설정(redis_url 빈 문자열)이면 모든 함수가 graceful no-op으로 동작.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_RESPONSE_TTL = 6 * 3600       # 6시간
_RECENT_REC_TTL = 7 * 24 * 3600  # 7일
_MAX_RECENT = 3                  # 최근 N회 추천 보관

try:
    import redis.asyncio as aioredis
    _REDIS_LIB = True
except ImportError:
    _REDIS_LIB = False


def _get_client() -> "aioredis.Redis | None":
    from app.config import get_settings
    settings = get_settings()
    if not settings.redis_url or not _REDIS_LIB:
        return None
    try:
        return aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception as exc:
        logger.warning("Redis 연결 실패: %s", exc)
        return None


def _prompt_key(prompt: str) -> str:
    h = hashlib.sha256(prompt.encode()).hexdigest()[:16]
    return f"ai:resp:{h}"


def _recent_key(user_id: int) -> str:
    return f"ai:recent:{user_id}"


# ─── Gemini 응답 캐시 ─────────────────────────────────────────────────────────

async def get_cached_response(prompt: str) -> str | None:
    """캐시된 Gemini 응답 반환. 없거나 오류 시 None."""
    client = _get_client()
    if client is None:
        return None
    try:
        key = _prompt_key(prompt)
        val = await client.get(key)
        if val:
            logger.debug("AI 캐시 히트: %s", key)
        return val
    except Exception as exc:
        logger.warning("AI 캐시 get 실패: %s", exc)
        return None
    finally:
        await client.aclose()


async def set_cached_response(prompt: str, response: str) -> None:
    """Gemini 응답을 6시간 캐시. 오류는 무시."""
    client = _get_client()
    if client is None:
        return
    try:
        key = _prompt_key(prompt)
        await client.setex(key, _RESPONSE_TTL, response)
    except Exception as exc:
        logger.warning("AI 캐시 set 실패: %s", exc)
    finally:
        await client.aclose()


# ─── 사용자 최근 추천 캐시 ───────────────────────────────────────────────────

async def get_recent_recommendations(user_id: int) -> list[str]:
    """사용자의 최근 추천 목적지 이름 목록 (최대 3개). 없으면 빈 리스트."""
    client = _get_client()
    if client is None:
        return []
    try:
        key = _recent_key(user_id)
        val = await client.get(key)
        if val:
            return json.loads(val)
        return []
    except Exception as exc:
        logger.warning("recent_recs get 실패 (user=%s): %s", user_id, exc)
        return []
    finally:
        await client.aclose()


async def push_recent_recommendation(user_id: int, destination: str, location_names: list[str]) -> None:
    """새 추천 결과를 최근 목록에 추가 (LIFO, 최대 3개 유지)."""
    client = _get_client()
    if client is None:
        return
    try:
        key = _recent_key(user_id)
        val = await client.get(key)
        recent: list[dict[str, Any]] = json.loads(val) if val else []
        # 새 항목을 앞에 삽입하고 최대 N개로 자름
        recent.insert(0, {"destination": destination, "names": location_names[:20]})
        recent = recent[:_MAX_RECENT]
        await client.setex(key, _RECENT_REC_TTL, json.dumps(recent, ensure_ascii=False))
    except Exception as exc:
        logger.warning("recent_recs push 실패 (user=%s): %s", user_id, exc)
    finally:
        await client.aclose()
