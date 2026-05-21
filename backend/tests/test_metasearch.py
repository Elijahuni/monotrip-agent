"""메타서치 테스트 (항공/호텔 검색)
API 키가 없는 테스트 환경에서는 결정론적 mock provider가 동작하며
data_source="mock"으로 표시된다. 가격 스냅샷 적재 BackgroundTask는
실 PostgreSQL을 열어 이벤트 루프와 충돌하므로 no-op으로 대체한다.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login


@pytest.fixture(autouse=True)
def _no_snapshot_persist(monkeypatch):
    import app.routes.metasearch as ms

    async def _noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(ms, "_persist_flight_snapshot", _noop)
    monkeypatch.setattr(ms, "_persist_hotel_snapshot", _noop)


@pytest.mark.asyncio
async def test_flight_search_returns_mock_offers(client: AsyncClient):
    token = await register_and_login(client, email="meta_f@ex.com")
    res = await client.get(
        "/metasearch/flights",
        params={"from_iata": "ICN", "to_iata": "NRT", "depart_date": "2026-09-01"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    # 항공 live provider는 키가 있어야 동작 → 테스트 환경에선 mock.
    # (키 없는 live provider가 추가될 경우 대비해 허용값으로 검증)
    assert data["data_source"] in ("mock", "live")
    assert len(data["offers"]) > 0
    assert all(o["price_krw"] > 0 for o in data["offers"])


@pytest.mark.asyncio
async def test_hotel_search_returns_mock_offers(client: AsyncClient):
    token = await register_and_login(client, email="meta_h@ex.com")
    res = await client.get(
        "/metasearch/hotels",
        params={"city": "도쿄", "checkin": "2026-09-01", "checkout": "2026-09-03"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    # 호텔은 키 없이 동작하는 live provider가 있어 환경에 따라 live/mock 모두 가능
    assert data["data_source"] in ("mock", "live")
    assert len(data["offers"]) > 0
    assert all(o["price_per_night_krw"] > 0 for o in data["offers"])


@pytest.mark.asyncio
async def test_flight_search_validates_iata(client: AsyncClient):
    token = await register_and_login(client, email="meta_v@ex.com")
    res = await client.get(
        "/metasearch/flights",
        params={"from_iata": "XX", "to_iata": "NRT", "depart_date": "2026-09-01"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_flight_search_requires_auth(client: AsyncClient):
    res = await client.get(
        "/metasearch/flights",
        params={"from_iata": "ICN", "to_iata": "NRT", "depart_date": "2026-09-01"},
    )
    assert res.status_code in (401, 403)
