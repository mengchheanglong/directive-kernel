# Directive Kernel

Directive Kernel is Hermes's capability kernel. It is the digestive and verification system that turns selected sources, repos, papers, workflows, and task failures into verified Hermes-usable capabilities or honestly-classified notes.

Use it when you want your project to:
- classify inbound sources into operationalization decisions
- prove capabilities work before exposing them as powers
- route system-improvement ideas into measured experiments
- turn verified results into Hermes-usable projections
- learn from outcomes to improve trust and recall

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

Directive Kernel is **Hermes's capability acquisition, verification, and self-improvement kernel.** Its purpose is compounding assistant capability over time:

```text
Every accepted source must become exactly one of:
1. verified Hermes capability (callable power with evidence),
2. measured Architecture experiment (system improvement with kill criteria),
3. Obsidian/note-only memory (useful but not a callable power),
4. rejected/skipped item with rationale.
```

Registry growth is not success. **Hermes getting new reliable powers is success.**

The kernel provides:
- a **source operationalization classifier** — every source receives a decision (capability candidate, architecture experiment, note-only, training-lab-only, fine-tune later, or reject) before pipeline advancement
- a **verified-only capability registry** — only capabilities with real execution evidence and a usable Hermes projection (MCP tool, skill, CLI wrapper, handoff prompt) surface as powers
- a **capability recall and trust loop** — Hermes can ask for relevant capabilities, use them, and report outcomes that feed back into reliability scores
- a **decision-policy ledger** — every routing and outcome decision is recorded with provenance
- a **bounded operator dashboard** — Jarvis readiness surfaced as verified powers, candidates, gaps, and recent failures

### Historical lineage (secondary)

The `general-workflow-kernel` positioning — dev teams running source-driven workflows with bug-report triage, incident triage, and feature-request triage — is the kernel's historical public packaging. It is **not the current local north star** for this branch. Two flagship example consumers ship with the kernel as secondary lineage:
- **[Bug-report triage](hosts/integration-kit/examples/bug-report-triage/README.md)** — GitHub issue → routing decision (`fix-now`, `backlog`, `wontfix`, `duplicate`)
- **[Incident triage](hosts/integration-kit/examples/incident-triage/README.md)** — alert webhook → routing decision (`page-on-call`, `monitor-only`, `auto-resolve`, `noise`)

See [`AUDIENCE.md`](./AUDIENCE.md) for the full rationale behind the Jarvis capability kernel pivot.

> **Warning:** Registry count is not a success metric. Ten verified working powers beat one hundred placeholder capabilities. Claimed/placeholder entries must never be projected as Hermes-usable tools.

## How It Works

1. Hermes encounters a need, failure, or new source (paper, repo, tool, task failure)
2. Sources enter through Discovery's front door
3. Discovery classifies the source into an operationalization decision: capability candidate, architecture experiment, note-only, training-lab-only, fine-tune later, or reject
4. Capability candidates enter Runtime for proof, verification, and projection into Hermes-usable powers
5. Architecture experiments test system-improvement hypotheses with kill criteria
6. The host and UI show Jarvis readiness: verified powers, candidates, gaps, recent failures, and trust state

The three main lanes are:
- `Discovery` for source classification and operationalization decisions
- `Runtime` for verified capability production and projection
- `Architecture` for system-improvement experiments

## Main Parts

- `engine/` - shared logic that ties the lanes together
  - `engine/orchestration/` — coordination, execution, and lifecycle logic merged into one orchestration surface
  - `engine/cases/` — tracked case records per submission
  - `engine/mission/` — goal and gap management
  - `engine/planning/` — plan construction and consumption
  - `engine/routing/` — lane scoring, assessment, and routing decisions
  - `engine/state/` — workspace state resolution
- `discovery/` - source intake and routing
- `runtime/` - reusable capability work
- `architecture/` - system-improvement work
- `shared/` - shared helpers and contracts
- `hosts/` - ways to run or embed the system
- `ui/` - a bounded operator workbench over the kernel mutation surface

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
