from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import List


class StartExamRequest(BaseModel):
    face_image: str


class StartExamResponse(BaseModel):
    message: str
    session_uid: UUID
    start_time: datetime
    expected_end_time: datetime
    duration_minutes: int


class ChooseOptionsRequest(BaseModel):
    exam_session_uid: str
    selected_option_uids: List[str] = Field(
        default=[],
        description="List of selected option UIDs. Empty list for unanswered questions.",
    )


class ChooseOptionsResponse(BaseModel):
    message: str
    answer_uid: UUID


class SubmitExamResponse(BaseModel):
    message: str
    submitted_time: datetime
