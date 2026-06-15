# Directive Kernel

Directive Kernel is a harness-portable capability truth layer for agents. Hermes skills remain the user-facing workflow/interface; DK sits underneath selected high-value skills when proof, contracts, recall, reliability, and portability matter.

Use it when you need to:
- prove a capability works before exposing it as an agent power
- record contracts, schemas, failure modes, and execution evidence
- project verified capabilities into Hermes/OpenClaw-compatible harnesses
- let agents recall trusted capabilities instead of guessing from prose
- feed outcomes back into reliability and trust

Do **not** use DK as a replacement for Hermes skills. Use a plain Hermes skill when a workflow, prompt, or procedure is enough. Use DK only when stronger capability truth is worth the extra ceremony.

## Try It

```powershell
pnpm install
pnpm try
```

That runs the kernel end-to-end against a sample source in a fresh temp directive root and prints the routing decision and artifact path. No config files, no JSON to write.

## For AI agents

If you are an AI coding agent, start with [`AGENTS.md`](./AGENTS.md).

## Federation

To aggregate multiple kernels without introducing shared mutation, create
`kernel-federation.config.json` at the current directive root and read:

- `GET /api/federation/snapshot`

The first version is read-only. It aggregates remote `/api/snapshot`,
`/api/operator-decision-inbox`, and `/api/runtime/status` responses per root.
All writes remain scoped to each root's own host.

## What This Repo Is For (current branch)

Directive Kernel is **the capability truth/projection layer underneath selected Hermes/OpenClaw skills**. Its purpose is not to replace skills or maximize registry count; its purpose is to make selected agent capabilities more trustworthy than plain instructions.

```text
selected need/source
→ evaluate fit
→ verify capability with evidence
→ record contract/projection metadata
→ expose through a skill or harness
→ report outcomes into reliability/trust
```

Registry growth is not success. **Verified usefulness is success.** Ten verified working powers beat one hundred placeholder capabilities.

The kernel provides:
- a **verified-only capability ledger** — only capabilities with real execution evidence and usable projection metadata surface as powers
- a **capability recall and trust loop** — Hermes/OpenClaw can ask for relevant verified capabilities, use them, and report outcomes that feed reliability scores
- a **projection layer** — verified capabilities can be exposed through MCP tools, host APIs, or Hermes skills
- a **bounded source-evaluation surface** — Discovery helps decide whether a selected source should become a Runtime capability, an active-memory experiment, a skill smoke, note-only memory, or a reject
- a **minimal active-memory support pattern** — Architecture is retained only for active execution state, transition ledgers, checkpoints, and closeout discipline

### DK and Hermes Skills

Hermes skills are the user-facing workflow layer. DK is only used underneath selected skills when the capability needs stronger proof, contracts, recall, reliability, or portability.

Use a plain skill when a procedure is enough. Use a DK-backed skill when the agent must know that the capability is real, verified, and safe enough to expose.

### Historical lineage (secondary)

The `general-workflow-kernel` positioning — dev teams running source-driven workflows with bug-report triage, incident triage, and feature-request triage — is historical public packaging. It is **not the current local north star** for this branch. Two flagship example consumers remain as secondary lineage:
- **[Bug-report triage](hosts/integration-kit/examples/bug-report-triage/README.md)** — GitHub issue → routing decision (`fix-now`, `backlog`, `wontfix`, `duplicate`)
- **[Incident triage](hosts/integration-kit/examples/incident-triage/README.md)** — alert webhook → routing decision (`page-on-call`, `monitor-only`, `auto-resolve`, `noise`)

See [`AUDIENCE.md`](./AUDIENCE.md) for the current capability-truth audience and historical lineage.

> **Warning:** Claimed/placeholder entries must never be projected as Hermes-usable tools.

## How It Works

1. Hermes/OpenClaw has a selected capability need, source, paper, repo, or task failure
2. Discovery evaluates whether it is worth operationalizing, testing as active-memory support, keeping as note-only, or rejecting
3. Runtime turns approved capability candidates into verified, projection-ready powers with proof, contracts, schemas, and failure modes
4. Hermes skills or harnesses expose the verified capability as the user-facing workflow
5. Outcomes are reported back into reliability/trust

The three surviving surfaces are:
- `Runtime` for capability ledger / projection truth
- `Discovery` for research-engine / source evaluation support
- `Architecture` for active memory / state patterns only

## Main Parts

- `engine/` - shared logic that ties the lanes together
  - `engine/orchestration/` — coordination, execution, and lifecycle logic merged into one orchestration surface
  - `engine/cases/` — tracked case records per submission
  - `engine/mission/` — goal and gap management
  - `engine/planning/` — plan construction and consumption
  - `engine/routing/` — lane scoring, assessment, and routing decisions
  - `engine/state/` — workspace state resolution
- `runtime/` - capability ledger, verification, projection, recall, and outcome trust
- `discovery/` - selected source evaluation and research-engine support
- `architecture/` - active memory / state-pattern support only
- `shared/` - contracts, schemas, and helpers for capability truth
- `hosts/` - thin MCP/API/web shells for exposing verified capabilities
- `ui/` - optional operator debug/read-model surface

Executable code lives in the `lib/`, `engine/`, `hosts/`, and `ui/src/` surfaces. The numbered lane folders under `discovery/`, `runtime/`, and `architecture/` are artifact/state surfaces, not normal module trees.

## Goal Ownership

The host project must provide goal context explicitly.

The easiest way is a root-level goal file:
- [DIRECTIVE_GOAL.md](./DIRECTIVE_GOAL.md)

Keep that file at the consuming project's root or at the directive root you pass into Kernel.

Common ways to provide goals:

1. Root goal file + resolver
   - keep `DIRECTIVE_GOAL.md` at the project root
   - let your host read it and turn it into one goal object
2. Per-request goal input
   - each submission includes the current goal
3. Project goal resolver
   - your host maps current product state or operator intent into one goal object
4. Review-first fallback
   - if your project has no goal model yet, keep Discovery review-first until an operator sets direction

Goal contract:
- [shared/contracts/goal-input.md](./shared/contracts/goal-input.md)

Shared helper:
- `@directive/kernel/shared/directive-goal`

If your project does not already have a goal system, start with one simple goal object like this:

```json
{
  "goalId": "project-current-goal",
  "goalStatement": "Improve the host project's active product direction.",
  "whyNow": "Current operator request or active delivery pressure.",
  "adoptionTarget": "runtime",
  "constraints": [
    "stay bounded",
    "keep review explicit"
  ],
  "successSignal": "One reusable capability or one engine improvement is materially clearer than before."
}
```

Pass that goal into Discovery before the source enters the front door.

## Install

From the repo root:

```powershell
pnpm install
```

If you want live web/provider research, also configure the optional provider keys described in:
- [discovery/research-engine/README.md](./discovery/research-engine/README.md) (used primarily by the research-curation domain — see [`docs/lineage/research-curation.md`](./docs/lineage/research-curation.md))

Before embedding the kernel in another host, review the security boundary:
- [SECURITY.md](./SECURITY.md)

## Build and Run

The kernel has two execution paths.

**Source path (no build required).** These commands run directly against TypeScript source through `tsx` and Vitest. Use them while you are working in the repo. Do not run `pnpm run build` first.

- `pnpm dev` — source-mode web host and static UI helper, all from source
- `pnpm ui:dev` — alias of `pnpm dev`
- `pnpm typecheck` — type-check only, no emit
- `pnpm test` — Vitest run against source
- `pnpm try` — end-to-end smoke against a sample source

**Compiled path (requires `pnpm run build`).** These commands run from `/dist/` on stable Node, with no experimental flags. They expect `pnpm run build` to have produced `/dist/` first, except `pnpm start` which runs the build for you.

- `pnpm run build` — produces `/dist/` (compiled JS, type definitions, source maps, and the example JSON files the kernel resolves at runtime)
- `pnpm start` — builds and runs the UI host stack
- `pnpm ui:start` — runs the UI host stack from `/dist/`
- `pnpm web:serve` — runs the web host CLI from `/dist/`
- `pnpm standalone:cli` — runs the standalone host CLI from `/dist/`

`/dist/` is git-ignored and is regenerated by `pnpm run build`. CI runs the build before typecheck and test.

## Fastest Bootstrap

### Standalone host

After `pnpm run build`, create a local working folder:

```powershell
node ./dist/hosts/standalone-host/cli.js init --output-root ./local/standalone
```

This gives you:
- a local directive root
- a standalone host config
- example Discovery and Runtime payloads

Then run:

```powershell
node ./dist/hosts/standalone-host/cli.js serve --config ./local/standalone/standalone-host.config.json
```

### Web host

Build the UI and run the web host:

```powershell
pnpm run start
```

Or for dev:

```powershell
pnpm run dev
```

## MCP Server

The kernel exposes an MCP (Model Context Protocol) server at `hosts/mcp-host/`
that mirrors every API operation as an MCP tool. Any MCP-compatible client
(Claude Desktop, Cursor, Continue, etc.) can drive the kernel through it.

### Usage

```powershell
pnpm run mcp:serve -- --directive-root <path>
```

### Example Claude Desktop config

```json
{
  "mcpServers": {
    "directive-kernel": {
      "command": "node",
      "args": ["--import", "tsx", "hosts/mcp-host/cli.ts", "--directive-root", "/path/to/directive-root"]
    }
  }
}
```

## Clone-And-Wire Into Another Project

Recommended setup:

1. clone `directive-kernel` into your project as a sibling repo, submodule, or vendored package
2. add `DIRECTIVE_GOAL.md` at the consuming project root or directive root
3. keep the goal resolver in your host project
4. submit sources through the canonical Discovery front door
5. keep host adapters thin
6. keep project-specific records, logs, and sources in the consuming project

Start here for embedding:
- [hosts/integration-kit/README.md](./hosts/integration-kit/README.md)

## Runtime Capability Scaffolding

To add a new manifest-backed Runtime capability folder:

```powershell
pnpm run standalone:cli runtime-capability-scaffold --name "Example Capability"
```

This writes `manifest.json`, `index.ts`, and `executor.ts` under
`runtime/capabilities/<capability-id>/`. The registry and
`GET /api/runtime/capabilities` then read the same manifest-backed metadata.

## Jarvis Migration Audit

Use the migration audit before changing any live directive root semantics:

```powershell
npx tsx scripts/migrate-jarvis-capability-kernel.ts
npx tsx scripts/migrate-jarvis-capability-kernel.ts --dry-run
npx tsx scripts/capability-health.ts
```

Important rules:

- The migration script is dry-run safe by default. Running it with no flags does not rewrite or delete registry entries.
- This branch intentionally does not apply registry rewrites from the migration script yet. Do not treat historical registry acceptance as proof of a usable Hermes power.
- `verified projection-ready` means verified execution plus complete contract plus complete Hermes projection metadata.
- `verified but missing projection` is still blocked. It is not a usable power until projection metadata is complete.
- `candidate`, `claimed`, and `placeholder` entries stay non-usable.

Rollback guidance:

- Dry-run mode writes nothing, so rollback is a no-op.
- For committed slice rollback, use normal git revert on the slice commit.
- If a future applied migration is introduced, require explicit backups before writes and stop the web host first to avoid directive-root locks.

Final verification commands for this refactor branch:

```powershell
pnpm run test
npx tsx scripts/migrate-jarvis-capability-kernel.ts --dry-run
npx tsx scripts/capability-health.ts
python -m graphify . --update
python -m graphify cluster-only .
```

## Replay Engine Runs

To replay one engine run non-persistently with optional mission or answer
overrides:

```powershell
pnpm run standalone:cli engine-replay --directive-root <path> --run-id <id>
```

The replay surface reports whether the result is exact or approximate and
never writes new run records unless you explicitly use a normal workflow
mutation afterward.

## Ownership

The consuming project owns:
- current goals
- operator identity
- external app context
- project-local storage choices
- project-local approval policy

The kernel owns:
- the workflow model
- the lane logic
- the shared contracts and schemas
- the starter hosts
- the reusable Runtime and Architecture code
