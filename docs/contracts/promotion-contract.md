# Promotion Contract

Required before runtime/callable delivery:

- `integration_mode`
  - `reimplement` | `adapt` | `wrap`
- `target_runtime_surface`
- `owner`
- `source_intent_artifact`
  - markdown or structured spec that defines intended behavior
- `compile_contract_artifact`
  - compiled lock/spec artifact that is treated as execution truth
- `runtime_permissions_profile`
  - explicit lane split (`read_only_lane` and optional constrained `write_lane`)
- `safe_output_scope`
  - bounded write path(s) if write lane is enabled
- `sanitize_policy`
  - required sanitization flags/guards for all write-lane outputs
- `required_gates`
- `rollback_plan`
- `proof_artifact_path`

Rules:
- no runtime-callable claim without a completed promotion contract
- no promotion contract means no host delivery
- Mission Control may host the runtime, but the contract vocabulary is product-owned
- source intent is never execution truth by itself; compiled contract artifact is authoritative
- write access is disallowed unless explicitly declared in lane split + safe output scope
