"""협업자 관리 테스트
- POST   /trips/{id}/invite               초대 발급 (owner/협업자)
- POST   /trips/invite/accept             초대 수락 → 협업자 등록
- GET    /trips/{id}/collaborators        목록
- PATCH  /trips/{id}/collaborators/{uid}  역할 변경 (owner만)
- DELETE /trips/{id}/collaborators/{uid}  제거 (owner만)
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


async def _me_id(client: AsyncClient, token: str) -> int:
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    return res.json()["data"]["id"]


async def _setup_owner_and_collaborator(client: AsyncClient, suffix: str):
    """owner가 여행+초대 생성, collaborator가 수락. (owner_token, collab_token, trip_id, collab_uid) 반환."""
    owner = await register_and_login(client, email=f"own_{suffix}@ex.com")
    collab = await register_and_login(client, email=f"col_{suffix}@ex.com")
    owner_h = {"Authorization": f"Bearer {owner}"}

    trip_id = (
        await client.post("/trips", json={"title": "공동 여행"}, headers=owner_h)
    ).json()["data"]["id"]

    token = (
        await client.post(
            f"/trips/{trip_id}/invite", json={"role": "edit"}, headers=owner_h
        )
    ).json()["data"]["token"]

    await client.post(
        "/trips/invite/accept",
        json={"token": token},
        headers={"Authorization": f"Bearer {collab}"},
    )
    collab_uid = await _me_id(client, collab)
    return owner, collab, trip_id, collab_uid


@pytest.mark.asyncio
async def test_owner_changes_collaborator_role(client: AsyncClient):
    owner, _collab, trip_id, collab_uid = await _setup_owner_and_collaborator(client, "role")
    owner_h = {"Authorization": f"Bearer {owner}"}

    res = await client.patch(
        f"/trips/{trip_id}/collaborators/{collab_uid}",
        json={"role": "view"},
        headers=owner_h,
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["role"] == "view"

    # 목록에도 반영
    lst = await client.get(f"/trips/{trip_id}/collaborators", headers=owner_h)
    roles = {c["user_id"]: c["role"] for c in lst.json()["data"]}
    assert roles[collab_uid] == "view"


@pytest.mark.asyncio
async def test_owner_removes_collaborator(client: AsyncClient):
    owner, _collab, trip_id, collab_uid = await _setup_owner_and_collaborator(client, "rm")
    owner_h = {"Authorization": f"Bearer {owner}"}

    res = await client.delete(
        f"/trips/{trip_id}/collaborators/{collab_uid}", headers=owner_h
    )
    assert res.status_code == 200, res.text

    lst = await client.get(f"/trips/{trip_id}/collaborators", headers=owner_h)
    uids = {c["user_id"] for c in lst.json()["data"]}
    assert collab_uid not in uids


@pytest.mark.asyncio
async def test_non_owner_cannot_manage(client: AsyncClient):
    _owner, collab, trip_id, collab_uid = await _setup_owner_and_collaborator(client, "perm")
    collab_h = {"Authorization": f"Bearer {collab}"}

    # 협업자가 역할 변경 시도 → 403
    patch = await client.patch(
        f"/trips/{trip_id}/collaborators/{collab_uid}",
        json={"role": "view"},
        headers=collab_h,
    )
    assert patch.status_code == 403

    # 협업자가 제거 시도 → 403
    delete = await client.delete(
        f"/trips/{trip_id}/collaborators/{collab_uid}", headers=collab_h
    )
    assert delete.status_code == 403


@pytest.mark.asyncio
async def test_manage_nonexistent_collaborator_404(client: AsyncClient):
    owner = await register_and_login(client, email="own_404@ex.com")
    owner_h = {"Authorization": f"Bearer {owner}"}
    trip_id = (
        await client.post("/trips", json={"title": "혼자 여행"}, headers=owner_h)
    ).json()["data"]["id"]

    res = await client.delete(
        f"/trips/{trip_id}/collaborators/999999", headers=owner_h
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_invalid_role_rejected(client: AsyncClient):
    owner, _collab, trip_id, collab_uid = await _setup_owner_and_collaborator(client, "badrole")
    owner_h = {"Authorization": f"Bearer {owner}"}

    res = await client.patch(
        f"/trips/{trip_id}/collaborators/{collab_uid}",
        json={"role": "admin"},  # 허용되지 않는 값
        headers=owner_h,
    )
    assert res.status_code == 422
