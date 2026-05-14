"""
인증 엔드포인트 테스트
- POST /auth/register
- POST /auth/login
- GET  /auth/me
"""

import pytest
from httpx import AsyncClient

from tests.conftest import TEST_USER, register_and_login


# ─── /auth/register ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    res = await client.post("/auth/register", json=TEST_USER)
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["email"] == TEST_USER["email"]
    assert body["data"]["nickname"] == TEST_USER["nickname"]
    assert "hashed_password" not in body["data"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    # 첫 번째 등록 성공
    await client.post("/auth/register", json=TEST_USER)
    # 두 번째 동일 이메일 → 409 (Conflict) 또는 400
    res = await client.post("/auth/register", json=TEST_USER)
    assert res.status_code in (400, 409)
    body = res.json()
    # HTTPException은 {"detail": "..."}, ApiResponse는 {"success": false}
    assert body.get("success") is not True or "detail" in body


@pytest.mark.asyncio
async def test_register_missing_fields(client: AsyncClient):
    res = await client.post("/auth/register", json={"email": "a@b.com"})
    assert res.status_code == 422  # Pydantic 검증 실패


# ─── /auth/login ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # 먼저 등록
    await client.post("/auth/register", json=TEST_USER)

    res = await client.post("/auth/login", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert body["data"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json=TEST_USER)
    res = await client.post("/auth/login", json={
        "email": TEST_USER["email"],
        "password": "wrongpassword",
    })
    assert res.status_code == 401
    # 401은 FastAPI HTTPException으로 반환될 수 있으므로 success 필드는 선택적
    body = res.json()
    assert body.get("success") is not True


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    res = await client.post("/auth/login", json={
        "email": "nobody@example.com",
        "password": "anypassword",
    })
    assert res.status_code == 401


# ─── /auth/me ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    token = await register_and_login(client)
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["email"] == TEST_USER["email"]


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    res = await client.get("/auth/me")
    assert res.status_code == 401
