from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class InstitutionCreateModel(BaseModel):
    name: str
    short_info: Optional[str] = None
    logo_url: Optional[str] = None

class InstitutionResponseModel(BaseModel):
    uid: UUID
    admin_uid: UUID
    name: str
    short_info: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ActivityItemModel(BaseModel):
    type: str
    title: str
    description: str
    timestamp: str

class OverviewResponseModel(BaseModel):
    institutions_count: int
    active_exams_count: int
    total_students_count: int
    violations_detected_count: int
    recent_activities: list[ActivityItemModel]
