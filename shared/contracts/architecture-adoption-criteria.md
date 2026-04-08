# Architecture Adoption Criteria

Profile: `architecture_adoption_criteria/v1`

## Purpose

Operationalize the Decide step of the canonical source flow for Architecture:

**Source → Analyze → Route → Extract → Adapt → Improve → Prove → Integrate**

This contract governs when an adapted/improved mechanism should be adopted, what artifact type it should become, when it should stay experimental, and when it should hand off to Runtime.

Without this contract, Architecture adoption decisions are ad hoc: mechanisms get adopted because they "seem useful" or because the experiment completed, not because structured criteria were met.

## When to use

Use this contract when:
- an adaptation-decision record exists (per `adaptation-decision-contract`)
- the adapted/improved mechanism needs a product-owned materialization decision
- an existing adopted mechanism is being re-evaluated for artifact type or scope

If the Decide step needs a deterministic machine-readable resolution, use `architecture/lib/architecture-adoption-resolution.ts`.
If the Decide step also needs a canonical schema-shaped adoption artifact, emit it through `architecture/lib/architecture-adoption-artifacts.ts`.
If the Decide step should resolve review, resolve adoption, and retain the resulting decision as one canonical closeout flow, use `architecture/lib/architecture-closeout.ts`.
If that adoption artifact should be retained beside an adopted record, emit it through `architecture/lib/architecture-adoption-decision-writer.ts`.
That writer may consume raw review input and resolve the review/adoption path before retaining the decision artifact.

## Adoption decision surface

### 1. Adoption readiness check

All of the following must be true before adoption:

- `source_analysis_complete`: a source-analysis record exists with verdict `proceed_to_extraction`
- `adaptation_decision_complete`: an adaptation-decision record exists with `next_action` = `proceed_to_proof`
- `adaptation_quality_acceptable`: `overall_adaptation_quality` is `strong` or `adequate` (not `weak` or `skipped` without explicit justification)
- `delta_evidence_present`: `original_vs_adapted_delta` and `original_vs_improved_delta` are substantive, not placeholder
- `no_unresolved_baggage`: all identified baggage from the source analysis has been explicitly excluded or justified

If any of these are false, the mechanism should return verdict `stay_experimental` and remain in `02-experiments` until the gap is closed.

### 2. Artifact type selection

Use this decision matrix to select the target artifact type:

| Extracted value shape | Target artifact type | Target surface |
|---|---|---|
| An interface or handoff structure between tracks or stages | `contract` | `shared/contracts/` |
| A data shape that should be standardized for agents and validators | `schema` | `shared/schemas/` |
| A reusable working document structure that forces consistent execution | `template` | `shared/templates/` |
| A rule or constraint that governs behavior across the system | `policy` | `shared/contracts/` |
| A reusable design or workflow pattern not yet productized | `reference-pattern` | legacy classification only - keep experimental until promoted or explicitly deferred |
| Executable helper logic that should be product-owned | `engine-code` | `engine/` (lane-owned code under `architecture/lib/`, `runtime/lib/`, or `discovery/lib/`; residual support only under `shared/lib/`) |
| A change to how the system fundamentally operates | `doctrine-update` | `knowledge/` |

Selection rules:
- If the mechanism governs interaction between two or more system components → `contract`
- If the mechanism defines a data shape that agents or code must conform to → `schema`
- If the mechanism structures human or agent work into repeatable steps → `template`
- If the mechanism constrains behavior without defining data or interaction shape → `policy`
- If the mechanism is a good example but not yet an enforceable rule → keep it experimental until it can become a contract, template, policy, or doctrine update
- If the mechanism is executable logic → `engine-code`
- If the mechanism changes the operating model itself → `doctrine-update`
- When unclear between `contract` and `policy`, prefer `contract` if there are required fields, prefer `policy` if there are only rules
- When unclear between `template` and `contract`, prefer `template` if the output is a filled document, prefer `contract` if the output is a constraint set

### 3. Architecture-to-Runtime threshold

Hand off to Runtime instead of adopting in Architecture when **all** of the following are true:

- the remaining value is **callable runtime capability**, not reusable internal operating logic
- the mechanism requires host integration, runtime gates, or production deployment
- Architecture has already captured its own value (the framework pattern, policy, or operating logic)
- the handoff can be explicit via `shared/contracts/architecture-to-runtime.md`

Do **not** hand off to Runtime when:
- the mechanism is purely structural (improves how the system works, not what it does at runtime)
- the mechanism is meta-useful (improves the engine's own source-consumption ability)
- the Runtime handoff would leave Architecture with no product-owned artifact

Threshold rule: if you are unsure whether the remaining work is Architecture or Runtime, ask: "Would this mechanism still be valuable if we never built a runtime surface for it?" If yes, it belongs in Architecture. If no, it belongs in Runtime.

### 4. Usefulness level treatment

The three usefulness levels from the source-analysis contract require different adoption treatment:

#### Direct usefulness (`direct`)
- The mechanism is useful immediately for repeated user/runtime use.
- Default path: extract, adapt, improve, then hand off to Runtime for runtime operationalization.
- Architecture retains: the adapted framework pattern as experimental evidence or the retained operating logic as `engine-code` / contract.
- Adoption artifact: usually `contract` in Architecture, with a Runtime handoff.

#### Structural usefulness (`structural`)
- The mechanism is useful for how the system works.
- Default path: extract, adapt, improve, then adopt as a product-owned Architecture artifact.
- No Runtime handoff unless a runtime component is also identified.
- Adoption artifact: usually `contract`, `schema`, `template`, or `policy`.
- Evidence required: explain how the mechanism improves system structure (routing, evaluation, handoff, workflow, or doctrine quality).

#### Meta-usefulness (`meta`)
- The mechanism is useful because it improves Directive Workspace's ability to discover, judge, extract, adapt, and improve future sources.
- Default path: extract, adapt, improve, then adopt as a high-priority Architecture artifact.
- Meta-useful mechanisms should be flagged for Architecture self-improvement tracking (per `architecture-self-improvement-contract`).
- Adoption artifact: usually `contract`, `template`, or `doctrine-update`.
- Evidence required: explain which self-improvement category is strengthened (`analysis_quality`, `extraction_quality`, `adaptation_quality`, `improvement_quality`, `routing_quality`, `evaluation_quality`, `handoff_quality`).
- Priority rule: meta-useful adoptions take priority over direct-useful adoptions because they compound — improving the engine makes all future source consumption more valuable.

### 5. Stay-experimental criteria

Keep the mechanism in `02-experiments` (do not adopt) when any of these are true:

- `adaptation_quality` is `weak` or `skipped` without justification
- `delta_evidence` is placeholder or absent
- the mechanism's value depends on another mechanism that has not yet been adopted
- the target artifact type is unclear after attempting the selection matrix
- the mechanism requires proof that has not yet been executed
- the mechanism conflicts with an existing adopted contract, schema, or policy

Re-evaluate when the blocking condition is resolved.

## Required adoption record fields

When adopting, the Architecture adopted record must include:

- `adoption_date`: ISO date
- `source_id`: candidate id or name
- `usefulness_level`: `direct` | `structural` | `meta`
- `artifact_type`: from the selection matrix
- `artifact_path`: path to the product-owned artifact
- `adaptation_quality`: `strong` | `adequate`
- `improvement_quality`: `strong` | `adequate` | `weak` | `skipped` (with rationale if weak/skipped)
- `meta_useful`: `yes` | `no`
- `self_improvement_category`: if meta-useful
- `runtime_handoff`: `yes` | `no`
- `runtime_handoff_ref`: if applicable
- `completion_status`: per `architecture-completion-rubric` status classes

## Rules

- Never adopt with `adaptation_quality` = `weak` or `skipped` unless explicitly justified
- Never adopt without substantive delta evidence
- Meta-useful mechanisms get adoption priority
- Direct-useful mechanisms should have a Runtime handoff plan even if the handoff is deferred
- Structural-useful mechanisms are the core Architecture output — they strengthen the system itself
- The artifact type selection matrix is a decision aid, not a gate — use judgment when the matrix is ambiguous
- Every adoption must be traceable to a source-analysis record and an adaptation-decision record

For mixed-value sources, prefer adopting an explicit partition artifact in Architecture before any Runtime handoff so the retained Architecture value is not lost.

## Relationship to other contracts

- Receives input from: `adaptation-decision-contract` (the adapted/improved mechanism)
- Feeds output to: `architecture-completion-rubric` (completion tracking)
- Feeds Runtime handoff via: `architecture-to-runtime` (when direct-useful with runtime component)
- Feeds self-improvement tracking via: `architecture-self-improvement-contract` (when meta-useful)
- Complements: `architecture-review-guardrails` (review process quality)
