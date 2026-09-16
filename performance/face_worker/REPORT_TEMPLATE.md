# Face-worker throughput report

## Status

- Date:
- Author:
- Git commit:
- Worktree clean or dirty:
- Dataset and split:
- Retention/deletion date for local artifacts:

## Research question

State the concurrent-student load and capture frequency that the worker should
support, together with a latency and failure criterion chosen before inspecting
the results.

## Environment

- Host OS and CPU:
- Host RAM:
- Docker CPU/RAM allocation:
- Redis location/version:
- Benchmark worker count:
- Celery pool and concurrency:
- Whether other workloads shared the host:

## Scope

This benchmark covers broker queue wait and the isolated production
decode/detect/encode/distance path. It does not cover the API, database lookup,
embedding decryption, violation creation, or snapshot upload. Do not describe
the result as end-to-end application capacity.

## Pre-registered criteria

- Maximum task failure rate:
- Maximum p95 worker end-to-end latency:
- Maximum acceptable queue growth/backlog:
- Required completion throughput:

## Workload

| Students | Capture interval | Requested tasks/s | Duration | Repetitions |
|---:|---:|---:|---:|---:|
| 1 | 10 s | 0.1 | 60 s | 1 smoke |
| 5 | 10 s | 0.5 | 180 s | 3 |
| 10 | 10 s | 1.0 | 180 s | 3 |
| 25 | 10 s | 2.5 | 180 s | 3 |
| 50 | 10 s | 5.0 | 180 s | 3 |
| 100 | 10 s | 10.0 | 180 s | 3 |

## Aggregate results

Report the median run and range across equivalent repetitions. Preserve failed
and timed-out runs rather than selecting only the best run.

| Students | Completed/s | Queue p50/p95/p99 | Processing p50/p95/p99 | Worker E2E p50/p95/p99 | Peak in flight | Failed/timed out |
|---:|---:|---|---|---|---:|---:|
|  |  |  |  |  |  |  |

## Resource observations

Record worker and Redis CPU/memory near the beginning, midpoint, and end of each
retained run. State whether the worker was containerized or measured with the
host operating-system tools.

## Interpretation

- Highest load meeting all pre-registered criteria:
- First load showing sustained queue growth:
- Likely bottleneck:
- Whether more worker instances improved throughput:
- Failures or detector rejections observed:

## Limitations

Include at least: controlled FEI imagery, single-machine/local Redis effects,
excluded database and evidence-write work, finite run duration, machine-specific
results, and any difference between benchmark and deployment worker topology.

## Decision and next experiment

State whether the evidence supports the intended concurrent-student capacity.
The next separate experiment should evaluate session-level identity rules over
repeated observations, without treating one mismatch or detector failure as a
definitive identity conclusion.
