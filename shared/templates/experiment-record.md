# Experiment Record Template

Use this as the default downstream proof artifact.

Create a separate decision record only when the decision needs to stand alone as long-lived doctrine, a cross-track handoff, or a reopened case.

- Candidate id:
- Candidate name:
- Experiment date:
- Owning track:
- Experiment type:
- Objective:
- Bounded scope:
- Inputs:
- Expected output:
- Validation gate(s):
- Transition policy profile:
- Scoring policy profile:
- Blocked recovery path:
- Failure criteria:
- Rollback:
- Result summary:
- Evidence path:
- Next decision: `adopt` | `defer` | `reject` | `needs-more-evidence` | `hand-off-to-runtime`

## Lifecycle classification (per `architecture-artifact-lifecycle` contract)

- Origin: `source-driven` | `internally-generated`
- Usefulness level: `direct` | `structural` | `meta`
- Runtime threshold check: Would this mechanism still be valuable without a runtime surface? `yes` (→ Architecture) | `no` (→ Runtime handoff)

## Source adaptation fields (Architecture source-driven experiments only)

Fill these when the experiment involves source-driven Architecture work.
Leave blank for non-source work or Runtime experiments.

- Source analysis ref: (path to source-analysis artifact, per `source-analysis-contract`)
- Adaptation decision ref: (path to adaptation-decision artifact, per `adaptation-decision-contract`)
- Adaptation quality: `strong` | `adequate` | `weak` | `skipped`
- Improvement quality: `strong` | `adequate` | `weak` | `skipped`
- Meta-useful: `yes` | `no` — does this experiment improve the engine's own source-consumption ability?
- Meta-usefulness category: `analysis_quality` | `extraction_quality` | `adaptation_quality` | `improvement_quality` | `routing_quality` | `evaluation_quality` | `handoff_quality` | `n/a`
- Transformation artifact gate result: `passed` | `partial` | `failed`
- Transformed artifacts produced:
