# Architecture Review Checklist Template

Use this when an Architecture proposal, slice, policy, or contract needs a structured review pass.
If the review needs a deterministic next-state recommendation, feed the completed structure into `shared/lib/architecture-review-resolution.ts`.

- Review profile:
  - `architecture_review_guardrails/v1`
- Candidate id:
- Candidate name:
- Review date:
- Review scope:
- Review owner:

## Guardrail Checks

- Signal over noise:
  - Does the proposal keep interfaces or workflow surfaces purpose-driven?
  - Does it remove decorative or low-signal complexity that hides meaning?

- Explicit state visibility:
  - Are status, blockers, degraded modes, and next actions clearly surfaced?
  - Are lifecycle labels unambiguous?

- Safe defaults:
  - Is the rollback or no-op path explicit?
  - Are reversible choices preferred?

- Scope discipline:
  - Is feature intent isolated from unrelated redesign?
  - Is there bounded evidence for the requested change?

- Operational traceability:
  - Are validation gates or validation methods explicit?
  - Are ownership and handoff destinations explicit?

- Artifact/evidence continuity:
  - If stage-boundary artifacts are present, do evidence, citation, or proof-support artifacts remain attached to the same operating chain?
  - If an existing mechanism packet or cross-source synthesis packet exists, does this review consume it instead of reopening the full historical source chain?

## Anti-Pattern Scan

- vague status labels:
- concealed gate failures or degraded states:
- missing validation method:
- blurred Runtime vs Architecture ownership:
- unbounded rewrite pressure:
- ignored reusable packet inputs:
- broken artifact/evidence continuity:

## Review Outcome

- Decision:
- Why:
- Packet inputs consumed:
- Required changes before accept:
- Validation method:
- Rollback or no-op:
