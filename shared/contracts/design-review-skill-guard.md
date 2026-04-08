# Design Review Skill Guard Contract

Purpose:
- enforce bounded design-review skill import evidence on Runtime promotion records before callable design-review claims
- ensure software-design-philosophy promotions capture explicit import-pack results, deterministic reviewer metadata, and rollback scope

Scope:
- applies to Runtime promotion records whose `Quality gate profile` is `design_review_skill_guard/v1`
- applies to linked proof artifacts referenced by `Proof path`

Canonical profile:
- `design_review_skill_guard/v1`

Canonical family:
- `bounded_design_review_skill`

Canonical proof shape:
- `agent_pack_import_snapshot/v1`

Primary host checker:
- `npm run check:directive-design-philosophy-runtime`

Baseline thresholds:
- explicit import route returns `200`
- explicit import request for `software-design-philosophy-skill` imports exactly one bounded review operator
- default import requests must not import `software-design-philosophy-skill`
- imported agent count == `1`
- sync-existing updated count >= `1`
- imported agent must be:
  - `Design Philosophy Reviewer`
- imported `sourcePack` must equal `software-design-philosophy-skill`
- imported source ref must equal `software-design-philosophy-skill/reviewer`
- imported workflow mode must equal `review`
- imported pack assets must include `README.md` and `SKILL.md`

Required evidence:
- promotion record declares `Quality gate profile: design_review_skill_guard/v1`
- promotion record declares `Promotion profile family: bounded_design_review_skill`
- promotion record declares `Proof shape: agent_pack_import_snapshot/v1`
- promotion record declares `Primary host checker: npm run check:directive-design-philosophy-runtime`
- promotion record links the host compile artifact and proof artifact
- proof artifact records:
  - import smoke report path
  - imported agent count
  - updated count from `syncExisting`
  - default import design-pack count
  - imported agent name
  - imported agent source ref
  - imported workflow mode
  - imported pack asset labels
  - gate outcomes for:
    - `npm run runtime:design-philosophy:smoke`
    - `npm run check:directive-design-philosophy-runtime`
    - `npm run check:agents-import-packs-api-backend`
    - `npm run check:ops-stack`

Decision rules:
1. A bounded design-review lane may claim `pass` only when the import smoke artifact proves the pack imports only by explicit request and stays out of the default import path.
2. A bounded design-review lane must remain scoped to importing the `Design Philosophy Reviewer`; it does not imply adoption of the full upstream installation path or generic skill-pack runtime as product truth.
3. Rollback must remove slice-specific Runtime artifacts and checker wiring without disturbing unrelated import-pack API behavior.

Validation hooks:
- `npm run check:directive-design-philosophy-runtime`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
