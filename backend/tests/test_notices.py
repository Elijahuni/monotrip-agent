"""공지사항 API 테스트
- GET /notices          게시된 공지 목록 (고정 우선, 카테고리 필터)
- GET /notices/{id}     단건 (미게시/없음 → 404)

공지는 운영자(어드민)가 작성하므로 테스트에선 db_session으로 직접 삽입한다.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notice import Notice
from tests.conftest import register_and_login


async def _seed(db: AsyncSession, **kwargs) -> Notice:
    notice = Notice(
        category=kwargs.get("category", "general"),
        title=kwargs["title"],
        body=kwargs.get("body", "본문"),
        is_pinned=kwargs.get("is_pinned", False),
        is_published=kwargs.get("is_published", True),
    )
    db.add(notice)
    await db.flush()
    await db.refresh(notice)
    return notice


@pytest.mark.asyncio
async def test_list_returns_published_only(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="ntc1@ex.com")
    await _seed(db_session, title="게시됨", is_published=True)
    await _seed(db_session, title="숨김", is_published=False)

    res = await client.get("/notices", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    titles = {n["title"] for n in res.json()["data"]}
    assert "게시됨" in titles
    assert "숨김" not in titles


@pytest.mark.asyncio
async def test_pinned_notice_comes_first(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="ntc2@ex.com")
    await _seed(db_session, title="일반1", is_pinned=False)
    await _seed(db_session, title="고정", is_pinned=True)
    await _seed(db_session, title="일반2", is_pinned=False)

    res = await client.get("/notices", headers={"Authorization": f"Bearer {token}"})
    data = res.json()["data"]
    assert data[0]["title"] == "고정"
    assert data[0]["is_pinned"] is True


@pytest.mark.asyncio
async def test_category_filter(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="ntc3@ex.com")
    await _seed(db_session, title="이벤트 공지", category="event")
    await _seed(db_session, title="점검 공지", category="maintenance")

    res = await client.get(
        "/notices", params={"category": "event"}, headers={"Authorization": f"Bearer {token}"}
    )
    cats = {n["category"] for n in res.json()["data"]}
    assert cats == {"event"}


@pytest.mark.asyncio
async def test_get_single_notice(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="ntc4@ex.com")
    notice = await _seed(db_session, title="상세 공지", body="자세한 내용")

    res = await client.get(f"/notices/{notice.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["title"] == "상세 공지"
    assert data["body"] == "자세한 내용"


@pytest.mark.asyncio
async def test_unpublished_or_missing_returns_404(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="ntc5@ex.com")
    hidden = await _seed(db_session, title="숨김 상세", is_published=False)
    hdrs = {"Authorization": f"Bearer {token}"}

    assert (await client.get(f"/notices/{hidden.id}", headers=hdrs)).status_code == 404
    assert (await client.get("/notices/999999", headers=hdrs)).status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    res = await client.get("/notices")
    assert res.status_code in (401, 403)
