# Session-level face policy report

## Status and scope

- Date:
- Git commit/worktree state:
- Dataset and held-out split:
- Threshold evaluated: `0.40` (unchanged in production)
- Simulated sessions per class:
- Observations per session:
- Random seed:

## Pre-registered research question

Which repeated-observation rule reduces genuine-session false alerts while
maintaining high detection of sustained impostor attempts within an acceptable
number of observations?

## Results

| Policy | Genuine false alerts | Impostor detection | Median observations to detection | p95 observations to detection |
|---|---:|---:|---:|---:|
| Single anomaly |  |  |  |  |
| Two consecutive mismatches |  |  |  |  |
| Three consecutive mismatches |  |  |  |  |
| Three mismatches in five |  |  |  |  |

## Interpretation

- Reduction in false alerts relative to single-frame behavior:
- Detection-rate trade-off:
- Detection-delay trade-off:
- Separate no-face and multiple-face behavior:
- Candidate, if any, for prospective validation:

## Limitations

State clearly that FEI contains still images; simulations reuse a finite set of
100 held-out identities; permutations are not real temporal sessions; results
exclude live camera/network behavior; and disciplinary conclusions require
human review and corroborating evidence.

## Decision

Do not change production behavior from this simulation alone. Record whether a
candidate advances to prospective testing, requires revision, or is rejected.
