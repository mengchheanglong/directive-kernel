# Engine Runtime

This folder is the grouped entry surface for Runtime lane operating code.

The Runtime lane has three different physical surfaces:

- `runtime/lib/` = Runtime lifecycle and orchestration code
- `runtime/` = follow-up, proof, boundary, promotion, and registry artifacts
- `runtime/core/` and `runtime/capabilities/` = actual executable runtime capability surfaces

## Typical responsibilities

- follow-up, proof-open, and promotion-readiness openers
- record, proof, capability-boundary, and promotion runners
- projections, sequence helpers, and manual control
- runtime promotion assistance and callable execution evidence

## Start here

- `index.ts`
  Barrel export for the Runtime lane operating surface.

Use the barrel for navigation first, then open the specific `runtime-*` module you need.
