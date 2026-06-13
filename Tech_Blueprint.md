# Directive Kernel - Technical Blueprint

Reference document for engineering review, onboarding, and architecture
analysis. This file is meant to describe the repository as it exists now,
not an earlier planning phase.

## 1. Purpose

Directive Kernel is **Hermes's capability acquisition, verification, and self-improvement kernel.** It turns selected sources, repos, papers, workflows, and task failures into verified Hermes-usable capabilities or honestly-classified notes.

The consuming host (Hermes) still owns:

- goal resolution and intent framing
- operator identity and conversation context
- external app context
- project-local policy
- project-local storage decisions beyond the kernel's shipped defaults

The kernel owns the capability compounding model:

1. accept a source
2. classify it into an operationalization decision (capability candidate, architecture experiment, note-only, training-lab-only, fine-tune later, or reject)
3. route capability candidates through proof, verification, and projection
4. route system-improvement ideas into measured architecture experiments
5. record decisions, outcomes, and trust updates
6. expose verified powers and Jarvis readiness through hosts, API, UI, and MCP

The current-branch north star is the Jarvis capability kernel. The historical `general-workflow-kernel` audience described in [AUDIENCE.md](./AUDIENCE.md) is retained as secondary/public lineage.

### Core vocabulary

| Term | Meaning |
| --- | --- |
| **Operationalization decision** | The decision about what DK should do with a source: `reject`, `note_only`, `capability_candidate`, `architecture_experiment`, `training_lab_only`, or `fine_tune_later`. |
| **Capability candidate** | A source that may become a Hermes-usable capability after verification and projection. |
| **Verified capability** | A capability with real execution/evaluation evidence and a usable Hermes projection. |
| **Hermes projection** | An MCP tool, skill, CLI wrapper, handoff prompt, cron job, or Obsidian note that makes a capability usable by Hermes. |
| **Architecture experiment** | A bounded system-improvement hypothesis with measurable expected benefit and kill criteria. |
| **Note-only** | Useful information that belongs in Obsidian/wiki but not as a Runtime capability. |
| **Training-lab-only** | A source requiring model architecture/pretraining/fine-tuning beyond local system-layer changes. |
| **Registry entry class** | The classification of a registry entry: `verified_capability`, `candidate`, `placeholder`, `note_only`, `rejected`, or `architecture_experiment`. |

## 2. Core Product Boundaries

The repository is organized around five product surfaces.

- `engine/` is the cross-lane kernel core
- `discovery/` is the intake and routing lane
- `runtime/` is the reusable capability lane
- `architecture/` is the self-improvement lane
- `shared/` is the cross-lane contract and helper surface

Supporting surfaces:

- `hosts/` contains thin reference hosts and the integration kit
- `ui/` contains the bounded operator workbench
- `control/` contains machine-readable control-plane artifacts used by live code
- `examples/` contains example consumer flows
- `docs/` contains operational and boundary documentation

Important distinction:

- numbered lane folders such as `discovery/01-intake/` or
  `runtime/03-proof/` are artifact destinations in a directive root
- executable code lives under `engine/`, `*/lib/`, `runtime/core/`,
  `runtime/capabilities/`, `hosts/`, `shared/lib/`, and `ui/`

## 3. System Model

At a high level the capability compounding loop works like this:

1. Hermes encounters a need, failure, or new source (paper, repo, tool, task failure)
2. the source enters through Discovery's front door
3. Discovery classifies the source into an operationalization decision
4. capability candidates are routed into Runtime for proof, verification, and projection
5. system-improvement ideas are routed into Architecture as measured experiments
6. verified capabilities are projected as Hermes-usable powers (MCP tools, skills, CLI wrappers, handoff prompts)
7. Hermes uses capabilities and reports outcomes; trust and reliability scores update
8. hosts, UI, and MCP expose Jarvis readiness views over the same kernel logic

The three lanes have fixed responsibilities:

- `Discovery` handles source classification, operationalization decisions, intake queueing, routing records, and capability-gap surfacing
- `Runtime` turns capability candidates into verified, projection-ready Hermes powers with proof, promotion, and registry acceptance
- `Architecture` handles bounded system-improvement experiments with measurable hypotheses and kill criteria; does not accept training-lab-only ideas

The kernel intentionally keeps human review explicit. It does not claim broad
autonomous orchestration across arbitrary projects.

## 4. Repository Layout

| Path | Role |
| --- | --- |
| `engine/` | Cross-lane kernel logic: routing, mission, orchestration, state, case store |
| `discovery/` | Discovery lane code plus the optional Python research engine |
| `runtime/` | Runtime lane contracts, lifecycle code, and shipped capabilities |
| `architecture/` | Architecture lane code |
| `shared/` | Contracts, schemas, templates, shared helpers |
| `hosts/` | Standalone host, web host, MCP host, integration kit |
| `ui/` | Static HTML/CSS/JS operator workbench served by the web host |
| `control/` | Live machine-readable policy/status artifacts used by engine and lane code |
| `state/` | Reserved top-level marker surface, not the primary live state substrate |
| `examples/` | Reference consumer flow and integration examples |
| `docs/` | Operator docs, lineage docs, boundary docs |
| `scripts/` | Build, validation, and local dev helpers |
| `tests/` | Unit, integration, property, and hardening coverage |
| `dist/` | Built JS/type output generated by `pnpm run build` |

Top-level entry files:

- `index.ts` is the package root export
- `package.json` defines the real public export surface
- `STANDALONE_SURFACE.json` records the intended shipped package surface
- `DIRECTIVE_GOAL.md` is the human-facing example goal file

## 5. Engine

### 5.1 Responsibility

`engine/` is the kernel's highest-leverage surface. It owns:

- source normalization and processing
- routing assessment
- mission context and mission evolution
- case records and snapshots
- orchestration and lifecycle pressure
- run storage and replay
- cross-lane current-state resolution

### 5.2 Public Engine Surface

Primary exports come from:

- `engine/index.ts`
- `engine/cases/index.ts`
- `engine/orchestration/index.ts`
- `engine/state/index.ts`
- `engine/mission/index.ts`
- `engine/routing/index.ts`
- `engine/planning/index.ts`

The main class is `DirectiveEngine` in `engine/directive-engine.ts`.
Important methods include:

- `processMinimalSource(...)`
- `processSource(...)`
- `updatePlanProgress(...)`
- `reRouteWithAnswers(...)`
- `previewMissionChange(...)`
- `getRun(...)`
- `listRuns(...)`

### 5.3 Engine Internal Clusters

| Path | Responsibility |
| --- | --- |
| `engine/cases/` | Case store, events, projections, snapshots |
| `engine/orchestration/` | Lifecycle coordination, autonomous-loop policy, completion slices, replay, operator inbox |
| `engine/state/` | Cross-lane state resolution and "current head" reads |
| `engine/mission/` | Mission defaults, health, feedback, evolution, gap formalization |
| `engine/routing/` | Lane scoring, routing assessment, earned autonomy, gap radar, correction memory |
| `engine/planning/` | Executable plan builders and progress model |

### 5.4 Engine Guard Rails

Important invariants are enforced here:

- `engine/approval-boundary.ts` guards mutable opens and stage correctness
- `engine/workspace-truth.ts` defines allowed seams and bounded scope
- `engine/decision-policy-ledger.ts` records operator review and routing corrections
- `engine/storage.ts` enforces schema-version behavior and persistence layout
- `engine/run-record-replay.ts` provides non-persistent replay instead of hidden rewrites

## 6. Discovery

### 6.1 Responsibility

Discovery is the source digestion front door. Every source enters here and receives an operationalization decision before downstream action.

It owns:

- source submission
- source operationalization classification
- intake queue materialization
- routing records
- explicit routing review
- handoff opening into downstream lanes
- capability-gap surfacing and worklist generation

### 6.2 Code Layout

| Path | Responsibility |
| --- | --- |
| `discovery/lib/front-door/` | canonical submission entry and front-door flow |
| `discovery/lib/intake/` | queue writing and intake lifecycle |
| `discovery/lib/routing/` | routing record writing, review resolution, route opening |
| `discovery/lib/records/` | supporting record writers |
| `discovery/lib/gaps/` | gap worklist generation and prioritization |
| `discovery/importers/` | importer bridges into Discovery |

### 6.3 Optional Research Engine

`discovery/research-engine/` is a separate Python workspace member. It is not
required for baseline kernel operation. It provides optional live-provider
research and can feed Discovery via importer code.

## 7. Runtime

### 7.1 Responsibility

Runtime is the verified assistant power lane. It turns capability candidates into verified, projection-ready Hermes powers with proof, promotion, and registry acceptance stages. Only verified capabilities with a valid Hermes projection are eligible for MCP tool projection and capability recall ranking.

### 7.2 Runtime Surface Split

This split matters and should stay clear:

- `runtime/core/` contains contracts and registry helpers
- `runtime/lib/` contains lifecycle orchestration and projections
- `runtime/capabilities/` contains shipped callable capability implementations
- `runtime/meta/` contains policy/profile metadata

### 7.3 Runtime Lifecycle

The shipped runtime lifecycle is expressed by code and artifact surfaces:

1. follow-up
2. record
3. proof
4. capability boundary
5. promotion readiness
6. promotion specification / seam decision
7. promotion record
8. registry acceptance

### 7.4 Runtime Code Groups

| Path | Responsibility |
| --- | --- |
| `runtime/lib/openers/` | transition openers between stages |
| `runtime/lib/runners/` | bounded execution helpers |
| `runtime/lib/operations/` | operator-facing lifecycle operations |
| `runtime/lib/projections/` | read-model views |
| `runtime/lib/writers/` | artifact writers |
| `runtime/lib/host/` | host selection and host integration helpers |
| `runtime/lib/control/` | automation eligibility and control helpers |
| `runtime/lib/sequences/` | grouped multi-step flows |

### 7.5 Capability Registry and Scaffolding

The runtime capability surface is now manifest-backed.

- capability metadata is read by `runtime/core/capability-registry.ts`
- shipped capabilities live under `runtime/capabilities/*`
- each capability may define `manifest.json`
- the standalone CLI can scaffold new capabilities with
  `runtime-capability-scaffold`
- web-host and manifest surfaces expose runtime capability metadata

## 8. Architecture

### 8.1 Responsibility

Architecture is the paper-to-experiment and system-improvement lane. It handles bounded experiments with measurable hypotheses and kill criteria. Every architecture experiment requires source reference, claim/hypothesis, expected benefit, measurement command, and rollback plan.

It does **not** accept training-lab-only ideas (model architecture/pretraining/tokenizer redesign) or speculative papers without local eval.

### 8.2 Lifecycle

The lane covers:

1. handoff start
2. bounded closeout
3. bounded continuation
4. adoption
5. implementation target
6. implementation result
7. retention
8. integration record
9. consumption record
10. post-consumption evaluation
11. possible reopen

### 8.3 Code Layout

| Path | Responsibility |
| --- | --- |
| `architecture/lib/experiments/` | starts, closeout, reopen, experiment feedback |
| `architecture/lib/adoption/` | adoption lifecycle and decisions |
| `architecture/lib/materialization/` | implementation, retention, integration, consumption |
| `architecture/lib/control/` | tail-stage maps, linkage, loop control |

One important architecture seam is
`architecture/lib/control/materialization-tail-stage-map.ts`. The web-host
uses it to derive deep-tail detail routes and avoid hard-coding every stage.

## 9. Shared Surface

### 9.1 Contracts

`shared/contracts/` contains behavioral contracts and boundary documents.
Important examples:

- `goal-input.md`
- `host-integration-boundary.md`
- `host-integration-acceptance.md`
- `runtime-to-host.md`
- `schema-versioning.md`
- `data-retention.md`
- `capability.md`
- `read-only-federation.md`

### 9.2 Schemas

`shared/schemas/` contains JSON Schemas for persisted artifacts and now also
for several API request/response shapes. The web host serves them through:

- `GET /api/schemas/:schemaName`

### 9.3 Templates

`shared/templates/` contains markdown and artifact templates used by writers.

### 9.4 Helpers

`shared/lib/` contains cross-lane helpers such as:

- file I/O
- goal parsing
- path normalization and path safety
- validation helpers
- SSRF guard and text sanitizer
- telemetry helpers

## 10. Hosts

### 10.1 Standalone Host

`hosts/standalone-host/` is the full filesystem reference host.

It provides:

- directive-root bootstrap
- full CLI mutation surface
- bounded local workflows
- server bootstrapping for local HTTP access

Key files:

- `cli.ts`
- `server.ts`
- `bootstrap.ts`
- `config.ts`
- `filesystem-host.ts`

### 10.2 Web Host

`hosts/web-host/` is the API and UI-serving host.

It provides:

- the API catalog in `api-manifest.ts`
- the concrete route handler in `api-routes.ts`
- static UI serving and missing-build behavior in `server.ts`
- snapshot, inbox, glossary, schema, explain, telemetry, replay, and federation reads
- bounded workflow mutation endpoints across Discovery, Runtime, Architecture, and mission/gap surfaces

The web host is intentionally thin. It should delegate to kernel code instead
of inventing host-local lifecycle models.

### 10.3 MCP Host

`hosts/mcp-host/` exposes the kernel as an MCP server.

It does not loop back through HTTP. It maps the same operation catalog to
tool executors that call the same underlying logic as the web-host routes.

Key files:

- `cli.ts`
- `server.ts`
- `tool-registry.ts`
- `executors/`

### 10.4 Integration Kit

`hosts/integration-kit/` is the embedding surface for another host.

It contains:

- `lib/` for executable integration helpers
- `starter/` for copy-facing starter templates
- `cli/` for acceptance and flow utilities
- `examples/` for first-host patterns

It should be the first stop for a consuming project that does not want to use
the reference hosts directly.

## 11. UI

The UI is a bounded operator workbench implemented as a static HTML/CSS/JS
surface under `ui/`, served directly by the web host.

Important properties:

- it is not a second backend
- it consumes the web-host API surface
- it exposes bounded mutations through the same routes documented in
  `docs/operator-cli.md`
- it keeps the dashboard architecture simple: no framework build step is
  required for the shipped readiness view

Key source files:

- `ui/index.html`
- `ui/source-descriptions.json`

## 12. API and External Surfaces

### 12.1 API Manifest

`hosts/web-host/api-manifest.ts` is the machine-readable operation catalog.
It is the best current source of truth for shipped HTTP operations.

It exposes:

- `operations`
- `capabilities`
- `schema_index`

and is served at:

- `GET /api/manifest`

### 12.2 Key Read Routes

Important read routes include:

- `GET /api/snapshot`
- `GET /api/operator-decision-inbox`
- `GET /api/runtime/status`
- `GET /api/runtime/capabilities`
- `GET /api/explain`
- `GET /api/glossary`
- `GET /api/schemas/:schemaName`
- `GET /api/telemetry/snapshot`
- `GET /api/federation/snapshot`

### 12.3 Key Mutation Routes

Important mutation families include:

- Discovery submission and review
- engine reroute and plan progress
- engine replay
- mission preview/approve/reject/revert
- gap approve/reject
- Runtime stage openers and decisions
- Architecture stage transitions

### 12.4 Package Exports

The public package surface is defined in `package.json` exports. Important
exports include:

- `@directive/kernel`
- `@directive/kernel/engine`
- `@directive/kernel/discovery`
- `@directive/kernel/runtime`
- `@directive/kernel/architecture`
- `@directive/kernel/standalone-host`
- `@directive/kernel/integration-kit`
- `@directive/kernel/ui`
- `@directive/kernel/mcp-host`
- selected sub-exports for engine, runtime, architecture, and host surfaces

The source path uses the `development` export condition; built consumers use
the `import` / `default` dist outputs.

## 13. Persistence and Directive Root

The directive root is the on-disk workspace the kernel reads and writes.

It contains:

- lane artifact folders
- engine state and run records
- mission and gap records
- control-plane machine-readable files
- optional federation config

Important persistence points:

- `engine/storage.ts`
- `shared/lib/file-io.ts`
- numbered lane artifact folders
- `control/state/*.json`

Top-level `control/` is live and should not be mistaken for dead scaffolding.
Several engine, runtime, and architecture components read it.

Top-level `state/` is a reserved marker surface and is much less active than
`control/`.

## 14. Build and Execution Model

The repository now supports two execution paths.

### 14.1 Source Path

Used during development:

- `pnpm run dev`
- `pnpm run ui:dev`
- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run try`
- `pnpm run mcp:serve -- --directive-root <path>`

This path uses `tsx` and Vitest against source.

### 14.2 Built Path

Used for stable production-style runs:

- `pnpm run build`
- `pnpm run start`
- `pnpm run ui:start`
- `pnpm run web:serve`
- `pnpm run standalone:cli`

The build emits JS, type declarations, source maps, and runtime example JSON
into `dist/`.

Important build files:

- `tsconfig.build.json`
- `scripts/copy-runtime-assets.mjs`
- `scripts/run-with-check-build.mjs`

## 15. Testing and Validation

The repo has real automated coverage. It is not a doc-only or manual-only
system.

Primary test layers:

- unit tests under `tests/unit/`
- integration tests under `tests/integration/`
- property tests under `tests/property/`
- hardening coverage under `tests/integration/hardening/`

Primary validation commands:

- `pnpm run test`
- `pnpm run typecheck`
- `pnpm run check:build`
- `pnpm run check:naming`
- `pnpm run check:contracts`
- `pnpm run check:examples`
- `pnpm run check:first-integration`
- `pnpm run check:hardening`

### 15.1 Jarvis migration verification

The branch now ships a read-only migration audit for the Jarvis capability
kernel pivot:

```powershell
npx tsx scripts/migrate-jarvis-capability-kernel.ts
npx tsx scripts/migrate-jarvis-capability-kernel.ts --dry-run
npx tsx scripts/capability-health.ts
```

Rules:

- the migration script is dry-run safe by default
- it does not delete registry entries
- historical registry acceptance does not imply a projection-ready Hermes power
- verified-but-missing-projection entries remain blocked until projection
  metadata is complete
- this slice does not enable `--apply`; any future apply mode must require
  explicit backups and an explicit operator decision

Rollback guidance:

- dry-run migration writes nothing, so rollback is a no-op
- committed slice rollback should use git revert
- if a future apply mode is added, stop the web host first and restore from
  the migration backup set before reopening the directive root

Final refactor verification commands:

```powershell
pnpm run test
npx tsx scripts/migrate-jarvis-capability-kernel.ts --dry-run
npx tsx scripts/capability-health.ts
python -m graphify . --update
python -m graphify cluster-only .
```

## 16. Goal, Mission, and Review Model

The host must provide goal context. The kernel does not own the goal source of
truth.

Inputs:

- `DIRECTIVE_GOAL.md`
- per-request goal payloads
- host-resolved goal envelopes

Mission and review surfaces now include:

- mission health and mission feedback
- mission evolution history
- gap formalization and discovery worklist refresh
- operator decision inbox
- replay for audit/debug without silent writes

The kernel remains review-first where explicit approval is required.

## 17. Shipped Advanced Surfaces

These are important because they change what the system can now prove about
itself.

### 17.1 Telemetry

The web host maintains bounded in-memory telemetry and exposes it via:

- `GET /api/telemetry/snapshot`

The UI consumes this surface for observability.

### 17.2 Explain

The web host can build a derived explanation for one engine run via:

- `GET /api/explain`

### 17.3 Replay

Replay is non-persistent by default:

- CLI: `engine-replay`
- API: `POST /api/engine-runs/:runId/replay`

This returns exact-vs-approximate replay information without writing new run
records unless a normal mutation flow is invoked later.

### 17.4 Federation

Federation is intentionally read-only:

- config: `kernel-federation.config.json`
- route: `GET /api/federation/snapshot`

It aggregates visibility across roots without remote writes or merged workflow
state.

### 17.5 Reference Consumer

`examples/reference-consumer/` is the concrete minimal consumer example. It
shows how a real host should:

- resolve a goal
- submit a source
- read back state
- avoid reimplementing kernel lifecycle logic

## 18. Current Operational Rules

These are the most important rules for anyone modifying the repo:

1. Do not write directly into numbered artifact folders by hand.
2. Do not bypass `engine/approval-boundary.ts` for mutable opens.
3. Do not treat `control/` as dead weight; live code depends on it.
4. Do not invent host-local workflow models in the hosts or UI.
5. Do not confuse `runtime/core/`, `runtime/lib/`, and `runtime/capabilities/`.
6. Use `api-manifest.ts` and `package.json` exports as current-state truth for
   external surfaces.

## 19. Recommended Reading Order

For a reviewer or another coding agent, this is the fastest accurate path:

1. `README.md`
2. `AGENTS.md`
3. `AUDIENCE.md`
4. `package.json`
5. `hosts/web-host/api-manifest.ts`
6. `engine/directive-engine.ts`
7. `engine/workspace-truth.ts`
8. `hosts/integration-kit/README.md`
9. `docs/operator-cli.md`
10. `shared/contracts/`

## 20. Quick Commands

```powershell
pnpm install
pnpm run build
pnpm run start
pnpm run ui:dev
pnpm run test
pnpm run typecheck
pnpm run standalone:cli init --output-root ./local/standalone --received-at 2026-06-10
pnpm run mcp:serve -- --directive-root <path>
```

For a full local bootstrap, read:

- `README.md`
- `hosts/integration-kit/FIRST_INTEGRATION.md`
- `examples/reference-consumer/README.md`
