"""Generate concurrent face-verification traffic and summarize worker timings."""

from __future__ import annotations

import argparse
import base64
import csv
import json
import math
import random
import subprocess
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from performance.biometric.evaluate import load_manifest
from performance.face_worker.tasks import verify_face_benchmark


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_RESULTS_ROOT = (
    REPOSITORY_ROOT / "performance" / "face_worker" / "results"
).resolve()


def percentile(values: Sequence[float], percentage: float) -> float | None:
    """Return an interpolated percentile, or None for an empty sequence."""

    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentage / 100
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def timing_summary(values: Sequence[float]) -> dict[str, float | None]:
    return {
        "p50_ms": percentile(values, 50),
        "p95_ms": percentile(values, 95),
        "p99_ms": percentile(values, 99),
        "max_ms": max(values) if values else None,
    }


def git_context() -> dict[str, object]:
    """Capture reproducibility metadata without modifying the repository."""

    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPOSITORY_ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=REPOSITORY_ROOT,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
        )
        return {"git_commit": commit, "worktree_dirty": dirty}
    except (OSError, subprocess.CalledProcessError):
        return {"git_commit": None, "worktree_dirty": None}


def choose_probes(manifest: Path, dataset_root: Path, students: int, seed: int):
    samples = load_manifest(manifest, dataset_root)
    probes_by_subject = defaultdict(list)
    for sample in samples:
        if sample.role == "probe":
            probes_by_subject[sample.subject_id].append(sample)

    eligible = sorted(probes_by_subject)
    if students > len(eligible):
        raise ValueError(
            f"Requested {students} students but the manifest has only "
            f"{len(eligible)} subjects with probes."
        )
    rng = random.Random(seed)
    chosen_subjects = rng.sample(eligible, students)
    for subject_id in chosen_subjects:
        rng.shuffle(probes_by_subject[subject_id])
    return chosen_subjects, probes_by_subject


def write_outputs(
    output_dir: Path,
    raw_rows: list[dict[str, object]],
    summary: dict[str, object],
) -> None:
    resolved_output = output_dir.resolve()
    if not resolved_output.is_relative_to(SAFE_RESULTS_ROOT):
        raise ValueError(
            "Raw worker results must stay beneath "
            "performance/face_worker/results."
        )
    resolved_output.mkdir(parents=True, exist_ok=True)
    if raw_rows:
        timings_path = resolved_output / "task_timings.csv"
        with timings_path.open(
            "w", newline="", encoding="utf-8"
        ) as stream:
            writer = csv.DictWriter(stream, fieldnames=list(raw_rows[0]))
            writer.writeheader()
            writer.writerows(raw_rows)
        timings_path.chmod(0o600)
    summary_path = resolved_output / "run_summary.json"
    summary_path.write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    summary_path.chmod(0o600)


def run_benchmark(args: argparse.Namespace) -> dict[str, object]:
    subjects, probes_by_subject = choose_probes(
        args.manifest, args.dataset_root, args.students, args.seed
    )
    encoded_probes = {
        subject_id: [
            base64.b64encode(sample.image_path.read_bytes()).decode("ascii")
            for sample in probes_by_subject[subject_id]
        ]
        for subject_id in subjects
    }

    # Warm model/template caches before starting the measured clock. Set this
    # equal to the number of benchmark worker processes so each can initialize.
    for warmup_index in range(args.warmup_tasks):
        subject_id = subjects[warmup_index % len(subjects)]
        warmup_result = verify_face_benchmark.apply_async(
            kwargs={
                "subject_id": subject_id,
                "live_image_base64": encoded_probes[subject_id][0],
                "submitted_at_epoch": time.time(),
            },
            queue=args.queue,
            expires=args.drain_timeout_seconds,
        )
        warmup_result.get(timeout=args.drain_timeout_seconds)
        warmup_result.forget()

    probe_indexes = Counter()
    pending = {}
    raw_rows: list[dict[str, object]] = []
    outcomes = Counter()
    failed_tasks = 0
    peak_in_flight = 0
    submitted = 0

    interval_between_tasks = args.capture_interval_seconds / args.students
    started_at = time.time()
    stop_sending_at = started_at + args.duration_seconds
    next_send_at = started_at

    while time.time() < stop_sending_at:
        now = time.time()
        while now >= next_send_at and next_send_at < stop_sending_at:
            subject_id = subjects[submitted % len(subjects)]
            probes = encoded_probes[subject_id]
            probe_index = probe_indexes[subject_id] % len(probes)
            probe_indexes[subject_id] += 1
            submitted_at = time.time()
            result = verify_face_benchmark.apply_async(
                kwargs={
                    "subject_id": subject_id,
                    "live_image_base64": probes[probe_index],
                    "submitted_at_epoch": submitted_at,
                },
                queue=args.queue,
                expires=args.duration_seconds + args.drain_timeout_seconds,
            )
            pending[result.id] = (result, submitted_at)
            submitted += 1
            peak_in_flight = max(peak_in_flight, len(pending))
            next_send_at += interval_between_tasks

        completed_ids = []
        for task_id, (result, submitted_at) in pending.items():
            if not result.ready():
                continue
            completed_ids.append(task_id)
            received_at = time.time()
            if result.successful():
                payload = result.result
                outcomes[payload["outcome"]] += 1
                raw_rows.append(
                    {
                        "task_id": task_id,
                        "outcome": payload["outcome"],
                        "enqueue_to_result_ms": round(
                            (received_at - submitted_at) * 1000, 3
                        ),
                        "queue_wait_ms": round(payload["queue_wait_ms"], 3),
                        "processing_ms": round(payload["processing_ms"], 3),
                        "worker_end_to_end_ms": round(
                            payload["worker_end_to_end_ms"], 3
                        ),
                    }
                )
            else:
                failed_tasks += 1
            result.forget()
        for task_id in completed_ids:
            pending.pop(task_id)
        time.sleep(args.poll_interval_seconds)

    drain_deadline = time.time() + args.drain_timeout_seconds
    while pending and time.time() < drain_deadline:
        completed_ids = []
        for task_id, (result, submitted_at) in pending.items():
            if not result.ready():
                continue
            completed_ids.append(task_id)
            received_at = time.time()
            if result.successful():
                payload = result.result
                outcomes[payload["outcome"]] += 1
                raw_rows.append(
                    {
                        "task_id": task_id,
                        "outcome": payload["outcome"],
                        "enqueue_to_result_ms": round(
                            (received_at - submitted_at) * 1000, 3
                        ),
                        "queue_wait_ms": round(payload["queue_wait_ms"], 3),
                        "processing_ms": round(payload["processing_ms"], 3),
                        "worker_end_to_end_ms": round(
                            payload["worker_end_to_end_ms"], 3
                        ),
                    }
                )
            else:
                failed_tasks += 1
            result.forget()
        for task_id in completed_ids:
            pending.pop(task_id)
        time.sleep(args.poll_interval_seconds)

    finished_at = time.time()
    completed = len(raw_rows)
    completion_span = max(finished_at - started_at, 0.000001)
    queue_wait = [float(row["queue_wait_ms"]) for row in raw_rows]
    processing = [float(row["processing_ms"]) for row in raw_rows]
    worker_e2e = [float(row["worker_end_to_end_ms"]) for row in raw_rows]
    observed_e2e = [float(row["enqueue_to_result_ms"]) for row in raw_rows]

    summary = {
        "schema_version": 1,
        "started_at_utc": datetime.fromtimestamp(
            started_at, tz=timezone.utc
        ).isoformat(),
        "finished_at_utc": datetime.fromtimestamp(
            finished_at, tz=timezone.utc
        ).isoformat(),
        **git_context(),
        "configuration": {
            "students": args.students,
            "capture_interval_seconds": args.capture_interval_seconds,
            "duration_seconds": args.duration_seconds,
            "requested_tasks_per_second": (
                args.students / args.capture_interval_seconds
            ),
            "queue": args.queue,
            "seed": args.seed,
            "warmup_tasks": args.warmup_tasks,
        },
        "counts": {
            "submitted": submitted,
            "completed": completed,
            "failed_tasks": failed_tasks,
            "not_completed_before_drain_timeout": len(pending),
            "peak_in_flight": peak_in_flight,
            "outcomes": dict(sorted(outcomes.items())),
        },
        "completed_tasks_per_second": completed / completion_span,
        "timings": {
            "queue_wait": timing_summary(queue_wait),
            "processing": timing_summary(processing),
            "worker_end_to_end": timing_summary(worker_e2e),
            "producer_observed_end_to_end": timing_summary(observed_e2e),
        },
        "scope": (
            "Isolated decode/detect/encode/distance worker path. Excludes API, "
            "database lookup/decryption, and violation evidence writes."
        ),
        "privacy": (
            "Individual Celery results were forgotten after collection. Raw "
            "timings remain only in the ignored local output directory."
        ),
    }
    write_outputs(args.output_dir, raw_rows, summary)
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--students", type=int, required=True)
    parser.add_argument("--capture-interval-seconds", type=float, default=10.0)
    parser.add_argument("--duration-seconds", type=float, default=180.0)
    parser.add_argument("--drain-timeout-seconds", type=float, default=120.0)
    parser.add_argument("--poll-interval-seconds", type=float, default=0.05)
    parser.add_argument("--warmup-tasks", type=int, default=1)
    parser.add_argument("--seed", type=int, default=20260916)
    parser.add_argument("--queue", default="face-benchmark")
    args = parser.parse_args()
    for field in (
        "students",
        "capture_interval_seconds",
        "duration_seconds",
        "drain_timeout_seconds",
        "poll_interval_seconds",
    ):
        if getattr(args, field) <= 0:
            parser.error(f"--{field.replace('_', '-')} must be greater than zero")
    if args.warmup_tasks < 0:
        parser.error("--warmup-tasks must be zero or greater")
    return args


def main() -> None:
    args = parse_args()
    summary = run_benchmark(args)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
