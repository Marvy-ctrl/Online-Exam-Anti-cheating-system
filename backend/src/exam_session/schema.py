from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class StartExamRequest(BaseModel):
    face_image: str


class StartExamResponse(BaseModel):
    message: str
    session_uid: UUID
    start_time: datetime
    expected_end_time: datetime
    duration_minutes: int
