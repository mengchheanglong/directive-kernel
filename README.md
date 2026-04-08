# Directive Kernel

Directive Kernel is a reusable source-adaptation system core for clone-and-wire use inside other projects.

It keeps the operating code, contracts, hosts, and frontend needed to:
- ingest sources through Discovery
- operationalize reusable runtime capability through Runtime
- evaluate self-improvement through Architecture
- host the system through a standalone filesystem host or thin web host

It intentionally ships the system surfaces only:
- no historical lane corpora
- no archived promotion history
- no experiment backlog
- no control logs or reports
- no source dumps

## What This Repo Is For

Use Directive Kernel when you want to clone a reusable source-adaptation system into another project and wire it to that project's own goals, operators, and storage.

## Included Surfaces

- `engine/` - shared adaptation core and state resolver
- `discovery/lib/` - Discovery front door, routing, queue, and import surfaces
- `discovery/research-engine/` - bounded Python research pipeline
- `runtime/lib/`, `runtime/core/`, `runtime/capabilities/`, `runtime/meta/` - Runtime operating code and capability contracts
- `architecture/lib/` - Architecture operating code
- `shared/` - shared libs, contracts, schemas, and templates
- `hosts/standalone-host/` - reference filesystem host
- `hosts/web-host/` + `frontend/` - thin web/API host and frontend
- `hosts/integration-kit/` - starter surfaces for embedding the kernel into another project

## Goal Ownership

Directive Kernel does not infer the consuming project's active goal from historical project records.

The host project must provide goal context explicitly.

The preferred human-facing source of truth is a root-level goal file:
- [DIRECTIVE_GOAL.md](/C:/Users/User/projects/directive-kernel/DIRECTIVE_GOAL.md)

Keep a file with that shape at the consuming project's root or at the directive root you pass into the kernel.

Use one of these models:

1. Root goal file + resolver
   - keep `DIRECTIVE_GOAL.md` at the project root
   - let your host read it and normalize it into one active goal envelope
2. Per-request goal input
   - every submission includes the current mission or operator goal
3. Project goal resolver
   - your host project maps current product state, operator intent, or user request into one active goal envelope
4. Review-first fallback
   - if your project has no goal model yet, keep Discovery submissions queue-only or review-first until an operator sets direction

Read the canonical goal contract:
- [shared/contracts/directive-kernel-goal-input.md](/C:/Users/User/projects/directive-kernel/shared/contracts/directive-kernel-goal-input.md)

Use the shared helper when your host wants a kernel-owned reader:
- `@directive/kernel/shared/directive-goal`

If your project does not already have a goal system, start with this minimum envelope:

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

Route that envelope into Discovery submissions through `mission_alignment`, host-local metadata, or a thin adapter that enriches the canonical request before it enters the Discovery front door.

If `DIRECTIVE_GOAL.md` does not exist, fall back to per-request goal input and keep Discovery review-first or queue-only until the host has a stable goal resolver.

## Install

From the repo root:

```powershell
npm install
npm run frontend:install
```

For Research Engine live-provider use, also configure the optional provider keys described in:
- [discovery/research-engine/README.md](/C:/Users/User/projects/directive-kernel/discovery/research-engine/README.md)

Without those keys, the system still works in bounded/local modes, but live acquisition quality drops.

## Fastest Bootstrap

### Standalone host

Create a local working root:

```powershell
node --experimental-strip-types ./hosts/standalone-host/cli.ts init --output-root ./local/standalone
```

This gives you:
- a local directive root
- a standalone host config
- example Discovery and Runtime payloads

Then run:

```powershell
node --experimental-strip-types ./hosts/standalone-host/cli.ts serve --config ./local/standalone/standalone-host.config.json
```

### Web host

Build the frontend and run the thin web host against the repo root:

```powershell
npm run start
```

Or for dev:

```powershell
npm run dev
```

## Clone-And-Wire Into Another Project

Recommended pattern:

1. clone `directive-kernel` into your project as a sibling repo, submodule, or vendored package
2. add `DIRECTIVE_GOAL.md` at the consuming project root or directive root
3. keep your host project's goal resolver outside the kernel
4. submit sources through the canonical Discovery front door
5. keep host adapters thin
6. store project-specific records, logs, and sources in the consuming project, not in the kernel repo

The integration starting point is:
- [hosts/integration-kit/README.md](/C:/Users/User/projects/directive-kernel/hosts/integration-kit/README.md)

## Operating Rule

Directive Kernel keeps this core hierarchy:
- product core
- Engine as the shared adaptation core
- Discovery / Runtime / Architecture as Engine lanes

It does not carry historical authority surfaces from any prior project.

The consuming project owns:
- current goals
- operator identity
- external app context
- project-local storage choices
- project-local approval policy

The kernel owns:
- lane vocabulary
- bounded workflow machinery
- canonical contracts and schemas
- host starter surfaces
- reusable Runtime and Architecture operating code
