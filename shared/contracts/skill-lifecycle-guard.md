# Skill Lifecycle Guard Contract

Purpose:
- enforce bounded skill-lifecycle import evidence on Runtime promotion records before callable skill-lifecycle claims
- ensure skill-lifecycle promotions capture explicit import-pack results, deterministic source metadata, pack asset coverage, and rollback scope

Scope:
- applies to Runtime promotion records whose `Quality gate profile` is `skill_lifecycle_guard/v1`
- applies to linked proof artifacts referenced by `Proof path`

Canonical profile:
- `skill_lifecycle_guard/v1`

Canonical family:
- `bounded_skill_lifecycle`

Canonical proof shape:
- `agent_pack_import_snapshot/v1`

Primary host checker:
- `npm run check:directive-skills-manager-runtime`

Baseline thresholds:
- import route returns `200`
- imported agent count >= `1`
- sync-existing updated count >= `1`
- imported agent `sourcePack` must equal `skills-manager`
- imported agent `sourceRef` must equal `skills-manager/lifecycle-operator`
- imported pack assets must include `README.md`, `scripts`, `src`, and `assets`

Required evidence:
- promotion record declares `Quality gate profile: skill_lifecycle_guard/v1`
- promotion record declares `Promotion profile family: bounded_skill_lifecycle`
- promotion record declares `Proof shape: agent_pack_import_snapshot/v1`
- promotion record declares `Primary host checker: npm run check:directive-skills-manager-runtime`
- promotion record links the host compile artifact and proof artifact
- proof artifact records:
  - import smoke report path
  - imported agent count
  - updated count from `syncExisting`
  - imported agent name
  - imported agent source pack
  - imported agent source ref
  - imported workflow mode
  - imported pack asset labels
  - gate outcomes for:
    - `npm run runtime:skills-manager:smoke`
    - `npm run check:directive-skills-manager-runtime`
    - `npm run check:agents-import-packs-api-backend`
    - `npm run check:ops-stack`

Decision rules:
1. A bounded skill-lifecycle lane may claim `pass` only when the import smoke artifact proves the `Skills Lifecycle Operator` can be imported from the Runtime-owned pack and re-synced safely.
2. A bounded skill-lifecycle lane must remain scoped to agent-pack import and skill-governance guidance; it does not imply adoption of the upstream desktop app runtime, UI, or `~/.skills-manager` as product truth.
3. Rollback must remove slice-specific Runtime artifacts and checker wiring without disturbing unrelated import-pack API behavior.

Validation hooks:
- `npm run check:directive-skills-manager-runtime`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
