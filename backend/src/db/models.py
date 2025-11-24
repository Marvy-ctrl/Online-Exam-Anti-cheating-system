import uuid
from datetime import datetime
from typing import List, Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy.dialects.postgresql import UUID, JSON
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy import ForeignKey
from enum import Enum


class Admin(SQLModel, table=True):
    __tablename__ = "admin"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    first_name: str
    last_name: str
    email: str
    password: str = Field(exclude=True)
    role: str = "admin"
    is_verified: bool = False
    created_at: datetime = Field(sa_column=Column(pg.TIMESTAMP, default=datetime.now))
    updated_at: datetime = Field(sa_column=Column(pg.TIMESTAMP, default=datetime.now))


class Student(SQLModel, table=True):
    __tablename__ = "student"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, unique=True, primary_key=True, nullable=False, default=uuid.uuid4
        )
    )
    student_id: str
    first_name: str
    last_name: str
    email: str
    baseline_face_path: Optional[str] = None


class Subject(SQLModel, table=True):
    __tablename__ = "subject"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    name: str


class Exam(SQLModel, table=True):
    __tablename__ = "exam"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    admin_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("admin.uid")))
    subject_uid: Optional[uuid.UUID] = Field(
        sa_column=Column(pg.UUID, ForeignKey("subject.uid"))
    )
    title: str
    duration_minutes: int
    start_time: datetime
    end_time: datetime


class Question(SQLModel, table=True):
    __tablename__ = "question"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    exam_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("exam.uid")))
    question_text: str
    options: List[str] = Field(sa_column=Column(JSON))
    correct_answer: str


class ExamStatus(str, Enum):
    not_started = "Not started"
    in_progress = "In progress"
    submitted = "Submitted"


class ExamSession(SQLModel, table=True):
    __tablename__ = "exam_session"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    student_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("student.uid")))
    exam_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("exam.uid")))
    start_time: datetime
    end_time: datetime
    score: Optional[float] = None
    status: ExamStatus = Field(
        sa_column=Column(pg.ENUM(ExamStatus, name="exam_status"), nullable=False),
    )


class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshot"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    student_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("student.uid")))
    session_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("exam_session.uid"))
    )
    image_path: str
    face_matches: bool = True
    multiple_faces_detected: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ViolationType(str, Enum):
    no_face = "No Face Detected"
    multiple_faces = "Multiple Faces Detected"
    face_mismatch = "Face Mismatch"


class Violation(SQLModel, table=True):
    __tablename__ = "violation"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    student_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("student.uid")))
    session_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("exam_session.uid"))
    )
    violation_type: ViolationType = Field(
        sa_column=Column(pg.ENUM(ViolationType, name="violation_type", nullable=False))
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)
