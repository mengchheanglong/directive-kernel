# Context Operator Import Guard Contract

Purpose:
- enforce bounded context-operator import evidence on Runtime promotion records before callable context-planning/review claims
- ensure arscontexta promotions capture explicit import-pack results, imported operator set, deterministic source metadata, and rollback scope

Scope:
- applies to Runtime promotion records whose `Quality gate profile` is `context_operator_import_guard/v1`
- applies to linked proof artifacts referenced by `Proof path`

Canonical profile:
- `context_operator_import_guard/v1`

Canonical family:
- `bounded_context_operator_import`

Canonical proof shape:
- `agent_pack_import_snapshot/v1`

Primary host checker:
- `npm run check:directive-arscontexta-runtime`

Baseline thresholds:
- explicit import route returns `200`
- explicit import request for `arscontexta` imports exactly the bounded context-operator seed set
- default import requests must not import `arscontexta`
- imported agent count == `3`
- sync-existing updated count >= `3`
- imported agents must include:
  - `Ars Context Architect`
  - `Ars Delivery Builder`
  - `Ars Quality Reviewer`
- imported `sourcePack` must equal `arscontexta`
- imported source refs must include:
  - `arscontexta/context-architect`
  - `arscontexta/delivery-builder`
  - `arscontexta/quality-reviewer`
- imported pack assets must include `README.md`, `methodology`, `reference`, `skills`, and `skill-sources`

Required evidence:
- promotion record declares `Quality gate profile: context_operator_import_guard/v1`
- promotion record declares `Promotion profile family: bounded_context_operator_import`
- promotion record declares `Proof shape: agent_pack_import_snapshot/v1`
- promotion record declares `Primary host checker: npm run check:directive-arscontexta-runtime`
- promotion record links the host compile artifact and proof artifact
- proof artifact records:
  - import smoke report path
  - imported agent count
  - updated count from `syncExisting`
  - default import arscontexta count
  - imported agent names
  - imported agent source refs
  - imported workflow modes
  - imported pack asset labels
  - gate outcomes for:
    - `npm run runtime:arscontexta:smoke`
    - `npm run check:directive-arscontexta-runtime`
    - `npm run check:agents-import-packs-api-backend`
    - `npm run check:ops-stack`

Decision rules:
1. A bounded context-operator lane may claim `pass` only when the import smoke artifact proves `arscontexta` imports by explicit request and stays out of the default import path.
2. A bounded context-operator lane must remain scoped to importing the three arscontexta operator seeds; it does not imply adoption of the full upstream methodology/plugin runtime as product truth.
3. Rollback must remove slice-specific Runtime artifacts and checker wiring without disturbing unrelated import-pack API behavior.

Validation hooks:
- `npm run check:directive-arscontexta-runtime`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
