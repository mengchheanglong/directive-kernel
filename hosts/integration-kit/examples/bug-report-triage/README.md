# Bug Report Triage Example

This example demonstrates how a consuming host can use the Directive Kernel to triage inbound bug reports against active sprint priorities. The kernel receives a realistic bug report source and routes it through the Discovery Engine to produce a decision lane and operator-auditable routing record.

## Goal Envelope

The goal (`dev-team-bug-triage`) models a development team's triage workflow:

- **Goal statement**: Triage inbound bug reports against active sprint priorities and route each to fix-now, backlog, wontfix, or duplicate.
- **Why now**: Active sprint has bandwidth for high-priority bugs only; backlog grooming happens weekly.
- **Adoption target**: `runtime` — bugs are routed at ingestion time.
- **Constraints**: No auto-assign without human review; duplicates must reference the original issue ID.
- **Success signal**: Each routed bug has a clear next-step decision and the operator can audit the routing rationale.

## Sample Source

The sample source (`gh-issue-482`) represents a real bug report about search bar focus loss on macOS Safari 17.2. It includes:

- `source_type`: `internal-signal` (this is an internal GitHub issue, not an external source)
- `mission_alignment`: Describes how fixing this bug directly advances the sprint goal
- `notes`: Full repro steps and severity classification

The source has no `capability_gap_id`, so the kernel will attempt to resolve the appropriate lane through its routing logic.

## Expected Routing Outcome

The kernel should:

1. Resolve the goal envelope and write `DIRECTIVE_GOAL.md` and `knowledge/active-mission.md` to the directive root.
2. Build a `DiscoverySubmissionRequest` with the bug's details.
3. Route the submission through the Discovery front door, which selects a capability lane.
4. Produce a decision record with a `decisionState` (e.g., `needs_review`) and a `selectedLane` (one of `discovery`, `runtime`, `architecture`).
5. Write routing artifacts to disk: `routingRecordPath`, `engineRunRecordPath`.

## How to Run

```bash
pnpm exec tsx hosts/integration-kit/examples/bug-report-triage/flow.ts
```

With custom paths:

```bash
pnpm exec tsx hosts/integration-kit/examples/bug-report-triage/flow.ts \
  --directive-root ./local/custom-root \
  --goal-json-path ./path/to/goal.json \
  --source-json-path ./path/to/source.json
```

## Integration Test

An automated integration test validates this flow end-to-end. Run it with:

```bash
pnpm run test tests/integration/bug-report-triage.test.ts
```

The test creates a temporary directive root, runs the full integration flow, and asserts that the routing produces valid artifacts on disk.
