# Engine Coordination

`engine/coordination/` is the Engine-owned coordination and control-selection surface.

It holds the read-only coordination logic that:
- summarizes live lifecycle pressure
- persists bounded coordination cadence in its own ledger
- selects the next completion slice from the control registry

This is Engine-owned because it interprets cross-lane workflow pressure and control state without becoming lane lifecycle code.

Grouped feature families:
- `autonomous-lane-loop/`
  Orchestration shell plus policy, phase, Architecture, Runtime, and type helpers for bounded cross-lane auto-advancement.
- `operator-decision-inbox/`
  Composition shell plus report types, plan-state helpers, builders, and markdown rendering for operator-facing coordination reports.
- `read-only-lifecycle-coordination/`
  Read-only reporting shell plus classification, pressure, and type helpers for live-case pressure summaries.

Flat modules that remain here:
- `bounded-persistent-coordination.ts`
- `completion-slice-selector.ts`
- `runtime-promotion-automation.ts`

Use `index.ts` as the public coordination barrel. Add new coordination code under an existing family folder when it belongs to that workflow; keep truly standalone modules flat.
