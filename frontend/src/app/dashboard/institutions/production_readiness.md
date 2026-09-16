# ExamLoc v2 engineering readiness

Last aligned with the implementation: 2026-09-16.

This document is an engineering status record, not a certification that ExamLoc is suitable for unsupervised production use or high-stakes disciplinary decisions.

## Completed foundations

| Area | Current implementation |
|---|---|
| Authentication | Signed JWTs with separate examiner and student secrets, explicit role checks, and session-scoped student tokens |
| Tenant isolation | Institution/exam ownership checks across administrator data, results, evidence, questions, and analytics |
| Student session protection | Answer, violation, face-check, and submission operations verify the authenticated session identity |
| Exam completion | PostgreSQL `expected_end_time` is authoritative; Celery Beat finalizes abandoned expired sessions |
| Grading | Submission dispatches grading to the dedicated Celery queue |
| Face processing | Periodic live frames are processed by the dedicated face worker |
| Biometric storage | Averaged 128-dimensional templates are encrypted with AES-256-GCM before persistence |
| Evidence | Clean frames are discarded; violation snapshots are stored in MinIO/local fallback, deduplicated, access-controlled, and expired |
| Configuration | Required settings are validated with `extra="forbid"`; secrets, threshold, storage, queue, and retention settings are environment-driven |
| Logging | Backend logging is standardized and covered by logging-hygiene regression tests |
| Frontend architecture | Student exam logic, exam management, institution workspace, session audit, and question management are decomposed into hooks and focused components |
| Testing | Core lifecycle, authorization, tenant boundaries, completion, encryption, evidence, migrations, and frontend behaviors have automated coverage |
| Evaluation | API, biometric, face-worker, and repeated-observation harnesses exist with privacy and reproduction guidance |

## Important operational boundaries

- The default `FACE_SIMILARITY_THRESHOLD` remains `0.40`. The FEI report characterizes its trade-off but does not authorize a production change.
- Frame-level biometric events are review signals, not proof of cheating or identity fraud.
- The repeated-observation policies have only been evaluated offline. They are not active production rules.
- Local Docker credentials and `COOKIE_SECURE=false` are development settings only.
- Real deployment requires HTTPS, unique secrets, database backups, reviewed migrations, consent, access governance, monitoring, and a legally appropriate retention policy.
- Rate limiting, broader browser security headers, operational alerting, disaster-recovery exercises, and a consented prospective biometric pilot remain production-hardening work.

## Evidence and reproducibility

Do not publish general capacity or biometric-accuracy claims from screenshots or one raw run. Use only reviewed reports under `performance/`, retain the configuration and sample counts, and state the environment and limitations beside every result.

## Remaining product work

- Add session-level risk summaries based on accumulated evidence.
- Improve examiner review prioritization and consistency.
- Add exportable incident/evidence reports with privacy controls.
- Expand integrity, completion, and operational-health analytics.
- Prospectively validate repeated-observation policies before changing enforcement behavior.
