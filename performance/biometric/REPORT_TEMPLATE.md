# ExamLoc biometric evaluation report

## Run classification

- Classification: harness check / engineering pilot / formal evaluation
- Date:
- Evaluator:
- Git commit:
- Dirty worktree: yes / no
- Dataset version:

## Scope and limitations

Describe the intended use of this run and what conclusions it cannot support.

## Dataset

- Consented or licensed source:
- Subjects included:
- Subjects excluded:
- Enrollment images submitted:
- Enrollment images accepted:
- Probe images submitted:
- Probe images accepted:
- Operational image failures:
- Devices represented:
- Capture sessions represented:
- Lighting and pose conditions:
- Retention deadline:

Do not include participant names, contact information, or raw image paths.

## Environment

- Operating system:
- Python version:
- `face_recognition` version:
- dlib version:
- NumPy version:
- Hardware:

## Pre-registered procedure

- Enrollment images per subject:
- Minimum passing enrollment images:
- Probe protocol:
- Threshold range:
- Threshold step:
- Production threshold evaluated:
- Exclusion rules:

## Results at threshold 0.40

- Genuine attempts:
- Impostor attempts:
- False rejects:
- False accepts:
- FRR:
- FAR:
- Rejected image count:

## Threshold comparison

Summarize the retained aggregate rows from `threshold_metrics.csv`. Do not attach
raw pair scores to a public or portfolio report.

| Threshold | Genuine attempts | Impostor attempts | False rejects | False accepts | FRR | FAR |
|---:|---:|---:|---:|---:|---:|---:|
| 0.40 |  |  |  |  |  |  |

## Throughput

- Images processed:
- Total evaluation duration:
- Average embedding time:
- Average comparison time:
- Hardware limitations:

Complete this section only after the throughput harness is implemented.

## Decision

- Keep or change `0.40`:
- Evidence supporting the decision:
- Security trade-off:
- Student-impact trade-off:
- Additional data required:
- Rollback plan if changed:

## Privacy and deletion record

- Dataset storage location reviewed:
- Access list reviewed:
- Git ignore check completed:
- Withdrawal requests processed:
- Raw-data deletion completed or scheduled for:
- Aggregate artifacts retained:
