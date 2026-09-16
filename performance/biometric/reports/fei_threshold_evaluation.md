# FEI threshold evaluation - aggregate engineering report

## Status

- Evaluation date: 2026-09-16
- Classification: engineering evaluation supporting future research reporting
- Production configuration changed: no
- Dataset: FEI Face Database original images
- Official source: https://fei.edu.br/~cet/facedatabase.html
- Permitted use recorded by source: research only; do not distribute or reproduce

This report contains aggregate measurements only. Face images, embeddings,
subject-level outcomes, pair scores, and rejected-image details remain local and
Git-ignored.

## Question

Does ExamLoc's deployed Euclidean-distance threshold of `0.40` provide an
appropriate security/usability trade-off, and does the preselected conservative
candidate `0.47` improve genuine acceptance on unseen identities without an
unacceptable increase in false acceptance?

ExamLoc uses the strict comparison rule:

```text
match = distance < threshold
```

Lower values are stricter. Higher values are more lenient.

## Method

The four official FEI archives were validated as 2,800 unique JPEG images: 200
identities with 14 images per identity. Archive hashes and preparation metadata
are retained locally in the ignored dataset record.

For every identity:

- Images 03, 05, 07, 11, and 12 formed the averaged enrollment template.
- The remaining nine images were independent probes.
- Enrollment used ExamLoc's production decoding, quality checks, 128-dimensional
  face embeddings, and template averaging.
- Probes used the production face detector, encoder, and Euclidean distance.

Identity-disjoint splits were fixed before evaluation:

- Calibration: subjects 001-100.
- Held-out evaluation: subjects 101-200.

The calibration split explored thresholds from `0.30` through `0.60`. Based on
that split, `0.47` was preselected as a conservative alternative to `0.40`. The
held-out split was then evaluated only at `0.40` and `0.47`.

```text
FAR = false accepts / impostor comparisons
FRR = false rejects / detected genuine comparisons
```

No-face and multiple-face outcomes are reported separately and are not included
in the FAR or FRR denominator.

## Calibration results

- Identities: 100
- Submitted enrollment images: 500
- Passing enrollment images: 499
- Submitted probes: 900
- Detected probes: 821
- Operationally rejected images: 80
- Genuine comparisons: 821
- Impostor comparisons: 81,279

| Threshold | False rejects | FRR | False accepts | FAR |
|---:|---:|---:|---:|---:|
| 0.40 | 140 | 17.0524% | 15 | 0.0185% |
| 0.47 | 80 | 9.7442% | 33 | 0.0406% |

Calibration image-processing exclusions comprised 79 no-face probe outcomes and
one multiple-face enrollment outcome.

## Held-out results

- Identities: 100
- Submitted enrollment images: 500
- Passing enrollment images: 500
- Submitted probes: 900
- Detected probes: 807
- Operationally rejected probes: 93
- Genuine comparisons: 807
- Impostor comparisons: 79,893

| Threshold | False rejects | FRR | False accepts | FAR |
|---:|---:|---:|---:|---:|
| 0.40 | 138 | 17.1004% | 0 | 0.0000% observed |
| 0.47 | 93 | 11.5242% | 43 | 0.0538% |

All 93 held-out image-processing exclusions were no-face probe outcomes.
`0.0000% observed` means no false accepts occurred in this finite held-out run;
it does not establish that the population false-acceptance probability is zero.

## Interpretation

The held-out `0.40` FRR closely reproduced calibration: 17.1004% versus
17.0524%. This supports the conclusion that `0.40` is a strongly
security-prioritized threshold with a substantial genuine-user rejection cost
under the represented pose and lighting variation.

The `0.47` candidate reduced held-out false rejects from 138 to 93, a reduction
of 45 events and 5.5762 percentage points. Its held-out FAR increased to
0.0538%. The candidate therefore demonstrates a repeatable usability/security
trade-off, not an unqualified improvement.

The 93 no-face outcomes represent 10.33% of submitted held-out probes. Because
ExamLoc records no-face outcomes separately, detector/pose reliability is an
important operational limitation that threshold tuning cannot solve.

## Decision

Do not change the production threshold based solely on this evaluation.

The evidence supports these conclusions:

1. The deployed `0.40` threshold is not lenient; it is strict.
2. Its low observed FAR comes with a reproducible FRR of approximately 17% among
   successfully detected FEI probes.
3. `0.47` reduces genuine rejection, but it also produces measurable impostor
   acceptance and still has an 11.52% held-out FRR.
4. A single-frame threshold is insufficient as the only operational decision.
   Session-level aggregation, repeated observations, capture guidance, and
   detector-failure handling should be evaluated before changing `0.40`.

## Limitations

- FEI images were captured in a controlled environment with a white background.
- Subjects are primarily FEI students and staff aged 19-40.
- Extreme profile and low-light probes intentionally stress face detection.
- Pairwise impostor comparisons are not all statistically independent.
- These results apply to the tested model, preprocessing, capture selection,
  and dataset; they are not universal biometric accuracy claims.
- This evaluation did not measure demographic subgroup performance.
- This evaluation measured per-probe decisions, not session-level risk rules.

## Next research step

Measure face-worker throughput and end-to-end queue latency under concurrent
verification load. Separately, design and evaluate a session-level policy that
requires repeated evidence instead of treating one mismatched or undetected
frame as a definitive identity conclusion.
