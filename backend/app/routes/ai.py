from fastapi import APIRouter, Query, Request

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.repositories.trip_repository import TripRepository
from app.schemas.ai import AiRefineRequest, AiTripPlan
from app.schemas.common import ApiResponse
from app.services.ai_service import generate_trip_plan, refine_trip_plan

router = APIRouter(prefix="/ai", tags=["ai"])

_repo = TripRepository()


@router.get("/recommend", response_model=ApiResponse[AiTripPlan])
@limiter.limit("10/hour")
async def recommend_trip(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    destination: str = Query(min_length=1, max_length=200, description="여행 목적지 (예: 도쿄)"),
    days: int = Query(ge=1, le=14, description="여행 일수 (1~14)"),
    preferences: str | None = Query(default=None, max_length=300, description="여행 스타일 (예: 미식여행, 자연탐방)"),
) -> ApiResponse[AiTripPlan]:
    # 사용자 과거 트립의 카테고리 빈도 → 프롬프트 보강
    top_categories = await _repo.get_top_categories(db, current_user.id, limit=3)
    plan = await generate_trip_plan(destination, days, preferences, top_categories or None)
    return ApiResponse(data=plan)


@router.post("/recommend/refine", response_model=ApiResponse[AiTripPlan])
@limiter.limit("5/hour")
async def refine_recommendation(
    request: Request,
    body: AiRefineRequest,
    current_user: CurrentUser,
) -> ApiResponse[AiTripPlan]:
    """유지할 장소 + 사용자 피드백으로 부분 재생성."""
    plan = await refine_trip_plan(body)
    return ApiResponse(data=plan)
