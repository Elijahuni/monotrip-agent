from pydantic import BaseModel, Field


class AiLocationPlan(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    category: str
    visit_order: int
    notes: str | None = None


class AiTripPlan(BaseModel):
    title: str
    description: str
    locations: list[AiLocationPlan]


class AiRecommendQuery(BaseModel):
    destination: str = Field(min_length=1)
    days: int = Field(ge=1, le=14)
    preferences: str | None = None


class AiRefineRequest(BaseModel):
    """부분 재생성 요청. 유지할 장소 + 사용자 피드백 + 기존 컨텍스트."""

    destination: str = Field(min_length=1)
    days: int = Field(ge=1, le=14)
    # 사용자가 마음에 든 장소들 (이름만으로도 충분). 그대로 유지하고 나머지를 갱신.
    keep_locations: list[AiLocationPlan] = Field(default_factory=list)
    # 사용자 피드백 ("더 조용한 곳", "맛집 위주", "야경 명소 추가")
    feedback: str = Field(min_length=1, max_length=500)
    # 추가로 채울 장소 개수 (기본: 원래 일정대비 부족분)
    target_total: int | None = Field(default=None, ge=1, le=60)


class TopArea(BaseModel):
    name: str
    description: str


class DestinationGuide(BaseModel):
    """AI가 생성한 여행지 가이드북."""

    destination: str
    country: str
    currency: str
    exchange_rate_krw: float | None = None
    timezone: str
    language: str
    best_season: str
    climate_now: str
    visa: str
    transport: list[str] = Field(default_factory=list)
    top_areas: list[TopArea] = Field(default_factory=list)
    must_eat: list[str] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
