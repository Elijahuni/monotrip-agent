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
