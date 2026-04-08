# Source-Pack Curation Allowlist

Date: 2026-03-21
Track: Directive Architecture
Source pattern: agent-lab orchestration allowlist extraction

## Purpose

Define the minimum boundary for what Directive Workspace may promote, mirror, export, or preserve from external tooling and orchestration sources.

This contract keeps curation/export decisions explicit and prevents source-pack promotion from turning into blind repository absorption.

## Required Fields

- `source_surface`
- `retained_value`
- `adoption_target`
- `allowed_export_surfaces`
- `excluded_baggage`
- `ownership_path`
- `activation_rule`
- `rollback_path`

## Allowed Export Surfaces

Only the following export forms are valid by default:
- product-owned shared contract
- product-owned shared template
- product-owned shared schema
- product-owned shared library
- Architecture reference pattern or policy note
- Discovery reference/source-map note
- Runtime follow-up record
- Runtime source pack with explicit readiness marker

## Excluded Baggage

The following must not be promoted by default:
- vendored dependencies
- raw upstream repository layout as runtime truth
- local logs
- generated test artifacts
- local stack bootstrap scripts unless preserved as a host runbook on purpose
- UI assets or desktop runtime dependencies that are not part of the retained mechanism

## Activation Rules

- A runtime-capable extracted pack must not be treated as live unless it has an explicit Runtime-owned destination and readiness marker.
- `runtime/source-packs/*` remains documentation-only until `SOURCE_PACK_READY.md` exists.
- Discovery and Architecture captures may preserve reference value without implying runtime activation.

## Rules

- Preserve the useful mechanism, not the surrounding upstream baggage.
- Direct mirrors of external tool folders are not callable truth by default.
- Curation/export decisions must declare the ownership path where the extracted value will live.
- If the retained value is governance, policy, or boundary logic, prefer shared contracts/templates/policies over runtime pack creation.
- If the retained value is runtime-capable, route it through Runtime follow-up with explicit readiness and rollback.
- If a source item does not fit an allowed export surface, keep it reference-only or drop it.

## Validation Hook

- `npm run check:directive-orchestration-allowlist-contracts`
