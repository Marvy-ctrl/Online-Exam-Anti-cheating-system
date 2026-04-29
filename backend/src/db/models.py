import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlmodel import SQLModel, Field, Column, Relationship, UniqueConstraint
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
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )
    exams: List["Exam"] = Relationship(
        back_populates="admin",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    institutions: List["Institution"] = Relationship(
        back_populates="admin",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class Institution(SQLModel, table=True):
    __tablename__ = "institution"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    admin_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("admin.uid")))
    name: str
    short_info: Optional[str] = None
    logo_url: Optional[str] = None
    
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )

    admin: "Admin" = Relationship(back_populates="institutions")
    
    subjects: List["Subject"] = Relationship(
        back_populates="institution",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    exams: List["Exam"] = Relationship(
        back_populates="institution",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    students: List["Student"] = Relationship(
        back_populates="institution",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class Student(SQLModel, table=True):
    __tablename__ = "student"
    __table_args__ = (
        UniqueConstraint("student_id", "institution_uid", name="uq_student_inst"),
    )

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    institution_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("institution.uid"))
    )
    first_name: str
    last_name: str
    email: str
    student_id: str

    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )

    institution: "Institution" = Relationship(back_populates="students")
    enrollments: List["ExamEnrollment"] = Relationship(back_populates="student_profile")
    subject_enrollments: List["SubjectEnrollment"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )




    # class Admin(SQLModel, table=True):
    # __tablename__ = "admin"

    # uid: uuid.UUID = Field(
    #     default_factory=uuid.uuid4,
    #     primary_key=True
    # )

    # first_name: str
    # last_name: str
    # email: str = Field(unique=True, index=True)
    # password: str
    # role: str = "admin"
    # is_verified: bool = False

    # created_at: datetime = Field(
    #     default_factory=lambda: datetime.now(timezone.utc)
    # )
    # updated_at: datetime = Field(
    #     default_factory=lambda: datetime.now(timezone.utc)
    # )

    # exams: List["Exam"] = Relationship(
    #     back_populates="admin",
    #     sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    # )


class Subject(SQLModel, table=True):
    __tablename__ = "subject"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    institution_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("institution.uid"))
    )
    name: str

    institution: "Institution" = Relationship(back_populates="subjects")
    exams: List["Exam"] = Relationship(
        back_populates="subject",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    enrolled_students: List["SubjectEnrollment"] = Relationship(
        back_populates="subject",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    updated_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )

class SubjectEnrollment(SQLModel, table=True):
    __tablename__ = "subject_enrollment"
    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    subject_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("subject.uid")))
    student_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("student.uid")))
    
    created_at: datetime = Field(
        sa_column=Column(
            TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
        )
    )

    subject: "Subject" = Relationship(back_populates="enrolled_students")
    student: "Student" = Relationship(back_populates="subject_enrollments")



class Exam(SQLModel, table=True):
    __tablename__ = "exam"

    uid: uuid.UUID = Field(
        sa_column=Column(
            pg.UUID, primary_key=True, unique=True, nullable=False, default=uuid.uuid4
        )
    )
    admin_uid: uuid.UUID = Field(sa_column=Column(pg.UUID, ForeignKey("admin.uid")))
    institution_uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, ForeignKey("institution.uid"))
    )
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
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )

    admin: "Admin" = Relationship(back_populates="exams")
    institution: "Institution" = Relationship(back_populates="exams")
    subject: Optional["Subject"] = Relationship(back_populates="exams")

    questions: List["Question"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    enrollments: List["ExamEnrollment"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    sessions: List["ExamSession"] = Relationship(
        back_populates="exam",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


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
    student_uid: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(pg.UUID, ForeignKey("student.uid", ondelete="SET NULL"))
    )
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
            TIMESTAMP(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
        )
    )

    student_profile: Optional["Student"] = Relationship(back_populates="enrollments")
    exam: "Exam" = Relationship(back_populates="enrollments")

    sessions: List["ExamSession"] = Relationship(
        back_populates="enrollment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    snapshots: List["Snapshot"] = Relationship(
        back_populates="enrollment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    violations: List["Violation"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


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
    options: List["Options"] = Relationship(
        back_populates="question",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


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
    expected_end_time: Optional[datetime] = Field(
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True)
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

    answers: List["StudentAnswers"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    snapshots: List["Snapshot"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    violations: List["Violation"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


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
