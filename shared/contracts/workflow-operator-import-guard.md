# Workflow Operator Import Guard

- Contract id: `workflow_operator_import_guard/v1`
- Contract family: `bounded_workflow_operator_import`
- Proof shape: `agent_pack_import_snapshot/v1`
- Primary host checker: `npm run check:directive-superpowers-runtime`
- Supporting host evidence:
  - `npm run runtime:superpowers:smoke`
  - `npm run check:agents-import-packs-api-backend`
  - `npm run check:ops-stack`

## Intent

Allow `superpowers` to become a bounded explicit-only workflow operator import lane inside Mission Control without adopting upstream plugin marketplace behavior, hook execution, or automatic overlay/runtime truth.

## Required Truths

- default import requests must not import `superpowers`
- explicit import route returns `200`
- imported agent count == `1`
- sync-existing updated count >= `1`
- imported agent name is `Superpowers Workflow Operator`
- imported source ref is `superpowers/workflow-operator`
- imported workflow mode is `execution`
- imported pack assets include:
  - `README.md`
  - `skills`
  - `commands`
  - `docs`
  - `agents`

## Allowed Runtime Surface

- explicit-only bounded workflow operator import lane
- host-local agent catalog import through `POST /api/agents/import-packs`
- smoke artifact writeback under `reports/agent-pack-imports/`

## Forbidden Runtime Surface

- no plugin marketplace installation flow
- no hook execution as product truth
- no automatic skill overlay into global agent state
- no upstream plugin/runtime behavior treated as canonical Runtime behavior
- no default import activation

## Rollback

- restore `superpowers` to `follow_up_only`
- remove superpowers-specific Runtime proof/promotion/registry artifacts
- remove superpowers-specific checker wiring
- keep generic import-pack infrastructure only if it remains justified independently
