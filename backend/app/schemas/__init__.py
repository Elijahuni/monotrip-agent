from app.schemas.ai import AiLocationPlan, AiRecommendQuery, AiTripPlan
from app.schemas.common import ApiResponse
from app.schemas.trip import LocationResponse, TripCreate, TripResponse, TripSummary, TripUpdate
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse

__all__ = [
    "ApiResponse",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenResponse",
    "TripCreate",
    "TripUpdate",
    "TripSummary",
    "TripResponse",
    "LocationResponse",
    "AiRecommendQuery",
    "AiTripPlan",
    "AiLocationPlan",
]
