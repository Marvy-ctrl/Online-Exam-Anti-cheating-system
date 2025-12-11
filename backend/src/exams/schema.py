from pydantic import BaseModel
from datetime import datetime
from enum import Enum
import uuid
from typing import List, Optional
from uuid import UUID


class SubjectCreateModel(BaseModel):
    name: str


class SubjectResponseModel(BaseModel):
    uid: uuid.UUID
    name: str


class UserRole(str, Enum):
    admin = "admin"
    student = "student"


class ExamCreateModel(BaseModel):
    title: str
    duration_minutes: int
    subject_uid: uuid.UUID
    admin_uid: UUID = None
    start_time: datetime
    end_time: datetime
    description: Optional[str]
    role: UserRole = UserRole.admin


class ExamResponseModel(BaseModel):
    uid: uuid.UUID
    title: str
    duration_minutes: int
    subject_uid: uuid.UUID
    admin_uid: UUID = None
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    role: UserRole = UserRole.admin
    created_at: datetime
    updated_at: datetime


class ExamModel(BaseModel):
    title: str
    duration_minutes: int
    start_time: datetime
    end_time: datetime


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
