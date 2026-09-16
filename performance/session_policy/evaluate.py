"""Evaluate session-level face rules using held-out biometric observations.

This is an offline research simulator. It does not import or change the ExamLoc
API, worker, database, or deployed face threshold.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from collections import Counter, defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Iterable, Sequence


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_RESULTS_ROOT = (
    REPOSITORY_ROOT / "performance" / "session_policy" / "results"
).resolve()
OBSERVATION_TYPES = {
    "match",
    "mismatch",
    "no_face",
    "multiple_faces",
    "technical_error",
}


@dataclass(frozen=True)
class Policy:
    name: str
    mismatch_mode: str
    mismatch_required: int
    mismatch_window: int
    no_face_consecutive: int
    multiple_faces_required: int
    multiple_faces_window: int
    alert_on_technical_error: bool = False


POLICIES = (
    Policy(
        name="single_anomaly_current",
        mismatch_mode="consecutive",
        mismatch_required=1,
        mismatch_window=1,
        no_face_consecutive=1,
        multiple_faces_required=1,
        multiple_faces_window=1,
        alert_on_technical_error=True,
    ),
    Policy(
        name="two_consecutive_mismatches",
        mismatch_mode="consecutive",
        mismatch_required=2,
        mismatch_window=2,
        no_face_consecutive=3,
        multiple_faces_required=2,
        multiple_faces_window=3,
    ),
    Policy(
        name="three_consecutive_mismatches",
        mismatch_mode="consecutive",
        mismatch_required=3,
        mismatch_window=3,
        no_face_consecutive=3,
        multiple_faces_required=2,
        multiple_faces_window=3,
    ),
    Policy(
        name="three_mismatches_in_five",
        mismatch_mode="rolling",
        mismatch_required=3,
        mismatch_window=5,
        no_face_consecutive=3,
        multiple_faces_required=2,
        multiple_faces_window=3,
    ),
)


def classify_rejection(reason: str) -> str:
    normalized = reason.lower()
    if "no face" in normalized:
        return "no_face"
    if "multiple faces" in normalized:
        return "multiple_faces"
    return "technical_error"


def first_alert(
    policy: Policy, observations: Sequence[str]
) -> tuple[int | None, str | None]:
    """Return the first 1-based alert position and its triggering rule."""

    mismatch_streak = 0
    no_face_streak = 0
    mismatch_window: deque[str] = deque(maxlen=policy.mismatch_window)
    multiple_window: deque[str] = deque(maxlen=policy.multiple_faces_window)

    for position, observation in enumerate(observations, start=1):
        if observation not in OBSERVATION_TYPES:
            raise ValueError(f"Unsupported observation type: {observation}")

        mismatch_streak = mismatch_streak + 1 if observation == "mismatch" else 0
        no_face_streak = no_face_streak + 1 if observation == "no_face" else 0
        mismatch_window.append(observation)
        multiple_window.append(observation)

        if policy.mismatch_mode == "consecutive":
            mismatch_triggered = mismatch_streak >= policy.mismatch_required
        elif policy.mismatch_mode == "rolling":
            mismatch_triggered = (
                sum(item == "mismatch" for item in mismatch_window)
                >= policy.mismatch_required
            )
        else:
            raise ValueError(f"Unsupported mismatch mode: {policy.mismatch_mode}")

        if mismatch_triggered:
            return position, "face_mismatch"
        if no_face_streak >= policy.no_face_consecutive:
            return position, "no_face"
        if (
            sum(item == "multiple_faces" for item in multiple_window)
            >= policy.multiple_faces_required
        ):
            return position, "multiple_faces"
        if observation == "technical_error" and policy.alert_on_technical_error:
            return position, "technical_error"

    return None, None


def percentile(values: Sequence[int], percentage: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentage / 100
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return float(ordered[lower])
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def load_observation_pools(
    pair_scores_path: Path,
    rejected_images_path: Path,
    threshold: float,
) -> tuple[
    dict[str, list[str]],
    dict[tuple[str, str], list[str]],
    dict[str, int],
]:
    """Build genuine and attacker-victim observation pools."""

    detected: dict[tuple[str, str], list[str]] = defaultdict(list)
    with pair_scores_path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        required = {
            "probe_subject_id",
            "reference_subject_id",
            "distance",
        }
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("Pair-score CSV is missing required columns.")
        for row in reader:
            probe_subject = row["probe_subject_id"].strip()
            reference_subject = row["reference_subject_id"].strip()
            distance = float(row["distance"])
            detected[(probe_subject, reference_subject)].append(
                "match" if distance < threshold else "mismatch"
            )

    rejected_by_subject: dict[str, list[str]] = defaultdict(list)
    rejection_counts = Counter()
    with rejected_images_path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        required = {"subject_id", "role", "reason"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError("Rejected-image CSV is missing required columns.")
        for row in reader:
            if row["role"].strip().lower() != "probe":
                continue
            outcome = classify_rejection(row["reason"])
            rejected_by_subject[row["subject_id"].strip()].append(outcome)
            rejection_counts[outcome] += 1

    genuine: dict[str, list[str]] = {}
    impostor: dict[tuple[str, str], list[str]] = {}
    for (probe_subject, reference_subject), observations in detected.items():
        pool = [*observations, *rejected_by_subject.get(probe_subject, [])]
        if probe_subject == reference_subject:
            genuine[probe_subject] = pool
        else:
            impostor[(probe_subject, reference_subject)] = pool

    if not genuine or not impostor:
        raise ValueError("Both genuine and impostor observation pools are required.")
    return genuine, impostor, dict(sorted(rejection_counts.items()))


def shuffled_sequence(
    pool: Sequence[str], length: int, rng: random.Random
) -> list[str]:
    """Create a sequence without replacement until another cycle is needed."""

    if not pool:
        raise ValueError("Observation pool must not be empty.")
    sequence: list[str] = []
    while len(sequence) < length:
        cycle = list(pool)
        rng.shuffle(cycle)
        sequence.extend(cycle)
    return sequence[:length]


def generate_sessions(
    pools: dict[object, list[str]],
    session_count: int,
    observations_per_session: int,
    rng: random.Random,
) -> list[list[str]]:
    keys = sorted(pools, key=str)
    return [
        shuffled_sequence(
            pools[rng.choice(keys)], observations_per_session, rng
        )
        for _ in range(session_count)
    ]


def evaluate_policy(
    policy: Policy,
    genuine_sessions: Iterable[Sequence[str]],
    impostor_sessions: Iterable[Sequence[str]],
) -> dict[str, object]:
    genuine_alert_positions: list[int] = []
    impostor_alert_positions: list[int] = []
    genuine_reasons = Counter()
    impostor_reasons = Counter()
    genuine_count = 0
    impostor_count = 0

    for observations in genuine_sessions:
        genuine_count += 1
        position, reason = first_alert(policy, observations)
        if position is not None:
            genuine_alert_positions.append(position)
            genuine_reasons[reason] += 1

    for observations in impostor_sessions:
        impostor_count += 1
        position, reason = first_alert(policy, observations)
        if position is not None:
            impostor_alert_positions.append(position)
            impostor_reasons[reason] += 1

    false_alerts = len(genuine_alert_positions)
    detections = len(impostor_alert_positions)
    return {
        "policy": policy.name,
        "genuine_sessions": genuine_count,
        "false_alerts": false_alerts,
        "false_alert_rate": false_alerts / genuine_count,
        "impostor_sessions": impostor_count,
        "impostor_detections": detections,
        "impostor_detection_rate": detections / impostor_count,
        "genuine_alert_observation_median": (
            median(genuine_alert_positions) if genuine_alert_positions else None
        ),
        "impostor_detection_observation_median": (
            median(impostor_alert_positions) if impostor_alert_positions else None
        ),
        "impostor_detection_observation_p95": percentile(
            impostor_alert_positions, 95
        ),
        "genuine_alert_reasons": dict(sorted(genuine_reasons.items())),
        "impostor_detection_reasons": dict(sorted(impostor_reasons.items())),
    }


def write_results(
    output_dir: Path,
    metrics: Sequence[dict[str, object]],
    summary: dict[str, object],
) -> None:
    resolved_output = output_dir.resolve()
    if not resolved_output.is_relative_to(SAFE_RESULTS_ROOT):
        raise ValueError(
            "Session-policy results must stay beneath "
            "performance/session_policy/results."
        )
    resolved_output.mkdir(parents=True, exist_ok=True)

    table_fields = [
        "policy",
        "genuine_sessions",
        "false_alerts",
        "false_alert_rate",
        "impostor_sessions",
        "impostor_detections",
        "impostor_detection_rate",
        "genuine_alert_observation_median",
        "impostor_detection_observation_median",
        "impostor_detection_observation_p95",
    ]
    metrics_path = resolved_output / "policy_metrics.csv"
    with metrics_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=table_fields)
        writer.writeheader()
        for row in metrics:
            writer.writerow({field: row[field] for field in table_fields})
    metrics_path.chmod(0o600)

    summary_path = resolved_output / "run_summary.json"
    summary_path.write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    summary_path.chmod(0o600)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pair-scores", type=Path, required=True)
    parser.add_argument("--rejected-images", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--threshold", type=float, default=0.40)
    parser.add_argument("--sessions-per-class", type=int, default=10000)
    parser.add_argument("--observations-per-session", type=int, default=9)
    parser.add_argument("--seed", type=int, default=20260916)
    args = parser.parse_args()
    if args.sessions_per_class <= 0:
        parser.error("--sessions-per-class must be greater than zero")
    if args.observations_per_session <= 0:
        parser.error("--observations-per-session must be greater than zero")
    return args


def main() -> None:
    args = parse_args()
    genuine_pools, impostor_pools, rejection_counts = load_observation_pools(
        args.pair_scores, args.rejected_images, args.threshold
    )
    rng = random.Random(args.seed)
    genuine_sessions = generate_sessions(
        genuine_pools,
        args.sessions_per_class,
        args.observations_per_session,
        rng,
    )
    impostor_sessions = generate_sessions(
        impostor_pools,
        args.sessions_per_class,
        args.observations_per_session,
        rng,
    )
    metrics = [
        evaluate_policy(policy, genuine_sessions, impostor_sessions)
        for policy in POLICIES
    ]
    summary = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "configuration": {
            "threshold": args.threshold,
            "sessions_per_class": args.sessions_per_class,
            "observations_per_session": args.observations_per_session,
            "seed": args.seed,
            "genuine_subject_pools": len(genuine_pools),
            "impostor_subject_pairs": len(impostor_pools),
            "rejected_probe_outcomes": rejection_counts,
        },
        "policies": [asdict(policy) for policy in POLICIES],
        "metrics": metrics,
        "warning": (
            "Bootstrapped permutations are repeated uses of the finite FEI "
            "observations, not new participants or temporal video sessions. "
            "Do not interpret these rates as population guarantees or deploy "
            "a policy without prospective validation."
        ),
    }
    write_results(args.output_dir, metrics, summary)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
