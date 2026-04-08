# Standalone Host Expansion Direction

Last updated: 2026-03-23

## Direction Correction

This note is now subordinate to the engine-first product direction.

The next main product goal is not broader standalone-host breadth by itself.
The next main product goal is:
- materialize the canonical Directive Workspace engine that hosts can embed

Standalone-host work should continue only when it directly helps prove:
- the engine adapter boundary
- local/shareable host consumption of the engine
- product-owned storage or proof surfaces that belong beneath the engine

## Current Boundary

The standalone host is already valid for shareable GitHub/local usage.
It is still not broad-host complete, but it now covers Discovery plus one bounded Runtime lane instead of Discovery alone.

Today it can:
- bootstrap a local Directive root
- accept Discovery submissions
- read Discovery overview
- write bounded Runtime follow-up artifacts
- write bounded Runtime record artifacts
- generate bounded Runtime proof bundles
- write bounded Runtime transformation proof artifacts
- write bounded Runtime transformation records
- write proof-backed bounded Runtime promotion and registry artifacts
- read Runtime overview
- expose health/runtime status
- persist runtime artifacts
- use optional SQLite persistence
- use optional bearer auth

## What "Expand Beyond Discovery" Means

This does not mean cloud deployment work.
It means broadening the standalone host so outside users can use more of Directive Workspace without depending on a separate broad host shell.

The next kinds of value to add are:
- Runtime-side local workflow support
- Architecture-side local workflow support
- broader standalone APIs beyond Discovery intake/overview
- local operator commands that span multiple Directive tracks

## Chosen Direction

The next preferred direction is:

**expand the standalone host through Runtime-side local workflow support**

Reason:
- Discovery-only standalone usage is structurally correct but still shallow
- Runtime is the next product lane that turns the standalone host from intake-only into useful runtime/workflow usage
- Runtime-side local workflow support improves standalone usefulness without requiring broad host parity

## First Practical Slice

The first completed step toward outside-user standalone adoption is:
- standalone bootstrap/init support so users can scaffold a usable local Directive root, config, and starter Discovery submission in one step

The next implementation target after bootstrap was:
- one bounded Runtime-side local workflow path that can run through the standalone host without another host layer

That target is now completed in bounded form:
- standalone host CLI commands for Runtime follow-up, record, proof, transformation proof, transformation record, promotion, and registry writes plus Runtime overview
- standalone host API endpoints for Runtime follow-up, record, proof, transformation proof, transformation record, promotion, and registry writes plus Runtime overview
- standalone bootstrap examples for the bounded local/shareable Runtime artifact lifecycle

The next likely useful standalone-host work after this is:
- only the work that helps validate the engine adapter boundary once the engine kernel is being materialized

## Non-goal

This direction is not about claiming broad host replacement or broad host parity.
It is about making Directive Workspace more usable as a standalone local/shareable product without confusing that with completion of the core engine.
