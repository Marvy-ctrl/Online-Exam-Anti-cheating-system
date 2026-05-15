# ExamGuard — Task Tracker

## Phase 0 — Face Verification Accuracy (CURRENT)

### Backend
- [x] Add `FACE_SIMILARITY_THRESHOLD` to `config.py`
- [x] Create `backend/src/students/face_utils.py` (`check_image_quality`, `get_face_embedding`, `average_embeddings`)
- [x] Update `backend/src/students/schema.py` — `RegisterFaceRequest` accepts `face_images: list[str]`
- [x] Rewrite `StudentService.register_face` — 5 images → quality gate → average → store
- [x] Replace hardcoded thresholds in `exam_session/service.py` with `Config.FACE_SIMILARITY_THRESHOLD`

### Frontend
- [x] Install `face-api.js` + download model weights
- [x] Build `FaceEnrollmentFlow` component (5-step circular progress UI)
- [x] Per-step client checks: brightness, face detected, eyes open, pose hint
- [x] Auto-capture trigger + step animation
- [x] Wire completed 5-image batch to `POST /register-face`
- [x] Replace old single-capture enrollment page with new flow

---

## Phase 1 — Configuration & Security Hardening
- [ ] `config.py` — `extra="forbid"`, split JWT secret, add MinIO/Celery settings
- [ ] `core/crypto.py` — AES-256-GCM encrypt/decrypt
- [ ] `core/logger.py` — structlog JSON logger

## Phase 2 — Database Schema & Migrations
- [ ] `models.py` — pgvector, soft deletes, object_key snapshots
- [ ] Alembic migration

## Phase 3 — Celery Background Processing
- [x] `worker/celery_app.py`
- [x] `worker/tasks.py` — verify_face_task, upload_snapshot_task, send_result_email_task

## Phase 4 — Student Auth Scoping
- [x] Scoped JWT dependencies
- [x] Auth on all student endpoints
- [x] Remove duplicate route

## Phase 5 — Exam Shell Decomposition
- [ ] Decompose 710-line exam page
- [ ] CSP headers in middleware

## Phase 6 — Service Wiring (Celery + Crypto)
- [ ] service.py — dispatch to Celery, encrypt embeddings
- [ ] Remove all print() statements
