# ExamLoc performance harness

This harness measures ExamLoc API latency, throughput, and failures under
repeatable workloads. The read scenario authenticates once during test setup,
then models a synthetic administrator reviewing an institution's exams, one
exam workspace, its students, and its questions. A separate login scenario
measures authentication without distorting read latency.

Results from a developer laptop describe only that tested environment. They are
not production-capacity claims. FAR, FRR, latency, and throughput values may be
published only from a retained report with its configuration, sample counts,
limitations, and reproduction procedure.

## Safety boundary

- Use a dedicated load-test administrator, institution, exam, questions, and
  synthetic students.
- Never use real identities, email addresses, credentials, or biometric images.
- Do not target production without explicit authorization and an agreed traffic
  window.
- The scenarios perform login and GET requests only. They do not send
  invitations, alter scores, submit exams, or enqueue biometric processing.
- Read-test virtual users share one synthetic administrator session. This is
  intentional: the read test measures endpoint capacity, not login capacity.

## Structure

```text
performance/
├── .env.example
├── README.md
├── biometric/                 # FEI threshold evaluation and aggregate report
├── face_worker/               # isolated queue/worker throughput harness
├── locustfile.py
├── login_locustfile.py
├── requirements.txt
├── results/
├── scenarios/
│   ├── admin_login.py
│   └── admin_reads.py
└── session_policy/            # repeated-observation policy simulation
```

Raw result files are ignored by Git. Aggregate reports contain no credentials,
face images, embeddings, pair scores, or subject-level outcomes.

## Environment under test

Record these details with every retained result:

- Git commit and whether the worktree contained changes.
- Test start time and duration in UTC.
- Host operating system, CPU model/core count, and available RAM.
- Docker Desktop CPU and memory allocation, when applicable.
- Whether API, PostgreSQL, Redis, MinIO, and Celery share one machine.
- API, database, and worker replica counts.
- User count, spawn rate, scenario name, and Locust version.
- Database/test-data reset procedure.

Comparisons are meaningful only when these conditions remain equivalent.

## Test data

Prepare a verified administrator that owns a dedicated institution. Inside it,
prepare one exam with representative questions and synthetic enrolled students.
The identifiers must belong to that administrator; authorization failures are
real failures, not load-test traffic.

Copy the example configuration without committing the resulting secret file:

```bash
cp performance/.env.example performance/.env
```

Set:

- `LOADTEST_HOST`: API origin without `/api/v1`.
- `LOADTEST_ADMIN_EMAIL`: verified synthetic administrator email.
- `LOADTEST_ADMIN_PASSWORD`: password for that account.
- `LOADTEST_EXAM_UID`: exam owned by that account.
- `LOADTEST_INSTITUTION_UID`: institution containing the exam.

For local HTTP testing, the backend must use `COOKIE_SECURE=false`; otherwise an
HTTP client correctly refuses to return the Secure authentication cookie. Use
secure cookies for HTTPS staging tests.

## Installation

Use a separate virtual environment so Locust is not added to the production API
image:

```bash
python3 -m venv performance/.venv
source performance/.venv/bin/activate
python -m pip install -r performance/requirements.txt
```

Load the test-only settings into the current shell:

```bash
set -a
source performance/.env
set +a
```

## Run sequence

Run each level at least three times. Investigate failures before increasing
concurrency. The commands below write Locust CSV files beneath `results/`.

### 1. Smoke - validate correctness

```bash
locust -f performance/locustfile.py --headless \
  --users 1 --spawn-rate 1 --run-time 1m \
  --csv performance/results/admin-read-smoke
```

### 2. Small - establish a baseline

```bash
locust -f performance/locustfile.py --headless \
  --users 10 --spawn-rate 2 --run-time 5m \
  --csv performance/results/admin-read-small
```

### 3. Medium - observe early degradation

```bash
locust -f performance/locustfile.py --headless \
  --users 25 --spawn-rate 5 --run-time 5m \
  --csv performance/results/admin-read-medium
```

### 4. Target - evaluate the earlier 50-user claim

```bash
locust -f performance/locustfile.py --headless \
  --users 50 --spawn-rate 5 --run-time 10m \
  --csv performance/results/admin-read-target
```

Do not run medium or target tests until the smoke and small runs complete
without scenario errors.

The setup login uses the standard HTTP client rather than Locust's instrumented
client, so it does not appear in read-test statistics. Each spawned read user
receives a copy of that authenticated session cookie. Consequently,
`--reset-stats` is unnecessary for the read scenario.

## Login capacity

Run authentication separately using paced users. Each user attempts at most one
login per second; when the server takes longer than one second, Locust does not
add catch-up requests. Start with one user and increase only after a clean run:

```bash
locust -f performance/login_locustfile.py --headless \
  --users 1 --spawn-rate 1 --run-time 3m \
  --csv performance/results/admin-login-1-per-second
```

Repeat with `--users 2` and then `--users 5` to request maximum rates of two and
five logins per second. Report the achieved request rate alongside latency; slow
password verification can make it lower than the requested maximum.

Do not weaken password hashing to improve this benchmark. Authentication should
also have production rate limiting even when its measured capacity is higher.

## Metrics and interpretation

For every endpoint and the aggregate, retain:

- Request and failure counts.
- Requests per second.
- Median, p95, and p99 response times.
- CPU and memory usage for API, database, Redis, and workers.
- Unexpected status codes and application errors.

Track queue wait and worker processing time in later asynchronous and biometric
scenarios. Do not mix those results with this read-only API baseline.

Set provisional acceptance criteria before running a test. For example, decide
the maximum failure rate and p95 latency suitable for the intended examination
size. Do not choose the criteria after seeing the results.

## Reproduction rules

1. Begin from the documented database state.
2. Use the same scenario, user count, spawn rate, and duration.
3. Record environment details and Git commit.
4. Repeat each scenario at least three times.
5. Report the median run and the observed range, not only the best result.
6. Preserve failures and limitations alongside successful measurements.

## Retained evaluation reports

- [FEI threshold evaluation](biometric/reports/fei_threshold_evaluation.md)
  reports identity-disjoint calibration and held-out FAR/FRR measurements. It
  concludes that the deployed `0.40` threshold is strict and should not be
  changed from this dataset alone.
- [FEI repeated-observation evaluation](session_policy/reports/fei_repeated_observation_evaluation.md)
  reports an offline simulation of session-level policies. It does not change
  the production threshold or worker behavior.

Face-worker runs and API load-test CSV files remain local until a reviewed
aggregate report records a stable environment and repeated runs. Do not cite an
individual raw run as a general scalability result.
