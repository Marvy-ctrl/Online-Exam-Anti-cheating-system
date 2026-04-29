from pydantic import BaseModel
from datetime import datetime
import uuid
from typing import Optional
from uuid import UUID


class SubjectCreateModel(BaseModel):
    name: str
    institution_uid: uuid.UUID

class SubjectUpdateModel(BaseModel):
    name: str


class SubjectResponseModel(BaseModel):
    uid: uuid.UUID
    institution_uid: uuid.UUID
    name: str


class ExamCreateModel(BaseModel):
    """
    Fields the client supplies when creating an exam.
    admin_uid is intentionally excluded — it is always derived
    server-side from the authenticated examiner's token.
    """
    title: str
    duration_minutes: int
    institution_uid: uuid.UUID
    subject_uid: uuid.UUID
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None


class ExamResponseModel(BaseModel):
    uid: uuid.UUID
    title: str
    duration_minutes: int
    institution_uid: uuid.UUID
    subject_uid: uuid.UUID
    admin_uid: UUID
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    created_at: datetime
    updated_at: datetime


class ExamModel(BaseModel):
    title: str
    duration_minutes: int
    start_time: datetime
    end_time: datetime

class ExamDetailResponseModel(BaseModel):
    uid: uuid.UUID
    title: str
    duration_minutes: int
    subject_uid: uuid.UUID
    subject_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None
    enroll_link: Optional[str] = None
    link_start_time: Optional[datetime] = None
    link_end_time: Optional[datetime] = None



class ExamUpdateModel(BaseModel):
    title: str
    duration_minutes: int
    start_time: datetime
    end_time: datetime


class StudentPreEnrollModel(BaseModel):
    first_name: str
    last_name: str
    student_id: str
    email: str


class StudentPreEnrollResponseModel(BaseModel):
    uid: uuid.UUID
    exam_uid: uuid.UUID
    first_name: str
    last_name: str
    email: str
    student_id: str
    status: str = "pending"


class EnrollLinkModel(BaseModel):
    link_start_time: datetime
    link_end_time: datetime

class BulkPreEnrollModel(BaseModel):
    students: list[StudentPreEnrollModel]

class StudentRosterResponseModel(BaseModel):
    uid: uuid.UUID
    first_name: str
    last_name: str
    email: str
    student_id: str
    created_at: datetime
    status: Optional[str] = None

class StudentUpdateModel(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    student_id: Optional[str] = None

class ExamInvitationModel(BaseModel):
    custom_message: Optional[str] = ""
