# Architecture To Runtime Handoff

Use this handoff when Architecture has extracted a useful callable/runtime follow-up and the next step belongs in Runtime rather than further framework evaluation.

## When to use

- the architecture value has already been captured in Architecture records
- the remaining work is runtime operationalization
- the callable surface needs host-facing gates, proof, and rollback

## Required fields

- candidate id or name
- originating Architecture record
- extracted mechanism kept in Architecture
- runtime value to operationalize in Runtime
- proposed host
- proposed runtime surface
- runtime guardrails
- required proof
- required gates
- rollback note

## Adaptation and improvement evidence

When the handoff originates from a source that went through the source-adaptation chain, these additional fields are required:

- source-analysis record ref: path to the source analysis artifact (per `source-analysis-contract`)
- adaptation-decision record ref: path to the adaptation decision artifact (per `adaptation-decision-contract`)
- adaptation summary: what was changed between the raw extracted mechanism and the Directive-owned adapted form
- improvement summary: what was improved beyond the original source
- value handed to Runtime: describe the **adapted and improved** value, not the raw extracted value

Rule: Runtime should receive adapted/improved value, not raw source extracts. If the mechanism was extracted without adaptation or improvement, the handoff must state why the weak pattern (`extract → adopt`) was acceptable.

## Meta-usefulness flag

- meta-useful: `yes` | `no` — does the extracted mechanism improve Directive Workspace's own source-consumption ability?
- if yes, Architecture should retain a copy of the operating logic even when handing runtime work to Runtime

## Rules

- Architecture keeps the extracted framework pattern.
- Runtime owns the callable follow-up path from this point forward.
- Runtime receives adapted/improved value, not raw extracts.
- If the source went through `source-analysis-contract` and `adaptation-decision-contract`, references to both must be included in the handoff.
- If the source is mixed-value and Architecture used `mixed-value-source-partition`, the handoff should also include the partition ref so Runtime receives only the bounded candidate mechanisms, not the whole mixed source.
