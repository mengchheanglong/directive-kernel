# Adaptation Decision Contract

Profile: `adaptation_decision/v1`

## Purpose

Operationalize the Extract → Adapt → Improve steps inside the canonical source flow:

**Source → Analyze → Route → Extract → Adapt → Improve → Prove → Decide → Integrate + Report**

This contract governs what happens after source analysis is complete and before proof begins.

Without this contract, Architecture defaults to the weak pattern:
- `extract → adopt` (copy useful parts, skip adaptation and improvement)

The doctrine requires the strong pattern:
- `extract → adapt → improve` (make extracted value fit Directive Workspace better than it fits the original source, then improve beyond it before proof/decision/integration)

## When to use

Use this contract when:
- source analysis is complete (source-analysis-contract verdict = `proceed_to_extraction`)
- Architecture is deciding what to extract, how to adapt it, and how to improve it
- a previously extracted mechanism needs re-evaluation for adaptation or improvement quality

## Required decision fields

### 1. Source reference

- `source_id`: candidate id or name
- `analysis_record_ref`: path to the completed source-analysis record
- `decision_date`: ISO date

### 2. Extraction decisions

For each mechanism identified in the source analysis value map:

- `mechanism_id`: name or short identifier
- `extraction_decision`: `extract` | `skip` | `defer`
- `extraction_rationale`: why this mechanism is worth extracting (or not)
- `raw_form_summary`: what the mechanism looks like in the original source
- `target_artifact_type`: `contract` | `schema` | `template` | `policy` | `engine-code` | `reference-pattern` | `shared-lib` | `doctrine-update`
- `target_path`: intended file path in Directive Workspace

### 3. Adaptation decisions

For each extracted mechanism:

- `adaptation_required`: `yes` | `no` | `minimal`
- `adaptation_description`: concrete description of how the mechanism will be reshaped to fit Directive Workspace
- `adaptation_actions`: list of specific changes:
  - terminology alignment
  - structural reshape
  - simplification
  - extension
  - constraint addition
  - recomposition with existing assets
- `adaptation_validates_against`: which existing Directive Workspace contracts, schemas, or patterns the adapted form must be compatible with
- `original_vs_adapted_delta`: explicit summary of what changes between the original mechanism and the Directive-owned adapted form

### 4. Improvement decisions

For each extracted mechanism:

- `improvement_applied`: `yes` | `no`
- `improvement_description`: concrete description of how the mechanism is improved beyond the original source
- `improvement_type`: `quality` | `efficiency` | `safety` | `generality` | `composability` | `evaluability`
- `improvement_rationale`: why this improvement matters for Directive Workspace
- `improvement_evidence_plan`: how the improvement will be verified (links to evaluator-contract or proof-checklist if applicable)
- `original_vs_improved_delta`: explicit summary of what the improved form does that the original does not

### 5. Integration target

- `integration_surface`: `shared/contracts` | `shared/schemas` | `shared/templates` | `knowledge` | `shared/lib`
- `integration_dependencies`: what existing assets must be updated or aware of this new artifact
- `runtime_handoff_required`: `yes` | `no` — if the extracted value also has a runtime component that should hand off to Runtime
- `runtime_handoff_ref`: path to architecture-to-runtime handoff record (if applicable)

### 6. Meta-usefulness check

- `improves_source_consumption`: `yes` | `no` — does this extracted/adapted/improved mechanism make Directive Workspace better at consuming future sources?
- `meta_usefulness_description`: if yes, describe how
- `self_improvement_category`:
  - `analysis_quality`: improves source analysis
  - `extraction_quality`: improves extraction decisions
  - `adaptation_quality`: improves adaptation execution
  - `improvement_quality`: improves the ability to improve beyond sources
  - `routing_quality`: improves routing accuracy
  - `evaluation_quality`: improves proof and evaluation
  - `handoff_quality`: improves Architecture-to-Runtime handoff
  - `none`: no meta-usefulness (which is fine — not all extractions are self-improving)

### 7. Decision summary

- `overall_adaptation_quality`: `strong` | `adequate` | `weak` | `skipped`
- `overall_improvement_quality`: `strong` | `adequate` | `weak` | `skipped`
- `confidence`: `high` | `medium` | `low`
- `next_action`: `proceed_to_proof` | `needs_revision` | `defer` | `abandon`

## Rules

- Every extraction must have an explicit adaptation decision, even if the decision is "no adaptation needed" with rationale.
- Every extraction must have an explicit improvement decision, even if the decision is "no improvement applied" with rationale.
- If `overall_adaptation_quality` is `weak` or `skipped` for a non-trivial extraction, the record should explain why the weak pattern (`extract → adopt`) is acceptable in this case.
- If `improves_source_consumption` is `yes`, the mechanism should be flagged as high-priority because meta-useful improvements compound over time.
- The `original_vs_adapted_delta` and `original_vs_improved_delta` fields are mandatory. They are the evidence that adaptation and improvement actually happened, not just extraction.

## Relationship to other contracts

- Receives input from: `source-analysis-contract`
- Works with: `phase-isolated-processing` when adaptation should consume a handoff packet from an isolated analysis phase
- Feeds reusable output to: `architecture-mechanism-packet` when the adapted/improved result should become a compact reusable Architecture building block
- Feeds reusable output to: `cross-source-synthesis-packet` when the adapted value should preserve agreements, tensions, and synthesis across multiple sources
- Feeds output to: `architecture-adoption-criteria` (adoption readiness, artifact type selection, Runtime threshold)
- Feeds output to: proof phase (experiment-record, evaluator-contract, proof-checklist)
- Feeds Runtime handoff via: `architecture-to-runtime` when runtime value is identified
- Feeds self-improvement tracking via: `architecture-self-improvement-contract` when `improves_source_consumption` is `yes`
- Does not replace: `architecture-review-guardrails` (which governs review process quality)
- Complements: `architecture-completion-rubric` (which governs what counts as done)
