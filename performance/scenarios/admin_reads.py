"""Pre-authenticated, read-only administrator workload for API testing."""

import os

# Locust must initialize gevent before requests imports urllib3.
from locust import HttpUser, between, events, task
from locust.exception import StopUser
import requests


_admin_cookies: dict[str, str] = {}


def _required_setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    raise RuntimeError(f"Required load-test setting is missing: {name}")


@events.test_start.add_listener
def authenticate_admin_once(environment, **_kwargs) -> None:
    """Create one admin session before read-only virtual users are spawned."""

    host = _required_setting("LOADTEST_HOST").rstrip("/")
    response = requests.post(
        f"{host}/api/v1/auth/login",
        json={
            "email": _required_setting("LOADTEST_ADMIN_EMAIL"),
            "password": _required_setting("LOADTEST_ADMIN_PASSWORD"),
        },
        timeout=30,
    )

    if response.status_code != 200:
        raise RuntimeError(
            "Load-test setup login failed with HTTP "
            f"{response.status_code}"
        )

    try:
        role = response.json()["user_details"]["role"]
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeError(
            "Load-test setup login did not return a user role"
        ) from exc

    if role != "admin":
        raise RuntimeError(
            "LOADTEST_ADMIN_EMAIL must belong to an administrator"
        )

    cookies = response.cookies.get_dict()
    if not cookies:
        raise RuntimeError("Load-test setup login did not return a cookie")

    _admin_cookies.clear()
    _admin_cookies.update(cookies)


class AdminReadUser(HttpUser):
    """Model an administrator reviewing one institution and exam workspace."""

    host = os.getenv("LOADTEST_HOST")
    wait_time = between(1, 3)

    def on_start(self) -> None:
        if not _admin_cookies:
            raise StopUser()

        self.client.cookies.update(_admin_cookies)
        self.exam_uid = _required_setting("LOADTEST_EXAM_UID")
        self.institution_uid = _required_setting(
            "LOADTEST_INSTITUTION_UID"
        )

    def _read(self, path: str, metric_name: str, **kwargs) -> None:
        with self.client.get(
            path,
            name=metric_name,
            catch_response=True,
            **kwargs,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Unexpected HTTP {response.status_code}")

    @task(2)
    def inspect_current_user(self) -> None:
        self._read("/api/v1/auth/me", "GET /api/v1/auth/me")

    @task(4)
    def list_institution_exams(self) -> None:
        self._read(
            "/api/v1/exam/get_all_exams",
            "GET /api/v1/exam/get_all_exams",
            params={"institution_uid": self.institution_uid},
        )

    @task(4)
    def inspect_exam(self) -> None:
        self._read(
            f"/api/v1/exam/{self.exam_uid}",
            "GET /api/v1/exam/[exam_uid]",
        )

    @task(3)
    def list_exam_students(self) -> None:
        self._read(
            f"/api/v1/exam/{self.exam_uid}/students",
            "GET /api/v1/exam/[exam_uid]/students",
        )

    @task(3)
    def list_exam_questions(self) -> None:
        self._read(
            f"/api/v1/questions/{self.exam_uid}",
            "GET /api/v1/questions/[exam_uid]",
        )
