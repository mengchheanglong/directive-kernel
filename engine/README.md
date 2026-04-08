# Engine

`engine/` is the shared Directive Workspace kernel.

It is the smallest but highest-leverage executable layer in the repo.

## Owns

- source normalization
- mission and usefulness interpretation
- routing assessment
- extraction, adaptation, and improvement planning
- proof, decision, and report planning
- lane contracts and lane resolution
- approval-boundary guard rails
- product-truth constants

## Main files

- `directive-engine.ts`
  Main source-processing orchestrator.
- `routing.ts`
  Shared routing logic.
- `usefulness.ts`
  Shared usefulness classification.
- `types.ts`
  Engine types.
- `lane.ts`
  Lane contract and resolution surface.
- `directive-workspace-lanes.ts`
  Default Directive Workspace lane set.
- `approval-boundary.ts`
  Shared guard rails used heavily by lane operating code.
- `workspace-truth.ts`
  Product-level truth summary.
- `artifact-link-validation.ts`
  Artifact-link integrity validation.
- `storage.ts`
  Store boundary.
- `source-type-normalization.ts`
  Input normalization.

## Does not own

- lane artifact and proof corpora
- host APIs or host persistence
- external-integration-specific adapters that do not define Engine semantics

`engine/state/` holds the canonical cross-lane state resolver.
`engine/cases/` holds mirrored case records, case events, snapshots, and planner logic.
`engine/coordination/` holds completion selection and read-only lifecycle coordination.
`engine/execution/` holds runner state, Engine run artifact readers, and run evidence aggregation.

Lane operating code lives in each lane's own folder:
- `architecture/lib/` — Architecture lane lifecycle code
- `runtime/lib/` — Runtime lane lifecycle code
- `discovery/lib/` — Discovery lane lifecycle code

`shared/lib/` holds only residual small reusable helpers and compatibility utilities that do not define a clearer Engine or host home.

## Practical rule

If the logic is:
- shared across lanes or defines the core source-processing model, prefer `engine/`
- lane-specific lifecycle code, prefer the lane's `lib/` folder (`architecture/lib/`, `runtime/lib/`, `discovery/lib/`)
- canonical state/read orchestration, prefer `engine/state/`
- residual cross-cutting support or adapters, prefer `shared/lib/`
