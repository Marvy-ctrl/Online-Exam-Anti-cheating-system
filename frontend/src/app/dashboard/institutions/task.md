# ExamLoc v2 implementation tracker

Last aligned with the implementation: 2026-09-16.

## Completed engineering stages

- [x] Administrator and student authorization hardening.
- [x] Institution/exam ownership enforcement and protected evidence access.
- [x] Server-authoritative deadlines and periodic expired-session finalization.
- [x] Asynchronous grading and dedicated worker routing.
- [x] Signed-token face enrollment with 3–5 captures and multi-image averaging.
- [x] AES-256-GCM encryption for persisted face templates.
- [x] Violation-only evidence retention, deduplication, and scheduled expiry.
- [x] Authoritative Alembic configuration and migration regression coverage.
- [x] Student exam decomposition into timer, answer-sync, browser, webcam, and WebSocket hooks.
- [x] Administrator exam, institution, audit, and question-management decomposition.
- [x] Backend lifecycle, authorization, ownership, completion, biometric, retention, migration, and logging tests.
- [x] Frontend component/hook tests for key refactored workspaces.
- [x] Reproducible API, biometric, face-worker, and session-policy evaluation harnesses.
- [x] Root, backend, frontend, performance, privacy, and research documentation alignment.

## Research decisions

- [x] Keep the deployed face-distance threshold at `0.40` pending broader evidence.
- [x] Treat clean frames as transient and retain only deduplicated violation evidence.
- [x] Keep frame-level events distinct from session-level conclusions.
- [ ] Run a prospective, consented sequential-capture pilot for the candidate repeated-observation policies.

## Next product stage

- [ ] Add examiner-facing session risk summaries based on accumulated events.
- [ ] Improve evidence-review prioritization and workflow consistency.
- [ ] Add privacy-controlled incident/evidence export.
- [ ] Expand integrity, completion, and operational-health analytics.
- [ ] Add production rate limiting, security headers, alerting, backup/restore drills, and operational runbooks.
