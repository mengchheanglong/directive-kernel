# Shared DW State

This folder contains the canonical state-resolution surface for Directive Workspace.

It is Engine cross-cutting code, not lane-local code.

## Owns

- current-head resolution across Discovery, Runtime, and Architecture artifacts
- runtime artifact type definitions used by the resolver and checks
- shared state helpers used by hosts, reports, and validation

## Files

- `shared.ts`
  Cross-lane shared state helpers.
- `runtime.ts`
  Runtime-focused state resolution.
- `runtime-artifact-types.ts`
  Canonical runtime artifact type definitions.
- `index.ts`
  Barrel export for this grouped state surface.

## Rule

If you need the current legal next step for a case, or the current head artifact, start here before reading lane folders directly.
