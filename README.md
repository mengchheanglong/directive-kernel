# Directive Kernel

Directive Kernel is a reusable system you can add to another project.

Use it when you want your project to:
- bring outside sources into your own workflow
- decide which sources are worth keeping
- route useful work into the right next step
- turn useful results into something reusable
- see the current state in a simple host or UI

## What This Repo Is For

Use Directive Kernel when you want your project to take in outside sources, judge them against your current goal, and move them through a clear workflow instead of handling everything by hand.

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
- `discovery/` - source intake and routing
- `runtime/` - reusable capability work
- `architecture/` - system-improvement work
- `shared/` - shared helpers and contracts
- `hosts/` - ways to run or embed the system
- `ui/` - a simple read-only operator view

## Goal Ownership

The host project must provide goal context explicitly.

The easiest way is a root-level goal file:
- [DIRECTIVE_GOAL.md](/C:/Users/User/projects/directive-kernel/DIRECTIVE_GOAL.md)

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
- [shared/contracts/directive-kernel-goal-input.md](/C:/Users/User/projects/directive-kernel/shared/contracts/directive-kernel-goal-input.md)

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
npm install
npm run ui:install
```

If you want live web/provider research, also configure the optional provider keys described in:
- [discovery/research-engine/README.md](/C:/Users/User/projects/directive-kernel/discovery/research-engine/README.md)

## Fastest Bootstrap

### Standalone host

Create a local working folder:

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

Build the UI and run the web host:

```powershell
npm run start
```

Or for dev:

```powershell
npm run dev
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
- [hosts/integration-kit/README.md](/C:/Users/User/projects/directive-kernel/hosts/integration-kit/README.md)

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
