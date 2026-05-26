# Directive Kernel — Technical Blueprint

> Reference document for future development, onboarding, and architectural decisions.
> Generated from a full codebase investigation.

---

## 1. Project Purpose

Directive Kernel is a **reusable workflow kernel** that a host project embeds to:

1. Ingest outside sources (papers, repos, essays, internal signals).
2. Judge each source against the host's current goal.
3. Route useful work through a structured lifecycle.
4. Turn results into reusable capability (Runtime) or system improvement (Architecture).

The kernel owns the workflow model, lane logic, contracts, reference hosts, and reusable operating code. The consuming project owns goals, operator identity, storage choices, and approval policy.

**Package:** `@directive/kernel` (private, clone-and-wire distribution model)

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Project                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │  Goal    │  │  Operator    │  │  Project-local    │    │
│  │  Owner   │  │  Identity    │  │  Storage/Policy   │    │
│  └────┬─────┘  └──────┬───────┘  └─────────┬─────────┘    │
└───────┼────────────────┼────────────────────┼──────────────┘
        │                │                    │
┌───────▼────────────────▼────────────────────▼──────────────┐
│                   Directive Kernel                          │
│                                                            │
│  ┌──────────────────── Engine ────────────────────────┐    │
│  │  Source → Analyze → Route → Extract → Adapt →      │    │
│  │  Improve → Prove → Decide → Integrate + Report     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐    │
│  │  Discovery  │  │   Runtime   │  │  Architecture  │    │
│  │  (intake &  │  │  (reusable  │  │  (system self- │    │
│  │   routing)  │  │  capability)│  │  improvement)  │    │
│  └─────────────┘  └─────────────┘  └────────────────┘    │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  ┌───────────┐    │
│  │  Shared  │  │  Hosts   │  │  UI   │  │  Control  │    │
│  └──────────┘  └──────────┘  └───────┘  └───────────┘    │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Layout

| Path | Role | Contains |
|------|------|----------|
| `engine/` | Shared kernel core | Source processing, routing, planning, decisions, lane contracts |
| `discovery/` | Discovery lane | `lib/` (operating code), `research-engine/` (Python provider) |
| `runtime/` | Runtime lane | `lib/` (lifecycle), `core/` (contracts), `capabilities/` (callables), `meta/` |
| `architecture/` | Architecture lane | `lib/` (operating code in grouped subfolders) |
| `shared/` | Cross-lane vocabulary | `contracts/`, `schemas/`, `templates/`, `lib/` |
| `hosts/` | Reference hosts | `standalone-host/`, `web-host/`, `integration-kit/` |
| `ui/` | Operator UI | Vite + Lit single-page app |
| `control/` | Control surface | `state/*.json` (machine-readable policy/status) |
| `state/` | Reserved | Host-side runtime persistence (not shipped) |
| `scripts/` | Dev utilities | Benchmarks, checks, UI dev runners |
| `local/` | Scratch (gitignored) | One-off audits, test outputs |

**Key rule:** Numbered folders (`01-intake/`, `02-adopted/`, etc.) are **artifact/state surfaces** created in the consuming project's `directive-root` at bootstrap time. They are NOT source-code modules.

---

## 4. The Engine (`engine/`)

### 4.1 What It Does

The engine is the smallest but highest-leverage layer. It orchestrates the full source-processing pipeline:

```
Source → Analyze → Route → Extract → Adapt → Improve → Prove → Decide → Integrate + Report
```

### 4.2 Public Entry Point

**`DirectiveEngine`** class (`engine/directive-engine.ts`):

| Method | Purpose |
|--------|---------|
| `processMinimalSource(...)` | Validates title, derives sourceRef, infers type, delegates to `processSource` |
| `processSource(input)` | Full pipeline: normalize → fingerprint → route → plan → persist → notify |
| `updatePlanProgress(...)` | Applies progress updates to an existing run's executable plan |
| `reRouteWithAnswers(...)` | Folds operator answers into a fresh routing pass |
| `previewMissionChange(...)` | Non-destructive before/after routing preview |
| `getRun(runId)` / `listRuns()` | Store-backed reads |

### 4.3 Core Domain Types (`engine/types.ts`)

- **Source:** `DirectiveEngineSourceItem`, supported types, integration modes
- **Mission:** `DirectiveEngineMissionContext`, capability gaps
- **Routing:** `DirectiveEngineRoutingAssessment` (scores, digest, gap radar, earned autonomy, narrative context)
- **Plans:** Extraction / Adaptation / Improvement / Proof plans (structured + executable)
- **Decision:** `hold_in_discovery` | `accept_for_architecture` | `route_to_runtime_follow_up` | `needs_human_review`
- **Run Record:** Schema version 8, ties all above together

### 4.4 Lane Contract (`engine/lane.ts`)

Each lane implements `DirectiveEngineLaneDefinition`:
- `laneId`, `label`, `hostDependence`, `defaultIntegrationMode`
- Optional callbacks: `planExtraction`, `planAdaptation`, `planImprovement`, `planProof`, `planIntegration`

The canonical 3-lane set (`engine/directive-workspace-lanes.ts`):
- **discovery** — engine-only, no integration, default decision `hold_in_discovery`
- **architecture** — engine-only, adapt integration, default decision `accept_for_architecture`
- **runtime** — host-adapter-required, adapt integration, default decision `route_to_runtime_follow_up`

### 4.5 Decision & Approval Rails

| File | Role |
|------|------|
| `decision-policy-ledger.ts` | Append-only ledger of routing review events + compiled suggestions |
| `approval-boundary.ts` | Guards: explicit approval, eligible status, integrity check, stage gate |
| `outcome-tracker.ts` | Classifies operator agreement/correction → feeds earned autonomy |
| `workspace-truth.ts` | Frozen scope constants (proven/partiallyBuilt/notBuilt per lane) |

### 4.6 Engine Subfolders

| Subfolder | Responsibility |
|-----------|---------------|
| `cases/` | Mirrored case substrate (event log, store, snapshot, planner) |
| `coordination/` | Lifecycle pressure, completion slices, autonomous-lane-loop, operator inbox |
| `execution/` | Runner state, run artifacts, evidence aggregation |
| `mission/` | Mission defaults, health, evolution, feedback inbox, gap formalization |
| `planning/` | Plan quality, prior-plan context, action API, decision/plan/record builders |
| `routing/` | Routing assessment, digest, diff, quality, correction ledger, earned autonomy, gap radar, source memory/similarity/narrative |
| `state/` | Canonical cross-lane state resolver (single source of truth for "current head") |

---

## 5. Discovery Lane (`discovery/`)

### 5.1 Purpose

Mission-aware intake queue, routing surface, and capability-gap detector. Everything enters through Discovery first.

### 5.2 Operating Code (`discovery/lib/`)

| Surface | Key Files |
|---------|-----------|
| `front-door/` | `discovery-front-door.ts` (canonical entry), coverage, projections, submission router, mission routing |
| `intake/` | Queue writer (`intake-queue.json`), transitions, lifecycle sync |
| `routing/` | Route opener, record writer, review resolution, effective boundary |
| `records/` | Case record, completion record, fast-path record writers |
| `gaps/` | Gap priority, worklist generator/selector/refresh |

### 5.3 Front Door Flow

1. Ingest `DiscoverySubmissionRequest`
2. Normalize source type
3. Run through `DirectiveEngine` (routing assessment)
4. Read decision-policy + routing-correction ledgers
5. Mirror submission via case store
6. Write intake/triage/routing records
7. Auto-open downstream stubs when route approval is explicit

### 5.4 Research Engine (`discovery/research-engine/`)

Python sub-package (separate workspace member). Finds candidates, gathers evidence, normalizes/scores, exports DW packets. Plugs in via `discovery/importers/research-engine-discovery-import.ts`. Optional live providers: GitHub, GitLab, Tavily, Exa, Firecrawl.

### 5.5 Artifact Folders (in consuming project)

`01-intake/` → `02-triage/` → `03-routing-log/` → `04-monitor/` → `05-deferred-or-rejected/`

---

## 6. Runtime Lane (`runtime/`)

### 6.1 Purpose

Turns extracted value into reusable callable capability with bounded proof, rollback, and host-facing packaging.

### 6.2 Code Surfaces

| Surface | Role |
|---------|------|
| `core/` | Contract types: source flow, usefulness levels, workspace V0 constants, callable/proof/decision contracts |
| `capabilities/` | Concrete callables: `literature-access`, `code-normalizer`, `research-vault-source-pack` |
| `lib/` | Lifecycle orchestration (see below) |
| `meta/` | Baseline promotion profiles and import source policy |

### 6.3 Lifecycle Code (`runtime/lib/`)

| Grouped Surface | Contents |
|-----------------|----------|
| `openers/` | Follow-up, record-proof, capability-boundary, promotion-readiness openers |
| `runners/` | Capability-boundary, follow-up, promotion-readiness, proof-open runners |
| `sequences/` | Pre-canned multi-step sequences |
| `projections/` | Read-model views for each stage |
| `writers/` | Artifact writers for follow-up, proof, record, promotion, registry, transformation |
| `host/` | Host callable adapter contract, selection resolution, promotion spec |
| `control/` | Automation eligibility, loop control, registry acceptance gate |

### 6.4 Artifact Folders (in consuming project)

`00-follow-up/` → `01-callable-integrations/` → `02-records/` → `03-proof/` → `04-capability-boundaries/` → `05-promotion-readiness/` → `06-promotion-specifications/` → `07-promotion-records/` → `08-registry/`

---

## 7. Architecture Lane (`architecture/`)

### 7.1 Purpose

Engine self-improvement lane. Handles system-level improvements that don't fit Runtime's capability model.

### 7.2 Lifecycle

```
Handoff → Bounded Closeout → Adoption → Materialization
                                            ├── Implementation Target
                                            ├── Implementation Result
                                            ├── Retention
                                            ├── Integration Record
                                            ├── Consumption Record
                                            └── Post-Consumption Evaluation
```

### 7.3 Operating Code (`architecture/lib/`)

| Grouped Surface | Responsibility |
|-----------------|---------------|
| `experiments/` | Handoff start, bounded closeout, reopen, lifecycle feedback, improvement candidates |
| `adoption/` | Adoption decisions, artifacts, review resolution, cycle summaries |
| `materialization/` | Implementation target/result, due checks, retention, integration, consumption, post-consumption evaluation |
| `control/` | Deep-tail stage maps, linkage index, note projections, operator loop control |

### 7.4 Artifact Folders (in consuming project)

`01-experiments/` → `02-adopted/` → `03-deferred-or-rejected/` → `04-materialization/{04-targets, 05-results, 06-retained, 07-integration, 08-consumption, 09-post-consumption}`

---

## 8. Shared Layer (`shared/`)

### 8.1 Contracts (`shared/contracts/`)

~50 markdown behavioral contracts. Key ones:
- `directive-kernel-goal-input.md` — goal envelope (goalId, goalStatement, whyNow, adoptionTarget, constraints, successSignal)
- `host-integration-boundary.md`, `host-callable-adapter.md` — host seam contracts
- `discovery-to-runtime.md`, `discovery-to-architecture.md` — lane handoff contracts
- `lifecycle-transition-policy.md`, `command-class-approval-policy.md` — governance

### 8.2 Schemas (`shared/schemas/`)

JSON Schemas for all machine-readable artifacts: engine run records, discovery queue entries, architecture decisions, capability gaps, transformation proofs, host configs, etc.

### 8.3 Templates (`shared/templates/`)

Markdown templates used by lane writers when materializing artifacts (intake, triage, routing, experiment, proof, promotion, registry, etc.).

### 8.4 Helpers (`shared/lib/`)

| File | Purpose |
|------|---------|
| `directive-goal.ts` | Parse `DIRECTIVE_GOAL.md`, return structured envelope or graceful fallback |
| `validation.ts` | Small string validators |
| `directive-relative-path.ts` | Path-safety helpers |
| `workspace-root.ts` | Directive workspace root resolution |
| `path-normalization.ts` | Forward-slashed absolute path normalizer |
| `file-io.ts` | `readJson`, `writeJson`, `writeJsonAtomic`, `readUtf8`, `writeUtf8`, `appendJsonLine` |

---

## 9. Hosts

### 9.1 Standalone Host (`hosts/standalone-host/`)

Full-featured reference filesystem host.

**CLI commands** (`cli.ts`, run via `node --experimental-strip-types`):
- `init` — Bootstrap a directive root with full scaffold + example payloads
- `serve` — Start HTTP server (127.0.0.1:8787, bearer auth, access logging)
- `discovery-submit`, `discovery-overview` — Discovery operations
- `engine-plan-progress`, `engine-reroute` — Engine operations
- `mission-*` — Mission feedback/preview/approve/reject/revert/history
- `gap-*` — Gap formalize/approve/reject
- `runtime-*` — Full runtime lifecycle commands + capability invocations

**Server API** (`server.ts`):
- `GET /health`, `/api/discovery/overview`, `/api/runtime/overview`, `/api/runtime/status`
- `POST /api/discovery/submissions` (with `?process_with_engine=1`, `?dry_run=1`)
- `POST /api/engine/plan-progress`, `/api/engine/reroute`
- `POST /api/runtime/{follow-ups, records, proof-bundles, ...}`

**Config** (`config.ts`): directive root, server host/port, auth (none | static_bearer), persistence (filesystem | filesystem_and_sqlite).

### 9.2 Web Host (`hosts/web-host/`)

UI-serving host that mounts the same filesystem host + a large API surface for the Lit UI.

- `cli.ts serve --directive-root <path>`
- Serves `ui/dist/` with `index.html` fallback
- Returns 503 with helpful "missing build" page when UI hasn't been built
- Full API routes mirror all lane lifecycle operations

### 9.3 Integration Kit (`hosts/integration-kit/`)

Embedding kit for consuming projects:
- `lib/` — Adapters, bridges (filesystem/memory), overview reader, acceptance flow
- `cli` — `acceptance-quickstart`, `submission-memory-dry-run`, `first-integration-flow`
- `starter/` — Copy-facing templates
- `examples/` — Ready-to-run JSON payloads

---

## 10. UI (`ui/`)

| Aspect | Detail |
|--------|--------|
| Framework | Lit 3.x |
| Bundler | Vite 8.x |
| Package | `@directive/kernel-ui` (workspace member) |
| Dev proxy | `/api` → `http://127.0.0.1:43128` (configurable) |
| Role | Read-only operator view, calls host APIs, no lane logic |

**Key source files:**
- `route-loader.ts` — Client-side router mapping URLs to API calls
- `page-actions.ts` — POST mutations (mission, discovery, runtime, architecture)
- `renderers/` — Dashboard, detail pages, discovery, execution, insight panels, workflow
- `types/` — Typed mirrors of backend snapshot shapes

---

## 11. Control & State

### 11.1 `control/state/` (shipped with kernel)

| File | Content |
|------|---------|
| `autonomous-lane-loop-policy.json` | Safe-by-default: all auto-* flags off. Consuming projects flip flags. |
| `completion-status.json` | Anchor with `currentTargetId: "kernel_baseline_complete"` |
| `completion-slices.json` | Empty items array (consuming projects own slices) |
| `operator-simplicity-migration-status.json` | Empty migration backlog |
| `operator-simplicity-migration-slices.json` | Empty (consuming projects own) |

### 11.2 `state/` (root-level, reserved)

Reserved for consuming-project case and event persistence. Kernel does not ship content here.

---

## 12. Build, Run & Tooling

### 12.1 Package Manager

pnpm 10.32.1 with workspace members: `ui`, `discovery/research-engine`, `hosts/integration-kit`

### 12.2 TypeScript Configuration (`tsconfig.repo.json`)

- Target: ES2022
- Module: ESNext, moduleResolution: Bundler
- Strict mode, `noEmit`, `allowImportingTsExtensions`, `verbatimModuleSyntax`
- Includes: `engine/`, `discovery/`, `runtime/`, `architecture/`, `hosts/`, `shared/`, `scripts/`
- Excludes: `ui/**`, `node_modules/**`, `local/**`

### 12.3 Execution Model

All TypeScript runs directly via `node --experimental-strip-types`. No compile step for the kernel. `tsx ^4.21.0` is a dev-only fallback. The UI is the only surface that uses a bundler (Vite).

### 12.4 Root Scripts

| Script | Command |
|--------|---------|
| `dev` | Runs UI dev server with API proxy |
| `start` | Builds UI then starts web host |
| `typecheck` | `tsc --noEmit` for kernel + UI |
| `check:first-integration` | Validates first-host integration flow |
| `check:hardening` | System hardening checks |
| `standalone:cli` | Direct standalone host CLI access |
| `web:serve` | Web host with directive root at `.` |

### 12.5 Testing

No kernel-level test runner is wired. The Python research-engine has `python -m unittest discover -s tests`.

---

## 13. Goal System

### 13.1 Contract

Defined in `shared/contracts/directive-kernel-goal-input.md`:

```json
{
  "goalId": "project-current-goal",
  "goalStatement": "...",
  "whyNow": "...",
  "adoptionTarget": "runtime",
  "constraints": ["stay bounded", "keep review explicit"],
  "successSignal": "..."
}
```

### 13.2 Resolution Chain

1. Host reads `DIRECTIVE_GOAL.md` from project root or directive root
2. `shared/lib/directive-goal.ts` parses it into a structured envelope
3. If missing, returns graceful fallback (`per_request_goal_input` mode)
4. Goal is passed to Discovery before source enters the front door

### 13.3 Fallback Behavior

When no goal file exists, hosts keep Discovery in **review-first** or **queue-only** mode until an operator sets direction.

---

## 14. Key Conventions & Gotchas

### Numbered folders are state, not modules
Every `0X-*` folder is an artifact destination created at bootstrap in the consuming project's `directive-root`. Operating code always lives in `<lane>/lib/` and `engine/`.

### Decision-policy ledger learns from operators
Append-only ledger at `<directiveRoot>/engine/decision-policy-ledger.json`. Each routing review emits events and recompiles suggestions (routing_bias, goal_hint, approval_boundary, gap_heuristic). These feed earned autonomy, gap radar, and source memory — the routing layer literally learns from operator outcomes.

### Process fingerprinting prevents duplicate work
`process-fingerprint.ts` hashes (source, mission) deterministically. `processSource` short-circuits with `deduplicated: true` on fingerprint match. WeakMap cache with hits/misses telemetry for performance debugging.

### Approval boundary is a runtime invariant
`requireDirectiveIntegrityForOpening` refuses to open downstream work when `integrityState !== "ok"`. `requireDirectiveCurrentStageForOpening` additionally checks live stage against allowed-stage selectors. This is the most reused guard in lane openers.

### Workspace truth is a frozen constant
`DIRECTIVE_WORKSPACE_PRODUCT_TRUTH` lists proven/partiallyBuilt/intentionallyMinimal/notBuilt/forbiddenScopeExpansion per lane. New work must fit `legalNextSeams`. It's a hard-coded scope statement.

### Three runtime surfaces (don't confuse them)
- `runtime/lib/` — lifecycle orchestration code
- `runtime/core/` — contract types and constants
- `runtime/capabilities/` — concrete callable implementations
- `runtime/host-artifacts/` — artifact directory used by standalone host server (NOT a host)

### Web host "missing build" page
`server.ts` returns 503 with a helpful page when `ui/dist/index.html` is absent. The `start` script builds UI first; `dev` proxies via Vite.

### Deep-tail stage registry
`architecture-deep-tail-stage-map.ts` exports `ARCHITECTURE_DEEP_TAIL_STAGES`. The web-host API walks this array to construct detail routes — adding a new deep-tail stage is a single-file change.

### `local/` is scratch
Gitignored. Used for one-off audits and test outputs. Not part of the kernel surface.

---

## 15. Package Export Surface

The legitimate import paths for consumers (from `package.json` exports):

```
@directive/kernel                          → index.ts
@directive/kernel/engine                   → engine/index.ts
@directive/kernel/engine/cases             → engine/cases/index.ts
@directive/kernel/engine/coordination      → engine/coordination/index.ts
@directive/kernel/engine/execution         → engine/execution/index.ts
@directive/kernel/engine/state             → engine/state/index.ts
@directive/kernel/engine/mission           → engine/mission/index.ts
@directive/kernel/engine/routing           → engine/routing/index.ts
@directive/kernel/engine/planning          → engine/planning/index.ts
@directive/kernel/discovery                → discovery/lib/index.ts
@directive/kernel/discovery/gaps           → discovery/lib/gaps/index.ts
@directive/kernel/discovery/front-door     → discovery/lib/front-door/index.ts
@directive/kernel/discovery/intake         → discovery/lib/intake/index.ts
@directive/kernel/discovery/routing        → discovery/lib/routing/index.ts
@directive/kernel/discovery/records        → discovery/lib/records/index.ts
@directive/kernel/discovery/importers      → discovery/importers/index.ts
@directive/kernel/runtime                  → runtime/lib/index.ts
@directive/kernel/runtime/openers          → runtime/lib/openers/index.ts
@directive/kernel/runtime/projections      → runtime/lib/projections/index.ts
@directive/kernel/runtime/runners          → runtime/lib/runners/index.ts
@directive/kernel/runtime/sequences        → runtime/lib/sequences/index.ts
@directive/kernel/runtime/writers          → runtime/lib/writers/index.ts
@directive/kernel/runtime/host             → runtime/lib/host/index.ts
@directive/kernel/runtime/control          → runtime/lib/control/index.ts
@directive/kernel/runtime/core/...         → runtime/core/runtime-core-contract.ts
@directive/kernel/architecture             → architecture/lib/index.ts
@directive/kernel/architecture/control     → architecture/lib/control/index.ts
@directive/kernel/architecture/adoption    → architecture/lib/adoption/index.ts
@directive/kernel/architecture/materialization → architecture/lib/materialization/index.ts
@directive/kernel/architecture/experiments → architecture/lib/experiments/index.ts
@directive/kernel/standalone-host          → hosts/standalone-host/index.ts
@directive/kernel/standalone-host/*        → hosts/standalone-host/*.ts
@directive/kernel/integration-kit          → hosts/integration-kit/index.ts
@directive/kernel/ui                       → hosts/web-host/index.ts
@directive/kernel/shared/directive-goal    → shared/lib/directive-goal.ts
```

---

## 16. Quick Start Reference

```powershell
# Install
pnpm install

# Bootstrap a standalone directive root
node --experimental-strip-types ./hosts/standalone-host/cli.ts init --output-root ./local/standalone

# Run standalone host
node --experimental-strip-types ./hosts/standalone-host/cli.ts serve --config ./local/standalone/standalone-host.config.json

# Run web host + UI (production)
pnpm run start

# Run web host + UI (dev with hot reload)
pnpm run dev

# Type check
pnpm run typecheck
```

---

*Last updated from codebase investigation. Refer to individual README.md files in each surface for the most current details.*
