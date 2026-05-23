"""게이미피케이션 테스트
- 순수 함수: get_level_info(레벨 경계), get_xp_progress(진행률)
- 통합: GET /auth/me/gamification (XP/레벨/배지 산출)
"""

import pytest
from httpx import AsyncClient

from app.services.gamification_service import (
    BADGE_CATALOG,
    LEVELS,
    get_level_info,
    get_xp_progress,
)
from tests.conftest import register_and_login


# ─── 순수 함수: 레벨 경계 ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "xp, expected_level",
    [
        (0, 1),
        (99, 1),
        (100, 2),
        (299, 2),
        (300, 3),
        (699, 3),
        (700, 4),
        (1499, 4),
        (1500, 5),
        (99999, 5),
    ],
)
def test_get_level_info_boundaries(xp: int, expected_level: int):
    assert get_level_info(xp).level == expected_level


def test_get_xp_progress_within_level():
    # Lv.1 (0~99), 50 XP → 진행 50/100
    progress = get_xp_progress(50)
    assert progress["current"] == 50
    assert progress["required"] == 100
    assert progress["percentage"] == 50


def test_get_xp_progress_max_level_is_full():
    # 최고 레벨(Lv.5)은 항상 100%
    progress = get_xp_progress(5000)
    assert progress["percentage"] == 100
    assert progress["required"] == 0


def test_level_table_is_contiguous():
    """레벨 구간이 빈틈/중복 없이 이어지는지 검증."""
    for lower, upper in zip(LEVELS, LEVELS[1:]):
        assert lower.max_xp is not None
        assert upper.min_xp == lower.max_xp + 1
    assert LEVELS[-1].max_xp is None  # 최고 레벨은 상한 없음


# ─── 통합: 게이미피케이션 엔드포인트 ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fresh_user_gamification(client: AsyncClient):
    token = await register_and_login(client, email="gam_fresh@ex.com")
    res = await client.get("/auth/me/gamification", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["xp"] == 0
    assert data["level"] == 1
    assert data["badges"] == []
    # 미획득 배지는 전체 카탈로그 수만큼 잠금 상태
    assert len(data["locked_badges"]) == len(BADGE_CATALOG)


@pytest.mark.asyncio
async def test_creating_trip_grants_xp_and_first_trip_badge(client: AsyncClient):
    token = await register_and_login(client, email="gam_trip@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}

    await client.post("/trips", json={"title": "첫 여행"}, headers=hdrs)

    res = await client.get("/auth/me/gamification", headers=hdrs)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    # 여행 1개 = 50 XP
    assert data["xp"] == 50
    earned = {b["badge_id"] for b in data["badges"]}
    assert "first_trip" in earned
