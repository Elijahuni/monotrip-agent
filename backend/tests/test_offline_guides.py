"""오프라인 가이드 API 테스트
- GET /offline-guides         목록(메타, 도시 필터, 게시만)
- GET /offline-guides/{id}    상세(섹션 포함, 미게시/없음 404)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.offline_guide import OfflineGuide
from tests.conftest import register_and_login


async def _seed(db: AsyncSession, **kwargs) -> OfflineGuide:
    guide = OfflineGuide(
        city=kwargs.get("city", "도쿄"),
        country=kwargs.get("country", "일본"),
        title=kwargs["title"],
        summary=kwargs.get("summary", "요약"),
        sections=kwargs.get("sections", [{"heading": "교통", "body": "지하철 이용"}]),
        file_size_kb=kwargs.get("file_size_kb", 120),
        version=kwargs.get("version", 1),
        is_published=kwargs.get("is_published", True),
    )
    db.add(guide)
    await db.flush()
    await db.refresh(guide)
    return guide


@pytest.mark.asyncio
async def test_list_published_only(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="og1@ex.com")
    await _seed(db_session, title="도쿄 가이드", is_published=True)
    await _seed(db_session, title="숨김 가이드", is_published=False)

    res = await client.get("/offline-guides", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    titles = {g["title"] for g in res.json()["data"]}
    assert "도쿄 가이드" in titles
    assert "숨김 가이드" not in titles
    # 목록엔 섹션 본문이 포함되지 않음
    assert "sections" not in res.json()["data"][0]


@pytest.mark.asyncio
async def test_city_filter(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="og2@ex.com")
    await _seed(db_session, title="도쿄", city="도쿄")
    await _seed(db_session, title="오사카", city="오사카")

    res = await client.get(
        "/offline-guides", params={"city": "오사카"}, headers={"Authorization": f"Bearer {token}"}
    )
    assert {g["city"] for g in res.json()["data"]} == {"오사카"}


@pytest.mark.asyncio
async def test_detail_includes_sections(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="og3@ex.com")
    guide = await _seed(
        db_session,
        title="상세 가이드",
        sections=[
            {"heading": "교통", "body": "스이카 카드"},
            {"heading": "음식", "body": "라멘 추천"},
        ],
    )

    res = await client.get(
        f"/offline-guides/{guide.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert len(data["sections"]) == 2
    assert data["sections"][0]["heading"] == "교통"
    assert data["version"] == 1


@pytest.mark.asyncio
async def test_unpublished_or_missing_404(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="og4@ex.com")
    hidden = await _seed(db_session, title="숨김", is_published=False)
    hdrs = {"Authorization": f"Bearer {token}"}

    assert (await client.get(f"/offline-guides/{hidden.id}", headers=hdrs)).status_code == 404
    assert (await client.get("/offline-guides/999999", headers=hdrs)).status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    assert (await client.get("/offline-guides")).status_code in (401, 403)
