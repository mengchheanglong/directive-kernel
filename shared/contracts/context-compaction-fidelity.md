# Context Compaction Fidelity Contract

Profile: `context_compaction_fidelity/v1`

Purpose:
- allow bounded context compaction without losing handoff meaning
- define which fields are non-lossy and must survive compaction
- keep compaction/bypass semantics product-owned before any host-specific runtime behavior

Required fields:
- `compaction_profile`
  - must be `context_compaction_fidelity/v1`
- `compaction_status`
  - one of:
    - `full`
    - `compacted`
    - `bypass`
- `candidateId`
- `decisionState`
- `adoptionTarget`
- `nextAction`
- `riskNotes`
- `rollbackOrNoOp`
- `compaction_reason`
  - required when `compaction_status = bypass`

Allowed compaction scope:
- verbose trace text
- repeated evidence blocks
- low-value formatting noise

Disallowed compaction scope:
- decision states
- adoption targets
- gate outcomes
- rollback instructions
- explicit owner or route assignments
- contradiction signals
- unresolved blocker references

Allowed loss envelope:
- duplicated explanatory wording
- long raw logs after key evidence extraction

Low-confidence fallback:
- if compaction confidence is low, emit uncompressed handoff
- set `compaction_status = bypass`
- record the reason in `compaction_reason`

Validation rules:
- compacted output is valid only if required retained fields are present and unchanged in meaning
- `compaction_status` must be explicit whenever compaction is claimed
- bypass mode must not silently drop fields

Validation hooks:
- `npm run check:directive-hermes-contracts`
- `npm run check:ops-stack`
