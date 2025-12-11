from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class QuestionUploadModel(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    order_index: int


class OptionsUploadModel(BaseModel):
    option_text: str


class BulkQuestionUploadModel(BaseModel):
    questions: List[QuestionUploadModel]


class QuestionUpdateModel(BaseModel):
    question_text: Optional[str] = None
    order_index: Optional[int] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
