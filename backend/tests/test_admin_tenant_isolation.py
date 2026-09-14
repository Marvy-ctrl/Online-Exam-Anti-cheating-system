import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from src.analytics.router import analytics_router
from src.analytics.service import AnalyticsService
from src.exams.routes import exam_router
from src.exams.service import ExamService
from src.institutions.router import institution_router
from src.questions.routes import questions_router
from src.questions.service import QuestionService


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class _Session:
    def __init__(self, values):
        self.values = iter(values)
        self.statements = []
        self.add = Mock()
        self.delete = AsyncMock()
        self.commit = AsyncMock()

    async def exec(self, statement):
        self.statements.append(statement)
        return _Result(next(self.values))


class QuestionOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def test_question_lookup_joins_through_owned_exam(self):
        expected_question = object()
        session = _Session([expected_question])

        result = await QuestionService().get_owned_question(
            str(uuid4()), str(uuid4()), session
        )

        self.assertIs(result, expected_question)
        sql = str(session.statements[0])
        self.assertIn("JOIN exam", sql)
        self.assertIn("question.uid", sql)
        self.assertIn("exam.admin_uid", sql)

    async def test_foreign_question_cannot_be_updated(self):
        session = _Session([None])
        update = SimpleNamespace(model_dump=lambda **kwargs: {"question_text": "x"})

        result = await QuestionService().update_question(
            str(uuid4()), update, str(uuid4()), session
        )

        self.assertIsNone(result)
        session.add.assert_not_called()
        session.commit.assert_not_awaited()

    async def test_bulk_delete_authorizes_entire_batch_before_deleting(self):
        owned_id = uuid4()
        foreign_id = uuid4()
        session = _Session([[owned_id]])

        result = await QuestionService().bulk_delete_questions(
            [owned_id, foreign_id], str(uuid4()), session
        )

        self.assertFalse(result)
        self.assertEqual(len(session.statements), 1)
        session.commit.assert_not_awaited()


class ExamCreationOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def test_subject_cannot_be_created_in_foreign_institution(self):
        session = _Session([None])
        subject = SimpleNamespace(
            institution_uid=uuid4(),
            model_dump=lambda: {"name": "Physics", "institution_uid": uuid4()},
        )

        result = await ExamService().create_subject(
            subject, str(uuid4()), session
        )

        self.assertIsNone(result)
        session.add.assert_not_called()
        session.commit.assert_not_awaited()

    async def test_bulk_unenroll_rejects_partial_batch(self):
        owned_id = uuid4()
        missing_id = uuid4()
        enrollment = SimpleNamespace(uid=owned_id)
        session = _Session([SimpleNamespace(uid=uuid4()), [enrollment]])

        result = await ExamService().bulk_remove_students_from_exam(
            session,
            str(uuid4()),
            [owned_id, missing_id],
            str(uuid4()),
        )

        self.assertFalse(result)
        session.delete.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_exam_cannot_use_subject_from_another_institution(self):
        institution = SimpleNamespace(uid=uuid4())
        session = _Session([institution, None])
        exam = SimpleNamespace(
            institution_uid=institution.uid,
            subject_uid=uuid4(),
        )

        result = await ExamService().create_exam(exam, str(uuid4()), session)

        self.assertIsNone(result)
        session.add.assert_not_called()
        session.commit.assert_not_awaited()

    async def test_foreign_exam_cannot_receive_pre_enrollments(self):
        session = _Session([None])

        result = await ExamService().pre_enroll_students(
            SimpleNamespace(), str(uuid4()), str(uuid4()), session
        )

        self.assertIsNone(result)
        session.add.assert_not_called()
        session.commit.assert_not_awaited()


class InstitutionAnalyticsOwnershipTests(unittest.IsolatedAsyncioTestCase):
    async def test_foreign_institution_analytics_stop_before_data_queries(self):
        session = _Session([None])

        result = await AnalyticsService().get_institution_analytics(
            session, str(uuid4()), str(uuid4())
        )

        self.assertIsNone(result)
        self.assertEqual(len(session.statements), 1)
        sql = str(session.statements[0])
        self.assertIn("institution.uid", sql)
        self.assertIn("institution.admin_uid", sql)

    def test_institution_analytics_route_requires_admin_role(self):
        route = next(
            route
            for route in analytics_router.routes
            if route.name == "get_institution_analytics"
        )
        dependency_types = {
            type(dependency.call).__name__
            for dependency in route.dependant.dependencies
        }
        self.assertIn("AccessTokenBearer", dependency_types)
        self.assertIn("Role", dependency_types)


class AdminRouteGuardTests(unittest.TestCase):
    def test_every_admin_route_requires_authentication_and_admin_role(self):
        for router in (
            exam_router,
            questions_router,
            institution_router,
            analytics_router,
        ):
            for route in router.routes:
                with self.subTest(path=route.path, method=route.methods):
                    dependency_types = {
                        type(dependency.call).__name__
                        for dependency in route.dependant.dependencies
                    }
                    self.assertIn("AccessTokenBearer", dependency_types)
                    self.assertIn("Role", dependency_types)


if __name__ == "__main__":
    unittest.main()
