"""Paced administrator login workload for authentication testing."""

import os

from locust import HttpUser, constant_pacing, task


def _required_setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    raise RuntimeError(f"Required load-test setting is missing: {name}")


class AdminLoginUser(HttpUser):
    """Attempt one administrator login per second when capacity permits."""

    host = os.getenv("LOADTEST_HOST")
    wait_time = constant_pacing(1)

    def on_start(self) -> None:
        self.credentials = {
            "email": _required_setting("LOADTEST_ADMIN_EMAIL"),
            "password": _required_setting("LOADTEST_ADMIN_PASSWORD"),
        }

    @task
    def login(self) -> None:
        with self.client.post(
            "/api/v1/auth/login",
            json=self.credentials,
            name="POST /api/v1/auth/login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Load-test login failed with HTTP {response.status_code}"
                )
                return

            try:
                role = response.json()["user_details"]["role"]
            except (KeyError, TypeError, ValueError):
                response.failure("Login response did not contain a user role")
                return

            if role != "admin":
                response.failure("Load-test account is not an administrator")
