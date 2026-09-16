# ExamLoc backend

The backend is a FastAPI application backed by PostgreSQL. Redis and Celery provide asynchronous execution, while PostgreSQL remains authoritative for application state. MinIO stores retained violation evidence.

## Runtime services

| Service | Responsibility | Queue/state |
|---|---|---|
| FastAPI API | HTTP, authenticated WebSockets, validation, authorization | Reads/writes PostgreSQL |
| Face worker | Decode, detect, encode, compare, record biometric violations | `face` |
| Grading worker | Grade submitted exams and run completion/evidence jobs | `grading` |
| Email worker | Enrollment, exam, reset, and result email | `default` |
| Celery Beat | Schedule expired-session recovery and evidence cleanup | Enqueues periodic jobs |
| PostgreSQL | Exams, enrollment, sessions, answers, results, audit state | Authoritative |
| Redis | Celery broker and temporary task results | Non-authoritative |
| MinIO | Retained violation snapshot objects | Expiring evidence |

## Configuration

`src/config.py` validates settings at process startup. For local non-container execution, copy `src/.env.example` to `src/.env`. Docker Compose reads the repository-root `.env` instead.

Security-sensitive settings include:

- `JWT_SECRET_EXAMINER` and `JWT_SECRET_STUDENT`: separate signing secrets.
- `ENCRYPTION_KEY`: exactly 64 hexadecimal characters for AES-256-GCM.
- `COOKIE_SECURE`: `false` only for local HTTP; use `true` behind HTTPS.
- `FACE_SIMILARITY_THRESHOLD`: Euclidean distance threshold, currently `0.40`.
- `FACE_ENROLLMENT_MIN_PASSING`: minimum accepted enrollment captures, default `3`.
- `SNAPSHOT_RETENTION_DAYS`: retained violation-evidence lifetime, default `7`.



## Run outside Docker

From the repository root:

```bash
python3 -m venv env
source env/bin/activate
python -m pip install -r backend/requirements.txt
cp backend/src/.env.example backend/src/.env
```

Start only the process you need:

```bash
cd backend
uvicorn src:app --host 0.0.0.0 --port 8000 --reload
celery -A src.worker.celery_app worker --loglevel=info --queues=face --pool=solo --concurrency=1
celery -A src.worker.celery_app worker --loglevel=info --queues=grading --pool=solo --concurrency=1
celery -A src.worker.celery_app worker --loglevel=info --queues=default --pool=solo --concurrency=2
celery -A src.worker.celery_app beat --loglevel=info
```

PostgreSQL, Redis, and MinIO must already be available at the configured addresses. Docker Compose is the simpler way to run the complete local topology.

## Database migrations

The authoritative Alembic configuration is `backend/alembic.ini`, and the authoritative revision history is `backend/alembic/`.

From `backend/`:

```bash
alembic current
alembic upgrade head
```

Take a backup before migrating an existing database. Never stamp a database merely to silence a migration error; follow the existing-database notes in the repository's `DEPLOY.md`.

## Tests

The test suite uses `unittest`, including asynchronous test cases:

```bash
cd backend
PYTHONPATH=. ../env/bin/python -m unittest discover -s tests -v
```

Coverage currently targets:

- starting, answering, and submitting exams;
- student session ownership and administrator tenant boundaries;
- periodic completion and asynchronous grading dispatch;
- signed face-enrollment authorization;
- AES-256-GCM embedding persistence and legacy migration behavior;
- violation snapshot deduplication and retention cleanup;
- authoritative migration history and structured logging hygiene.

## Biometric lifecycle

1. A signed enrollment token resolves the enrollment record.
2. The client submits 3–5 captures; at least the configured minimum must pass quality and single-face checks.
3. Passing 128-dimensional embeddings are averaged.
4. The averaged template is encrypted with AES-256-GCM before persistence.
5. During an exam, live frames are dispatched to the face queue.
6. Successful frames are discarded. Violation frames are deduplicated by session and violation type.
7. Celery Beat removes expired evidence according to `SNAPSHOT_RETENTION_DAYS`.

The current worker records frame-level signals. It does not treat one mismatch or detector failure as definitive proof of identity fraud or cheating.

## API documentation

When the API is running:

- Swagger UI: `http://localhost:8000/api/v1/docs`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`
