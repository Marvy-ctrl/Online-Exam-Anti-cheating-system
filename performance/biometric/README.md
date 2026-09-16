# Controlled biometric evaluation

This offline harness evaluates ExamLoc's face-distance decision rule without
changing production verification. It uses the same decoding, enrollment quality
checks, 128-dimensional face encoder, multi-image averaging, and Euclidean
distance implementation as the application.

Read `PROTOCOL.md` before collecting images. Use `REPORT_TEMPLATE.md` to record
the run context, limitations, aggregate results, and deletion schedule.
Reviewed aggregate evaluation reports belong under `reports/`; raw result files
remain ignored under `results/`.

## Privacy boundary

- Use informed, consenting participants or a dataset whose licence explicitly
  permits biometric evaluation.
- Use pseudonymous subject and sample identifiers. Do not place names, emails,
  student IDs, or other identity data in the manifest.
- Keep images under `performance/biometric/data/` or another access-controlled
  local directory. The repository ignores the local data and result folders.
- Do not commit images, embeddings, pair scores, rejected-image details, or raw
  biometric distances.
- Delete the local dataset and raw outputs according to the evaluation's agreed
  retention period.

## Dataset design

Each subject needs:

- Three to five enrollment images, matching the production enrollment flow.
- At least one separate probe image that was not used for enrollment.
- Genuine probes captured under representative lighting, pose, expression, and
  camera conditions.

At least two subjects are technically required to calculate false acceptance,
but such a tiny pilot is not evidence for a published FAR or FRR claim. Record
participant count, demographic and environmental limitations, device types,
capture protocol, and exclusions alongside any retained aggregate report.

### FEI research dataset

For the FEI Face Database original-image archives, use the preparation command
below after downloading all four ZIP files from the official source:

```bash
python -m performance.biometric.prepare_fei \
  --archives-dir /path/to/downloads \
  --output-root performance/biometric/data/fei
```

The preparer verifies 2,800 unique images, extracts them beneath the ignored data
directory, records archive SHA-256 hashes, and creates identity-disjoint splits:

- Subjects 001-100: threshold calibration.
- Subjects 101-200: held-out evaluation.

For every subject, images 03, 05, 07, 11, and 12 are enrollment captures. The
remaining nine are probes. This fixed rule represents moderate pose and frontal
expression variation during enrollment while retaining extreme profile and
low-light images as operationally difficult probes. Do not change the split
after inspecting FAR or FRR.

FEI permits research use but prohibits redistribution or reproduction. Never
commit, share, or publish the extracted images. Publish reviewed aggregate
measurements only unless FEI separately grants permission to reproduce images.

Copy `manifest.example.csv` to the ignored data directory and replace its rows
with pseudonymous samples. Paths are relative to the dataset root.

```text
sample_id,subject_id,role,image_path
s001_enroll_1,subject_001,enrollment,subject_001/enrollment_1.jpg
s001_probe_1,subject_001,probe,subject_001/probe_1.jpg
```

## Run

Activate the backend environment containing `face_recognition`, NumPy, Pillow,
and FastAPI. The evaluator loads only the production face-utility file; it does
not initialize the API or require database configuration. From the repository
root:

```bash
python -m performance.biometric.evaluate \
  --manifest performance/biometric/data/fei/calibration_manifest.csv \
  --dataset-root performance/biometric/data \
  --output-dir performance/biometric/results/fei-calibration
```

The evaluator applies enrollment quality checks before averaging templates. It
then compares every accepted probe against every subject template. A comparison
with the same subject is genuine; comparisons with other subjects are impostor
attempts. A match uses the production rule `distance < threshold`.

Outputs include:

- `threshold_metrics.csv`: FAR and FRR from 0.30 through 0.60.
- `run_summary.json`: sample counts and the measured 0.40 result.
- `pair_scores.csv`: pseudonymous pair distances for audit and plotting.
- `rejected_images.csv`: samples excluded because decoding or detection failed.

All outputs are ignored because even pseudonymous pair distances are sensitive.
Only publish a separately reviewed aggregate report with the study limitations.

## Metrics

```text
FAR = false accepts / impostor attempts
FRR = false rejects / genuine attempts
```

The threshold where FAR and FRR are closest is reported for analysis; it is not
automatically a safe production threshold. ExamLoc is an anti-cheating system,
so the operational trade-off and the consequences of both error types must be
reviewed before changing the configured 0.40 threshold.
