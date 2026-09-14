import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import HTTPException

from src.exam_session.routes import (
    choose_options,
    exam_monitor_websocket_endpoint,
    exam_websocket_endpoint,
    exam_session_router,
    session_service,
)
from src.exam_session.schema import ChooseOptionsRequest
from src.exam_session.service import ExamSessionService
from src.db.models import ExamStatus


class _Result:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        return self.value


class _Session:
    def __init__(self, value):
        self.value = value
        self.statements = []

    async def exec(self, statement):
        self.statements.append(statement)
        return _Result(self.value)


class _SequenceSession:
    def __init__(self, values):
        self.values = iter(values)
        self.add = unittest.mock.Mock()
        self.commit = AsyncMock()

    async def exec(self, statement):
        return _Result(next(self.values))


class ExamSessionAuthorizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_owned_exam_is_returned(self):
        expected_exam = object()
        session = _Session(expected_exam)

        result = await ExamSessionService().get_owned_exam(
            str(uuid4()), str(uuid4()), session
        )

        self.assertIs(result, expected_exam)
        sql = str(session.statements[0])
        self.assertIn("exam.uid", sql)
        self.assertIn("exam.admin_uid", sql)

    async def test_foreign_or_missing_exam_is_hidden_as_not_found(self):
        with self.assertRaises(HTTPException) as raised:
            await ExamSessionService().get_owned_exam(
                str(uuid4()), str(uuid4()), _Session(None)
            )

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Exam not found")

    async def test_owned_session_query_joins_through_exam_owner(self):
        expected_session = object()
        session = _Session(expected_session)

        result = await ExamSessionService().get_owned_session(
            str(uuid4()), str(uuid4()), session
        )

        self.assertIs(result, expected_session)
        sql = str(session.statements[0])
        self.assertIn("JOIN exam", sql)
        self.assertIn("exam_session.uid", sql)
        self.assertIn("exam.admin_uid", sql)

    async def test_foreign_or_missing_session_is_hidden_as_not_found(self):
        with self.assertRaises(HTTPException) as raised:
            await ExamSessionService().get_owned_session(
                str(uuid4()), str(uuid4()), _Session(None)
            )

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Exam session not found")

    async def test_malformed_resource_id_is_not_a_server_error(self):
        with self.assertRaises(HTTPException) as raised:
            await ExamSessionService().get_owned_session(
                "not-a-uuid", str(uuid4()), _Session(None)
            )

        self.assertEqual(raised.exception.status_code, 404)

    async def test_student_session_query_matches_all_three_scopes(self):
        expected_session = object()
        session = _Session(expected_session)

        result = await ExamSessionService().get_student_session(
            str(uuid4()), str(uuid4()), str(uuid4()), session
        )

        self.assertIs(result, expected_session)
        sql = str(session.statements[0])
        self.assertIn("exam_session.uid", sql)
        self.assertIn("exam_session.exam_uid", sql)
        self.assertIn("exam_session.student_uid", sql)

    async def test_cross_student_session_is_hidden_as_not_found(self):
        with self.assertRaises(HTTPException) as raised:
            await ExamSessionService().get_student_session(
                str(uuid4()), str(uuid4()), str(uuid4()), _Session(None)
            )

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Exam session not found")


class SensitiveRouteDependencyTests(unittest.TestCase):
    def test_sensitive_http_routes_require_token_and_admin_role(self):
        sensitive_names = {
            "update_score",
            "get_exam_results",
            "get_session_details",
            "send_result_email",
            "bulk_send_results",
            "fetch_snapshot_image",
        }

        routes = {
            route.name: route
            for route in exam_session_router.routes
            if route.name in sensitive_names
        }
        self.assertEqual(set(routes), sensitive_names)

        for name, route in routes.items():
            dependency_types = {
                type(dependency.call).__name__
                for dependency in route.dependant.dependencies
            }
            with self.subTest(route=name):
                self.assertIn("AccessTokenBearer", dependency_types)
                self.assertIn("Role", dependency_types)


class MonitorWebSocketAuthorizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_monitor_rejects_connection_without_admin_cookie(self):
        websocket = AsyncMock()
        websocket.cookies = {}

        await exam_monitor_websocket_endpoint(websocket, str(uuid4()), AsyncMock())

        websocket.close.assert_awaited_once_with(
            code=1008,
            reason="Missing token",
        )

    async def test_monitor_rejects_admin_who_does_not_own_exam(self):
        websocket = AsyncMock()
        websocket.cookies = {"access_token": "signed-token"}
        token_data = {
            "role": "admin",
            "refresh": False,
            "jti": str(uuid4()),
            "user": {"uid": str(uuid4())},
        }

        with (
            patch("src.exam_session.routes.decode_token", return_value=token_data),
            patch(
                "src.exam_session.routes.token_in_blocklist",
                new=AsyncMock(return_value=False),
            ),
            patch.object(
                session_service,
                "get_owned_exam",
                new=AsyncMock(side_effect=HTTPException(404, "Exam not found")),
            ),
        ):
            await exam_monitor_websocket_endpoint(
                websocket, str(uuid4()), AsyncMock()
            )

        websocket.close.assert_awaited_once_with(
            code=1008,
            reason="Unauthorized",
        )


class StudentSessionRouteTests(unittest.IsolatedAsyncioTestCase):
    async def test_answer_body_cannot_override_token_session(self):
        token_session_uid = str(uuid4())
        request = ChooseOptionsRequest(
            exam_session_uid=str(uuid4()),
            selected_option_uids=[],
        )

        with patch.object(
            session_service,
            "choose_options",
            new=AsyncMock(),
        ) as save_answer:
            with self.assertRaises(HTTPException) as raised:
                await choose_options(
                    exam_uid=str(uuid4()),
                    student_uid=str(uuid4()),
                    question_uid=str(uuid4()),
                    request_data=request,
                    session=AsyncMock(),
                    token_data={"session_uid": token_session_uid},
                )

        self.assertEqual(raised.exception.status_code, 403)
        save_answer.assert_not_awaited()

    async def test_student_websocket_requires_session_scope(self):
        websocket = AsyncMock()
        websocket.cookies = {"exam_auth_token": "signed-token"}
        exam_uid = str(uuid4())
        student_uid = str(uuid4())

        with patch(
            "src.exam_session.routes.decode_token",
            return_value={
                "role": "student",
                "exam_uid": exam_uid,
                "sub": student_uid,
            },
        ):
            await exam_websocket_endpoint(
                websocket, exam_uid, student_uid, AsyncMock()
            )

        websocket.close.assert_awaited_once_with(
            code=1008,
            reason="Invalid token scope",
        )

    async def test_answer_rejects_option_from_another_question(self):
        exam_uid = uuid4()
        exam_session = SimpleNamespace(
            uid=uuid4(),
            exam_uid=exam_uid,
            student_uid=uuid4(),
            status=ExamStatus.in_progress,
            expected_end_time=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        question = SimpleNamespace(uid=uuid4(), exam_uid=exam_uid)
        session = _SequenceSession([exam_session, question, []])

        with self.assertRaises(HTTPException) as raised:
            await ExamSessionService().choose_options(
                exam_session_uid=str(exam_session.uid),
                exam_uid=str(exam_uid),
                student_uid=str(exam_session.student_uid),
                question_uid=str(question.uid),
                selected_option_uids=[str(uuid4())],
                session=session,
            )

        self.assertEqual(raised.exception.status_code, 400)
        session.add.assert_not_called()
        session.commit.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
