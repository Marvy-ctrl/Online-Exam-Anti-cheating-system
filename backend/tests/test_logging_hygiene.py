import ast
import unittest
from pathlib import Path
from unittest.mock import patch

from src.auth.email import send_email


class ApplicationLoggingTests(unittest.TestCase):
    def test_application_modules_do_not_call_print(self):
        source_root = Path(__file__).parents[1] / "src"
        excluded_cli_scripts = {source_root / "check_redis.py"}
        offenders = []

        for path in source_root.rglob("*.py"):
            if path in excluded_cli_scripts:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Name)
                    and node.func.id == "print"
                ):
                    offenders.append(f"{path.relative_to(source_root)}:{node.lineno}")

        self.assertEqual(offenders, [])

    def test_smtp_failure_log_excludes_recipient_and_message_content(self):
        recipient = "student@example.test"
        secret_content = "https://examloc.test/exam?token=signed-secret"

        with (
            patch("src.auth.email.Config.SMTP_PORT", 465),
            patch("src.auth.email.smtplib.SMTP_SSL", side_effect=OSError("offline")),
            patch("src.auth.email.logger.exception") as log_exception,
        ):
            with self.assertRaisesRegex(ValueError, "SMTP delivery failed"):
                send_email(recipient, "Exam link", secret_content)

        logged = repr(log_exception.call_args)
        self.assertNotIn(recipient, logged)
        self.assertNotIn(secret_content, logged)
        log_exception.assert_called_once_with(
            "SMTP delivery failed",
            error_type="OSError",
        )


if __name__ == "__main__":
    unittest.main()
