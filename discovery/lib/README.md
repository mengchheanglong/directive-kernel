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

## Start here

- `index.ts`
  Barrel export for the Discovery lane operating surface.

Use the barrel for navigation first, then open the specific `discovery-*` module you need.
