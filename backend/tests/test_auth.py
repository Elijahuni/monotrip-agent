"""
인증 엔드포인트 테스트
- POST /auth/register
- POST /auth/login   → access_token + refresh_token + expires_in
- POST /auth/refresh → token rotation (새 쌍 발급)
- POST /auth/logout  → refresh token 전체 폐기
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

    res = await client.post(
        "/auth/login",
        json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "access_token" in body["data"]
    assert body["data"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/auth/register", json=TEST_USER)
    res = await client.post(
        "/auth/login",
        json={
            "email": TEST_USER["email"],
            "password": "wrongpassword",
        },
    )
    assert res.status_code == 401
    # 401은 FastAPI HTTPException으로 반환될 수 있으므로 success 필드는 선택적
    body = res.json()
    assert body.get("success") is not True


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    res = await client.post(
        "/auth/login",
        json={
            "email": "nobody@example.com",
            "password": "anypassword",
        },
    )
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


# ─── /auth/refresh ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_returns_refresh_token(client: AsyncClient):
    await client.post("/auth/register", json=TEST_USER)
    res = await client.post(
        "/auth/login",
        json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert "refresh_token" in data
    assert "expires_in" in data
    assert data["expires_in"] > 0
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient):
    """refresh 성공 → 새 쌍 발급, 기존 refresh token 재사용 시 401."""
    await client.post("/auth/register", json=TEST_USER)
    login_res = await client.post(
        "/auth/login",
        json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"],
        },
    )
    old_refresh = login_res.json()["data"]["refresh_token"]

    # 새 쌍 발급
    refresh_res = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == 200
    body = refresh_res.json()
    assert body["success"] is True
    new_data = body["data"]
    assert "access_token" in new_data
    assert "refresh_token" in new_data
    assert new_data["refresh_token"] != old_refresh  # 새 토큰이어야 함

    # 기존 refresh token은 폐기됐으므로 재사용 시 401
    reuse_res = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == 401


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    res = await client.post("/auth/refresh", json={"refresh_token": "invalid-token-value"})
    assert res.status_code == 401


# ─── /auth/logout ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client: AsyncClient):
    """logout 후 refresh token으로 갱신 시도 → 401."""
    token = await register_and_login(client)

    # 먼저 refresh token 취득
    login_res = await client.post(
        "/auth/login",
        json={
            "email": TEST_USER["email"],
            "password": TEST_USER["password"],
        },
    )
    refresh_token = login_res.json()["data"]["refresh_token"]

    # 로그아웃 (access token 사용)
    logout_res = await client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

    # refresh token 재사용 시도 → 401
    reuse_res = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_res.status_code == 401


@pytest.mark.asyncio
async def test_logout_unauthenticated(client: AsyncClient):
    res = await client.post("/auth/logout")
    assert res.status_code == 401
