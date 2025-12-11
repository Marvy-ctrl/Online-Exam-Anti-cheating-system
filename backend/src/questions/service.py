from .schema import (
    QuestionUploadModel,
    OptionsUploadModel,
    BulkQuestionUploadModel,
    QuestionUpdateModel,
)
from src.db.models import Question, Options, Exam
from sqlmodel.ext.asyncio.session import AsyncSession
from src.exams.service import ExamService
from sqlmodel import select
from datetime import datetime, timezone

exam_service = ExamService()


class QuestionService:

    async def get_an_exam(self, exam_uid: str, session: AsyncSession):
        statement = select(Exam).where(Exam.uid == exam_uid)
        result = await session.exec(statement)
        return result.first()

    async def get_all_questions(self, exam_uid: str, session: AsyncSession):
        statement = (
            select(Question)
            .where(Question.exam_uid == exam_uid)
            .order_by(Question.order_index)
        )
        result = await session.exec(statement)
        return result.all()

    async def get_a_question(self, question_uid: str, session: AsyncSession):
        statement = select(Question).where(Question.uid == question_uid)
        result = await session.exec(statement)
        return result.first()

    async def upload_questions(
        self, question_detail: QuestionUploadModel, exam_uid: str, session: AsyncSession
    ):
        new_question = Question(
            exam_uid=exam_uid,
            question_text=question_detail.question_text,
            order_index=question_detail.order_index,
        )

        session.add(new_question)
        await session.flush()  # get new_question.id without committing

        options_to_create = []
        for index, option_text in enumerate(question_detail.options):
            option_row = Options(
                question_uid=new_question.uid,
                option_text=option_text,
                is_correct=(option_text == question_detail.correct_answer),
                order_index=index,
            )
            session.add(option_row)
            options_to_create.append(option_row)

        await session.commit()

        await session.refresh(new_question)

        return new_question

    async def update_question(
        self,
        question_uid: str,
        update_data: QuestionUpdateModel,
        session: AsyncSession,
    ):
        question_to_update = await self.get_a_question(question_uid, session)
        if not question_to_update:
            return None

        update_data_dict = update_data.model_dump(exclude_unset=True)

        if "question_text" in update_data_dict:
            question_to_update.question_text = update_data_dict["question_text"]
        if "order_index" in update_data_dict:
            question_to_update.order_index = update_data_dict["order_index"]

        if "options" in update_data_dict and "correct_answer" in update_data_dict:
            existing_options = await session.exec(
                select(Options).where(Options.question_uid == question_uid)
            )
            for option in existing_options:
                await session.delete(option)

            for index, option_text in enumerate(update_data_dict["options"]):
                new_option = Options(
                    question_uid=question_uid,
                    option_text=option_text,
                    is_correct=(option_text == update_data_dict["correct_answer"]),
                    order_index=index,
                )
                session.add(new_option)

        question_to_update.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(question_to_update)

        return question_to_update

    async def delete_question(self, question_uid: str, session: AsyncSession):
        question_to_delete = await self.get_a_question(question_uid, session)
        if not question_to_delete:
            return None

        existing_options = await session.exec(
            select(Options).where(Options.question_uid == question_uid)
        )
        for option in existing_options:
            await session.delete(option)

        await session.delete(question_to_delete)
        await session.commit()

        return {"message": "Question deleted successfully"}
