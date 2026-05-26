# Runtime External Run Envelope

Last updated: 2026-03-20

Source extraction:
- retained as a generic Runtime boundary from earlier external-run experiments
- external host runner paths are no longer canonical Directive Workspace product paths

Purpose:
- define the minimum contract shape when Directive Runtime uses an external execution surface
- preserve the useful boundary from historical external-run extraction without keeping any prior host runner as runtime truth

This contract is a Runtime-side boundary, not a requirement that Runtime execute through any specific host or runner.

## Required Fields

- `tool`
- `mode`
- `project`
- `source`
- `task`
- `outputPaths`
- `reportBack`

## Optional Fields

- `runId`
- `idempotencyKey`
- `metadata`

## Field Meaning

### `tool`
- the external execution surface or adapter target
- historically included:
  - `codegraph`
  - `puppeteer`
  - `promptfoo`
  - `impeccable`
  - `agency-agents`
  - `arscontexta`
  - `agent-orchestrator`
  - `openviking`

### `mode`
- the execution mode or adapter behavior requested for the tool

### `project`
- the owning project or workspace target

### `source`
- where the run request originated
- expected to identify the upstream record or system of origin

### `task`
- the requested work payload
- may be a string or structured object

### `outputPaths`
- one or more artifact destinations
- raw output remains on disk under host-owned paths

### `reportBack`
- whether the run should produce summarized writeback to a host surface

## Runtime Rules

- Raw artifacts remain host-owned or run-owned, not embedded into Directive Workspace doctrine.
- Human-level summary belongs in host reports.
- Follow-up actions belong in host task/quest surfaces.
- Tool internals stay outside Directive Runtime core.
- A Runtime integration may adopt this envelope while replacing the old `agent-lab` runner entirely.

## Lifecycle Expectation

Recommended lifecycle:
- `queued`
- `running`
- `succeeded`
- `failed`

This lifecycle is useful and should be preserved even if the eventual runner is not the old PowerShell implementation.

## Adoption Boundary

What is retained:
- the contract boundary
- adapter isolation
- raw artifact on disk / summarized host writeback split

What is not retained by default:
- historical host folder structures
- direct PowerShell runner dependency
- vendored orchestration dependencies
- OpenViking-specific local stack management as a default Runtime runtime requirement
