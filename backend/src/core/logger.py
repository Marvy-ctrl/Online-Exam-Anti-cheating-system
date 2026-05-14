"""
core/logger.py — Structured JSON logging configuration.

Rules:
- All application code must use `get_logger(__name__)` from this module.
- Never use print() anywhere in the application.
- Fields that must NEVER appear in logs:
    face encodings, JWT payloads, password hashes, AES keys, exam question text.
"""

import logging
import sys
import structlog


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structlog for JSON-formatted structured logging.
    Call this once at application startup in lifespan().
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        # In production, render as JSON. In dev, render as coloured console output.
        processor=structlog.dev.ConsoleRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Return a structlog logger bound to the given module name.
    Usage: logger = get_logger(__name__)
    """
    return structlog.get_logger(name)
