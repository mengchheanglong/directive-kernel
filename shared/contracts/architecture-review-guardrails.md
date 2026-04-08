# Architecture Review Guardrails

Profile: `architecture_review_guardrails/v1`

Purpose:
- standardize Architecture review quality for proposals, slices, and policy changes
- keep review criteria product-owned and reusable
- prevent noisy or ambiguous review outcomes from entering the Directive workflow

Named guardrails:
1. `signal_over_noise`
2. `explicit_state_visibility`
3. `safe_defaults`
4. `scope_discipline`
5. `operational_traceability`
6. `artifact_evidence_continuity`

Required review prompts:
- `state_visibility_check`
- `rollback_check`
- `scope_isolation_check`
- `validation_link_check`
- `ownership_boundary_check`
- `packet_consumption_check`
- `artifact_evidence_continuity_check`

Anti-patterns:
- vague status labels with no decision meaning
- changes that conceal gate failures or degraded states
- recommendations with no validation method
- proposals that blur Runtime vs Architecture ownership
- broad redesign requests without bounded evidence
- reviews that reopen full source history even though reusable mechanism or synthesis packets already exist
- stage-boundary artifacts that become detached from evidence, citation, or proof support artifacts

Rules:
- every Architecture review artifact must preserve explicit state and next-action language
- every proposal review must include rollback or no-op reasoning
- every recommendation must link to validation or make clear that validation is not yet applicable
- architecture review guardrails are required for Architecture slices and advisory for host UI work unless explicitly elevated
- when reviewing source-driven Architecture work that depends on staged artifacts or packetized outputs, the review must say whether an existing mechanism or synthesis packet was consumed
- when packetized stage logic is present, the review must verify that stage-boundary artifacts remain coupled to evidence, citation, or proof support artifacts instead of being reviewed as isolated files
- when a structured review must resolve into an actual next-state recommendation, use `architecture/lib/architecture-review-resolution.ts` instead of ad hoc score or outcome logic

Validation hooks:
- `npm run check:directive-impeccable-contracts`
- `npm run check:directive-workflow-doctrine`
- `npm run check:ops-stack`
