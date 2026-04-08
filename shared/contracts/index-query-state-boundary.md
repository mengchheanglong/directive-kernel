# Index Query State Boundary Contract

Profile: `index_query_state_boundary/v1`

Purpose:
- separate local indexing state from downstream query/use behavior
- make degraded query behavior explicit when structural context is incomplete
- keep code-understanding state disclosure product-owned before any host-specific runtime binding

Required fields:
- `index_query_profile`
  - must be `index_query_state_boundary/v1`
- `index_state`
  - one of:
    - `ready`
    - `missing-index`
    - `stale-index`
    - `partial-index`
- `index_metadata`
  - minimum fields:
    - `indexVersion`
    - `sourceScope`
    - `generatedAt`
    - `coverageHint`
- `query_intent`
- `confidence_note`
- `recommended_refresh_action`
- `unresolved_scope`

Index stage rule:
- index stage must produce explicit metadata, not an implied “available/not available” state
- missing or partial metadata must not be hidden from downstream consumers

Query stage rule:
- query stage may read from index state, but must disclose the effective `index_state` in every downstream result
- query stage may not claim complete structural confidence when `index_state` is not `ready`

Fallback behavior:
- when `index_state = missing-index`
  - query may run only in degraded mode
  - `recommended_refresh_action` must be present
- when `index_state = stale-index`
  - query may run only in degraded mode
  - output must state that refresh is recommended before promotion-quality use
- when `index_state = partial-index`
  - output may answer only for the indexed scope
  - `unresolved_scope` must be explicit

Validation rules:
- never present degraded output as complete
- never hide `index_state` from downstream consumers
- downstream artifacts must preserve state and confidence semantics

Boundary:
- this contract does not require graph database adoption
- this contract does not require MCP/runtime integration
- this contract defines Architecture truth for index/query state disclosure only

Validation hooks:
- `npm run check:directive-codegraphcontext-contracts`
- `npm run check:ops-stack`
