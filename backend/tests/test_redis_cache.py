"""Redis 캐시 graceful 폴백 테스트.

redis_url 미설정(테스트 환경 기본값)에서는 모든 캐시 함수가 no-op으로 동작하며
예외를 던지지 않아야 한다 — Redis 없이도 앱이 정상 동작하는 것이 핵심 계약.
"""

import pytest

from app.services.ai import redis_cache


@pytest.mark.asyncio
async def test_get_returns_none_without_redis():
    assert await redis_cache.get_cached_response("아무 프롬프트") is None


@pytest.mark.asyncio
async def test_set_is_noop_without_redis():
    # 예외 없이 통과해야 함
    await redis_cache.set_cached_response("프롬프트", "응답")


@pytest.mark.asyncio
async def test_recent_recommendations_empty_without_redis():
    assert await redis_cache.get_recent_recommendations(1) == []


@pytest.mark.asyncio
async def test_push_recent_is_noop_without_redis():
    await redis_cache.push_recent_recommendation(1, "도쿄", ["센소지", "시부야"])


@pytest.mark.asyncio
async def test_aclose_is_noop_without_redis():
    # 연결이 없으므로 안전하게 통과
    await redis_cache.aclose_cache_client()


def test_get_client_none_without_redis_url():
    assert redis_cache._get_client() is None
