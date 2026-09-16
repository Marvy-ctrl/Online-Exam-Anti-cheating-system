# Session-level face policy evaluation

This offline simulator evaluates whether repeated observations can reduce false
identity alerts while retaining detection of sustained impostor attempts. It
uses held-out FEI pair distances and detector rejections produced by the
biometric threshold evaluator.

It does not import or modify the API, Celery production task, database, evidence
storage, or deployed `0.40` threshold.

## Pre-registered policies

1. `single_anomaly_current`: one mismatch, no-face, multiple-face, or technical
   error triggers an alert. This models the risk of treating one frame as
   definitive.
2. `two_consecutive_mismatches`: two direct mismatches; three consecutive
   no-face observations; or two multiple-face observations within three frames.
3. `three_consecutive_mismatches`: three direct mismatches; the same separate
   no-face and multiple-face rules.
4. `three_mismatches_in_five`: three mismatches among the latest five frames;
   the same separate no-face and multiple-face rules.

A successful match breaks a consecutive mismatch or no-face streak. Technical
processing errors do not count as identity evidence in candidate policies.

`single_anomaly_current` is a comparison model: the production worker currently
records a violation for each anomalous frame, but ExamLoc does not itself make a
disciplinary conclusion. The model asks what would happen if every recorded
single-frame violation were escalated as a session-level identity alert.

## Simulation design

- Genuine sessions draw observations from each subject compared with their own
  enrolled template.
- Impostor sessions draw one subject's probes compared with another subject's
  template.
- Detector rejections are included as `no_face`, `multiple_faces`, or
  `technical_error` observations.
- Each simulated session shuffles the finite observation pool without
  replacement before beginning another cycle.
- Every policy sees the same deterministic simulated sessions for a fair paired
  comparison.

The default run generates 10,000 genuine and 10,000 impostor sessions, each
with nine observations:

```bash
env/bin/python -m performance.session_policy.evaluate \
  --pair-scores performance/biometric/results/fei-held-out/pair_scores.csv \
  --rejected-images performance/biometric/results/fei-held-out/rejected_images.csv \
  --threshold 0.40 \
  --sessions-per-class 10000 \
  --observations-per-session 9 \
  --output-dir performance/session_policy/results/fei-held-out-9-observations
```

Raw derived results remain beneath the Git-ignored results directory.

## Metrics

- Genuine-session false-alert rate.
- Impostor-session detection rate.
- Median and p95 observation number required for detection.
- Aggregate reason counts for alerts and detections.

## Limitations

FEI contains still images, not sequential webcam video. Shuffled and bootstrapped
sessions do not reproduce temporal correlation, motion, camera outages,
adversarial behavior, or the diversity of real examination environments.
Repeated simulations reuse the same 100 held-out identities and do not create
10,000 independent participants. Results are comparative engineering evidence,
not population-level FAR/FRR values or permission to deploy a policy.

Before production changes, validate the selected rule prospectively with
consenting participants or appropriately licensed sequential data. Product UX
must distinguish capture guidance from an examiner-review incident, and final
disciplinary decisions must not be automated from face observations alone.
