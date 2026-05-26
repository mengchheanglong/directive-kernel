# Directive Kernel Repo Baseline

## Purpose

Directive Kernel is the reusable system core.
Engine is the shared adaptation core inside it.
Discovery, Runtime, and Architecture are the three main operating lanes of the Engine.

This contract defines the stable top-level export surfaces and the ownership rules that keep the kernel reusable when cloned into another project.

## Stable Top-Level Surfaces

### Engine

`engine/` is the canonical shared product kernel.

It owns shared behavior such as:
- mission-conditioned usefulness
- source-type normalization
- intake and routing semantics
- decision semantics
- canonical state interpretation when that behavior is product-defining

### Shared

`shared/` is the reusable declarative/support layer.

Its stable sub-surfaces are:
- `shared/contracts/`
- `shared/schemas/`
- `shared/templates/`
- `shared/lib/`

`shared/lib/` is only for reusable support code. If a module becomes the canonical owner of routing, usefulness, decision, lifecycle, or state semantics, it should live in `engine/` or the owning lane instead.

### Lane Code

`discovery/`, `runtime/`, and `architecture/` are lane-owned code surfaces.

In the kernel repo, they primarily ship:
- lane operating code under `lib/`
- lane-specific helpers and capability code
- lane-local docs that explain the generated state/artifact scaffold

The numbered lane folders are not source folders here. They are generated state/artifact folders in the consuming project's `directive-root`.

### Hosts And Frontend

`hosts/` and `ui/` are bounded host surfaces.

They may present or wrap product behavior, but they must not become the canonical owner of Engine semantics.

### State And Control

`state/` and `control/state/` are minimal bootstrap/control surfaces for the reusable kernel.

They are not the old workspace historical corpus.

## Growth Rules

### Keep The Kernel Reusable

Do not ship historical case-specific contracts, named source promotion guards, or workspace-only proof baggage in the kernel export.

### Keep Ownership Clear

- shared semantics belong in `engine/`
- lane lifecycle code belongs in the owning lane
- generic reusable contracts/schemas/templates belong in `shared/`
- host-local behavior stays host-local unless it becomes product-wide

### Keep Generated State Out Of Source Ownership

The consuming project's `directive-root` should hold:
- Discovery state folders
- Runtime stage folders
- Architecture state/materialization folders

Do not treat those generated state folders as package source modules.
