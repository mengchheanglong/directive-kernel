# Shared Surface

`shared/` contains the reusable cross-lane vocabulary for Directive Kernel.

It exists so Discovery, Runtime, Architecture, Engine state, and hosts do not invent incompatible shapes or workflow language.

This folder should contain only:
- reusable contracts
- machine-readable schemas
- canonical templates
- host-agnostic support helpers

It should not contain:
- historical case-specific promotion guards
- workspace-only proof baggage
- host-local deployment doctrine
- lane-owned lifecycle code that already has a clearer owner

## Structure

- `shared/contracts/` for reusable behavioral rules and handoff boundaries
- `shared/schemas/` for machine-readable shape authority
- `shared/templates/` for canonical artifact/document templates
- `shared/lib/` for residual reusable support code that is not the canonical owner of lane lifecycle or state semantics

## Ownership Rule

Put something in `shared/` only if it is:
- reusable across more than one lane or host surface
- stable enough to be part of the kernel export
- not better owned by `engine/`, `discovery/lib/`, `runtime/lib/`, or `architecture/lib/`

If a file is tied to one historical source, one named candidate, or one old workspace-only promotion case, it does not belong in Directive Kernel.
