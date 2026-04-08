# Shared Schemas

This folder holds the canonical Directive Kernel schemas used by Discovery, Runtime, Architecture, Engine state, and host validation.

These schemas belong in the kernel when they define reusable artifact or request shapes. They do not need to be referenced by one specific runtime caller to justify inclusion.

Current scope includes:
- Discovery request and queue-entry shapes
- Architecture packet/adoption shapes
- Runtime proof and integration artifact shapes
- host-facing config and adapter schemas
- generic analysis/evaluation/support artifact shapes

Boundary:
- schemas here define reusable shape authority
- they do not carry historical case truth
- host bindings remain explicit and fail-closed
- named workspace-era promotion cases do not belong here
