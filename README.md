# ExamLoc v2

ExamLoc is a research-oriented online examination platform with server-authoritative timing, role-scoped access control, asynchronous grading and face verification, and an examiner audit trail.

The v2 engineering work focuses on security, recoverability, biometric privacy, automated testing, and reproducible evaluation. It should not be described as a production-certified proctoring system or as proof that an individual cheated.

## Core capabilities

- Institution, subject, exam, question, enrollment, and result management.
- Signed JWT authentication with separate examiner and student secrets and role claims.
- Student session tokens scoped to a student, exam, and session.
- Server-authoritative exam deadlines backed by PostgreSQL.
- Periodic recovery of expired sessions through Celery Beat.
- Asynchronous face verification, grading, and email delivery through dedicated Celery queues.
- Deterministic per-student question and option shuffling when enabled.
- Answer auto-save with bounded retry and restoration after reconnecting.
- Multi-image face enrollment and encrypted biometric templates.
- Deduplicated, expiring violation evidence for authorized examiner review.
- Reproducible API, face-worker, biometric-threshold, and session-policy evaluation tools.

## Architecture

```text
Next.js 16 frontend
        |
        | HTTP/WebSocket
        v
FastAPI API -------------- PostgreSQL (authoritative application state)
        |
        +---- Redis broker/result backend
        |       +---- face worker
        |       +---- grading/completion/evidence worker
        |       +---- email worker
        |       +---- Celery Beat
        |
        +---- MinIO (retained violation snapshots)
```

Redis is not the authoritative store for exams, sessions, answers, or results. Those records remain in PostgreSQL. MinIO is used for retained violation images, with a local filesystem fallback for development.

## Security and biometric data

### Authentication

Examiner and student access tokens are signed JSON Web Tokens (JWTs). Examiner tokens include a role claim; student exam tokens are additionally scoped to the student, exam, and session. Email verification, enrollment, and password-reset links use separately salted, URL-safe timed signatures.

Authorization is enforced on the backend. Client-side route guards and hidden controls are usability features, not security boundaries.

### Face enrollment

Enrollment is bound to a signed enrollment token. A request contains between three and five face captures; the normal user flow captures five. Each image must pass decoding, brightness, blur, and single-face checks. At least `FACE_ENROLLMENT_MIN_PASSING` images, three by default, must pass.

The passing 128-dimensional embeddings are averaged into one template. New templates are encrypted before database persistence using AES-256-GCM and `ENCRYPTION_KEY`. Raw captures and plaintext embeddings are processed in memory and are not stored by the enrollment service.

### Verification evidence and retention

Successful clean verification frames are not retained. When verification reports `no_face`, `multiple_faces`, or `face_mismatch`, ExamLoc records the violation and retains at most one representative snapshot per violation type per session. Repeated events increment the snapshot occurrence count instead of creating another image.

Celery Beat runs evidence cleanup hourly. Snapshot files and database rows older than `SNAPSHOT_RETENTION_DAYS` (seven days by default) are deleted. Legacy inline or unclassified snapshots are also removed. Evidence access is restricted to an authorized administrator who owns the related exam.

The configured face-distance threshold remains `0.40`. Lower values are stricter. The FEI evaluation does not justify changing production behavior by itself; see [the biometric evaluation report](performance/biometric/reports/fei_threshold_evaluation.md).

## Local setup

### Prerequisites

- Docker Desktop with Docker Compose, or equivalent container tooling.
- Node.js 20 or later for the Next.js frontend.
- Python 3.11 when running the backend outside Docker.

### Backend infrastructure and workers

Copy the example settings and replace every secret or credential placeholder:

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Use distinct generated values for `JWT_SECRET_EXAMINER`, `JWT_SECRET_STUDENT`, and the 64-character hexadecimal `ENCRYPTION_KEY`. Never use the Compose fallback credentials outside local development.

Build and start PostgreSQL, Redis, MinIO, the API, workers, and Celery Beat:

```bash
docker compose up -d --build
docker compose ps
```

The API is available at `http://localhost:8000`; OpenAPI documentation is at `http://localhost:8000/api/v1/docs`. MinIO's local console is at `http://localhost:9001`.

For an existing database, check and apply the authoritative migration history from `backend/alembic`:

```bash
docker compose run --rm api alembic current
docker compose run --rm api alembic upgrade head
```

Do not use `alembic stamp` without first reading the existing-database procedure in [DEPLOY.md](DEPLOY.md).

### Frontend

```bash
cd frontend
npm install
printf 'NEXT_PUBLIC_BACKEND_URL=http://localhost:8000\n' > .env.local
npm run dev
```

The frontend is then available at `http://localhost:3000`. See [frontend/README.md](frontend/README.md) for its structure and verification commands.

## Verification

Backend tests use Python's standard `unittest` runner:

```bash
cd backend
PYTHONPATH=. ../env/bin/python -m unittest discover -s tests -v
```

Frontend checks:

```bash
cd frontend
npm test
npm run lint
./node_modules/.bin/tsc --noEmit
```

These tests cover the core exam lifecycle, authorization and tenant boundaries, timeout recovery, encrypted embeddings, evidence retention, migration history, logging hygiene, and key frontend workspace behavior.

## Evaluation and publication policy

The repository contains separate, reproducible harnesses under [`performance/`](performance/README.md):

- `performance/` - authenticated API read and login workloads.
- `performance/biometric/` - controlled threshold evaluation with identity-disjoint calibration and held-out splits.
- `performance/face_worker/` - isolated face-worker queue and processing throughput.
- `performance/session_policy/` - offline repeated-observation policy evaluation.

Raw face images, embeddings, subject-level scores, credentials, and raw benchmark output are intentionally ignored. Published latency, scalability, FAR, or FRR values must come from a retained report that includes the dataset, environment, configuration, sample counts, limitations, and reproduction procedure. A zero observed error count is not a claim of zero population risk.

The included FEI data preparation and reports are for research use. The FEI images themselves must not be committed or redistributed.

## Important design decisions

- **Server-authoritative timing:** `expected_end_time` is persisted by the backend and expired sessions are finalized periodically even if a browser closes or disconnects.
- **PostgreSQL-backed state:** exam progress and answers do not depend on Redis durability.
- **Deterministic shuffling:** question and option order is stable for the same student while differing across students.
- **Resilient answer saving:** the frontend retries transient save failures and the backend verifies session ownership.
- **Asynchronous processing:** face inference and grading run outside API requests through Celery queues.
- **Privacy-limited evidence:** clean frames are transient; violation images are deduplicated and expire.
- **Human review:** biometric or browser events are signals for review, not independent proof of misconduct.

## Repository map

```text
backend/                  FastAPI application, workers, migrations, and tests
frontend/                 Next.js application and component tests
performance/              Reproducible API and biometric evaluation harnesses
deploy/                   Reverse-proxy and VPS support files
docker-compose.yml        Local backend service topology
docker-compose.prod.yml   Production-oriented backend topology
DEPLOY.md                 Staging deployment and migration procedure
```

## Deployment

Read [DEPLOY.md](DEPLOY.md) before deploying or processing real user data. Production deployments require unique secrets, HTTPS, secure cookies, restricted infrastructure ports, backups, migration review, retention-policy review, and explicit consent and governance appropriate to the institution and jurisdiction.

## License and data use

The application is currently a proprietary research project. Third-party datasets retain their own licenses and use restrictions; they are not covered by the application source-code status.
