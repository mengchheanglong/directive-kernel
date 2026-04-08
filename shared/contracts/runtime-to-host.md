# Runtime To Host Contract

Use this contract when a host loads a Runtime promotion specification for an explicitly approved Runtime case.

This contract is the bounded host-loading surface between Runtime-owned capability truth and any host-owned adapter work.

## Required host-loading inputs

- `candidate_id`
- `candidate_name`
- `source_promotion_readiness_path`
- `source_intent_artifact`
- `compile_contract_artifact`
- `target_host`
- `integration_mode`
- `target_runtime_surface`
- `required_gates`
- `rollback_plan`
- `proof_artifact_path`
- linked Runtime artifacts:
  - Runtime record
  - Runtime proof
  - Runtime capability boundary
  - Runtime follow-up
  - Discovery routing record
- linked callable stub when present
- host-consumable description
- explicit remaining open decisions

## Rules

- Runtime owns the callable capability, promotion-readiness truth, blocker judgment, and generated promotion specification.
- Hosts may load Runtime capability only through the promotion specification plus this compile contract; they must not reconstruct the handoff from scattered Runtime artifacts.
- Hosts must not import Runtime internals directly. Host consumption must happen through an explicit product-owned adapter surface.
- Loading a promotion specification does not itself approve host-facing promotion, host integration, runtime execution, callable activation, or automation.
- Any host-facing promotion record must keep proof, rollback, and gate expectations explicit before activation is considered.

## Pre-host manual promotion-record prerequisites

Before a non-executing manual promotion record can even be prepared, the repo must already prove:

- one promotion-readiness artifact exists for the candidate
- one generated promotion specification exists for that same artifact
- this compile contract exists
- linked Runtime record, Runtime proof, Runtime capability boundary, Runtime follow-up, and Discovery routing artifacts all exist
- the linked callable stub exists for the candidate when the capability is already expressed as a Runtime-owned callable bundle
- the candidate still remains:
  - not promoted
  - not host-integrated
  - not executing
- no live promotion record has been opened yet for that candidate

Satisfying these prerequisites authorizes contract preparation only. It does not authorize host-facing promotion, registry acceptance, host integration, or execution.

## Current bounded manual host-loading seams

- Current bounded manual host-loading candidates:
  - `dw-source-scientify-research-workflow-plugin-2026-03-27`
  - `dw-mission-openmoss-runtime-orchestration-2026-03-26`
- Current bounded host targets:
  - `Directive Workspace standalone host (hosts/standalone-host/)`
  - `Directive Workspace web host (frontend/ + hosts/web-host/)`
- Current legal boundary:
  - load the promotion specification and bounded host-facing review metadata only
  - keep registry acceptance, host integration rollout, runtime execution, and promotion automation unopened until later explicit bounded decisions
