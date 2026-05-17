"""Phase 1-2 공용 유틸리티 라우트 (환율 등). 인증 필요."""

from __future__ import annotations

import logging
import time
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.dependencies.auth import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/utils", tags=["utils"])
logger = logging.getLogger(__name__)

# ── 환율 ─────────────────────────────────────────────────────────────────────

_EXCHANGE_CACHE_TTL = 3600  # 1시간
_EXCHANGE_API = "https://open.er-api.com/v6/latest/{base}"  # 무료, 키 불필요

# 단순 인메모리 캐시 {base: (timestamp, {target: rate})}.
# 워커당 분리되지만 Railway 단일 워커 환경에 충분.
# Redis 통합은 Phase 2 메타서치와 함께.
_rate_cache: dict[str, tuple[float, dict[str, float]]] = {}


class ExchangeRateResponse(BaseModel):
    base: str
    target: str
    rate: float  # 1 base = rate * target
    fetched_at: float  # epoch seconds — 클라이언트가 신선도 판단
    cached: bool  # 캐시 적중 여부 (디버그용)


@router.get("/exchange-rate", response_model=ApiResponse[ExchangeRateResponse])
@limiter.limit("60/minute")
async def get_exchange_rate(
    request: Request,
    base: Annotated[str, Query(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")] = "KRW",
    target: Annotated[str, Query(min_length=3, max_length=3, pattern=r"^[A-Z]{3}$")] = "JPY",
    _user: User = Depends(get_current_user),
) -> ApiResponse[ExchangeRateResponse]:
    """환율 조회 (1시간 인메모리 캐시).

    예) base=KRW&target=JPY → 1 KRW = rate JPY
    """
    base_u = base.upper()
    target_u = target.upper()
    now = time.time()

    cached_entry = _rate_cache.get(base_u)
    if cached_entry and now - cached_entry[0] < _EXCHANGE_CACHE_TTL:
        rates = cached_entry[1]
        if target_u not in rates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="지원하지 않는 통화입니다."
            )
        return ApiResponse(
            data=ExchangeRateResponse(
                base=base_u,
                target=target_u,
                rate=rates[target_u],
                fetched_at=cached_entry[0],
                cached=True,
            )
        )

    # 캐시 미스 → 외부 API 호출
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_EXCHANGE_API.format(base=base_u))
            resp.raise_for_status()
            payload = resp.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.warning("Exchange rate fetch failed: %s", e)
        # 스테일 캐시라도 있으면 폴백
        if cached_entry:
            rates = cached_entry[1]
            if target_u in rates:
                return ApiResponse(
                    data=ExchangeRateResponse(
                        base=base_u,
                        target=target_u,
                        rate=rates[target_u],
                        fetched_at=cached_entry[0],
                        cached=True,
                    ),
                    message="stale cache (외부 환율 API 오류)",
                )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="환율 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.",
        )

    if payload.get("result") != "success":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="환율 API 응답 형식 오류",
        )

    rates: dict[str, float] = payload.get("rates", {})
    _rate_cache[base_u] = (now, rates)

    if target_u not in rates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="지원하지 않는 통화입니다."
        )

    return ApiResponse(
        data=ExchangeRateResponse(
            base=base_u,
            target=target_u,
            rate=rates[target_u],
            fetched_at=now,
            cached=False,
        )
    )
