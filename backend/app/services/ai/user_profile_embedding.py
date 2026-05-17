"""사용자 행동 기반 선호 임베딩 서비스.

사용자가 장소를 추가/저장할 때 해당 장소의 임베딩을 누적 평균으로 합산.
누적 평균(running average) 방식:
  new_embedding = (old_embedding * n + new_vec) / (n + 1)

단순하지만 효과적 — 새 행동일수록 가중치가 자연스럽게 희석되므로
별도 decay 계수 없이도 시간 순 영향을 어느 정도 반영함.

비동기 갱신은 background_task로 호출 — 실패해도 사용자 응답에 영향 없음.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.ai.embedding_service import embed_place

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_EMBEDDING_DIM = 768


async def update_user_preference(
    user_id: int,
    place_name: str,
    place_category: str,
    place_address: str,
    place_notes: str | None = None,
) -> None:
    """사용자 선호 임베딩을 장소 정보로 갱신.

    새 세션을 생성해 독립적으로 커밋 — 호출 측 트랜잭션과 분리.
    실패해도 예외를 전파하지 않음 (비필수 백그라운드 작업).
    """
    try:
        new_vec = await embed_place(
            name=place_name,
            category=place_category,
            address=place_address,
            notes=place_notes,
        )
        if new_vec is None:
            return

        async with AsyncSessionLocal() as db:
            await _merge_embedding(db, user_id, new_vec)
    except Exception as exc:
        logger.warning("preference_embedding 갱신 실패 (user_id=%s): %s", user_id, exc)


async def _merge_embedding(db: AsyncSession, user_id: int, new_vec: list[float]) -> None:
    """DB에서 현재 임베딩을 읽어 running average로 갱신."""
    user = await db.get(User, user_id)
    if user is None:
        return

    current = user.preference_embedding
    if current is None or len(current) != _EMBEDDING_DIM:
        # 첫 번째 임베딩 — 그대로 저장
        user.preference_embedding = new_vec
    else:
        # 누적 평균 (running average, weight=0.3 for recency bias)
        # 완전 평균보다 최근 행동에 약간 더 무게를 둠
        alpha = 0.3
        merged = [
            alpha * nv + (1 - alpha) * cv
            for nv, cv in zip(new_vec, current)
        ]
        user.preference_embedding = merged

    await db.commit()
    logger.debug("preference_embedding 갱신 완료 (user_id=%s)", user_id)
