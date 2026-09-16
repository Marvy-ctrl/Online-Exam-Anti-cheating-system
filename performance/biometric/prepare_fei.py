"""Validate FEI archives and prepare identity-disjoint evaluation manifests."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAFE_DATA_ROOT = (
    REPOSITORY_ROOT / "performance" / "biometric" / "data"
).resolve()
ARCHIVE_NAMES = tuple(f"originalimages_part{part}.zip" for part in range(1, 5))
FILE_PATTERN = re.compile(r"^(?P<subject>[1-9]\d{0,2})-(?P<image>\d{2})\.jpg$")
EXPECTED_SUBJECTS = set(range(1, 201))
EXPECTED_IMAGES = set(range(1, 15))

# Fixed before evaluation. These represent moderate left, front/upward gaze,
# moderate right, neutral frontal, and smiling frontal enrollment captures.
ENROLLMENT_IMAGES = {3, 5, 7, 11, 12}
CALIBRATION_SUBJECTS = set(range(1, 101))
EVALUATION_SUBJECTS = set(range(101, 201))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_archives(
    archives_dir: Path,
) -> tuple[list[Path], dict[int, dict[int, tuple[Path, str]]]]:
    """Validate four archives contain exactly 200 subjects x 14 images."""

    archive_paths = [archives_dir / name for name in ARCHIVE_NAMES]
    missing = [path.name for path in archive_paths if not path.is_file()]
    if missing:
        raise ValueError(f"Missing FEI archives: {', '.join(missing)}")

    members: dict[int, dict[int, tuple[Path, str]]] = defaultdict(dict)
    seen_names: set[str] = set()
    for archive_path in archive_paths:
        with ZipFile(archive_path) as archive:
            for member_name in archive.namelist():
                if member_name.endswith("/"):
                    continue
                filename = Path(member_name).name
                match = FILE_PATTERN.fullmatch(filename)
                if not match:
                    raise ValueError(
                        f"Unexpected FEI archive member: {member_name}"
                    )
                if filename in seen_names:
                    raise ValueError(f"Duplicate FEI image: {filename}")
                seen_names.add(filename)

                subject = int(match.group("subject"))
                image_number = int(match.group("image"))
                members[subject][image_number] = (archive_path, member_name)

    if set(members) != EXPECTED_SUBJECTS:
        raise ValueError("FEI archives do not contain subjects 1 through 200.")
    for subject, images in members.items():
        if set(images) != EXPECTED_IMAGES:
            raise ValueError(
                f"FEI subject {subject} does not contain images 01 through 14."
            )
    if len(seen_names) != 2800:
        raise ValueError(f"Expected 2800 FEI images, found {len(seen_names)}.")
    return archive_paths, members


def extract_images(
    members: dict[int, dict[int, tuple[Path, str]]], output_root: Path
) -> None:
    """Extract verified members into a stable pseudonymous directory layout."""

    for subject, images in sorted(members.items()):
        subject_dir = output_root / "original" / f"{subject:03d}"
        subject_dir.mkdir(parents=True, exist_ok=True)
        for image_number, (archive_path, member_name) in sorted(images.items()):
            destination = subject_dir / f"{image_number:02d}.jpg"
            with ZipFile(archive_path) as archive:
                info = archive.getinfo(member_name)
                if destination.exists():
                    if destination.stat().st_size != info.file_size:
                        raise ValueError(
                            f"Existing image has unexpected size: {destination}"
                        )
                    continue
                with archive.open(info) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target)


def write_manifest(
    path: Path,
    subjects: set[int],
    dataset_relative_root: Path,
) -> None:
    """Write a stable five-enrollment/nine-probe manifest."""

    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=["sample_id", "subject_id", "role", "image_path"],
        )
        writer.writeheader()
        for subject in sorted(subjects):
            for image_number in sorted(EXPECTED_IMAGES):
                subject_id = f"fei_{subject:03d}"
                writer.writerow(
                    {
                        "sample_id": f"{subject_id}_{image_number:02d}",
                        "subject_id": subject_id,
                        "role": (
                            "enrollment"
                            if image_number in ENROLLMENT_IMAGES
                            else "probe"
                        ),
                        "image_path": str(
                            dataset_relative_root
                            / "original"
                            / f"{subject:03d}"
                            / f"{image_number:02d}.jpg"
                        ),
                    }
                )


def prepare_dataset(archives_dir: Path, output_root: Path) -> None:
    resolved_output = output_root.resolve()
    if not resolved_output.is_relative_to(SAFE_DATA_ROOT):
        raise ValueError(
            "FEI data must stay beneath performance/biometric/data."
        )

    archive_paths, members = inspect_archives(archives_dir.resolve())
    resolved_output.mkdir(parents=True, exist_ok=True)
    extract_images(members, resolved_output)

    dataset_relative_root = resolved_output.relative_to(SAFE_DATA_ROOT)
    write_manifest(
        resolved_output / "calibration_manifest.csv",
        CALIBRATION_SUBJECTS,
        dataset_relative_root,
    )
    write_manifest(
        resolved_output / "evaluation_manifest.csv",
        EVALUATION_SUBJECTS,
        dataset_relative_root,
    )

    record = {
        "dataset": "FEI Face Database - original images",
        "official_url": "https://fei.edu.br/~cet/facedatabase.html",
        "usage": "research only; do not distribute or reproduce",
        "subjects": 200,
        "images_per_subject": 14,
        "enrollment_image_numbers": sorted(ENROLLMENT_IMAGES),
        "probe_image_numbers": sorted(EXPECTED_IMAGES - ENROLLMENT_IMAGES),
        "calibration_subjects": "001-100",
        "held_out_evaluation_subjects": "101-200",
        "archives": [
            {
                "filename": path.name,
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for path in archive_paths
        ],
    }
    (resolved_output / "dataset_record.json").write_text(
        json.dumps(record, indent=2) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--archives-dir",
        type=Path,
        required=True,
        help="Directory containing originalimages_part1.zip through part4.zip.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path("performance/biometric/data/fei"),
        help="Ignored local destination beneath performance/biometric/data.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    prepare_dataset(args.archives_dir, args.output_root)
    print(f"FEI dataset prepared: {args.output_root}")


if __name__ == "__main__":
    main()
