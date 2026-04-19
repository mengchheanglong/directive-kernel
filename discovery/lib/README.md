# Engine Discovery

This folder is the grouped entry surface for Discovery lane operating code.

The executable Discovery lane does not primarily live under `discovery/`.
Instead:

- `discovery/lib/` = Discovery operating code
- `discovery/` = intake, triage, routing, monitor, and deferred/reference artifacts

## Typical responsibilities

- front-door intake orchestration
- queue writes and queue transitions
- routing and mission-conditioned selection
- capability-gap prioritization and worklist generation
- Discovery record materialization
- bounded research-engine imports

## Internal grouped surfaces

- `gaps/`
  Gap prioritization and worklist generation/selection/refresh.
- `front-door/`
  Front-door intake orchestration, mission routing, and front-door reporting support.
- `intake/`
  Intake queue writes, queue transitions, and intake lifecycle sync.
- `routing/`
  Routing record handling, route opening, review resolution, and effective-boundary helpers.
- `records/`
  Discovery record materialization for case, completion, and fast-path records.

## Start here

- `index.ts`
  Barrel export for the Discovery lane operating surface.

Use the grouped subfolder indexes first, then open the specific `discovery-*` module you need.

Keep Discovery-specific executable code here. Artifact storage remains under the numbered `discovery/` folders and should not be treated like normal module layout.
