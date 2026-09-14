import unittest
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from fastapi import HTTPException

from src.db.models import ExamStatus
from src.exam_session.service import ExamSessionService
from src.worker.celery_app import celery_app
from src.worker.tasks.completion_tasks import (
    finalize_expired_sessions,
    find_ungraded_submissions,
)
from src.worker.tasks.grading_tasks import grade_and_notify_task


class _AsyncSession:
    def __init__(self):
        self.add = Mock()
        self.commit = AsyncMock()
        self.refresh = AsyncMock()


class _ScalarResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return self

    def all(self):
        return self.values

    def scalar_one_or_none(self):
        return self.values


class _SyncSession:
    def __init__(self, results):
        self.results = iter(results)
        self.statements = []
        self.add = Mock()
        self.commit = Mock()

    def execute(self, statement):
        self.statements.append(statement)
        return _ScalarResult(next(self.results))


class ManualSubmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_submission_commits_before_dispatching_async_grading(self):
        service = ExamSessionService()
        db = _AsyncSession()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=datetime.now(timezone.utc) + timedelta(minutes=30),
            end_time=None,
        )

        with (
            patch.object(
                service,
                "get_student_session",
                new=AsyncMock(return_value=exam_session),
            ) as get_session,
            patch(
                "src.worker.tasks.grading_tasks.grade_and_notify_task.delay"
            ) as delay,
        ):
            result = await service.submit_exam(
                str(exam_session.uid), str(uuid4()), str(uuid4()), db
            )

        self.assertIs(result, exam_session)
        self.assertEqual(exam_session.status, ExamStatus.submitted)
        db.commit.assert_awaited_once()
        delay.assert_called_once_with(str(exam_session.uid))
        self.assertTrue(get_session.await_args.kwargs["for_update"])

    async def test_late_submission_uses_authoritative_deadline(self):
        service = ExamSessionService()
        db = _AsyncSession()
        deadline = datetime.now(timezone.utc) - timedelta(seconds=5)
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=deadline,
            end_time=None,
        )

        with (
            patch.object(
                service,
                "get_student_session",
                new=AsyncMock(return_value=exam_session),
            ),
            patch("src.worker.tasks.grading_tasks.grade_and_notify_task.delay"),
        ):
            await service.submit_exam(
                str(exam_session.uid), str(uuid4()), str(uuid4()), db
            )

        self.assertEqual(exam_session.end_time, deadline)
        self.assertEqual(exam_session.status, ExamStatus.submitted)

    async def test_committed_submission_survives_temporary_broker_failure(self):
        service = ExamSessionService()
        db = _AsyncSession()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=datetime.now(timezone.utc) + timedelta(minutes=30),
            end_time=None,
        )

        with (
            patch.object(
                service,
                "get_student_session",
                new=AsyncMock(return_value=exam_session),
            ),
            patch(
                "src.worker.tasks.grading_tasks.grade_and_notify_task.delay",
                side_effect=ConnectionError("broker unavailable"),
            ),
            patch("src.exam_session.service.logger.exception") as log_exception,
        ):
            result = await service.submit_exam(
                str(exam_session.uid), str(uuid4()), str(uuid4()), db
            )

        self.assertIs(result, exam_session)
        self.assertEqual(exam_session.status, ExamStatus.submitted)
        db.commit.assert_awaited_once()
        log_exception.assert_called_once()

    async def test_answer_save_cannot_race_past_the_deadline(self):
        service = ExamSessionService()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            exam_uid=uuid4(),
            student_uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=datetime.now(timezone.utc) - timedelta(seconds=1),
        )

        with patch.object(
            service,
            "get_student_session",
            new=AsyncMock(return_value=exam_session),
        ) as get_session:
            with self.assertRaises(HTTPException) as raised:
                await service.choose_options(
                    exam_session_uid=str(exam_session.uid),
                    exam_uid=str(exam_session.exam_uid),
                    student_uid=str(exam_session.student_uid),
                    question_uid=str(uuid4()),
                    selected_option_uids=[],
                    session=_AsyncSession(),
                )

        self.assertEqual(raised.exception.status_code, 409)
        self.assertTrue(get_session.await_args.kwargs["for_update"])


class PeriodicCompletionTests(unittest.TestCase):
    def test_expired_sessions_finalize_at_their_own_deadlines(self):
        now = datetime.now(timezone.utc)
        first = SimpleNamespace(
            uid=uuid4(),
            expected_end_time=now - timedelta(minutes=2),
            end_time=None,
            status=ExamStatus.in_progress,
        )
        second = SimpleNamespace(
            uid=uuid4(),
            expected_end_time=now - timedelta(minutes=1),
            end_time=None,
            status=ExamStatus.in_progress,
        )
        db = _SyncSession([[first, second]])

        finalized = finalize_expired_sessions(db, now)

        self.assertEqual(finalized, [str(first.uid), str(second.uid)])
        self.assertEqual(first.end_time, first.expected_end_time)
        self.assertEqual(second.end_time, second.expected_end_time)
        self.assertEqual(first.status, ExamStatus.submitted)
        self.assertEqual(second.status, ExamStatus.submitted)
        self.assertEqual(db.add.call_count, 2)
        db.commit.assert_called_once()
        sql = str(db.statements[0])
        self.assertIn("exam_session.expected_end_time", sql)
        self.assertIn("exam_session.status", sql)

    def test_ungraded_submissions_are_recovered(self):
        session_uids = [uuid4(), uuid4()]
        db = _SyncSession([session_uids])

        result = find_ungraded_submissions(db)

        self.assertEqual(result, [str(uid) for uid in session_uids])
        sql = str(db.statements[0])
        self.assertIn("exam_session.score IS NULL", sql)
        self.assertIn("exam_session.status", sql)

    def test_celery_beat_runs_completion_reconciliation_every_minute(self):
        schedule = celery_app.conf.beat_schedule["finalize-expired-exam-sessions"]

        self.assertEqual(schedule["schedule"], 60.0)
        self.assertEqual(
            schedule["task"],
            "src.worker.tasks.completion_tasks.finalize_expired_sessions_task",
        )


class GradingIdempotencyTests(unittest.TestCase):
    def test_already_graded_session_is_not_regraded(self):
        exam_session = SimpleNamespace(
            uid=uuid4(),
            status=ExamStatus.submitted,
            score=8.0,
            score_percentage=80.0,
        )
        db = _SyncSession([exam_session])

        with patch.object(
            grade_and_notify_task, "_session", return_value=nullcontext(db)
        ):
            result = grade_and_notify_task.run(str(exam_session.uid))

        self.assertEqual(result["status"], "already_graded")
        self.assertEqual(len(db.statements), 1)
        db.commit.assert_not_called()

    def test_grading_persists_answer_correctness_and_score(self):
        question_uid = uuid4()
        correct_option_uid = uuid4()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            exam_uid=uuid4(),
            status=ExamStatus.submitted,
            score=None,
            score_percentage=None,
        )
        question = SimpleNamespace(uid=question_uid, marks=4)
        answer = SimpleNamespace(
            question_uid=question_uid,
            selected_option_uids=[str(correct_option_uid)],
            is_correct=None,
        )
        option = SimpleNamespace(uid=correct_option_uid)
        db = _SyncSession([exam_session, [question], [answer], [option]])

        with patch.object(
            grade_and_notify_task, "_session", return_value=nullcontext(db)
        ):
            result = grade_and_notify_task.run(str(exam_session.uid))

        self.assertEqual(result["status"], "graded")
        self.assertEqual(exam_session.score, 4.0)
        self.assertEqual(exam_session.score_percentage, 100.0)
        self.assertTrue(answer.is_correct)
        db.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
