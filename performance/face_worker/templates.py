"""Build local averaged face templates for the throughput benchmark.

The output contains biometric embeddings. It is therefore restricted to the
ignored ``performance/face_worker/artifacts`` directory and must not be
committed, shared, or used as an application enrollment store.
"""

from __future__ import annotations

import argparse
import base64
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from performance.biometric.evaluate import load_face_utils, load_manifest


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_ARTIFACTS_ROOT = (
    REPOSITORY_ROOT / "performance" / "face_worker" / "artifacts"
).resolve()


def build_templates(manifest: Path, dataset_root: Path) -> dict[str, list[float]]:
    """Build one averaged template per subject from enrollment samples."""

    samples = load_manifest(manifest, dataset_root)
    face_utils = load_face_utils()
    grouped = defaultdict(list)
    for sample in samples:
        if sample.role == "enrollment":
            grouped[sample.subject_id].append(sample)

    templates: dict[str, list[float]] = {}
    for subject_id, enrollment_samples in sorted(grouped.items()):
        embeddings = []
        for sample in enrollment_samples:
            try:
                encoded = base64.b64encode(sample.image_path.read_bytes()).decode(
                    "ascii"
                )
                image = face_utils.decode_image(encoded)
                passed, _reason = face_utils.check_image_quality(image)
                if not passed:
                    continue
                embeddings.append(face_utils.get_face_embedding(image))
            except Exception:
                # A subject may still be usable when one controlled-dataset
                # enrollment image fails, provided at least three pass below.
                continue

        if len(embeddings) < 3:
            raise ValueError(
                f"{subject_id} has only {len(embeddings)} passing enrollment "
                "images; at least three are required."
            )
        averaged = face_utils.average_embeddings(embeddings)
        templates[subject_id] = [float(value) for value in averaged]

    if not templates:
        raise ValueError("No face templates could be built.")
    return templates


def write_templates(output: Path, templates: dict[str, list[float]]) -> None:
    """Write sensitive templates only within the ignored artifact directory."""

    resolved_output = output.resolve()
    if not resolved_output.is_relative_to(SAFE_ARTIFACTS_ROOT):
        raise ValueError(
            "Derived templates must stay beneath "
            "performance/face_worker/artifacts."
        )
    resolved_output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": 1,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "subject_count": len(templates),
        "embedding_dimensions": 128,
        "templates": templates,
    }
    resolved_output.write_text(json.dumps(payload), encoding="utf-8")
    resolved_output.chmod(0o600)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--dataset-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    templates = build_templates(args.manifest, args.dataset_root)
    write_templates(args.output, templates)
    print(f"Built {len(templates)} local templates: {args.output}")


if __name__ == "__main__":
    main()
