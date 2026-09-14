from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from uuid import UUID


class QuestionUploadModel(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    order_index: int
    marks: float = 1.0


class OptionsUploadModel(BaseModel):
    option_text: str


class BulkQuestionUploadModel(BaseModel):
    questions: List[QuestionUploadModel]


class QuestionUpdateModel(BaseModel):
    question_text: Optional[str] = None
    order_index: Optional[int] = None
    marks: Optional[float] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None


class BulkDeleteQuestionsModel(BaseModel):
    question_uids: List[UUID]
