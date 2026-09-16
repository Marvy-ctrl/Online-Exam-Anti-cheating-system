# FEI repeated-observation policy evaluation

## Status

- Evaluation type: offline, research-only simulation
- Threshold: deployed comparison threshold `0.40`, unchanged
- Dataset: FEI held-out subjects 101-200
- Genuine subject pools: 100
- Impostor subject pairs: 9,900
- Detector-rejected held-out probes: 93, all classified as no-face
- Simulated sessions: 10,000 genuine and 10,000 impostor per seed
- Observations per session: 9
- Seeds: 20260916, 20260917, 20260918

No API, production worker, database, evidence store, or production threshold was
changed by this evaluation.

## Research question

Can repeated-observation rules reduce genuine-session false alerts while still
detecting sustained impostor attempts within a practical number of frames?

The single-anomaly policy is a comparison model. The current worker records a
violation for every anomalous frame; it does not itself make a disciplinary
decision. The model quantifies the risk if each single-frame violation were
treated as a definitive session-level identity alert.

## Pre-registered policies

1. Single anomaly: one mismatch, no-face, multiple-face, or technical error.
2. Two consecutive mismatches; three consecutive no-face observations; or two
   multiple-face observations within three frames.
3. Three consecutive mismatches; the same separate no-face and multiple-face
   rules.
4. Three mismatches within five observations; the same separate no-face and
   multiple-face rules.

A successful match breaks consecutive streaks. Technical errors are not treated
as identity evidence by candidate policies.

## Aggregate results across three seeds

Rates below are medians, followed by the observed seed range.

| Policy | Genuine-session alert rate | Impostor-session detection | Median observations to detection | p95 observations to detection |
|---|---:|---:|---:|---:|
| Single anomaly | 98.13% (98.10-98.16%) | 100.00% | 1 | 1 |
| Two consecutive mismatches | 12.25% (12.10-12.36%) | 100.00% | 2 | 4 |
| Three consecutive mismatches | 0.68% (0.66-0.76%) | 99.46% (99.39-99.48%) | 3 | 6 |
| Three mismatches in five | 1.94% (1.90-2.17%) | 100.00% | 3 | 5 |

## Interpretation

The single-frame comparison produces an extremely high session-level alert rate
because nine opportunities accumulate both strict-threshold false mismatches and
detector failures. It illustrates why a recorded frame-level event must not be
treated automatically as a definitive identity conclusion.

Two consecutive mismatches substantially improve on single-frame escalation but
still alert on roughly one in eight simulated genuine sessions.

Three consecutive mismatches produced the lowest genuine-session alert rate. It
also missed approximately 0.52-0.61% of simulated impostor sessions within nine
observations and had a p95 detection point of six observations. This is the
preferred candidate for prospective testing when minimizing false accusations
is the priority.

Three mismatches in five detected every simulated impostor session and did so by
observation five at p95, but its median genuine-session alert rate was about
three times that of the three-consecutive rule. It is the stronger alternative
when maximizing detection within a short window is prioritized.

No-face is handled independently. It should initially drive capture guidance
and only become an examiner-review incident after repeated observations. A
technical processing failure is not evidence about identity.

## Limitations

- FEI contains controlled still images, not continuous webcam sessions.
- The simulations reuse finite observations from 100 held-out identities;
  10,000 simulated sessions are not 10,000 independent participants.
- Shuffling does not reproduce temporal correlation, camera outages, motion,
  network delay, adversarial presentation, or changing light.
- The controlled FEI population and acquisition environment do not represent
  all ExamLoc users or deployment settings.
- An alert is only a system event for human review. It is not proof of cheating
  and must not independently cause a disciplinary decision.

## Decision

Do not change production behavior from this simulation alone. Advance both the
three-consecutive and three-in-five policies to a prospective, consented pilot
using sequential captures. Pre-register the operational priority and acceptance
criteria before choosing between them. Keep the production face-distance
threshold at `0.40` during that comparison so threshold and session-policy
effects remain separable.
