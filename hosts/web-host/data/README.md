# Web Host Data Surface

This folder is the canonical read-model surface for the web host.

It owns frontend-facing snapshot assembly and artifact detail readers. It does not own Engine state resolution or lane-local artifact parsing.

## Owns

- queue and workbench snapshot reads for the web host
- grouped detail readers for Runtime and Architecture artifact views
- frontend-facing learning summaries and handoff stubs
- shared frontend current-head/view-path helpers used by the read-model

## Files

- `index.ts`
  Real grouped barrel for the web-host data surface.
- `snapshot.ts`
  Stable top-level web snapshot/read facade.
- `queue.ts`
  Queue overview and queue-entry readers.
- `shared.ts`
  Internal shared frontend read-model helpers used by the public readers.
- `snapshot-learning.ts`
  Learning summary readers.
- `snapshot-handoffs.ts`
  Handoff stub readers and legacy handoff parsing helpers.
- `snapshot-runtime-details.ts`
  Runtime detail-reader family.
- `snapshot-architecture-core-details.ts`
  Architecture start/result/adoption detail-reader family.
- `snapshot-architecture-details.ts`
  Architecture deep-tail detail-reader family.

## Rule

If the web UI needs to read current state or artifact detail views, start here. If you need to resolve canonical cross-lane state first, go to `engine/state/` and come back here only for host-facing projections.

`shared.ts` is intentionally not part of the grouped barrel export. It stays internal to this surface.
