from fastapi import APIRouter, Query, Request

from app.dependencies.auth import CurrentUser
from app.dependencies.db import DbSession
from app.limiter import limiter
from app.repositories.trip_repository import TripRepository
from app.schemas.ai import AiRefineRequest, AiTripPlan, DestinationGuide
from app.schemas.common import ApiResponse
from app.services.ai_service import (
    WEATHER_CONDITION_LABELS,
    generate_by_weather_plan,
    generate_destination_guide,
    generate_trip_plan,
    refine_trip_plan,
)

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
    preferences: str | None = Query(default=None, max_length=300, description="자유 텍스트 취향 (예: 맛집 위주)"),
    travel_style: str | None = Query(default=None, max_length=50, description="여행 스타일 키 (예: 미식, 자연, 쇼핑)"),
    weather_temp_c: float | None = Query(
        default=None,
        ge=-90,   # 지구 최저 기온 기록: -89.2°C (남극)
        le=60,    # 지구 최고 기온 기록: +56.7°C (데스밸리) + 여유
        description="현재 목적지 기온 (°C, wttr.in, 범위 -90~60)",
    ),
    weather_code: int | None = Query(
        default=None,
        ge=100,   # wttr.in 최솟값 코드 (113 = 맑음)
        le=500,   # wttr.in 최댓값 코드 (395 = 뇌설) + 여유
        description="wttr.in weatherCode (눈/비 감지용, 알 수 없는 값은 무시됨)",
    ),
    rain_chance: int | None = Query(default=None, ge=0, le=100, description="강우 확률 (%, 0~100)"),
) -> ApiResponse[AiTripPlan]:
    # 사용자 과거 트립의 카테고리 빈도 → 프롬프트 보강
    top_categories = await _repo.get_top_categories(db, current_user.id, limit=3)
    plan = await generate_trip_plan(
        destination, days, preferences, top_categories or None,
        travel_style=travel_style,
        weather_temp_c=weather_temp_c,
        weather_code=weather_code,
        rain_chance=rain_chance,
    )
    return ApiResponse(data=plan)


@router.get("/destination-guide", response_model=ApiResponse[DestinationGuide])
@limiter.limit("20/hour")
async def get_destination_guide(
    request: Request,
    current_user: CurrentUser,
    destination: str = Query(min_length=1, max_length=200, description="여행지 이름 (예: 도쿄, 파리)"),
) -> ApiResponse[DestinationGuide]:
    """목적지 여행 가이드 (통화·시간대·비자·교통·음식·꿀팁). 24h TTL 권장."""
    guide = await generate_destination_guide(destination)
    return ApiResponse(data=guide)


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


@router.get("/recommend/by-weather", response_model=ApiResponse[dict])
@limiter.limit("10/hour")
async def recommend_by_weather(
    request: Request,
    current_user: CurrentUser,
    weather_condition: str = Query(
        description=(
            "날씨 조건 키. "
            "가능한 값: " + ", ".join(WEATHER_CONDITION_LABELS.keys())
        ),
        pattern=r"^(sunny_warm|spring|snow|cool|hot_summer)$",
    ),
) -> ApiResponse[dict]:
    """지금 특정 날씨를 즐길 수 있는 세계 여행지 3곳 + 대표 일정 추천.

    예: weather_condition=snow → 지금 눈이 오는 여행지 3곳.
    """
    result = await generate_by_weather_plan(weather_condition)
    return ApiResponse(data=result)
