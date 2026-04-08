# Host Integration Boundary

Directive Workspace is a **standalone product**, not a Mission Control feature set.

It must remain:
- host-agnostic
- host-integrable
- product-owned

Repo-native hosts and external runtimes are integration surfaces.
They are not the definition of Directive Workspace.

## Product Ownership

Directive Workspace owns the canonical definition of:
- Discovery
- Runtime
- Architecture
- doctrine
- contracts
- schemas
- templates
- shared operating libraries
- routing logic
- evaluator structures
- source-adaptation logic

These product assets must live in `workspace/directive-workspace/`.

## Host Ownership

A host may own:
- runtime services
- runtime databases
- API surfaces
- operator UI
- runtime verification gates
- thin adapter layers around canonical Directive Workspace assets

These host assets are integration surfaces, not product doctrine.

## Adapter Rule

Host integration should follow this order:

**Directive Workspace canonical asset first -> host adapter second**

Preferred pattern:
1. define or update the canonical Directive Workspace contract, schema, template, or engine code
2. mirror or consume it in the host only when needed for runtime/build reliability
3. keep the host layer thin and replaceable

Avoid the reverse pattern where host behavior becomes the canonical definition and Directive Workspace merely documents it afterward.

## Non-Negotiable Boundary

Hosts must not become the place where Directive Workspace is redefined.

In particular, hosts must not become the canonical owner of:
- track identity
- track routing rules
- core doctrine
- product decision model
- source-adaptation lifecycle
- shared product contracts

## Current Host State

- `hosts/standalone-host/` is the filesystem reference host.
- `hosts/web-host/` is the product-owned frontend/API host.
- `hosts/integration-kit/` is the starter surface for external hosts.
- Future hosts should be able to integrate Directive Workspace through the same product-owned contracts and shared operating assets.

## Practical Rule For New Work

When adding a new host-facing capability:
- first ask whether a new canonical Directive Workspace contract/lib/schema is required
- only then add the host API/UI/service adapter
- if the change can only be explained in Mission Control terms, the boundary is probably drifting

## Final Boundary Sentence

Directive Workspace is the standalone product and canonical operating system for mission-driven source adaptation; hosts and connected layers consume, enforce, or expose Directive Workspace rather than define it.
