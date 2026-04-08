# Automation Lane Split Contract

Date: 2026-03-21
Track: Directive Architecture
Source pattern: gh-aw Slice 4 extraction

## Purpose

Define mandatory separation between read-only planning/evaluation and constrained write execution for automation and promotion specs.

## Required Structure

1. `read_only_lane`
- must not write files.
- used for analysis, planning, and review-only steps.

2. `write_lane` (optional)
- only enabled when explicit delivery requires writes.
- must declare `safe_output_scope`.
- must declare `sanitize_policy`.

## Required Fields

- `source_intent_artifact`
- `compile_contract_artifact`
- `runtime_permissions_profile`
- `safe_output_scope` (required if write lane exists)
- `sanitize_policy` (required if write lane exists)
- `tracker_id` or `workflow_id` for auditability

## Rules

- Source intent markdown is not execution truth by itself.
- Compiled contract artifact is authoritative for runtime execution.
- No write lane without explicit bounded output path.
- No write lane without explicit sanitization rules.
- No promotion without lane split declaration.

## Validation Hook

- `npm run check:directive-gh-aw-contracts`
