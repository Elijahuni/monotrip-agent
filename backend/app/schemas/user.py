from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nickname: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    profile_image_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL (초)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdateRequest(BaseModel):
    nickname: str | None = Field(None, min_length=1, max_length=100)
    profile_image_url: str | None = None  # 이미 업로드된 URL (uploads API 사용 후 전달)


class UserUpdateResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    profile_image_url: str | None

    model_config = {"from_attributes": True}


class UserStatsResponse(BaseModel):
    trip_count: int
    saved_count: int
    post_count: int
    review_count: int


# ── 게이미피케이션 ────────────────────────────────────────────────────────────

class BadgeItem(BaseModel):
    badge_id: str
    name_ko: str
    name_en: str
    description_ko: str
    emoji: str
    earned_at: str | None  # ISO 문자열, 미획득 시 None


class GamificationResponse(BaseModel):
    xp: int
    level: int
    level_title_ko: str
    level_title_en: str
    level_emoji: str
    xp_current: int       # 현재 레벨 내 진행 XP
    xp_required: int      # 다음 레벨까지 필요 총 XP (최고 레벨이면 0)
    xp_percentage: int    # 0~100
    badges: list[BadgeItem]          # 획득한 배지
    locked_badges: list[BadgeItem]   # 미획득 배지
