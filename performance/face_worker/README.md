# Face-worker throughput benchmark

This harness measures how the dedicated face queue behaves as concurrent
students submit periodic verification frames. It uses the production image
decoder, face detector/encoder, and distance function, but it deliberately does
not call the production `verify_face_task`.

That separation is a safety boundary: the benchmark cannot create exam
violations, upload snapshots, modify sessions, or read/write application
database rows. The production threshold is not changed. The task calculates a
distance only to exercise the same inference work and never returns that
distance or an embedding.

## What it measures

- Queue wait: broker submission until a worker starts the task.
- Processing time: decode, detect, encode, and distance calculation.
- Worker end-to-end latency: queue wait plus processing.
- Producer-observed end-to-end latency: submission until the result is seen.
- Completed tasks per second, task failures, outcomes, and peak in-flight work.

The runner sends one unmeasured warm-up task by default so model and template
initialization do not distort the run. When using multiple worker processes,
set `--warmup-tasks` to at least the number of processes.

The benchmark excludes API authentication, database lookup and embedding
decryption, and the mismatch/no-face evidence-write path. Its results are a
face-inference worker capacity measurement, not a complete production capacity
claim.

## Privacy and isolation

- Use only the locally prepared, research-authorized FEI data.
- Derived templates are biometric data and stay under the ignored `artifacts/`
  directory.
- Raw task timings stay under the ignored `results/` directory.
- The dedicated queue is named `face-benchmark`; never point this harness at
  the production `face` queue.
- Image payloads temporarily pass through Redis. Run against local/test Redis,
  not production, and apply the project retention policy afterward.
- Do not publish or redistribute FEI images or derived templates.

## 1. Build local templates once

From the repository root, activate the backend environment and run:

```bash
env/bin/python -m performance.face_worker.templates \
  --manifest performance/biometric/data/fei/evaluation_manifest.csv \
  --dataset-root performance/biometric/data \
  --output performance/face_worker/artifacts/fei-evaluation-templates.json
```

The output path is intentionally restricted to the ignored artifact directory.

## 2. Start only the benchmark worker

This is not the API or frontend. In one terminal, configure the local Redis
connection and absolute template path, then start the isolated queue:

```bash
export CELERY_BROKER_URL=redis://localhost:6379/15
export CELERY_RESULT_BACKEND=redis://localhost:6379/15
export FACE_BENCHMARK_TEMPLATE_FILE="$PWD/performance/face_worker/artifacts/fei-evaluation-templates.json"

env/bin/celery -A performance.face_worker.celery_app:celery_app worker \
  --loglevel=info --queues=face-benchmark --pool=solo --concurrency=1
```

Start with `--pool=solo --concurrency=1` because that matches the current local
Docker face-worker configuration. Later worker-count comparisons should use
separate benchmark worker instances with unique node names; do not assume that
raising `--concurrency` with the solo pool creates parallel inference.

## 3. Smoke test

In a second terminal with the same Redis variables loaded:

```bash
env/bin/python -m performance.face_worker.run \
  --manifest performance/biometric/data/fei/evaluation_manifest.csv \
  --dataset-root performance/biometric/data \
  --students 1 \
  --capture-interval-seconds 10 \
  --duration-seconds 60 \
  --output-dir performance/face_worker/results/fei-1-student-smoke
```

Confirm that submitted tasks complete, `failed_tasks` is zero, and
`not_completed_before_drain_timeout` is zero before increasing load.

## 4. Concurrent-student sequence

Use one verification frame per student every ten seconds. Run each level at
least three times and give every run a different output directory:

```bash
# Change --students and the output name together: 5, 10, 25, 50, then 100.
env/bin/python -m performance.face_worker.run \
  --manifest performance/biometric/data/fei/evaluation_manifest.csv \
  --dataset-root performance/biometric/data \
  --students 5 \
  --capture-interval-seconds 10 \
  --duration-seconds 180 \
  --output-dir performance/face_worker/results/fei-5-students-run1
```

The requested arrival rates are respectively 0.5, 1, 2.5, 5, and 10 tasks per
second. Stop increasing load when queue wait grows throughout the run, tasks
miss the drain deadline, failures occur, or the provisional latency target is
breached.

Queue-wait timings compare producer and worker wall clocks. Keep them on the
same machine or synchronize their clocks before treating those values as valid.

While a run is active, record worker and Redis resources separately:

```bash
docker stats --no-stream examloc-faceworker examloc-redis
```

If the benchmark worker runs on the host rather than in the Docker
`examloc-faceworker` container, Docker cannot report its CPU/memory; use Activity
Monitor and record that limitation.

After the benchmark worker is stopped and all required local results have been
saved, clear only the dedicated benchmark Redis database so no image payloads
or stale tasks remain:

```bash
docker exec examloc-redis redis-cli -n 15 FLUSHDB
```

Do not run that cleanup command if database 15 is used by another application.

## Interpretation

Processing latency shows the inference cost. Queue wait shows whether submitted
work is arriving faster than available workers can process it. A low failure
rate with rapidly increasing queue wait is still an overloaded system.

Compare the median of three equivalent runs and include the observed range.
Record CPU model, RAM, Docker allocation, worker count/pool, Redis location,
Git commit, worktree state, duration, arrival rate, and any rejected/no-face
outcomes with every retained aggregate report.
