import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from fastapi import HTTPException

from src.db.models import ExamEnrollmentStatus, ExamStatus, StudentAnswers
from src.exam_session.service import ExamSessionService


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class _SequenceSession:
    def __init__(self, values):
        self.values = iter(values)
        self.statements = []
        self.add = Mock()
        self.commit = AsyncMock()
        self.refresh = AsyncMock()

    async def exec(self, statement):
        self.statements.append(statement)
        return _Result(next(self.values))


class StartExamLifecycleTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _exam(*, ends_in_minutes: int = 5, duration_minutes: int = 60):
        now = datetime.now(timezone.utc)
        return SimpleNamespace(
            uid=uuid4(),
            title="Security Engineering",
            start_time=now - timedelta(minutes=5),
            end_time=now + timedelta(minutes=ends_in_minutes),
            duration_minutes=duration_minutes,
        )

    async def test_start_exam_verifies_face_and_caps_deadline_at_exam_end(self):
        service = ExamSessionService()
        exam = self._exam()
        enrollment = SimpleNamespace(
            uid=uuid4(),
            exam_uid=exam.uid,
            status=ExamEnrollmentStatus.enrolled,
            embedding_vector="v1:encrypted-template",
        )
        db = _SequenceSession([enrollment, None])
        decrypted_embedding = [0.01] * 128

        with (
            patch(
                "src.exam_session.service.exam_service.get_an_exam",
                new=AsyncMock(return_value=exam),
            ),
            patch(
                "src.exam_session.service.decrypt_embedding",
                return_value=decrypted_embedding,
            ) as decrypt,
            patch.object(
                service,
                "verify_live_face",
                new=AsyncMock(return_value=True),
            ) as verify_face,
            patch("src.exam_session.service.logger.info") as log_info,
        ):
            exam_session, returned_exam = await service.start_exam(
                str(exam.uid), str(enrollment.uid), "live-image", db
            )

        self.assertIs(returned_exam, exam)
        self.assertEqual(exam_session.status, ExamStatus.in_progress)
        self.assertEqual(exam_session.expected_end_time, exam.end_time)
        self.assertIsNone(exam_session.end_time)
        decrypt.assert_called_once_with(enrollment.embedding_vector)
        verify_face.assert_awaited_once_with(
            live_image_base64="live-image",
            stored_embedding=decrypted_embedding,
        )
        db.add.assert_called_once_with(exam_session)
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(exam_session)
        log_info.assert_called_once()

    async def test_start_exam_rejects_face_mismatch_without_writing_session(self):
        service = ExamSessionService()
        exam = self._exam(ends_in_minutes=30, duration_minutes=20)
        enrollment = SimpleNamespace(
            uid=uuid4(),
            exam_uid=exam.uid,
            status=ExamEnrollmentStatus.enrolled,
            embedding_vector="v1:encrypted-template",
        )
        db = _SequenceSession([enrollment])

        with (
            patch(
                "src.exam_session.service.exam_service.get_an_exam",
                new=AsyncMock(return_value=exam),
            ),
            patch(
                "src.exam_session.service.decrypt_embedding",
                return_value=[0.01] * 128,
            ),
            patch.object(
                service,
                "verify_live_face",
                new=AsyncMock(return_value=False),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await service.start_exam(
                    str(exam.uid), str(enrollment.uid), "live-image", db
                )

        self.assertEqual(raised.exception.status_code, 403)
        db.add.assert_not_called()
        db.commit.assert_not_awaited()


class AnswerLifecycleTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _active_session():
        return SimpleNamespace(
            uid=uuid4(),
            exam_uid=uuid4(),
            student_uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=datetime.now(timezone.utc) + timedelta(minutes=20),
        )

    async def test_choose_options_creates_an_answer_for_the_owned_session(self):
        service = ExamSessionService()
        exam_session = self._active_session()
        question = SimpleNamespace(uid=uuid4(), exam_uid=exam_session.exam_uid)
        option = SimpleNamespace(uid=uuid4(), question_uid=question.uid)
        db = _SequenceSession([question, [option], None])

        with patch.object(
            service,
            "get_student_session",
            new=AsyncMock(return_value=exam_session),
        ) as get_session:
            response = await service.choose_options(
                str(exam_session.uid),
                str(exam_session.exam_uid),
                str(exam_session.student_uid),
                str(question.uid),
                [str(option.uid)],
                db,
            )

        saved_answer = db.add.call_args.args[0]
        self.assertIsInstance(saved_answer, StudentAnswers)
        self.assertEqual(saved_answer.session_uid, exam_session.uid)
        self.assertEqual(saved_answer.question_uid, question.uid)
        self.assertEqual(saved_answer.selected_option_uids, [str(option.uid)])
        self.assertEqual(response["message"], "Answer saved successfully")
        self.assertTrue(get_session.await_args.kwargs["for_update"])
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(saved_answer)

    async def test_choose_options_updates_an_existing_answer(self):
        service = ExamSessionService()
        exam_session = self._active_session()
        question = SimpleNamespace(uid=uuid4(), exam_uid=exam_session.exam_uid)
        existing_answer = SimpleNamespace(
            uid=uuid4(),
            selected_option_uids=[str(uuid4())],
            updated_at=None,
        )
        db = _SequenceSession([question, existing_answer])
        before_update = datetime.now(timezone.utc)

        with patch.object(
            service,
            "get_student_session",
            new=AsyncMock(return_value=exam_session),
        ):
            response = await service.choose_options(
                str(exam_session.uid),
                str(exam_session.exam_uid),
                str(exam_session.student_uid),
                str(question.uid),
                [],
                db,
            )

        self.assertEqual(existing_answer.selected_option_uids, [])
        self.assertGreaterEqual(existing_answer.updated_at, before_update)
        self.assertEqual(response["message"], "Answer updated successfully")
        db.add.assert_called_once_with(existing_answer)
        db.commit.assert_awaited_once()
        db.refresh.assert_awaited_once_with(existing_answer)


class SubmissionLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_submit_exam_rejects_an_already_submitted_session(self):
        service = ExamSessionService()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.submitted,
            expected_end_time=datetime.now(timezone.utc),
        )
        db = _SequenceSession([])

        with patch.object(
            service,
            "get_student_session",
            new=AsyncMock(return_value=exam_session),
        ) as get_session:
            with self.assertRaises(HTTPException) as raised:
                await service.submit_exam(
                    str(exam_session.uid), str(uuid4()), str(uuid4()), db
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertTrue(get_session.await_args.kwargs["for_update"])
        db.commit.assert_not_awaited()

    async def test_submit_exam_rejects_a_session_without_a_deadline(self):
        service = ExamSessionService()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=None,
        )
        db = _SequenceSession([])

        with patch.object(
            service,
            "get_student_session",
            new=AsyncMock(return_value=exam_session),
        ):
            with self.assertRaises(HTTPException) as raised:
                await service.submit_exam(
                    str(exam_session.uid), str(uuid4()), str(uuid4()), db
                )

        self.assertEqual(raised.exception.status_code, 409)
        db.commit.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
