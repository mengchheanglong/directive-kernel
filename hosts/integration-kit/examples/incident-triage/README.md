# Incident Triage Example

This example demonstrates how a consuming host can use the Directive Kernel to triage inbound incident alerts against active service-level objectives (SLOs). The kernel receives a realistic monitoring alert payload and routes it through the Discovery Engine to produce a decision lane and operator-auditable routing record.

## Goal Envelope

The goal (`dev-team-incident-triage`) models a platform team's incident triage workflow:

- **Goal statement**: Triage inbound incident alerts against active service-level objectives and route each to page-on-call, monitor-only, auto-resolve, or noise.
- **Why now**: On-call rotation costs human attention; only true SLO breaches should page.
- **Adoption target**: `runtime` — incidents are routed at alert time.
- **Constraints**: Page-on-call only for breaches above severity threshold; auto-resolve requires a known recovery script.
- **Success signal**: Each routed incident has a clear urgency classification and the operator can audit the rationale.

## Sample Source

The sample source (`alert-cpu-sat-svc-payments`) represents a real CPU saturation alert from a payments service:

- `source_type`: `internal-signal` (this is a monitoring system alert, not an external source)
- `mission_alignment`: Describes how the payments service is a critical-path dependency for all checkout flows, directly tied to the sprint's top-priority SLO objective
- `notes`: Full alert details including timestamp, metrics (92% CPU for 8 min), auto-scale recovery, latency stats, and severity classification

The source has no `capability_gap_id`, so the kernel will attempt to resolve the appropriate lane through its routing logic.

## Expected Routing Outcome

The kernel should:

1. Resolve the goal envelope and write `DIRECTIVE_GOAL.md` and `knowledge/active-mission.md` to the directive root.
2. Build a `DiscoverySubmissionRequest` with the alert's details.
3. Route the submission through the Discovery front door, which selects a capability lane.
4. Produce a decision record with a `decisionState` (e.g., `needs_review`) and a `selectedLane` (one of `discovery`, `runtime`, `architecture`).
5. Write routing artifacts to disk: `routingRecordPath`, `engineRunRecordPath`.

## How to Run

```bash
pnpm exec tsx hosts/integration-kit/examples/incident-triage/flow.ts
```

With custom paths:

```bash
pnpm exec tsx hosts/integration-kit/examples/incident-triage/flow.ts \
  --directive-root ./local/custom-root \
  --goal-json-path ./path/to/goal.json \
  --source-json-path ./path/to/source.json
```

## Integration Test

An automated integration test validates this flow end-to-end. Run it with:

```bash
pnpm run test tests/integration/incident-triage.test.ts
```

The test creates a temporary directive root, runs the full integration flow, and asserts that the routing produces valid artifacts on disk.
