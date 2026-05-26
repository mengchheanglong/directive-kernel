**Enforced by:** engine/mission/gap-formalization.ts

# Gap Formalization

Gap formalization converts repeated gap-radar pressure into an explicit capability gap.

## Rule

- only medium-confidence or high-confidence radar suggestions are eligible
- do not formalize a suggestion that already points at an unresolved open gap
- require explicit operator rationale for approve or reject
- write the approved gap to `discovery/capability-gaps.json`
- refresh the Discovery gap worklist after an approved write

## Legal States

- `pending_approval`
- `approved`
- `written`
- `rejected`

## Legal Transitions

- `pending_approval -> written` when the operator approves and the new gap is written
- `pending_approval -> rejected` when the operator rejects the suggestion
- `approved` may be used as an intermediate host-local state, but the canonical persisted end state is `written`

## Required Proof

- radar evidence summary
- operator rationale
- explicit priority for approved gaps

## Stop-Line

Do not hand-edit the Discovery gap worklist to reflect a formalized gap. The worklist must be regenerated from canonical sources after the new gap is written.
