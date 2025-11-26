from pydantic import BaseModel, Field, EmailStr
import uuid
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    student = "student"


class UserCreateModel(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.admin


class UserLoginModel(BaseModel):
    email: EmailStr
    password: str


class UserresponseModel(BaseModel):
    uid: uuid.UUID
    first_name: str
    last_name: str
    email: EmailStr
    is_verified: bool
    created_at: datetime
    updated_at: datetime
