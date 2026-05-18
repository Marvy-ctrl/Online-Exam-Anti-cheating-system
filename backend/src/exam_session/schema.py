from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import List, Optional, Dict


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


class VerifyFaceRequest(BaseModel):
    face_image: str


class VerifyFaceResponse(BaseModel):
    status: str  # "ok" or "violation"
    message: str
    violation_type: str | None = None
 
 
class IdentifyStudentRequest(BaseModel):
    identifier: str  # Can be Email or Student ID


class ViolationReportRequest(BaseModel):
    violation_type: str
    count: int = 1


class UpdateScoreRequest(BaseModel):
    new_score: float
    adjustment_reason: Optional[str] = None


# --- Student-facing exam question schemas ---

class OptionResponse(BaseModel):
    uid: str
    option_text: str
    order_index: int


class QuestionResponse(BaseModel):
    uid: str
    question_text: str
    order_index: int
    options: List[OptionResponse]


class ExamQuestionsResponse(BaseModel):
    exam_uid: str
    session_uid: str
    expected_end_time: Optional[datetime] = None
    questions: List[QuestionResponse]
    student_first_name: str
    student_last_name: str
    student_id: str
    saved_answers: Dict[str, List[str]]



class ExamLinkValidateResponse(BaseModel):
    valid: bool
    exam_uid: str
    exam_title: str
    exam_start_time: datetime
    exam_end_time: datetime
    duration_minutes: int
    # "open" | "not_yet_open" | "expired"
    status: str
    enrollment_uid: Optional[str] = None 