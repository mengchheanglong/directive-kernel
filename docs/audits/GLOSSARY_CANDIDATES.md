# GLOSSARY_CANDIDATES.md — v8 → v9 Audit Output

> **Audit pass output for the v9 cut.** This file is the fixed input DeepSeek consumes during Wave 2 (vocabulary renames). DeepSeek does NOT make judgment calls about which terms to rename — every decision is locked in this file.
>
> Companion: `DIRECTIVE_PREFIX_INVENTORY.md` (covers Wave 3 type/file renames).
>
> **How this file was produced:** repository sweep across `shared/contracts/`, `engine/types.ts`, lane READMEs, and source comments by Claude during the audit phase of the v9 cut.
>
> **What DeepSeek does with this file:** apply the renames in the "Vocabulary_Rename_Set" section everywhere they appear, leave the "Do_Not_Touch_Term_Set" untouched, leave the "Keep" terms untouched. Every term not in this file should be a kernel-internal local variable name that is out of scope per Requirement 4.15.

---

## Vocabulary_Rename_Set (apply everywhere — 8 canonical pairs)

These are the eight renames the v8 → v9 cut applies. Each appears in TypeScript identifiers (camelCase, PascalCase), JSON property keys (camelCase), JSON Schema text, Markdown contracts, and lane READMEs. DeepSeek applies all forms.

| # | Prose form (LHS) | Prose form (RHS) | camelCase form | PascalCase form | kebab-case form |
|---|------------------|------------------|----------------|-----------------|-----------------|
| 1 | `earned autonomy` | `operator trust score` | `earnedAutonomy` → `operatorTrustScore` | `EarnedAutonomy` → `OperatorTrustScore` | `earned-autonomy` → `operator-trust-score` |
| 2 | `gap radar` | `open gaps view` | `gapRadar` → `openGapsView` | `GapRadar` → `OpenGapsView` | `gap-radar` → `open-gaps-view` |
| 3 | `narrative threading` | `source thread context` | `narrativeThreading` → `sourceThreadContext` | `NarrativeThreading` → `SourceThreadContext` | `narrative-threading` → `source-thread-context` |
| 4 | `deep tail` | `materialization tail` | `deepTail` → `materializationTail` | `DeepTail` → `MaterializationTail` | `deep-tail` → `materialization-tail` |
| 5 | `legal next seams` | `allowed next steps` | `legalNextSeams` → `allowedNextSteps` | `LegalNextSeams` → `AllowedNextSteps` | `legal-next-seams` → `allowed-next-steps` |
| 6 | `forbidden scope expansion` | `out of scope` | `forbiddenScopeExpansion` → `outOfScope` | `ForbiddenScopeExpansion` → `OutOfScope` | `forbidden-scope-expansion` → `out-of-scope` |
| 7 | `bounded closeout` | `closeout` | `boundedCloseout` → `closeout` | `BoundedCloseout` → `Closeout` | `bounded-closeout` → `closeout` |
| 8 | `integrity gate` | `integrity check` | `integrityGate` → `integrityCheck` | `IntegrityGate` → `IntegrityCheck` | `integrity-gate` → `integrity-check` |

**Confirmed call-sites (from grep sweep across `engine/`, `shared/`, `discovery/`, `runtime/`, `architecture/`):**
- `earnedAutonomy`: `engine/types.ts`, `engine/routing/routing-assessment.ts`, `engine/routing/routing-digest.ts`, `engine/routing/earned-autonomy.ts` (file rename: see DIRECTIVE_PREFIX_INVENTORY.md row F-19), `engine/execution/engine-run-artifacts.ts`, `discovery/lib/front-door/discovery-front-door.ts`, plus markdown templates
- `gapRadar`: `engine/types.ts`, `engine/routing/routing-assessment.ts`, `engine/routing/routing-digest.ts`, `engine/routing/gap-radar.ts` (file rename: F-20), `engine/execution/engine-run-artifacts.ts`, `discovery/lib/front-door/discovery-front-door.ts`, `discovery/lib/routing/discovery-routing-review-resolution.ts`
- `narrativeThreading`: `engine/routing/source-narrative-threading.ts` (file rename: F-21)
- `deepTail`: `architecture/lib/control/architecture-deep-tail-stage-map.ts`, `architecture/lib/control/architecture-deep-tail-linkage-index.ts`, `architecture/lib/control/architecture-deep-tail-artifact-helpers.ts` (file renames: F-22, F-23, F-24)
- `legalNextSeams`: `engine/workspace-truth.ts`, `engine/state/resolve-directive-workspace-state.ts`
- `forbiddenScopeExpansion`: `engine/workspace-truth.ts`, `engine/state/resolve-directive-workspace-state.ts`
- `boundedCloseout`: `architecture/lib/experiments/architecture-bounded-closeout.ts` (file rename: F-25)
- `integrityGate`: needs grep verification during Wave 2 (term may live in markdown only)

---

## Do_Not_Touch_Term_Set (NEVER alter — 7 locked terms)

DeepSeek MUST NOT rename any occurrence of these terms during Wave 2, even if they appear nested inside an otherwise-renamed phrase.

| Term | Why locked | Where it lives |
|------|-----------|----------------|
| `mission` | Load-bearing concept in `DIRECTIVE_GOAL.md` and `engine/mission/`. Renaming would force a host-contract rewrite outside this cut's scope. | `engine/mission/`, `DIRECTIVE_GOAL.md`, lane READMEs |
| `lane` | The fundamental kernel abstraction. Three concrete lanes ship; the term is referenced everywhere. | `engine/lane.ts`, `engine/directive-workspace-lanes.ts`, every README |
| `discovery` | Lane name. Folder name (`discovery/`), package export key (`./discovery`), schema key. | `discovery/`, `package.json` exports, every contract |
| `runtime` | Lane name. Folder name (`runtime/`), package export key, schema key. | `runtime/`, `package.json` exports |
| `architecture` | Lane name. Folder name (`architecture/`), package export key, schema key. | `architecture/`, `package.json` exports |
| `kernel` | Package brand. Appears in `@directive/kernel`, `README.md`, every quickstart. | Repo-wide |
| `directive root` | The on-disk workspace concept the kernel reads/writes. Hosted in `DIRECTIVE_GOAL.md` as a load-bearing concept. | `DIRECTIVE_GOAL.md`, `engine/storage.ts`, every host |

**Edge case for DeepSeek:** when a Vocabulary_Rename_Set term appears INSIDE a Do_Not_Touch_Term_Set phrase (e.g. `"discovery legal next seams"`), the rename DOES apply to the embedded term: `"discovery legal next seams"` → `"discovery allowed next steps"`. The "do not touch" rule applies only to the locked term itself, not phrases that contain it.

---

## Keep (no rename, document in glossary — Standard English domain terms)

These terms appear in the codebase and lane READMEs but stay as-is. DeepSeek doesn't touch them. The post-Wave 5 `GLOSSARY.md` documents each of them with a one-sentence definition.

| Term | Meaning | Why keep |
|------|---------|----------|
| `process` | Standard English. Used in process-source flow. | No clearer synonym. |
| `artifact` | Standard English. Used throughout `shared/contracts/`. | Already plain. |
| `source` | A consumed input to the kernel (paper, repo, signal, etc.). | Domain-correct; renaming would break clarity. |
| `route` | A routing decision target (`runtime`, `architecture`, etc.). | Domain-correct. |
| `routing` | The act of deciding a route. | Same. |
| `intake` | Discovery's first stage. | Folder name + lane stage. |
| `triage` | Discovery's second stage when complex. | Folder name + lane stage. |
| `closeout` (post-rename) | Terminal lifecycle stage of an experiment. | Replaces `bounded closeout`. |
| `proof` | Evidence backing a runtime/architecture record. | Domain-correct. |
| `promotion` | Runtime's promotion lifecycle stage. | Folder name + concept. |
| `readiness` | Runtime promotion-readiness state. | Domain-correct. |
| `record` | A persisted JSON artifact. | Standard term. |
| `registry` | Runtime's registry of accepted capabilities. | Folder name + concept. |
| `front door` | The Discovery submission entry point. | Already plain English. |
| `capability` | A reusable callable (literature-access etc.). | Domain-correct. |
| `capability gap` | A documented gap in the kernel's capability set. | Standard term. |
| `submission` | A source submission through the front door. | Domain-correct. |
| `boundary` | An approval boundary or capability boundary. | Domain-correct (replaces "gate" only in the integrity case). |
| `approval` | An operator approval action. | Standard term. |
| `host` | The runtime that embeds the kernel. | Domain-correct. |
| `adopter` | A consuming project. | Standard term. |
| `audit` | An auditable record / a code review. | Standard term. |
| `migration` | A schema migration. | Standard term. |
| `schema` | A JSON Schema. | Standard term. |
| `version` | A schema version integer. | Standard term. |
| `bearer` | A bearer token. | Standard term. |
| `rate limit` | A request-rate cap. | Standard term. |
| `mission alignment` | A source's alignment to the host's mission. | Domain-correct (uses "mission" do-not-touch term). |
| `goal envelope` | A goal envelope from the host. | Domain-correct. |
| `signal` | A source signal token used in routing. | Domain-correct. |
| `case` | A case record (engine/cases/). | Domain-correct. |
| `event` | An event record. | Standard term. |
| `snapshot` | A snapshot artifact. | Standard term. |
| `experiment` | An architecture experiment. | Domain-correct. |
| `adoption` | An architecture adoption decision. | Domain-correct. |
| `materialization` | Architecture's downstream phase (post-rename: includes `materialization tail`). | Domain-correct. |
| `consumption` | The architecture consumption record stage. | Domain-correct. |
| `evaluation` | Post-consumption evaluation stage. | Standard term. |
| `feedback` | Operator feedback. | Standard term. |
| `inbox` | Operator decision inbox. | Standard term. |
| `coverage` | Discovery coverage metric. | Standard term. |
| `worklist` | Discovery gap worklist. | Standard term. |
| `intelligence packet` | A research-engine output packet. | Domain-correct. |
| `bundle` | A research bundle / runtime callable bundle. | Domain-correct. |
| `seam` | A workflow seam (after rename: in `allowed next steps`, the surrounding term is "step", not "seam"). | NOTE: `seam` survives in compound terms post-rename (`promotion seam`); only `legal next seams` becomes `allowed next steps`. Other `seam` occurrences are not in Vocabulary_Rename_Set and stay. |
| `routing assessment` | The structured output of the routing engine. | Domain-correct. |
| `routing digest` | A summarized routing assessment. | Domain-correct. |

---

## Re-audit instructions for Wave 5 (Codex eval phase)

After DeepSeek finishes Wave 2, Codex re-runs this audit by:

```bash
# Confirm zero remaining LHS occurrences outside the documented allowlist:
for term in earnedAutonomy gapRadar narrativeThreading deepTail legalNextSeams forbiddenScopeExpansion boundedCloseout integrityGate; do
  echo "=== $term ==="
  pnpm exec rg --files-with-matches --case-sensitive \
    --glob '!dist/**' --glob '!ui/**' \
    --glob '!discovery/research-engine/**' --glob '!node_modules/**' \
    --glob '!vocabulary-audit.csv' --glob '!Fix_Plan.md' \
    --glob '!shared/schemas/migrations/v8-to-v9.ts' \
    --glob '!docs/audits/GLOSSARY_CANDIDATES.md' \
    -- "$term"
done
```

The expected output is empty for every term. The `tests/integration/vocabulary-sweep.test.ts` (Wave 2 task 2.3) automates this exact check.
