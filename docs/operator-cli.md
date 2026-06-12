# Directive Operator CLI

This is the canonical operator mutation surface. The browser workbench now executes the same bounded mutations through the web-host API, but the CLI remains the exact command reference.

## Submit a source

**Purpose.** Submit a source to the discovery lane.

**CLI pattern:**
```
pnpm run standalone:cli discovery-submit --directive-root <path> --input-json-path <path> [--config <path>] [--received-at <yyyy-mm-dd>] [--unresolved-gap-id <id> ...] [--persistence-sqlite-path <path>] [--dry-run] [--process-with-engine]
```

**Example:**
```
pnpm run standalone:cli discovery-submit --directive-root ./my-project --input-json-path ./source.json --process-with-engine
```

**Contract.** [discovery-submission-request.schema.json](../shared/schemas/discovery-submission-request.schema.json)

## Approve a route

**Purpose.** Record an explicit Discovery routing review resolution before opening a downstream lane.

**Web-host endpoint:**
```
POST /api/discovery/resolve-routing-review
```

**CLI status:** not yet exposed on the standalone CLI. Route approval is currently handled through the web-host API or the operator decision inbox.

**Contract.** [discovery-routing-record-request.schema.json](../shared/schemas/discovery-routing-record-request.schema.json)

## Reroute with answers

**Purpose.** Fold operator answers into a fresh routing pass for an existing engine run.

**CLI pattern:**
```
pnpm run standalone:cli engine-reroute --directive-root <path> --run-id <id> --answers-json-path <path> [--config <path>] [--received-at <iso>] [--persistence-sqlite-path <path>]
```

**Example:**
```
pnpm run standalone:cli engine-reroute --directive-root ./my-project --run-id run-001 --answers-json-path ./reroute-answers.json
```

**Contract.** [run-record.schema.json](../shared/schemas/run-record.schema.json)

## Write decision

**Purpose.** Resolve a Runtime promotion-seam or host-selection decision.

**CLI pattern (promotion seam):**
```
pnpm run standalone:cli runtime-promotion-seam-resolve --directive-root <path> --promotion-readiness-path <path> --rationale <text> [--config <path>] [--approved-by <actor>] [--persistence-sqlite-path <path>]
```

**CLI pattern (host selection):**
```
pnpm run standalone:cli runtime-host-selection-resolve --directive-root <path> --promotion-readiness-path <path> --decision <select_standalone|select_web|confirm_inferred|override|defer> --rationale <text> [--config <path>] [--selected-host <text>] [--reviewed-by <actor>] [--resolved-confidence <high|medium|low>] [--persistence-sqlite-path <path>]
```

**CLI pattern (registry acceptance):**
```
pnpm run standalone:cli runtime-registry-accept --directive-root <path> --promotion-record-path <path> --rationale <text> [--config <path>] [--accepted-by <actor>] [--persistence-sqlite-path <path>]
```

**Example (promotion seam):**
```
pnpm run standalone:cli runtime-promotion-seam-resolve --directive-root ./my-project --promotion-readiness-path ./promotion-readiness.json --rationale "Host selection and pre-host evidence are already explicit."
```

**Contract.** [runtime-promotion-record.schema.json](../shared/schemas/runtime-promotion-record.schema.json)

## Formalize a gap

**Purpose.** Approve or reject a capability-gap formalization candidate.

**CLI pattern (approve):**
```
pnpm run standalone:cli gap-approve --directive-root <path> --formalization-id <id> --priority <high|medium|low> --rationale <text> [--config <path>]
```

**CLI pattern (reject):**
```
pnpm run standalone:cli gap-reject --directive-root <path> --formalization-id <id> --rationale <text> [--config <path>]
```

**CLI pattern (list candidates):**
```
pnpm run standalone:cli gap-formalize --directive-root <path> [--config <path>]
```

**Example:**
```
pnpm run standalone:cli gap-approve --directive-root ./my-project --formalization-id gap-001 --priority high --rationale "Repeated radar signal deserves an explicit tracked Discovery objective."
```

**Contract.** [gap-formalization-record.schema.json](../shared/schemas/gap-formalization-record.schema.json)

## Edit mission

**Purpose.** Preview, approve, reject, revert, or list mission evolution entries.

**CLI pattern (list):**
```
pnpm run standalone:cli mission-feedback --directive-root <path> [--config <path>]
```

**CLI pattern (preview):**
```
pnpm run standalone:cli mission-preview --directive-root <path> --feedback-id <id> [--config <path>]
```

**CLI pattern (approve):**
```
pnpm run standalone:cli mission-approve --directive-root <path> --feedback-id <id> --rationale <text> [--config <path>] [--cascade-scope <none|low_confidence|conflicted|discovery_held>] [--run-id <id> ...]
```

**CLI pattern (reject):**
```
pnpm run standalone:cli mission-reject --directive-root <path> --feedback-id <id> --rationale <text> [--config <path>]
```

**CLI pattern (revert):**
```
pnpm run standalone:cli mission-revert --directive-root <path> --rationale <text> [--config <path>]
```

**CLI pattern (history):**
```
pnpm run standalone:cli mission-history --directive-root <path> [--config <path>]
```

**Example (approve):**
```
pnpm run standalone:cli mission-approve --directive-root ./my-project --feedback-id fb-001 --rationale "This mission evolution sharpens bounded intent without widening the active scope."
```

**Contract.** [mission-evolution-record.schema.json](../shared/schemas/mission-evolution-record.schema.json)

## Open runtime follow-up

**Purpose.** Write a Runtime follow-up record to open downstream capability work.

**CLI pattern:**
```
pnpm run standalone:cli runtime-followup-write --directive-root <path> --input-json-path <path> [--config <path>] [--persistence-sqlite-path <path>]
```

**Example:**
```
pnpm run standalone:cli runtime-followup-write --directive-root ./my-project --input-json-path ./follow-up-payload.json
```

**Contract.** [runtime-follow-up.schema.json](../shared/schemas/runtime-follow-up.schema.json)

## Scaffold runtime capability

**Purpose.** Generate a manifest-backed Runtime capability folder under
`runtime/capabilities/` without hand-copying the existing capability layout.

**CLI pattern:**
```
pnpm run standalone:cli runtime-capability-scaffold --name <name> [--description <text>] [--capabilities-root <path>] [--overwrite]
```

**Example:**
```
pnpm run standalone:cli runtime-capability-scaffold --name "Example Capability" --description "One bounded Runtime capability scaffold."
```

**Contract.** [capability.md](../shared/contracts/capability.md)

## Replay engine run

**Purpose.** Replay one engine run non-persistently with optional answer or
mission overrides, and return an exact-vs-approximate diff instead of writing
new run records.

**CLI pattern:**
```
pnpm run standalone:cli engine-replay --directive-root <path> --run-id <id> [--answers-json-path <path>] [--mission-change-json-path <path>] [--received-at <iso>]
```

**Example:**
```
pnpm run standalone:cli engine-replay --directive-root ./my-project --run-id 1234-abcd --mission-change-json-path ./mission-change.json
```

**Web-host endpoint:**
```
POST /api/engine-runs/:runId/replay
```

**Contract.** [engine-run-replay.request.schema.json](../shared/schemas/engine-run-replay-request.schema.json)

## Open architecture handoff

**Purpose.** Start an Architecture handoff experiment from an existing handoff artifact.

**Web-host endpoint:**
```
POST /api/architecture/handoff-start
```

**CLI status:** not yet exposed on the standalone CLI. Architecture handoffs are currently started through the web-host API.

**Contract.** [architecture-artifact-lifecycle.md](../shared/contracts/architecture-artifact-lifecycle.md)

## MCP Tool Profiles

The MCP server exposes two tool profiles to control the tool surface visible to
AI agent consumers. The engine keeps all 67 operations; profiles change only
what agents see.

### Core profile (default)

~15 task-level tools suitable for most operator workflows. This is the default
when no `--profile` flag is supplied.

```
pnpm run mcp:serve -- --directive-root <path>
```

| Tool | Purpose |
|------|---------|
| `discovery_submit` | Submit a new source through Discovery |
| `snapshot_get` | Read current dashboard snapshot |
| `operator_decision_inbox_get` | Read operator decision inbox |
| `engine_run_reroute` | Reroute an engine run with operator answers |
| `runtime_selection_resolutions` | Resolve host selection for a promotion |
| `runtime_promotion_seam_decisions` | Resolve whether a promotion seam is satisfied |
| `runtime_registry_acceptance_decisions` | Accept a promotion record into the registry |
| `gaps_approve` | Approve a capability gap formalization |
| `mission_preview` | Preview the effect of a mission feedback entry |
| `mission_approve` | Approve a mission feedback entry |
| `mission_reject` | Reject a mission feedback entry |
| `mission_revert` | Revert to the previous mission evolution |
| `glossary_get` | Query canonical Directive Kernel glossary terms |
| `invoke_capability` | Invoke a capability through trust-gated execution |
| `maintenance_archive` | Archive old engine runs and rotate the ledger |

### Full profile (opt-in)

All 67+ operations, including deep-tail read routes and architecture lifecycle
operations. Use when an agent needs full surface access.

```
pnpm run mcp:serve -- --directive-root <path> --profile full
```

### Profile selection rules

- Default: `core` (15 tools)
- Explicit `--profile full`: all registered tools (67+)
- Unknown profile value: server exits with a validation error

### Maintenance archive (MCP-only tool)

The `maintenance_archive` tool wraps the `pnpm run standalone:cli maintenance
archive` CLI command for MCP consumers. It archives old engine run records and
rotates the decision-policy ledger.

**Input schema:**
```json
{
  "type": "object",
  "properties": {
    "max_age_days": {
      "type": "number",
      "description": "Archive records older than this many days (default: 90)"
    }
  }
}
```
