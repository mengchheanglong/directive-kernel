# Directive Kernel

Directive Kernel is a reusable system you can add to another project.

Use it when you want your project to:
- bring outside sources into your own workflow
- decide which sources are worth keeping
- route useful work into the right next step
- turn useful results into something reusable
- see the current state in a simple host or UI

## Try It

```powershell
pnpm install
pnpm try
```

That runs the kernel end-to-end against a sample source in a fresh temp directive root and prints the routing decision and artifact path. No config files, no JSON to write.

<!-- TODO: replace this block with a recorded terminal cast (Fix_Plan.md F3 follow-up). -->

## For AI agents

If you are an AI coding agent, start with [`AGENTS.md`](./AGENTS.md).

## What This Repo Is For

Directive Kernel is for **dev teams running source-driven workflows that need a structured intake → routing → decision pipeline.**

You have a stream of inbound items — bug reports, incident alerts, source repos to evaluate, feature requests, security advisories, customer feedback, papers worth tracking — and each needs the same kind of decision: *what do we do with this?* The kernel takes that source, judges it against your current mission, routes it to the right next step, and records the decision so later work has provenance.

Your team gets a **mission-conditioned routing pass,** a **structured intake queue + lifecycle,** a **decision-policy ledger** for audit and replay, and a **bounded operator workbench** for visibility and explicit workflow mutations.

Two flagship example consumers ship with the kernel:
- **[Bug-report triage](hosts/integration-kit/examples/bug-report-triage/README.md)** — GitHub issue → routing decision (`fix-now`, `backlog`, `wontfix`, `duplicate`)
- **[Incident triage](hosts/integration-kit/examples/incident-triage/README.md)** — alert webhook → routing decision (`page-on-call`, `monitor-only`, `auto-resolve`, `noise`)

See [`AUDIENCE.md`](./AUDIENCE.md) for the full rationale behind this framing and the conditions under which we'd revisit it.

## How It Works

1. your project gives Kernel the current goal
2. sources enter through Discovery
3. Discovery decides whether to hold, review, or route the source
4. Runtime turns useful routed work into reusable capability
5. Architecture handles system-improvement work
6. the host and UI show the current state and artifact detail

The three main lanes are:
- `Discovery` for intake and routing
- `Runtime` for reusable capability work
- `Architecture` for system improvement work

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

**Source path (no build required).** These commands run directly against TypeScript source through `tsx` and Vite/Vitest. Use them while you are working in the repo. Do not run `pnpm run build` first.

- `pnpm dev` — Vite dev server plus the UI host, all from source
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
