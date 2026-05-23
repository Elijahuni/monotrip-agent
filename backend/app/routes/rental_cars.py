"""렌터카·보험 메타서치 라우트 — 도시/기간 기반 차량+보험 검색."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies.auth import get_current_user
from app.limiter import limiter
from app.models.user import User
from app.schemas.common import ApiResponse
from app.schemas.rental_cars import (
    InsuranceLevel,
    RentalCarSearchQuery,
    RentalCarSearchResult,
)
from app.services.rental_cars import search_rental_cars

router = APIRouter(prefix="/rental-cars", tags=["rental-cars"])


@router.get("/search", response_model=ApiResponse[RentalCarSearchResult])
@limiter.limit("60/hour")
async def search_rental_car_insurance(
    request: Request,
    city: str = Query(min_length=1, max_length=60),
    pickup_date: date = Query(description="YYYY-MM-DD"),
    return_date: date = Query(description="YYYY-MM-DD"),
    driver_age: int = Query(default=30, ge=18, le=99),
    insurance_level: InsuranceLevel | None = Query(default=None),
    _user: User = Depends(get_current_user),
) -> ApiResponse[RentalCarSearchResult]:
    q = RentalCarSearchQuery(
        city=city,
        pickup_date=pickup_date,
        return_date=return_date,
        driver_age=driver_age,
        insurance_level=insurance_level,
    )
    result = await search_rental_cars(q)
    return ApiResponse(data=result)
