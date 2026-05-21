"""고객센터 FAQ API 테스트
- GET /faqs        게시된 FAQ 목록 (order_index 정렬, 카테고리 필터)
- GET /faqs/{id}   단건 (미게시/없음 → 404)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faq import Faq
from tests.conftest import register_and_login


async def _seed(db: AsyncSession, **kwargs) -> Faq:
    faq = Faq(
        category=kwargs.get("category", "general"),
        question=kwargs["question"],
        answer=kwargs.get("answer", "답변"),
        order_index=kwargs.get("order_index", 0),
        is_published=kwargs.get("is_published", True),
    )
    db.add(faq)
    await db.flush()
    await db.refresh(faq)
    return faq


@pytest.mark.asyncio
async def test_list_returns_published_only(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="faq1@ex.com")
    await _seed(db_session, question="게시 질문", is_published=True)
    await _seed(db_session, question="숨김 질문", is_published=False)

    res = await client.get("/faqs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, res.text
    qs = {f["question"] for f in res.json()["data"]}
    assert "게시 질문" in qs
    assert "숨김 질문" not in qs


@pytest.mark.asyncio
async def test_ordered_by_order_index(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="faq2@ex.com")
    await _seed(db_session, question="세번째", order_index=3)
    await _seed(db_session, question="첫번째", order_index=1)
    await _seed(db_session, question="두번째", order_index=2)

    res = await client.get("/faqs", headers={"Authorization": f"Bearer {token}"})
    questions = [f["question"] for f in res.json()["data"]]
    assert questions == ["첫번째", "두번째", "세번째"]


@pytest.mark.asyncio
async def test_category_filter(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="faq3@ex.com")
    await _seed(db_session, question="결제 질문", category="payment")
    await _seed(db_session, question="예약 질문", category="booking")

    res = await client.get(
        "/faqs", params={"category": "payment"}, headers={"Authorization": f"Bearer {token}"}
    )
    cats = {f["category"] for f in res.json()["data"]}
    assert cats == {"payment"}


@pytest.mark.asyncio
async def test_get_single_and_404(client: AsyncClient, db_session: AsyncSession):
    token = await register_and_login(client, email="faq4@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    faq = await _seed(db_session, question="상세 질문", answer="상세 답변")
    hidden = await _seed(db_session, question="숨김", is_published=False)

    ok = await client.get(f"/faqs/{faq.id}", headers=hdrs)
    assert ok.status_code == 200
    assert ok.json()["data"]["answer"] == "상세 답변"

    assert (await client.get(f"/faqs/{hidden.id}", headers=hdrs)).status_code == 404
    assert (await client.get("/faqs/999999", headers=hdrs)).status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    res = await client.get("/faqs")
    assert res.status_code in (401, 403)
