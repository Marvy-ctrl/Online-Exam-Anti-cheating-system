"""Evaluate ExamLoc face-distance thresholds using a controlled local dataset.

The evaluator reuses the production face decoding, quality, embedding,
averaging, and distance functions. It never writes images or embeddings. Raw
pair scores are written only beneath the ignored results directory selected by
the operator.
"""

from __future__ import annotations

import argparse
import base64
import csv
import importlib.util
import json
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Sequence


MANIFEST_FIELDS = {"sample_id", "subject_id", "role", "image_path"}
ALLOWED_ROLES = {"enrollment", "probe"}
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_RESULTS_ROOT = (
    REPOSITORY_ROOT / "performance" / "biometric" / "results"
).resolve()


@dataclass(frozen=True)
class Sample:
    sample_id: str
    subject_id: str
    role: str
    image_path: Path


@dataclass(frozen=True)
class PairScore:
    probe_id: str
    probe_subject_id: str
    reference_subject_id: str
    expected_match: bool
    distance: float


def load_face_utils():
    """Load only face_utils.py, without initializing the FastAPI package."""

    module_path = REPOSITORY_ROOT / "backend" / "src" / "students" / "face_utils.py"
    spec = importlib.util.spec_from_file_location(
        "examloc_biometric_face_utils", module_path
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load production face utilities: {module_path}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except ImportError as exc:
        raise RuntimeError(
            "Face dependencies are unavailable. Activate the backend environment."
        ) from exc
    return module


def build_thresholds(start: float, end: float, step: float) -> list[float]:
    """Build an inclusive, decimal-safe threshold sequence."""

    start_value = Decimal(str(start))
    end_value = Decimal(str(end))
    step_value = Decimal(str(step))
    if step_value <= 0:
        raise ValueError("Threshold step must be greater than zero.")
    if start_value > end_value:
        raise ValueError("Threshold start must not exceed threshold end.")

    values: list[float] = []
    current = start_value
    while current <= end_value:
        values.append(float(current))
        current += step_value
    return values


def compute_threshold_metrics(
    genuine_distances: Sequence[float],
    impostor_distances: Sequence[float],
    thresholds: Iterable[float],
) -> list[dict[str, int | float]]:
    """Calculate FAR and FRR using the production rule: distance < threshold."""

    if not genuine_distances:
        raise ValueError("At least one genuine comparison is required.")
    if not impostor_distances:
        raise ValueError("At least one impostor comparison is required.")

    rows: list[dict[str, int | float]] = []
    for threshold in thresholds:
        false_rejects = sum(
            distance >= threshold for distance in genuine_distances
        )
        false_accepts = sum(
            distance < threshold for distance in impostor_distances
        )
        rows.append(
            {
                "threshold": threshold,
                "genuine_attempts": len(genuine_distances),
                "impostor_attempts": len(impostor_distances),
                "false_rejects": false_rejects,
                "false_accepts": false_accepts,
                "false_reject_rate": false_rejects / len(genuine_distances),
                "false_accept_rate": false_accepts / len(impostor_distances),
            }
        )
    return rows


def load_manifest(manifest_path: Path, dataset_root: Path) -> list[Sample]:
    """Load and validate pseudonymous samples contained beneath dataset_root."""

    root = dataset_root.resolve()
    samples: list[Sample] = []
    seen_ids: set[str] = set()

    with manifest_path.open(newline="", encoding="utf-8") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or not MANIFEST_FIELDS.issubset(reader.fieldnames):
            raise ValueError(
                "Manifest must contain: " + ", ".join(sorted(MANIFEST_FIELDS))
            )

        for line_number, row in enumerate(reader, start=2):
            sample_id = row["sample_id"].strip()
            subject_id = row["subject_id"].strip()
            role = row["role"].strip().lower()
            relative_path = row["image_path"].strip()

            if not sample_id or not subject_id or not relative_path:
                raise ValueError(f"Manifest line {line_number} has an empty field.")
            if sample_id in seen_ids:
                raise ValueError(f"Duplicate sample_id: {sample_id}")
            if role not in ALLOWED_ROLES:
                raise ValueError(
                    f"Manifest line {line_number} has unsupported role: {role}"
                )

            image_path = (root / relative_path).resolve()
            if not image_path.is_relative_to(root):
                raise ValueError(
                    f"Manifest line {line_number} escapes the dataset root."
                )
            if not image_path.is_file():
                raise ValueError(f"Image does not exist: {relative_path}")

            seen_ids.add(sample_id)
            samples.append(
                Sample(sample_id, subject_id, role, image_path)
            )

    if not samples:
        raise ValueError("Manifest contains no samples.")
    return samples


def evaluate_samples(
    samples: Sequence[Sample],
    min_enrollment_images: int,
    max_enrollment_images: int,
) -> tuple[list[PairScore], list[dict[str, str]], dict[str, int]]:
    """Build averaged templates and compare every probe with every subject."""

    face_utils = load_face_utils()

    grouped: dict[str, dict[str, list[Sample]]] = defaultdict(
        lambda: {"enrollment": [], "probe": []}
    )
    for sample in samples:
        grouped[sample.subject_id][sample.role].append(sample)

    if len(grouped) < 2:
        raise ValueError("At least two subjects are required to calculate FAR.")

    templates = {}
    rejected: list[dict[str, str]] = []
    accepted_probe_embeddings: list[tuple[Sample, object]] = []

    for subject_id, roles in sorted(grouped.items()):
        enrollment_samples = roles["enrollment"]
        if not min_enrollment_images <= len(enrollment_samples) <= max_enrollment_images:
            raise ValueError(
                f"{subject_id} must have between {min_enrollment_images} and "
                f"{max_enrollment_images} enrollment images."
            )
        if not roles["probe"]:
            raise ValueError(f"{subject_id} must have at least one probe image.")

        embeddings = []
        for sample in enrollment_samples:
            try:
                encoded = base64.b64encode(sample.image_path.read_bytes()).decode()
                image = face_utils.decode_image(encoded)
                passed, reason = face_utils.check_image_quality(image)
                if not passed:
                    raise ValueError(reason)
                embeddings.append(face_utils.get_face_embedding(image))
            except Exception as exc:
                rejected.append(
                    {
                        "sample_id": sample.sample_id,
                        "subject_id": subject_id,
                        "role": sample.role,
                        "reason": str(exc),
                    }
                )

        if len(embeddings) < min_enrollment_images:
            raise ValueError(
                f"{subject_id} has only {len(embeddings)} passing enrollment "
                f"images; {min_enrollment_images} are required."
            )
        templates[subject_id] = face_utils.average_embeddings(embeddings)

        for sample in roles["probe"]:
            try:
                encoded = base64.b64encode(sample.image_path.read_bytes()).decode()
                image = face_utils.decode_image(encoded)
                embedding = face_utils.get_face_embedding(image)
                accepted_probe_embeddings.append((sample, embedding))
            except Exception as exc:
                rejected.append(
                    {
                        "sample_id": sample.sample_id,
                        "subject_id": subject_id,
                        "role": sample.role,
                        "reason": str(exc),
                    }
                )

    pair_scores = []
    for probe, probe_embedding in accepted_probe_embeddings:
        for reference_subject_id, template in sorted(templates.items()):
            pair_scores.append(
                PairScore(
                    probe_id=probe.sample_id,
                    probe_subject_id=probe.subject_id,
                    reference_subject_id=reference_subject_id,
                    expected_match=probe.subject_id == reference_subject_id,
                    distance=face_utils.compute_distance(template, probe_embedding),
                )
            )

    counts = {
        "subjects": len(templates),
        "manifest_samples": len(samples),
        "accepted_probes": len(accepted_probe_embeddings),
        "rejected_images": len(rejected),
    }
    return pair_scores, rejected, counts


def write_results(
    output_dir: Path,
    pair_scores: Sequence[PairScore],
    rejected: Sequence[dict[str, str]],
    counts: dict[str, int],
    thresholds: Sequence[float],
    current_threshold: float,
) -> None:
    """Write sensitive raw measurements only to the ignored output directory."""

    resolved_output = output_dir.resolve()
    if not resolved_output.is_relative_to(SAFE_RESULTS_ROOT):
        raise ValueError(
            "Raw biometric results must stay beneath "
            "performance/biometric/results."
        )
    resolved_output.mkdir(parents=True, exist_ok=True)
    genuine = [score.distance for score in pair_scores if score.expected_match]
    impostor = [score.distance for score in pair_scores if not score.expected_match]
    metrics = compute_threshold_metrics(genuine, impostor, thresholds)

    with (resolved_output / "pair_scores.csv").open(
        "w", newline="", encoding="utf-8"
    ) as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=[
                "probe_id",
                "probe_subject_id",
                "reference_subject_id",
                "expected_match",
                "distance",
            ],
        )
        writer.writeheader()
        for score in pair_scores:
            writer.writerow(
                {
                    "probe_id": score.probe_id,
                    "probe_subject_id": score.probe_subject_id,
                    "reference_subject_id": score.reference_subject_id,
                    "expected_match": score.expected_match,
                    "distance": f"{score.distance:.8f}",
                }
            )

    with (resolved_output / "threshold_metrics.csv").open(
        "w", newline="", encoding="utf-8"
    ) as stream:
        writer = csv.DictWriter(stream, fieldnames=list(metrics[0]))
        writer.writeheader()
        writer.writerows(metrics)

    with (resolved_output / "rejected_images.csv").open(
        "w", newline="", encoding="utf-8"
    ) as stream:
        writer = csv.DictWriter(
            stream, fieldnames=["sample_id", "subject_id", "role", "reason"]
        )
        writer.writeheader()
        writer.writerows(rejected)

    current = min(metrics, key=lambda row: abs(row["threshold"] - current_threshold))
    closest = min(
        metrics,
        key=lambda row: abs(
            row["false_accept_rate"] - row["false_reject_rate"]
        ),
    )
    summary = {
        **counts,
        "genuine_attempts": len(genuine),
        "impostor_attempts": len(impostor),
        "current_threshold_metrics": current,
        "closest_far_frr_threshold": closest,
        "warning": (
            "Do not publish or deploy a threshold from this run without "
            "documenting participant count, capture conditions, and limitations."
        ),
    }
    (resolved_output / "run_summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--threshold-start", type=float, default=0.30)
    parser.add_argument("--threshold-end", type=float, default=0.60)
    parser.add_argument("--threshold-step", type=float, default=0.01)
    parser.add_argument("--current-threshold", type=float, default=0.40)
    parser.add_argument("--min-enrollment-images", type=int, default=3)
    parser.add_argument("--max-enrollment-images", type=int, default=5)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    thresholds = build_thresholds(
        args.threshold_start, args.threshold_end, args.threshold_step
    )
    if args.current_threshold not in thresholds:
        thresholds = sorted({*thresholds, args.current_threshold})

    samples = load_manifest(args.manifest, args.dataset_root)
    pair_scores, rejected, counts = evaluate_samples(
        samples,
        min_enrollment_images=args.min_enrollment_images,
        max_enrollment_images=args.max_enrollment_images,
    )
    write_results(
        args.output_dir,
        pair_scores,
        rejected,
        counts,
        thresholds,
        args.current_threshold,
    )
    print(f"Biometric evaluation complete: {args.output_dir}")


if __name__ == "__main__":
    main()
