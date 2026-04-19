# Shared DW State

This folder contains the canonical state-resolution surface for Directive Workspace.

It is Engine cross-cutting code, not lane-local code.

## Owns

- current-head resolution across Discovery, Runtime, and Architecture artifacts
- lane-specific state resolution for Discovery and Architecture artifact chains
- final resolved-focus assembly for Engine, Architecture, and Runtime views
- runtime artifact type definitions used by the resolver and checks
- shared state helpers used by hosts, reports, and validation

## Files

- `resolve-directive-workspace-state.ts`
  Canonical workspace-state resolver and dispatch surface.
- `focus-builders.ts`
  Final resolved-focus builders for Engine, Architecture, and Runtime artifact views.
- `architecture-state.ts`
  Architecture artifact-chain resolution and stage derivation.
- `discovery-state.ts`
  Discovery routing and monitor focus resolution.
- `shared-state-helpers.ts`
  Cross-lane shared state helpers.
- `runtime-focus/`
  Runtime-focused state resolution family.
  - `runtime-focus.ts`
    Runtime-focused state resolver shell.
  - `runtime-focus-readers.ts`
    Runtime artifact readers and canonical local read-model types used by the Runtime resolver.
  - `runtime-focus-paths.ts`
    Runtime path inference and candidate-path lookup helpers used by the Runtime resolver.
  - `runtime-focus-legacy.ts`
    Legacy Runtime state builders kept separate from the current Runtime artifact-chain resolver.
- `artifact-storage.ts`
  Engine-owned artifact path/storage compatibility helpers.
- `runtime-artifact-types.ts`
  Canonical runtime artifact type definitions.
- `index.ts`
  Real barrel export for this grouped state surface.

The grouped files here are the canonical state read-model surface. Historical alias names are not the authoritative entrypoints anymore.
Use `artifact-storage.ts` directly; the old shared compatibility bridge has been retired.

## Rule

If you need the current legal next step for a case, or the current head artifact, start here before reading lane folders directly.
