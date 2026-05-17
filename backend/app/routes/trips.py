import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.models.trip import Trip
from app.schemas.common import ApiResponse
from app.schemas.trip import (
    LocationCreate,
    LocationResponse,
    LocationUpdate,
    TripCreate,
    TripPage,
    TripResponse,
    TripSummary,
    TripUpdate,
)
from app.services.ai.user_profile_embedding import update_user_preference
from app.services.realtime import manager as realtime_manager
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["trips"])

_service = TripService()


async def _broadcast_location_change(
    trip_id: int,
    op: str,
    location_id: int,
    from_user_id: int,
    payload: dict | None = None,
) -> None:
    """Location 변경을 같은 trip room에 연결된 다른 사용자에게 알림.
    실패는 무시 — 실시간 알림이 실패해도 본 작업은 성공으로 처리."""
    try:
        await realtime_manager.broadcast(
            trip_id,
            {
                "type": "location_update",
                "op": op,
                "location_id": location_id,
                "from_user_id": from_user_id,
                "payload": payload,
            },
            exclude_ws=None,
        )
    except Exception:
        pass


_SHARE_TOKEN_DAYS = 30  # 공유 토큰 유효 기간


# ── Trip CRUD ────────────────────────────────────────────────────────────────


@router.get("", response_model=ApiResponse[TripPage])
async def list_trips(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=20, ge=1, le=100, description="페이지당 항목 수"),
    cursor: int | None = Query(default=None, description="이전 페이지 마지막 trip.id (커서)"),
) -> ApiResponse[TripPage]:
    page = await _service.get_my_trips_paginated(db, current_user.id, limit=limit, cursor=cursor)
    return ApiResponse(data=page)


@router.post("", response_model=ApiResponse[TripResponse], status_code=201)
async def create_trip(
    body: TripCreate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.create_trip(db, current_user.id, body)
    return ApiResponse(data=trip)


@router.get("/{trip_id}", response_model=ApiResponse[TripResponse])
async def get_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.get_trip(db, trip_id, current_user.id)
    return ApiResponse(data=trip)


@router.patch("/{trip_id}", response_model=ApiResponse[TripResponse])
async def update_trip(
    trip_id: int, body: TripUpdate, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    trip = await _service.update_trip(db, trip_id, current_user.id, body)
    return ApiResponse(data=trip)


@router.delete("/{trip_id}", response_model=ApiResponse[None])
async def delete_trip(trip_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[None]:
    await _service.delete_trip(db, trip_id, current_user.id)
    return ApiResponse(data=None, message="삭제되었습니다.")


# ── Location 엔드포인트 ──────────────────────────────────────────────────────


@router.post(
    "/{trip_id}/locations",
    response_model=ApiResponse[LocationResponse],
    status_code=201,
)
async def add_location(
    trip_id: int,
    body: LocationCreate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[LocationResponse]:
    location = await _service.add_location(db, trip_id, current_user.id, body)
    # 임베딩은 응답 후 별도 세션에서 백그라운드로 처리
    background_tasks.add_task(_service.embed_location_bg, location.id, body)
    # 같은 trip room에 있는 다른 사용자에게 실시간 알림
    background_tasks.add_task(
        _broadcast_location_change,
        trip_id,
        "create",
        location.id,
        current_user.id,
        None,
    )
    # 사용자 선호 임베딩 갱신 — 장소 추가 행동 누적
    background_tasks.add_task(
        update_user_preference,
        current_user.id,
        body.name,
        body.category,
        body.address,
        body.notes,
    )
    return ApiResponse(data=location)


@router.patch(
    "/{trip_id}/locations/{location_id}",
    response_model=ApiResponse[LocationResponse],
)
async def update_location(
    trip_id: int,
    location_id: int,
    body: LocationUpdate,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> ApiResponse[LocationResponse]:
    """If-Match 헤더로 낙관적 동시성. 클라이언트가 보유한 version을 전송하면
    서버가 다르면 409로 머지 UI를 띄울 수 있도록 현재 상태를 함께 반환."""
    expected_version: int | None = None
    if if_match is not None:
        try:
            expected_version = int(if_match.strip('"').strip("'"))
        except ValueError:
            expected_version = None
    location = await _service.update_location(
        db,
        trip_id,
        location_id,
        current_user.id,
        body,
        expected_version=expected_version,
    )
    background_tasks.add_task(
        _broadcast_location_change,
        trip_id,
        "patch",
        location.id,
        current_user.id,
        None,
    )
    return ApiResponse(data=location)


@router.delete("/{trip_id}/locations/{location_id}", response_model=ApiResponse[None])
async def delete_location(
    trip_id: int,
    location_id: int,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: DbSession,
) -> ApiResponse[None]:
    await _service.delete_location(db, trip_id, location_id, current_user.id)
    background_tasks.add_task(
        _broadcast_location_change,
        trip_id,
        "delete",
        location_id,
        current_user.id,
        None,
    )
    return ApiResponse(data=None, message="장소가 삭제되었습니다.")


@router.get(
    "/{trip_id}/locations/similar",
    response_model=ApiResponse[list[LocationResponse]],
    summary="의미 유사 장소 검색 (pgvector)",
)
async def similar_locations(
    trip_id: int,
    q: str,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = 5,
) -> ApiResponse[list[LocationResponse]]:
    """자연어 쿼리 q와 의미적으로 가장 가까운 장소를 반환.

    예: ?q=카페 분위기 조용한 곳  →  해당 여행의 카페 중 유사한 장소 순위.
    임베딩이 없는 장소는 결과에서 제외됨 (장소 추가 후 수 초 내 생성됨).
    PostgreSQL + pgvector 환경에서만 동작 (SQLite에서는 빈 리스트).
    """
    locations = await _service.find_similar_locations(db, trip_id, current_user.id, q, limit)
    return ApiResponse(data=locations)


# ── 공유 (UP-7) ───────────────────────────────────────────────────────────────


@router.post("/{trip_id}/share", response_model=ApiResponse[dict])
async def share_trip(trip_id: int, current_user: CurrentUser, db: DbSession) -> ApiResponse[dict]:
    """공유 토큰 발급 (없으면 신규 생성, 있으면 재사용). 만료 30일."""
    trip = await _service.repo.get_by_id(db, trip_id)
    if trip is None or trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="여행을 찾을 수 없습니다."
        )

    now = datetime.now(timezone.utc)
    # 토큰이 없거나 만료됐으면 새로 발급 (SQLite naive datetime 정규화)
    _exp = trip.share_token_expires_at
    if _exp is not None and _exp.tzinfo is None:
        _exp = _exp.replace(tzinfo=timezone.utc)
    needs_new_token = not trip.share_token or _exp is None or _exp < now
    if needs_new_token:
        trip.share_token = secrets.token_urlsafe(16)
        trip.share_token_expires_at = now + timedelta(days=_SHARE_TOKEN_DAYS)
        db.add(trip)
        await db.flush()
        await db.refresh(trip)

    settings = get_settings()
    base = getattr(settings, "api_base_url", "http://localhost:8000")
    expires_iso = trip.share_token_expires_at.isoformat() if trip.share_token_expires_at else None
    return ApiResponse(
        data={
            "share_token": trip.share_token,
            "share_url": f"{base}/trips/shared/{trip.share_token}",
            "expires_at": expires_iso,
        }
    )


@router.get("/shared/{share_token}", response_model=ApiResponse[dict])
async def get_shared_trip(share_token: str, db: DbSession) -> ApiResponse[dict]:
    """공유 링크로 여행 열람 (인증 불필요). 만료 토큰은 404 반환."""
    stmt = select(Trip).where(Trip.share_token == share_token).options(selectinload(Trip.locations))
    result = await db.execute(stmt)
    trip = result.scalars().first()

    if trip is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="공유된 여행을 찾을 수 없습니다."
        )

    # 만료 체크: expires_at이 NULL이면 항상 만료로 처리
    # SQLite는 naive datetime을 반환하므로 UTC로 정규화
    now = datetime.now(timezone.utc)
    expires_at = trip.share_token_expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at is None or expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="공유 링크가 만료되었습니다. 여행 주인에게 재공유를 요청하세요.",
        )

    return ApiResponse(
        data={
            "trip": TripSummary.model_validate(trip).model_dump(),
            "locations": [loc.__dict__ for loc in trip.locations],
        }
    )


# ── 여행 복제 (U7) ────────────────────────────────────────────────────────────


@router.post("/{trip_id}/duplicate", response_model=ApiResponse[TripResponse], status_code=201)
async def duplicate_trip(
    trip_id: int, current_user: CurrentUser, db: DbSession
) -> ApiResponse[TripResponse]:
    """여행과 모든 장소를 복사. 날짜·공유토큰은 초기화."""
    trip = await _service.duplicate_trip(db, trip_id, current_user.id)
    return ApiResponse(data=trip, message="여행이 복제되었습니다.")
