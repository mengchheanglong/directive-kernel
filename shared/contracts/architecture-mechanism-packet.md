# Architecture Mechanism Packet Contract

Profile: `architecture_mechanism_packet/v1`

## Purpose

Turn the result of a source-driven Architecture slice into a reusable building block that future Architecture work can assemble from directly.

This contract captures the surviving mechanism extracted from arscontexta's packet/assembly doctrine:
- session outputs should be composable packets for future work
- assembly is stronger than restarting from zero
- packets only matter when they contain transformed value rather than reorganized source material

Directive Workspace already has source-analysis and adaptation records.
This contract defines the smaller reusable artifact those records should yield when a source-derived mechanism is expected to influence future Architecture work.

## When to use

Use this contract when:
- a source-driven Architecture slice produces a mechanism that future Architecture work should reuse
- the slice is meta-useful and should improve future source consumption, adaptation, or self-improvement quality
- a phase-isolated slice needs a stable post-adaptation output that later work can assemble from without reopening the full analysis/adaptation chain

Do not use when:
- the slice only matters as one-time local reasoning with no expected reuse
- the output is purely Runtime runtime behavior rather than Architecture operating code

## Core rule

If a source-driven Architecture slice is expected to influence future Architecture work, it should emit a mechanism packet that another agent or operator can use without reopening the original source or reconstructing the full reasoning chain.

The packet is not a replacement for source-analysis or adaptation records.
It is the reusable condensed artifact that those records produce.

## Required fields

- `packet_id`
- `packet_date`
- `source_slice_ref`
- `source_reference`
- `mechanism_name`
- `usefulness_level`
- `problem_solved`
- `directive_value`
- `excluded_baggage`
- `adapted_form`
- `improved_form`
- `reuse_targets`
- `artifact_refs`
- `runtime_threshold_check`
- `meta_usefulness`
- `meta_usefulness_category`

## Field intent

- `source_slice_ref`
  - points back to the source-analysis/adaptation/adopted chain that produced the packet
- `problem_solved`
  - states the concrete operating problem the mechanism fixes for Directive Workspace
- `directive_value`
  - states the retained value after source-specific baggage is removed
- `excluded_baggage`
  - makes clear what should not be carried forward
- `adapted_form`
  - describes how Directive reshaped the mechanism
- `improved_form`
  - describes how Directive improved beyond the source
- `reuse_targets`
  - lists the future Architecture surfaces or workflows expected to use this packet
- `artifact_refs`
  - points to the product-owned contracts/templates/schemas/policies produced

## Quality test

Ask:

1. Can a future Architecture slice use this packet without reopening the original source?
2. Does the packet preserve the adapted/improved Directive form, not merely the raw source idea?
3. Does the packet identify excluded baggage explicitly?
4. Does the packet point to the product-owned artifacts created from the mechanism?

If the answer is "no" to most of these, the packet is only a summary, not a reusable mechanism packet.

## Relationship to phase isolation

Phase handoff packets move work between phases.
Mechanism packets preserve the resulting adapted mechanism for future slices.

Typical sequence:
1. source analysis produces a phase handoff packet
2. adaptation consumes the packet and materializes Directive-owned artifacts
3. the adopted result emits a mechanism packet for future reuse

## Relationship to transformation-artifact gate

The mechanism packet can count toward `transformation-artifact-gate` only when it captures transformed Directive-owned value and points to actual product-owned artifacts.

A mechanism packet with no transformed assets behind it is not enough.

## Relationship to other contracts

- Works with: `source-analysis-contract`
- Works with: `adaptation-decision-contract`
- Works with: `phase-isolated-processing`
- Works with: `transformation-artifact-gate`
- Related specialization: `cross-source-synthesis-packet` for multi-source synthesis results
- Feeds into: `architecture-cycle-evaluation.md`
- Uses: `shared/templates/architecture-mechanism-packet.md`
- Uses: `shared/schemas/architecture-mechanism-packet.schema.json`
