import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import Column, Float
from sqlalchemy.dialects.postgresql import JSON
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import ForeignKey
from enum import Enum
from sqlalchemy.types import TIMESTAMP


class Admin(SQLModel, table=True):
    __tablename__ = "admin"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    first_name: str
    last_name: str
    email: str = Field(unique=True, index=True)
    password: str = Field(exclude=True)
    role: str = "admin"
    is_verified: bool = False
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    exams: List["Exam"] = Relationship(back_populates="admin")


class Subject(SQLModel, table=True):
    __tablename__ = "subject"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    name: str

    exams: List["Exam"] = Relationship(back_populates="subject")


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
    description: Optional[str] = None
    duration_minutes: int
    start_time: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    end_time: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    enroll_link: Optional[str] = None

    link_start_time: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )

    link_end_time: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )

    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    admin: "Admin" = Relationship(back_populates="exams")
    subject: Optional["Subject"] = Relationship(back_populates="exams")
    questions: List["Question"] = Relationship(back_populates="exam")
    enrollments: List["ExamEnrollment"] = Relationship(back_populates="exam")
    sessions: List["ExamSession"] = Relationship(back_populates="exam")


class ExamEnrollmentStatus(str, Enum):
    pending = "pending"
    enrolled = "enrolled"


class ExamEnrollment(SQLModel, table=True):
    __tablename__ = "enrollment"
    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    exam_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("exam.uid")))
    first_name: str
    last_name: str
    email: str = Field(index=True)
    student_id: str
    device_id: Optional[str] = Field(default=None, index=True, unique=False)
    embedding_vector: Optional[List[float]] = Field(sa_column=Column(ARRAY(Float)))

    face_s3_url: Optional[str] = Field(default=None)
    enrolled_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    ip_address: Optional[str] = Field(default=None)
    status: ExamEnrollmentStatus = Field(
        sa_column=Column(
            pg.ENUM(
                ExamEnrollmentStatus, name="exam_enrollment_status", create_type=True
            ),
            nullable=False,
            default=ExamEnrollmentStatus.pending,
        ),
        description="Enrollment status, pending or enrolled",
    )
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    exam: "Exam" = Relationship(back_populates="enrollments")
    sessions: List["ExamSession"] = Relationship(back_populates="enrollment")
    snapshots: List["Snapshot"] = Relationship(back_populates="enrollment")
    violations: List["Violation"] = Relationship(back_populates="student")


class Question(SQLModel, table=True):
    __tablename__ = "question"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    exam_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("exam.uid")))
    question_text: str
    order_index: int
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    exam: "Exam" = Relationship(back_populates="questions")
    options: List["Options"] = Relationship(back_populates="question")


class Options(SQLModel, table=True):
    __tablename__ = "options"
    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    question_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("question.uid"))
    )
    option_text: str
    is_correct: bool
    order_index: int
    question: "Question" = Relationship(back_populates="options")


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
    student_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("enrollment.uid"))
    )
    exam_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("exam.uid")))
    start_time: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    end_time: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )
    score: Optional[float] = None
    status: ExamStatus = Field(
        sa_column=Column(
            pg.ENUM(ExamStatus, name="exam_status", create_type=True),
            nullable=False,
            default=ExamStatus.not_started,
        ),
    )

    enrollment: "ExamEnrollment" = Relationship(back_populates="sessions")
    exam: "Exam" = Relationship(back_populates="sessions")
    answers: List["StudentAnswers"] = Relationship(back_populates="session")
    snapshots: List["Snapshot"] = Relationship(back_populates="session")
    violations: List["Violation"] = Relationship(back_populates="session")


class StudentAnswers(SQLModel, table=True):
    __tablename__ = "student_answers"
    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    session_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("exam_session.uid"))
    )
    question_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("question.uid"))
    )
    selected_option_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("options.uid"))
    )
    is_correct: bool
    answered_at: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
    )

    session: "ExamSession" = Relationship(back_populates="answers")
    question: "Question" = Relationship()
    selected_option: "Options" = Relationship()


class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshot"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        ),
    )
    student_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("enrollment.uid"))
    )
    session_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("exam_session.uid"))
    )
    image_path: str
    face_matches: bool = True
    multiple_faces_detected: bool = False
    timestamp: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    enrollment: "ExamEnrollment" = Relationship(back_populates="snapshots")
    session: "ExamSession" = Relationship(back_populates="snapshots")


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
    student_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("enrollment.uid"))
    )
    session_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("exam_session.uid"))
    )
    violation_type: ViolationType = Field(
        sa_column=Column(
            pg.ENUM(
                ViolationType, name="violation_type", create_type=True, nullable=False
            )
        )
    )
    timestamp: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    student: "ExamEnrollment" = Relationship(back_populates="violations")
    session: "ExamSession" = Relationship(back_populates="violations")
