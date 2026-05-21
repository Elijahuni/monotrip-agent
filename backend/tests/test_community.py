"""커뮤니티 API 테스트
- POST   /community/posts           글 작성
- GET    /community/feed            피드 (도시/카테고리 필터)
- GET    /community/posts/{id}      단건 조회
- DELETE /community/posts/{id}      삭제 (작성자만)
- POST   /community/posts/{id}/comments   댓글
- POST   /community/posts/{id}/like       좋아요 토글
- POST   /community/posts/{id}/report     신고 (3건 누적 자동 숨김)

모더레이션은 BackgroundTask(응답 후 실행)이므로 동기 응답 동작만 검증한다.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


@pytest.fixture(autouse=True)
def _no_background_moderation(monkeypatch):
    """글/댓글 작성 시 트리거되는 Gemini 모더레이션 BackgroundTask를 no-op으로 대체.

    실제 구현은 자체 AsyncSessionLocal(실 PostgreSQL)을 열어 모더레이션 결과를
    기록하는데, 테스트 환경에서는 그 연결이 이벤트 루프 종료와 충돌한다.
    동기 응답 동작만 검증하므로 백그라운드 모더레이션은 비활성화한다.
    """
    import app.routes.community as community

    async def _noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(community, "_moderate_post_bg", _noop)
    monkeypatch.setattr(community, "_moderate_comment_bg", _noop)


async def _create_post(
    client: AsyncClient,
    token: str,
    *,
    title: str = "도쿄 맛집 추천",
    body: str = "신주쿠 라멘집 정말 맛있어요",
    category: str = "qna",
    city: str | None = "도쿄",
) -> dict:
    res = await client.post(
        "/community/posts",
        json={"category": category, "city": city, "title": title, "body": body},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]


@pytest.mark.asyncio
async def test_create_post(client: AsyncClient):
    token = await register_and_login(client, email="comm1@ex.com")
    post = await _create_post(client, token)
    assert post["title"] == "도쿄 맛집 추천"
    assert post["city"] == "도쿄"
    assert post["like_count"] == 0
    assert post["comment_count"] == 0
    # regular 게시글은 만료 없음
    assert post["expires_at"] is None


@pytest.mark.asyncio
async def test_feed_lists_post_and_filters_by_city(client: AsyncClient):
    token = await register_and_login(client, email="comm2@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    await _create_post(client, token, title="도쿄글", city="도쿄")
    await _create_post(client, token, title="오사카글", city="오사카")

    # 전체 피드
    res = await client.get("/community/feed", headers=hdrs)
    assert res.status_code == 200
    titles = {p["title"] for p in res.json()["data"]}
    assert {"도쿄글", "오사카글"} <= titles

    # 도시 필터
    res2 = await client.get("/community/feed", params={"city": "오사카"}, headers=hdrs)
    cities = {p["city"] for p in res2.json()["data"]}
    assert cities == {"오사카"}


@pytest.mark.asyncio
async def test_get_post_and_not_found(client: AsyncClient):
    token = await register_and_login(client, email="comm3@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    post = await _create_post(client, token)

    res = await client.get(f"/community/posts/{post['id']}", headers=hdrs)
    assert res.status_code == 200
    assert res.json()["data"]["id"] == post["id"]

    missing = await client.get("/community/posts/999999", headers=hdrs)
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_delete_post_permission(client: AsyncClient):
    owner = await register_and_login(client, email="comm_owner@ex.com")
    other = await register_and_login(client, email="comm_other@ex.com")
    post = await _create_post(client, owner)

    # 타인 삭제 시도 → 403
    forbidden = await client.delete(
        f"/community/posts/{post['id']}",
        headers={"Authorization": f"Bearer {other}"},
    )
    assert forbidden.status_code == 403

    # 작성자 삭제 → 200
    ok = await client.delete(
        f"/community/posts/{post['id']}",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert ok.status_code == 200


@pytest.mark.asyncio
async def test_create_comment_increments_count(client: AsyncClient):
    token = await register_and_login(client, email="comm4@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    post = await _create_post(client, token)

    res = await client.post(
        f"/community/posts/{post['id']}/comments",
        json={"body": "저도 가봤어요!"},
        headers=hdrs,
    )
    assert res.status_code == 201
    assert res.json()["data"]["body"] == "저도 가봤어요!"

    # comment_count 증가 확인
    got = await client.get(f"/community/posts/{post['id']}", headers=hdrs)
    assert got.json()["data"]["comment_count"] == 1

    # 존재하지 않는 글에 댓글 → 404
    missing = await client.post(
        "/community/posts/999999/comments", json={"body": "x"}, headers=hdrs
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_toggle_like(client: AsyncClient):
    token = await register_and_login(client, email="comm5@ex.com")
    hdrs = {"Authorization": f"Bearer {token}"}
    post = await _create_post(client, token)

    # 좋아요 ON
    on = await client.post(f"/community/posts/{post['id']}/like", headers=hdrs)
    assert on.status_code == 200
    assert on.json()["data"] == {"liked": True, "like_count": 1}

    # 좋아요 OFF (토글)
    off = await client.post(f"/community/posts/{post['id']}/like", headers=hdrs)
    assert off.json()["data"] == {"liked": False, "like_count": 0}


@pytest.mark.asyncio
async def test_report_auto_hides_after_threshold(client: AsyncClient):
    author = await register_and_login(client, email="comm_author@ex.com")
    post = await _create_post(client, author)

    # 서로 다른 3명이 신고 → 자동 숨김
    for i in range(3):
        reporter = await register_and_login(client, email=f"reporter{i}@ex.com")
        res = await client.post(
            f"/community/posts/{post['id']}/report",
            json={"reason": "spam"},
            headers={"Authorization": f"Bearer {reporter}"},
        )
        assert res.status_code == 201

    # 숨김 처리되어 단건 조회 404
    viewer = await register_and_login(client, email="comm_viewer@ex.com")
    got = await client.get(
        f"/community/posts/{post['id']}",
        headers={"Authorization": f"Bearer {viewer}"},
    )
    assert got.status_code == 404

    # 피드에서도 제외
    feed = await client.get(
        "/community/feed", headers={"Authorization": f"Bearer {viewer}"}
    )
    ids = {p["id"] for p in feed.json()["data"]}
    assert post["id"] not in ids
