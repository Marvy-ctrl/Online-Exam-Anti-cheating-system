# ExamLoc biometric evaluation protocol

## Purpose

This protocol evaluates the existing ExamLoc face-verification pipeline and its
current Euclidean-distance threshold of `0.40`. It is an engineering evaluation,
not evidence of universal biometric accuracy. Do not generalize results beyond
the participants, cameras, environments, and capture procedure represented in
the dataset.

## Approval and consent

Before collecting any image:

1. Explain that face images will be converted into biometric embeddings and
   compared with other participants' templates.
2. Explain the purpose, storage location, access controls, retention period, and
   deletion procedure.
3. Obtain explicit, informed consent that can be withdrawn.
4. Do not use existing student, employee, social-media, or production images
   merely because they are technically accessible.
5. For publication, institutional research, or external distribution, confirm
   whether formal ethics or institutional review is required.

Record consent separately from the biometric manifest. The manifest must contain
only pseudonymous identifiers.

## Dataset boundary

For an initial engineering pilot, use at least 10 consenting subjects when
practical. A smaller run can validate the harness but must not support a public
FAR or FRR claim. A later formal evaluation should justify its sample size and
representation before data collection begins.

Each subject should contribute:

- Five enrollment captures where possible; at least three must pass the same
  production quality checks.
- At least five separate probe captures that are never used for enrollment.
- Captures from representative devices and conditions rather than repeated
  copies of one image.

Never duplicate or digitally alter one capture to inflate the sample count.

## Capture procedure

### Enrollment captures

Use the same pattern as the application:

1. Neutral, front-facing image.
2. Slight left pose.
3. Slight right pose.
4. Chin slightly raised.
5. Natural expression variation.

Capture one face only. Keep the face visible and reasonably centred. Record
quality failures instead of repeatedly selecting only ideal images after seeing
the verification result.

### Probe captures

Collect separate probes covering representative variation:

1. Normal lighting and front-facing.
2. Moderate side pose.
3. Expression variation.
4. Lower but usable lighting.
5. A second capture session or device, when possible.

Do not deliberately include unusable images in FAR/FRR calculations. No-face,
multiple-face, decode, and encoding failures are operational failure modes and
must be reported separately.

## Manifest rules

Use `manifest.example.csv` as the schema:

```text
sample_id,subject_id,role,image_path
```

- `sample_id`: unique pseudonymous capture identifier.
- `subject_id`: stable pseudonymous participant identifier.
- `role`: exactly `enrollment` or `probe`.
- `image_path`: path relative to the protected dataset directory.

Do not include names, emails, student IDs, enrollment IDs, exam IDs, or other
direct identifiers.

## Pre-registered decision rule

The production decision is:

```text
match = distance < threshold
```

The evaluation must include the deployed `0.40` threshold. Explore `0.30`
through `0.60` in `0.01` increments without changing production configuration.

For each threshold:

```text
FAR = false accepts / impostor attempts
FRR = false rejects / genuine attempts
```

Every accepted probe is compared with its own subject template for a genuine
attempt and with every other subject template for impostor attempts. These pair
comparisons are useful engineering measurements but are not all statistically
independent; report subject and probe counts alongside the rates.

## Inclusion and exclusion

Define these rules before viewing the final rates:

- Enrollment images failing production brightness, blur, face-count, or encoding
  checks are excluded and recorded.
- A subject with fewer than three passing enrollment images is excluded from the
  run and must not be silently replaced after results are inspected.
- Probe images with decode, face-count, or encoding failures are excluded from
  FAR/FRR and counted separately as operational failures.
- Do not remove valid high-distance genuine pairs or low-distance impostor pairs
  because they make the results look worse.
- Any post-run exclusion requires a written reason in the retained report.

## Run record

For every evaluation, record:

- Git commit and dirty-worktree status.
- Date and evaluator.
- Dataset version and collection dates.
- Subject, enrollment-image, and probe-image counts.
- Device and capture-condition summary.
- Inclusion, exclusion, and withdrawal counts.
- `face_recognition`, dlib, Python, NumPy, and operating-system versions.
- Threshold range and step.
- Current-threshold result at `0.40`.
- Limitations and whether the run is a harness check, engineering pilot, or
  formal evaluation.

## Retention and deletion

- Keep raw images and pair scores only for the agreed evaluation period.
- Restrict access to the minimum number of people required.
- Never commit raw inputs or outputs to Git.
- Delete withdrawn participants' images and regenerate derived results.
- Delete raw data and pair scores at the end of the retention period.
- Retain only a reviewed aggregate report when continued retention is justified.

## Acceptance decision

The harness reports the threshold where FAR and FRR are closest, but that value
is not automatically the production choice. Review:

- Security consequences of false acceptance.
- Student impact of false rejection.
- Operational handling of no-face and multiple-face failures.
- Dataset representation and environmental limitations.
- Whether the result is repeatable on a separate capture session.

Any threshold change requires a separate configuration change, regression tests,
and a documented rollback plan.
