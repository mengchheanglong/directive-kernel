# Bounded Literature Monitoring Workflow

## Purpose

Define the smallest reusable Runtime-owned runtime surface for recurring literature monitoring.

This contract exists for bounded monitoring workflows that:
- query a small paper-source pool
- rank and filter candidates against a bounded topic or mission signal
- render an inspectable digest artifact
- fail closed into an explicit degraded state when evidence quality is weak

It does **not** describe a full autonomous research agent or a broad plugin platform.

## Workflow Shape

Required stages:

1. `candidate_fetch`
   - query only the explicitly allowed providers
   - capture provider status and candidate count

2. `candidate_normalization`
   - normalize source metadata into one bounded candidate shape
   - preserve provider/source references for later inspection

3. `ranking_and_filter`
   - score candidates against one bounded topic or mission signal
   - record enough ranking rationale that a human can inspect why items were kept or dropped

4. `digest_render`
   - produce one concise digest artifact from the accepted candidates
   - include evidence quality summary and source references

5. `delivery_or_degraded_emit`
   - deliver the digest through a delivery adapter if quality is sufficient
   - otherwise emit an explicit degraded-state artifact instead of a false-confidence digest

## Required Inputs

- `topic_input`
  - bounded topic, query, or mission-aligned filter
- `provider_allowlist`
  - explicit source providers allowed for the slice
- `candidate_pool_limit`
  - bounded maximum candidate count before filtering
- `ranking_signal`
  - declared ranking logic or criteria
- `delivery_target`
  - one bounded delivery surface or adapter boundary
- `quality_threshold`
  - explicit minimum evidence quality needed for normal delivery

## Required Outputs

The workflow must produce one of:

- `digest_artifact`
  - concise summary
  - selected candidate refs
  - ranking rationale summary
  - evidence quality result
  - degraded flag = `false`

- `degraded_state_artifact`
  - explicit degraded reason
  - provider and candidate-pool snapshot
  - evidence quality result
  - next-safe action or no-op note
  - degraded flag = `true`

## Boundary Rules

- First slice must stay bounded to `<= 2` paper providers.
- First slice must stay bounded to one delivery target.
- First slice must not require full-text ingestion or broad research synthesis.
- Retrieval, ranking/filter logic, digest rendering, and delivery adapters must stay separable.
- The workflow must not silently succeed with an empty or weak candidate set.
- The workflow must not conceal degraded evidence quality behind a normal digest artifact.

## Architecture Boundary

Architecture keeps:
- mixed-value partition logic
- promotion-quality gate logic
- source-analysis and packet logic used to derive the workflow candidate

Runtime owns:
- callable workflow design
- runtime proof shape
- degraded-state handling behavior
- later host-facing promotion once bounded proof exists

## Acceptance Rule

This workflow is ready for Runtime runtime execution only when:
- the bounded workflow shape is explicit
- the degraded-state guard is explicit
- the slice has a proof checklist
- rollback is bounded and reversible

Related artifacts:
- `shared/contracts/architecture-to-runtime.md`
- `shared/contracts/runtime-to-host.md`
- `shared/contracts/literature-monitoring-degraded-state-guard.md`
- `shared/templates/literature-monitoring-digest.md`
- `shared/templates/literature-monitoring-degraded-state.md`
- `shared/schemas/literature-monitoring-digest.schema.json`
- `shared/schemas/literature-monitoring-degraded-state.schema.json`
