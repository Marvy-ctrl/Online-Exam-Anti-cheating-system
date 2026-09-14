"""Locust entry point for ExamLoc performance scenarios."""

from performance.scenarios.admin_reads import AdminReadUser


__all__ = ["AdminReadUser"]
