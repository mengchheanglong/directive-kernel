# Discovery To Architecture Handoff

Use this handoff when the primary value is internal framework improvement.

## Required fields

- candidate id or name
- source type
- source reference
- routing rationale
- proposed adoption target
- first-pass risks
- suggested experiment type
- evidence or notes collected during triage

## Source-analysis preparation fields

When the routed candidate is a source (repo, paper, framework, tool, workflow, method), Discovery should also provide initial signals to accelerate Architecture's source analysis:

- initial value hypothesis: what extractable value Discovery observed during triage
- initial baggage signals: any implementation, stack, scope, or complexity baggage already visible at triage
- usefulness level hint: `direct` | `structural` | `meta` — Discovery's best guess, not binding
- capability gap reference: gap_id from `discovery/capability-gaps.json` if the candidate addresses a known gap

These fields are advisory. Architecture owns the full analysis via `source-analysis-contract` (profile: `source_analysis/v1`).

## Rules

- Discovery routes.
- Architecture performs deeper evaluation.
- When the handoff involves a source, Architecture's next required step is a source analysis per `shared/contracts/source-analysis-contract.md`.
- Architecture should not skip the source-analysis step and jump directly to extraction or adoption.
- The source-analysis contract output feeds the adaptation-decision contract (`shared/contracts/adaptation-decision-contract.md`), which governs the extract → adapt → improve chain.
