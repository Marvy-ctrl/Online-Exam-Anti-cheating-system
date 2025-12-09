from pydantic import BaseModel
from src.db.models import Exam, ExamEnrollment
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class StudentEnrollModel(BaseModel):
    first_name: str
    last_name: str
    student_id: str
    email: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    embedding_vector: Optional[List[float]] = None
    face_s3_url: Optional[str] = None


class StudentEnrollResponse(BaseModel):
    uid: UUID
    exam_uid: UUID
    first_name: str
    last_name: str
    student_id: str
    email: str
    device_id: Optional[str]
    ip_address: Optional[str]
    embedding_vector: Optional[List[float]]
    face_s3_url: Optional[str]
    status: str
    enrolled_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FaceRegisterModel(BaseModel):
    enrollment_uid: UUID
    face_image: str  # Base64 encoded image


class FaceRegisterResponse(BaseModel):
    message: str
    enrollment_uid: UUID
    face_registered: bool
    embedding_vector_length: Optional[int] = None
