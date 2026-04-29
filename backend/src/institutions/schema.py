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
