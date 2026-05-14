from datetime import datetime

from pydantic import BaseModel, Field


class ChecklistItemCreate(BaseModel):
    category: str = Field(default="짐", max_length=50)
    text: str = Field(min_length=1, max_length=300)


class ChecklistItemToggle(BaseModel):
    is_checked: bool


class ChecklistItemResponse(BaseModel):
    id: int
    trip_id: int
    category: str
    text: str
    is_checked: bool
    created_at: datetime

    model_config = {"from_attributes": True}
