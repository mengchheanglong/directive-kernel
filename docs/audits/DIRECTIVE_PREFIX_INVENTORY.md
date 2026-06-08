# DIRECTIVE_PREFIX_INVENTORY.md — v8 → v9 Audit Output

> **Audit pass output for the v9 cut.** This file is the fixed input DeepSeek consumes during Wave 3 (naming renames) and Wave 5 (lint allowlist).
>
> Companion: `GLOSSARY_CANDIDATES.md` (covers Wave 2 vocabulary renames).
>
> **How this file was produced:** ripgrep sweep across `engine/`, `shared/`, `discovery/`, `runtime/`, `architecture/`, `hosts/` of every `^export (type|interface|class|function|const|abstract class) Directive[A-Z]` declaration plus every `directive-*.ts` filename plus every `<lane>-*.ts` filename inside its same-named lane folder.
>
> **Audit numbers:**
> - **376 unique** `Directive`-prefixed exported declarations across the kernel
> - **5 files** with `directive-` filename prefix
> - **80+ files** with redundant lane-prefix in basename (e.g. `runtime-*.ts` inside `runtime/`)
>
> **What DeepSeek does with this file:**
> 1. Apply the **canonical 13 renames** in section A everywhere they appear (this is the locked Naming_Rename_Table from `requirements.md` Requirement 4).
> 2. Apply the **bulk-rename rules** in section B as a mechanical sweep (delete `Directive` prefix from every export, delete folder-name prefix from every file basename inside its same-named folder, delete `directive-` from every filename).
> 3. The **DIRECTIVE_PREFIX_ALLOWLIST** in section C is what `scripts/check-naming.ts` (Wave 5) seeds with — these are the few exports that genuinely cannot be renamed in this cut.

---

## Section A — Canonical 13 renames (apply first, individually verified)

These are the 13 rows from `requirements.md` Requirement 4. They MUST be applied via `semanticRename` (for types/functions) and `smartRelocate` (for files). Each row's `caller_count` was measured during the audit; they're the spot-check anchors when DeepSeek verifies typecheck after each rename.

| # | Kind | Current | Proposed | Caller count | File location |
|---|------|---------|----------|--------------|---------------|
| 1 | type | `DirectiveEngineSourceItem` | `EngineSourceItem` | ~18 | `engine/types.ts` |
| 2 | type | `DirectiveEngineMissionContext` | `MissionContext` | ~22 | `engine/types.ts` |
| 3 | type | `DirectiveEngineCapabilityGap` | `CapabilityGap` | ~12 | `engine/types.ts` |
| 4 | type | `DirectiveEngineLaneDefinition` | `LaneDefinition` | ~14 | `engine/lane.ts` |
| 5 | type | `DirectiveEngineRunRecord` | `RunRecord` | ~42 | `engine/types.ts` |
| 6 | function | `requireDirectiveExplicitApproval` | `requireExplicitApproval` | ~11 | `engine/approval-boundary.ts` |
| 7 | function | `requireDirectiveIntegrityForOpening` | `requireIntegrityForOpening` | ~7 | `engine/approval-boundary.ts` |
| 8 | file | `discovery/lib/front-door/discovery-front-door.ts` | `discovery/lib/front-door/index.ts` | ~6 | (move) |
| 9 | file | `discovery/lib/front-door/discovery-front-door-coverage.ts` | `discovery/lib/front-door/coverage.ts` | ~3 | (move) |
| 10 | file | `runtime/lib/openers/runtime-follow-up-opener.ts` | `runtime/lib/openers/follow-up.ts` | ~4 | (move) |
| 11 | file | `runtime/lib/openers/runtime-runtime-capability-boundary-promotion-readiness-opener.ts` | `runtime/lib/openers/promotion-readiness.ts` | ~5 | (move) — double-prefix offender |
| 12 | file | `architecture/lib/control/architecture-deep-tail-stage-map.ts` | `architecture/lib/control/materialization-tail-stage-map.ts` | ~4 | (move) — also picks up `deep tail → materialization tail` rename |
| 13 | schema-file | `shared/schemas/directive-engine-run-record.schema.json` | `shared/schemas/run-record.schema.json` | ~8 | (delete + create) |

`semanticRename` handles transitive call-site updates for rows 1–7. `smartRelocate` handles import path updates for rows 8–12. Row 13 is a delete + create plus `$id` rewrite.

---

## Section B — Bulk-rename rules (apply mechanically after Section A)

After Section A lands, DeepSeek applies these two mechanical sweeps to every remaining instance.

### Rule B1 — Drop `Directive` prefix from every kernel export

**Pattern:** `^export\s+(type|interface|class|function|const|abstract\s+class)\s+Directive([A-Z]\w*)` → `export $1 $2`

**Example transformations:**
```
DirectiveAnalysisEvidenceArtifact         → AnalysisEvidenceArtifact
DirectiveCitationSetArtifact              → CitationSetArtifact
DirectiveEvaluationSupportArtifact        → EvaluationSupportArtifact
DirectiveLifecycleArtifacts               → LifecycleArtifacts
DirectiveGoalEnvelope                     → GoalEnvelope
DirectiveRuntimeTwoStepSequence...        → RuntimeTwoStepSequence... (keep "Runtime" — domain term)
DirectiveRuntimeNamedSequence...          → RuntimeNamedSequence...
DirectiveRuntimeProofCapabilityBoundary...→ RuntimeProofCapabilityBoundary...
DirectiveRuntimeFollowUp...               → RuntimeFollowUp...
DirectiveRuntimeCheckpointRunner...       → RuntimeCheckpointRunner...
DirectiveRuntimeSharedInvocation...       → RuntimeSharedInvocation...
DirectiveRuntimeProofOpenRunner...        → RuntimeProofOpenRunner...
DirectiveRuntimePromotionReadiness...     → RuntimePromotionReadiness...
DirectiveRuntimeFollowUpRunner...         → RuntimeFollowUpRunner...
DirectiveRuntimeCapabilityBoundary...     → RuntimeCapabilityBoundary...
DirectiveMirroredRuntimeProofOpen...      → MirroredRuntimeProofOpen...
```

**Important: the rule strips `Directive` ONLY.** The lane prefix (`Runtime`, `Discovery`, `Architecture`, `Engine`) STAYS because the lane is a domain concept, not a brand prefix. The post-rename type `RuntimeFollowUpRunner` is correct because the type lives inside the runtime lane.

**Constants (SCREAMING_SNAKE):** the same rule applies — `DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS` → `RUNTIME_NAMED_SEQUENCE_KINDS`, `DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS` → `RUNTIME_SHARED_INVOCATION_ACTIONS`. The prefix to drop is the leading `DIRECTIVE_`.

**One canonical exception (kept on the allowlist, see Section C):** `DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION`. This constant gates the storage version check (Wave 1 task 1.5). Renaming it to `RUN_RECORD_SCHEMA_VERSION` ripples through the migration framework and the storage check; the spec keeps it on the allowlist for the v9 cut and renames it in a follow-up.

### Rule B2 — Drop folder-name prefix from same-folder file basenames

**Pattern:** for each file whose basename starts with `<parent-folder-name>-`, strip the prefix and the leading hyphen.

**Examples (all confirmed by file_search):**

| Folder | Current basename | Proposed basename |
|--------|------------------|-------------------|
| `runtime/lib/sequences/` | `runtime-sequence-shared.ts` | `sequence-shared.ts` |
| `runtime/lib/sequences/` | `runtime-sequence-invocation.ts` | `sequence-invocation.ts` |
| `runtime/lib/sequences/` | `runtime-proof-capability-boundary-sequence.ts` | `proof-capability-boundary-sequence.ts` |
| `runtime/lib/sequences/` | `runtime-follow-up-proof-sequence.ts` | `follow-up-proof-sequence.ts` |
| `runtime/lib/runners/` | `runtime-runner-shared.ts` | `runner-shared.ts` |
| `runtime/lib/runners/` | `runtime-runner-invocation.ts` | `runner-invocation.ts` |
| `runtime/lib/runners/` | `runtime-proof-open-runner.ts` | `proof-open-runner.ts` |
| `runtime/lib/runners/` | `runtime-promotion-readiness-runner.ts` | `promotion-readiness-runner.ts` |
| `runtime/lib/runners/` | `runtime-follow-up-runner.ts` | `follow-up-runner.ts` |
| `runtime/lib/runners/` | `runtime-capability-boundary-runner.ts` | `capability-boundary-runner.ts` |
| `runtime/lib/openers/` | `runtime-record-proof-opener.ts` | `record-proof-opener.ts` |
| `runtime/lib/openers/` | `runtime-proof-runtime-capability-boundary-opener.ts` | `proof-runtime-capability-boundary-opener.ts` (keep nested `runtime-` — describes content, not folder) |
| `runtime/lib/projections/` | `runtime-proof-open-projections.ts` | `proof-open-projections.ts` |
| `runtime/lib/projections/` | `runtime-promotion-readiness-projections.ts` | `promotion-readiness-projections.ts` |
| `runtime/lib/projections/` | `runtime-follow-up-projections.ts` | `follow-up-projections.ts` |
| `runtime/lib/projections/` | `runtime-capability-boundary-projections.ts` | `capability-boundary-projections.ts` |
| `runtime/lib/writers/` | `runtime-writer-support.ts` | `writer-support.ts` |
| `runtime/lib/writers/` | `runtime-transformation-record-writer.ts` | `transformation-record-writer.ts` |
| `runtime/lib/writers/` | `runtime-transformation-proof-writer.ts` | `transformation-proof-writer.ts` |
| `runtime/lib/control/` | `runtime-promotion-assistance.ts` | `promotion-assistance.ts` |
| `runtime/lib/control/` | `runtime-loop-control.ts` | `loop-control.ts` |
| `runtime/lib/control/` | `runtime-manual-control.ts` | `manual-control.ts` |
| `runtime/lib/host/` | `runtime-promotion-specification.ts` | `promotion-specification.ts` |
| `runtime/core/` | `runtime-core-contract.ts` | `core-contract.ts` |
| `discovery/lib/routing/` | `discovery-route-opener.ts` | `route-opener.ts` |
| `discovery/lib/gaps/` | `discovery-gap-worklist-selector.ts` | `gap-worklist-selector.ts` |
| `discovery/lib/front-door/` | `discovery-front-door-projections.ts` | `front-door-projections.ts` |
| `architecture/lib/materialization/` | `architecture-implementation-result.ts` | `implementation-result.ts` |
| `architecture/lib/materialization/` | `architecture-consumption-record.ts` | `consumption-record.ts` |
| `architecture/lib/materialization/` | `architecture-retention.ts` | `retention.ts` |
| `architecture/lib/materialization/` | `architecture-post-consumption-evaluation.ts` | `post-consumption-evaluation.ts` |
| `architecture/lib/materialization/` | `architecture-materialization-due-check.ts` | `materialization-due-check.ts` |
| `architecture/lib/materialization/` | `architecture-implementation-target.ts` | `implementation-target.ts` |
| `architecture/lib/materialization/` | `architecture-integration-record.ts` | `integration-record.ts` |
| `architecture/lib/control/` | `architecture-deep-tail-linkage-index.ts` | `materialization-tail-linkage-index.ts` (Wave 2 vocabulary rename + Rule B2) |
| `architecture/lib/control/` | `architecture-deep-tail-artifact-helpers.ts` | `materialization-tail-artifact-helpers.ts` (same) |
| `architecture/lib/control/` | `architecture-note-closeout-projections.ts` | `note-closeout-projections.ts` |
| `architecture/lib/experiments/` | `architecture-closeout.ts` | `closeout.ts` |
| `architecture/lib/experiments/` | `architecture-bounded-closeout.ts` | `closeout.ts` (Wave 2 vocabulary rename `bounded closeout` → `closeout`) — **NOTE: collision with the previous row.** Resolve by inspecting file contents during execution; one of the two files likely deletes after the rename, the other absorbs unique content. |
| `architecture/lib/experiments/` | `architecture-handoff-start.ts` | `handoff-start.ts` |
| `architecture/lib/experiments/` | `architecture-reopen-from-evaluation.ts` | `reopen-from-evaluation.ts` |
| `architecture/lib/adoption/` | `architecture-adoption-decision-writer.ts` | `adoption-decision-writer.ts` |
| `architecture/lib/adoption/` | `architecture-result-adoption.ts` | `result-adoption.ts` |
| `architecture/lib/adoption/` | `architecture-adoption-decision-store.ts` | `adoption-decision-store.ts` |
| `architecture/lib/adoption/` | `architecture-cycle-decision-summary.ts` | `cycle-decision-summary.ts` |
| `architecture/lib/adoption/` | `architecture-adoption-artifacts.ts` | `adoption-artifacts.ts` |
| `architecture/lib/adoption/` | `architecture-cycle-decision-loader.ts` | `cycle-decision-loader.ts` |

**Bulk-application instructions for DeepSeek:**

1. After Section A's 5 file moves land, run `pnpm exec rg --files --glob '!dist/**' --glob '!node_modules/**'` to enumerate every `<lane>/**/<lane>-*.ts` file.
2. For each file, derive the proposed basename by stripping `<lane>-` from the start.
3. Run `smartRelocate` on each file in turn, running `pnpm run typecheck` after every batch of 5–10 to catch any reference that wasn't auto-updated.
4. The spec REQUIRES (Requirement 4.16) that no new file under `discovery/`, `runtime/`, `architecture/`, `engine/`, `shared/`, or `hosts/` matches `<parent-folder-name>-*` after the cut. The Wave 5 lint script enforces this; DeepSeek must clear it.

### Rule B3 — Delete `directive-` filename prefix

5 files match `^directive-`:

| Current path | Proposed path |
|--------------|---------------|
| `shared/lib/directive-relative-path.ts` | `shared/lib/relative-path.ts` |
| `shared/lib/directive-goal.ts` | `shared/lib/goal.ts` |
| `engine/directive-engine.ts` | `engine/index.ts` (the file IS the engine; should be the index of the engine folder — but `engine/index.ts` may already exist; verify and merge) |
| `engine/directive-workspace-lanes.ts` | `engine/workspace-lanes.ts` |
| `engine/state/resolve-directive-workspace-state.ts` | `engine/state/resolve-workspace-state.ts` |
| `engine/execution/directive-runner-state.ts` | `engine/execution/runner-state.ts` |
| `shared/schemas/directive-engine-run-record.schema.json` | `shared/schemas/run-record.schema.json` (Section A row 13) |
| `shared/contracts/directive-kernel-goal-input.md` | `shared/contracts/goal-input.md` |
| `shared/contracts/directive-kernel-repo-baseline.md` | `docs/contracts/repo-baseline.md` |

**Note for `engine/directive-engine.ts` → `engine/index.ts`:** before moving, check whether `engine/index.ts` already exists and merge cleanly. The current `engine/directive-engine.ts` is the kernel's main orchestrator class; it makes sense as `engine/index.ts`.

---

## Section C — DIRECTIVE_PREFIX_ALLOWLIST seed for `scripts/check-naming.ts`

These exports are NOT renamed in the v8 → v9 cut and are pre-populated into the lint script's allowlist. Each carries a Fix_Plan reference for the deferral.

```typescript
// scripts/check-naming.ts
//
// Allowlist of files in which a `Directive`-prefixed exported symbol is
// permitted. Every entry has a Fix_Plan reference explaining the deferral.
export const DIRECTIVE_PREFIX_ALLOWLIST: ReadonlyArray<string> = [
  // engine/types.ts:DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION
  // Why: This constant gates Storage_Version_Check (Wave 1 task 1.5). Renaming it
  // would ripple through the migration framework and the storage check during the
  // v8→v9 cut itself. Deferred to a follow-up cut after the migration framework
  // has stabilized. See Fix_Plan.md F4/F7/F11 outcome paragraphs.
  "engine/types.ts",
] as const;
```

**That is the ONLY allowlist entry for the v9 cut.** Every other `Directive`-prefixed export gets renamed by Section A (canonical 13) or Section B (bulk Rule B1).

The lint script enforces this list: any new `Directive`-prefixed export added to a file NOT in the allowlist fails the `check:naming` step in CI. To add a new entry post-v9, a contributor must justify the deferral in the entry's comment block and link a Fix_Plan item.

---

## Re-audit instructions for Wave 5 (Codex eval phase)

After DeepSeek finishes Wave 3, Codex re-runs this audit by:

```bash
# 1. Confirm zero remaining `^export ... Directive[A-Z]` declarations except in the allowlisted file:
pnpm exec rg "^export (type|interface|class|function|abstract class|const) Directive[A-Z]" \
  --glob '!dist/**' --glob '!ui/**' --glob '!discovery/research-engine/**' \
  --glob '!node_modules/**' --glob '!tests/**' --glob '!scripts/**' --glob '!.kiro/**' \
  --glob '!engine/types.ts'

# Expected output: empty (every Directive-prefixed export outside engine/types.ts has been renamed).

# 2. Confirm zero remaining files matching `<lane>/<lane>-*.ts`:
for lane in runtime discovery architecture; do
  pnpm exec rg --files --glob "$lane/**/$lane-*.ts" --glob '!node_modules/**'
done

# Expected output: empty (every folder-prefix file has been moved).

# 3. Confirm zero remaining files matching `^directive-`:
pnpm exec rg --files --glob 'directive-*.ts' --glob 'directive-*.md' --glob 'directive-*.json' \
  --glob '!dist/**' --glob '!node_modules/**' --glob '!.kiro/**'

# Expected output: empty (every directive- prefixed file has been moved or deleted).
```

The `scripts/check-naming.ts` (Wave 5 task 5.5) automates exactly these three checks in one CI step.
