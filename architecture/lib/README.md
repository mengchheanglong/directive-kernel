# Engine Architecture

This folder is the grouped entry surface for Architecture lane operating code.

The executable Architecture lane does not primarily live under `architecture/`.
Instead:

- `architecture/lib/` = Architecture operating code
- `architecture/` = Architecture experiment, decision, and proof artifacts

## Typical responsibilities

- Architecture handoff and bounded-start logic
- bounded closeout and adoption flow
- DEEP materialization lifecycle
- retention, integration, consumption, and post-consumption evaluation
- Architecture-specific review and decision helpers
- Architecture-owned operational feedback and loop-control helpers

## Start here

- `index.ts`
  Barrel export for the Architecture lane operating surface.

Use the barrel for navigation first, then open the specific `architecture-*` module you need.
