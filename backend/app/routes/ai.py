from fastapi import APIRouter, Query

from app.dependencies.auth import CurrentUser
from app.schemas.ai import AiTripPlan
from app.schemas.common import ApiResponse
from app.services.ai_service import generate_trip_plan

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/recommend", response_model=ApiResponse[AiTripPlan])
async def recommend_trip(
    current_user: CurrentUser,
    destination: str = Query(min_length=1, description="여행 목적지 (예: 도쿄)"),
    days: int = Query(ge=1, le=14, description="여행 일수 (1~14)"),
    preferences: str | None = Query(default=None, description="여행 스타일 (예: 미식여행, 자연탐방)"),
) -> ApiResponse[AiTripPlan]:
    plan = await generate_trip_plan(destination, days, preferences)
    return ApiResponse(data=plan)
