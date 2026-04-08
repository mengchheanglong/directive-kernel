# Command Class Approval Policy

Purpose:
- map command classes to explicit approval outcomes before any Runtime command-mediation experiment may reopen

Canonical policy id:
- `command_class_approval_policy/v1`

Linked contract:
- `shared/contracts/command-mediation-contract.md`

Current candidate:
- `al-parked-cli-anything`

Policy table:

| Command class | Current approval state | Reason |
|---|---|---|
| `read_only_workspace_inspect` | `manual_approval_required` | Only class narrow enough for a future bounded rollback/no-op experiment |
| `destructive_or_state_mutating` | `hard_deny` | Too much blast radius for current Runtime stage |
| `network_or_external_side_effect` | `hard_deny` | Unsafe expansion beyond bounded host scope |
| `privilege_or_security_sensitive` | `hard_deny` | Explicitly out of scope until a separate security review exists |

Rules:
1. No class is pre-approved right now.
2. `read_only_workspace_inspect` is the only class eligible for a future bounded experiment, and it still requires manual approval plus rollback/no-op evidence.
3. Any undefined class must resolve to `hard_deny`.
4. Approval policy changes require a new Runtime decision slice, not an inline edit during runtime work.

Current re-entry meaning:
- command-mediation contract exists
- approval policy exists
- candidate remains deferred until bounded rollback/no-op evidence exists

Validation hooks:
- `npm run check:directive-cli-anything-reentry`
- `npm run check:ops-stack`
