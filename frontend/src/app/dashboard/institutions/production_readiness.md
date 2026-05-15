# ExamGuard — Production Readiness Assessment

> **Verdict: ~35% production-ready.** The system is demo-capable end-to-end, but has five
> critical security/architecture violations that make it unsafe to run against real students.
> These are not nice-to-haves — they are blockers.

---

## What Works Right Now (End-to-End)

| Feature | Status | Notes |
|---|---|---|
| Examiner registration + email verification | ✅ Working | bcrypt passwords, itsdangerous tokens |
| Login / logout / refresh token | ✅ Working | httpOnly cookie-based, 15min access / 2-day refresh |
| Change password / forgot+reset password | ✅ Working | |
| Institution management | ✅ Working | Cloudinary for logos |
| Subject + exam CRUD | ✅ Working | |
| Question + options CRUD | ✅ Working | |
| Student pre-enrolment (examiner creates records) | ✅ Working | |
| Student enrolment link validation (time window) | ✅ Working | |
| Student face registration | ✅ Working | Single frame, stores embedding |
| Exam entry (face gate, timing check) | ✅ Working | |
| Live exam shell (questions, navigation) | ✅ Working | |
| Answer save with 3-retry logic | ✅ Working | |
| Tab-switch + focus-loss violation logging | ✅ Working | |
| Periodic face verification (every 20s) | ✅ Working | |
| WebSocket student ↔ examiner monitor relay | ✅ Working | Basic |
| Exam submission + MCQ autograding | ✅ Working | Exact match, marks-weighted |
| Manual score override by admin | ✅ Working | |
| Session detail + results view | ✅ Working | |
| Result email dispatch | ✅ Working | Via BackgroundTasks |
| Analytics router | ✅ Exists | |
| 9 Alembic migrations | ✅ Applied | |

---

## Critical Blockers (Cannot Go Live Without These)

### 🔴 BLOCKER 1 — Face inference runs synchronously in FastAPI route handlers

`students/service.py:register_face()` and `exam_session/service.py:verify_face_loop()` both call `face_recognition.face_locations()` and `face_recognition.face_encodings()` directly inside the async service, which executes in the FastAPI event loop.

`face_recognition` is a CPU-bound, blocking operation (~150–400ms per frame). Every call freezes the entire event loop. Under concurrent exam load (100+ students), this kills all other requests while one face check is running.

**Fix:** Move all face inference into a Celery worker. The route enqueues the task and returns immediately.

---

### 🔴 BLOCKER 2 — Zero authentication on student exam endpoints

Every student-facing exam endpoint has no auth dependency:

```python
# exam_session/routes.py — no Depends() on auth at all
async def start_exam(exam_uid: str, student_uid: str, ...):
async def choose_options(exam_uid: str, student_uid: str, ...):
async def submit_answers(exam_uid: str, student_uid: str, ...):
async def verify_face(exam_uid: str, student_uid: str, ...):
async def log_violation(exam_uid: str, student_uid: str, ...):
```

Any HTTP client that knows (or guesses) a UUID can submit answers, log fake violations, or terminate another student's session. UUIDs are not a security mechanism.

**Fix:** Student exam endpoints need a scoped JWT dependency. The student receives a session token on exam start; all subsequent calls authenticate against it.

---

### 🔴 BLOCKER 3 — Single JWT secret, no scope separation

`config.py` has one `JWT_SECRET`. Examiner tokens and student tokens are signed with the same key. A student token can be used to call examiner endpoints and vice versa.

**Fix:** Separate `JWT_SECRET_EXAMINER` and `JWT_SECRET_STUDENT` in config. Examiner endpoints reject student-scoped tokens at the dependency level.

---

### 🔴 BLOCKER 4 — Face encodings stored plaintext

`embedding_vector` is a plain `ARRAY(Float)` column. Face encodings are biometric PII. If the database is dumped or accessed without authorisation, every student's biometric data is exposed in plaintext.

**Fix:** AES-256 encryption through `core/crypto.py` before any write, decrypt on read. Per-institution key.

---

### 🔴 BLOCKER 5 — Violation snapshots stored as truncated base64 in the database

```python
# exam_session/service.py
image_path=f"data:image/jpeg;base64,{live_image_base64[:50]}..."
```

The snapshot is stored as 50 characters of truncated base64 — meaning it's effectively destroyed. The snapshot record exists but is unusable for examiner review. The actual image data is silently discarded.

**Fix:** Upload full frame to MinIO, store the object key. Generate presigned URL (15-min expiry) when examiner retrieves it.

---

## High-Severity Issues (Needed Before Any Real Exam)

### 🟠 Hardcoded similarity thresholds

`verify_live_face()` uses `threshold = 0.50`. `verify_face_loop()` uses `distance > 0.60`. Two different values, neither from config. The architecture specifies `FACE_SIMILARITY_THRESHOLD` in `.env`.

### 🟠 `extra="ignore"` on settings

```python
model_config = SettingsConfigDict(env_file="backend/src/.env", extra="ignore")
```

A typo in `.env` (e.g., `JWT_SECRETT=...`) silently passes through. The server starts with the wrong config. Must be `extra="forbid"`.

### 🟠 No Celery — result emails have no retry or idempotency

`BackgroundTasks` runs in FastAPI's thread pool. If the process crashes mid-send, the email is lost. There is no retry. There is no idempotency guard. Running the task twice sends two emails.

### 🟠 `secure=False` on all cookies

```python
response.set_cookie(key="access_token", ..., secure=False)
```

Access and refresh tokens will be transmitted over plain HTTP. On a production Hetzner VPS behind Nginx with TLS, this must be `secure=True`.

### 🟠 Face encoding stored as `ARRAY(Float)`, not `pgvector`

Cosine distance queries (`<=>`) for deduplication checking require `vector(128)` with an IVFFlat index. `ARRAY(Float)` has no vector similarity operator.

---

## Medium Issues (Before Scale / Second Institution)

| Issue | Location | Impact |
|---|---|---|
| `print()` / `console.log()` throughout | All modules | No structured logs, no searchability, debug data in prod |
| Duplicate route `/{exam_uid}/identify` registered twice | `exam_session/routes.py:179–203` | FastAPI silently uses the second; the first is dead code |
| Exam shell page is 710 lines — single component | `exam/[exam_uid]/[enrollment_uid]/page.tsx` | Unmaintainable; one bug affects everything |
| All API calls are inline `fetch()` in components | Exam shell page | No centralised error handling, no retry strategy |
| Timer uses `sessionStorage`, lost on hard refresh | Exam shell page | Student loses timer on accidental refresh; no server-side timer endpoint |
| No soft deletes on `Exam`, `Question`, `ExamEnrollment` | `db/models.py` | Hard deletes cascade and destroy audit trail |
| Face check interval 20s (not 60s per spec) | Exam shell page | Sends 3× more frames than designed; higher CPU load on server |
| No rate limiting on any endpoint | Entire API | `/verify-face` can be hammered from a script |
| No CSP headers | Frontend | XSS not mitigated |
| `api.ts` is almost entirely commented-out dead code | `frontend/src/lib/api.ts` | The apiFetch wrapper exists but exam shell ignores it entirely and calls `fetch()` directly |

---

## Production Distance Summary

```
Authentication & Auth Flow       ████████░░  80%  (solid, needs scope split)
Database Schema                  ██████░░░░  60%  (missing pgvector, soft deletes, encryption)
Face Pipeline                    ███░░░░░░░  30%  (works but sync, wrong storage, no Celery)
API Security                     ██░░░░░░░░  20%  (no auth on student endpoints, single secret)
Task Queue / Reliability         ██░░░░░░░░  20%  (BackgroundTasks ≠ Celery)
Frontend Architecture            ████░░░░░░  40%  (works but 710-line monolith, no types)
Observability / Logging          █░░░░░░░░░  10%  (all print statements)
Deployment Readiness             ██░░░░░░░░  20%  (no Docker, secure=False, no Nginx config)

Overall                          ~35%
```

---

## What the Refactor Must Deliver (Priority Order)

1. **Celery + Redis** — move face inference and email dispatch off the request cycle
2. **Student auth** — scoped JWT (separate secret), session token on exam start
3. **pgvector migration** — `ARRAY(Float)` → `vector(128)` with IVFFlat index
4. **MinIO for snapshots** — full frame upload, presigned URL retrieval
5. **AES-256 face encoding encryption** — `core/crypto.py`, per-institution key
6. **Config hardening** — `extra="forbid"`, scoped JWT secrets, threshold from env
7. **Structured logging** — replace all `print()` with `structlog`
8. **Fix duplicate route + cookies `secure=True`**
9. **Frontend decomposition** — break 710-line exam page into components
10. **Soft deletes** — `deleted_at` on `Exam`, `Question`, `ExamEnrollment`
