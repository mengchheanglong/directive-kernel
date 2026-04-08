# Cross-Source Synthesis Packet Contract

Profile: `cross_source_synthesis_packet/v1`

## Purpose

Preserve the reusable result of a multi-source Architecture slice when the real value emerges from agreement, tension, contradiction, or recombination across sources rather than from any single source alone.

This contract captures the surviving mechanism extracted from:
- `incremental reading enables cross-source connection finding`
- `academic research uses structured extraction with cross-source synthesis`

Directive Workspace already has source-analysis and adaptation records plus mechanism packets.
This contract defines the reusable packet for the specific case where the adapted value is cross-source synthesis.

## When to use

Use this contract when:
- Architecture processes more than one source in a bounded slice
- the key value is a connection, contradiction, or synthesis across sources
- the slice should leave behind a reusable synthesis result for future Architecture work

Do not use when:
- the slice is effectively single-source
- the output is a runtime/callable behavior that belongs in Runtime

## Core rule

If the main value of the slice comes from the collision between sources, the slice should emit a cross-source synthesis packet rather than only separate source notes or a long adopted record.

The packet must let future Architecture work reuse:
- what the sources agree on
- where they differ
- what Directive synthesized from the collision
- what baggage was excluded from the synthesis

## Required fields

- `packet_id`
- `packet_date`
- `source_slice_ref`
- `sources_compared`
- `synthesis_question`
- `shared_pattern`
- `key_agreements`
- `key_tensions`
- `directive_synthesis`
- `excluded_baggage`
- `artifact_refs`
- `reuse_targets`
- `usefulness_level`
- `meta_usefulness`
- `meta_usefulness_category`

## Quality test

Ask:

1. Can a future slice reuse the cross-source synthesis without reopening every source?
2. Does the packet preserve both agreements and tensions rather than flattening them into one vague summary?
3. Does the packet state what Directive synthesized beyond the sources?
4. Does it point to the product-owned assets created from the synthesis?

If not, the result is still cross-source note-taking rather than reusable cross-source synthesis.

## Relationship to phase isolation

Cross-source work often benefits from phase isolation:
1. analyze the sources and identify the collision worth preserving
2. hand off through a phase packet
3. adapt the collision into Directive-owned assets
4. emit a synthesis packet for future reuse

## Relationship to transformation-artifact gate

The synthesis packet helps satisfy `transformation-artifact-gate` only when it points to transformed Directive-owned assets and preserves an adapted synthesis rather than raw comparison notes.

## Relationship to other contracts

- Works with: `source-analysis-contract`
- Works with: `adaptation-decision-contract`
- Works with: `phase-isolated-processing`
- Works with: `architecture-mechanism-packet`
- Works with: `transformation-artifact-gate`
- Uses: `shared/templates/cross-source-synthesis-packet.md`
- Uses: `shared/schemas/cross-source-synthesis-packet.schema.json`
