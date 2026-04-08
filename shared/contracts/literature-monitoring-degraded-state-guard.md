# Literature Monitoring Degraded-State Guard

## Purpose

Define the proof and evaluator expectations for a bounded Runtime literature-monitoring slice before any host promotion.

This guard exists to prevent a monitoring workflow from:
- hiding weak evidence behind a normal-looking digest
- silently succeeding with an empty or poor candidate pool
- claiming usefulness without inspectable ranking and degraded-state behavior

## Required Proof Cases

Every bounded literature-monitoring slice must prove at least:

1. `qualified_pool_case`
   - a non-empty candidate pool is fetched
   - at least one candidate passes the ranking/filter criteria
   - a digest artifact is emitted

2. `degraded_quality_case`
   - provider results are empty, weak, or below quality threshold
   - normal digest delivery is not claimed
   - an explicit degraded-state artifact is emitted instead

## Required Evaluator Fields

These are bounded slice evaluators, not promotion profiles:

- `candidate_pool_count`
  - number of fetched candidates before filtering
- `accepted_candidate_count`
  - number of candidates included in the digest
- `digest_artifact_emitted`
  - `yes | no`
- `degraded_state_visible`
  - `yes | no`
- `ranking_rationale_present`
  - `yes | no`
- `evidence_quality_result`
  - `pass | degraded_quality | fail`
- `delivery_result`
  - `delivered | degraded_only | fail`

## Pass Rules

The slice may claim `pass` only if:
- qualified-pool case emits a digest artifact
- degraded-quality case emits an explicit degraded artifact
- ranking rationale is present in the normal digest path
- degraded-state visibility is explicit in the weak-evidence path

## Failure Rules

The slice must be treated as failed if:
- weak evidence still emits a normal digest without degraded visibility
- the workflow reports success with no artifact output
- degraded state is implied but not explicitly surfaced
- ranking/filter decisions cannot be inspected at all

## Rollback Rule

If the guard fails:
- keep the candidate in Runtime follow-up
- do not open promotion
- do not open registry acceptance
- preserve Architecture-owned source and partition logic
- remove only slice-specific runtime artifacts if any were created

## Relationship To Other Contracts

- Uses workflow boundary from:
  - `shared/contracts/bounded-literature-monitoring-workflow.md`
- Complements:
  - `shared/contracts/evaluator-contract.md`
  - `shared/contracts/runtime-to-host.md`
  - `shared/templates/literature-monitoring-digest.md`
  - `shared/templates/literature-monitoring-degraded-state.md`
  - `shared/schemas/literature-monitoring-digest.schema.json`
  - `shared/schemas/literature-monitoring-degraded-state.schema.json`
