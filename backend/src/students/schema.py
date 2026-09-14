from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class StudentEnrollModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str
    last_name: str
    student_id: str
    email: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None

    @field_validator("student_id", mode="before")
    @classmethod
    def strip_leading_zeros(cls, v):
        if isinstance(v, str):
            return v.lstrip("0") or "0"
        return v


class StudentEnrollResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: UUID
    exam_uid: UUID
    first_name: str
    last_name: str
    student_id: str
    email: str
    device_id: Optional[str]
    ip_address: Optional[str]
    status: str
    enrolled_at: datetime
    created_at: datetime
    updated_at: datetime

    face_registration_token: str


class FaceRegisterModel(BaseModel):
    """
    Multi-image enrollment request.
    The client captures 5 images (front, left, right, chin-up, smile)
    and sends them all in a single request. The server quality-gates each
    image and averages the passing embeddings into one stored vector.
    """
    model_config = ConfigDict(extra="forbid")

    enrollment_token: str
    # Between 3 and 5 base64-encoded images. Client must send >= 3.
    face_images: List[str]

    @field_validator("face_images")
    @classmethod
    def validate_image_count(cls, v: List[str]) -> List[str]:
        if len(v) < 3:
            raise ValueError("At least 3 face images are required for enrollment.")
        if len(v) > 5:
            raise ValueError("A maximum of 5 face images is allowed per enrollment.")
        return v


class FaceRegisterResponse(BaseModel):
    message: str
    enrollment_uid: UUID
    exam_uid: UUID
    face_registered: bool
    images_submitted: int
    images_passed_quality: int
    embedding_vector_length: Optional[int] = None
