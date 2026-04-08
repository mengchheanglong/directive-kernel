# Command Mediation Contract

Purpose:
- define the minimum product-owned mediation boundary required before any bounded callable CLI execution experiment
- prevent broad wrapper generation or direct command passthrough from becoming Runtime runtime truth

Canonical contract id:
- `command_mediation_contract/v1`

Current candidate:
- `al-parked-cli-anything`

Scope:
- applies only to deferred or experimental Runtime lanes that mediate external command execution
- does not authorize runtime execution by itself

Required command classes:
- `read_only_workspace_inspect`
- `destructive_or_state_mutating`
- `network_or_external_side_effect`
- `privilege_or_security_sensitive`

Required input envelope:
- `candidate_id`
- `command_class`
- `target_surface`
- `working_directory`
- `requested_args`
- `approval_mode`
- `request_id`

Required output envelope:
- `ok`
- `decision`
- `deny_reason`
- `executed_command`
- `stdout_summary`
- `stderr_summary`
- `artifact_paths`
- `rollback_hint`

Hard-deny behavior:
- deny any request whose `command_class` is undefined
- deny any request whose target surface is outside the declared bounded surface
- deny any privileged, destructive, or networked command class unless a future explicit policy override exists
- return structured denial output instead of best-effort execution

Current allowed experiment shape:
- at most one command class
- at most one bounded non-critical surface
- no persistence of newly created privileged execution paths

Current rule:
- only `read_only_workspace_inspect` may be considered for a future bounded experiment
- all other classes remain hard-deny until a later explicit promotion decision exists

Validation hooks:
- `npm run check:directive-cli-anything-reentry`
- `npm run check:ops-stack`
