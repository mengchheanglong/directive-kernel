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

## Internal grouped surfaces

- `openers/`
  Opener helpers and opener support.
- `projections/`
  Projection helpers and projection support.
- `runners/`
  Runner helpers and runner support.
- `sequences/`
  Sequence helpers and sequence support.
- `writers/`
  Writer helpers and write support.
- `host/`
  Runtime-to-host integration surfaces.
- `control/`
  Manual control, automation eligibility, and related bounded-control helpers.

The grouped subfolder indexes are the authoritative Runtime operating surface now. Use them instead of the older flat helper filenames when you are navigating or adding new Runtime code.

In particular:
- callable execution evidence and follow-up navigation belong to `control/`
- host-selection and promotion-specification seams belong to `host/`

## Start here

- `index.ts`
  Barrel export for the Runtime lane operating surface.

Use the barrel for navigation first, then open the specific runtime module you need.
