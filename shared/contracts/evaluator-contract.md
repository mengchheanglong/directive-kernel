# Evaluator Contract

## Purpose

Evaluators measure dimensional improvement. Gates measure binary pass/fail.
Both are valid verification surfaces. They serve different questions:

- Gate: "Did this pass the required checks?"
- Evaluator: "How much better is this than the baseline?"

## Evaluator Shape

Required fields:

- `metric`: what is being measured (e.g., latency_p99, cost_per_call, correctness_rate, build_time_seconds)
- `baseline`: the before-state measurement
- `measurement_method`: how the metric is obtained (e.g., benchmark script, production telemetry, manual test)
- `threshold`: minimum improvement required to accept (optional — some evaluators are informational)
- `comparison_mode`: how before and after are compared
  - `absolute_improvement`: after - before
  - `relative_improvement`: (after - before) / before
  - `regression_check`: after >= before (no degradation)
  - `threshold_check`: after meets a fixed threshold

## Rules

- Evaluators are optional enrichment on top of gates, not a replacement for gates
- Transformation work should always include at least one evaluator alongside its proof checklist
- Non-transformation work (standard capability adoption) uses gates only unless the change has measurable performance impact
- Evaluator results should be recorded in the proof artifact or in a linked evaluator-result artifact

## Architecture adaptation evaluation

Architecture source-adaptation work can also use evaluators when the adaptation or improvement has measurable quality dimensions.

Applicable metrics for source adaptation:
- `adaptation_coverage`: fraction of extractable mechanisms that received explicit adaptation (not raw adoption)
- `improvement_coverage`: fraction of extractable mechanisms that received explicit improvement beyond source
- `baggage_exclusion_rate`: fraction of identified baggage that was successfully excluded
- `delta_evidence_completeness`: whether `original_vs_adapted_delta` and `original_vs_improved_delta` fields are substantive (not placeholder)
- `meta_usefulness_hit_rate`: fraction of adaptations flagged as meta-useful that demonstrably improved subsequent source-consumption cycles

These are informational evaluators, not gates. They help Architecture track whether the source-adaptation chain is producing genuine adaptation/improvement value or silently defaulting to the weak `extract → adopt` pattern.

Reference: `shared/contracts/source-analysis-contract.md`, `shared/contracts/adaptation-decision-contract.md`

## Relationship to existing verification

- Gates remain the primary enforcement surface for all Runtime work
- Evaluators add dimensional measurement for transformation work and performance-sensitive changes
- The transformation proof schema (`shared/schemas/transformation-proof-artifact.schema.json`) embeds evaluator fields directly
- Promotion profiles that reference this contract require before/after measurement, not just pass/fail
- Architecture adaptation evaluators are informational and track adaptation quality trends across source-processing cycles
