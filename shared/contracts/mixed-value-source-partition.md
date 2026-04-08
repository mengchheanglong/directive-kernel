# Mixed-Value Source Partition

Profile: `mixed_value_source_partition/v1`

## Purpose

Some sources contain both:
- Architecture value that should become Directive-owned operating logic
- Runtime value that should become runtime or callable capability later

Directive Workspace already has:
- source analysis
- adaptation decisions
- Architecture-to-Runtime handoff
- packetized retained value for stage/evidence continuity

What it lacked was an explicit partition surface for mixed-value sources where:
- some retained value can be reused from existing packets
- some value must be re-analyzed from raw source because packet coverage is only partial
- some value should stay in Architecture
- some value should be deferred as Runtime follow-up

This contract standardizes that split.

## When to use

Use this contract when:
- a source family contains both structural/meta-useful value and direct runtime value
- Architecture should keep part of the source-derived mechanism
- Runtime follow-up is plausible but should not absorb the whole source immediately
- existing mechanism packets or synthesis packets cover part of the retained value, but not the whole source

Do not use when:
- the source is cleanly Architecture-only
- the source is cleanly Runtime-only
- Discovery has not yet narrowed the source enough to know what value is mixed

## Core rule

For a mixed-value source, Architecture must make the split explicit:
1. what retained value is already covered by existing packets or adopted artifacts
2. what retained value still requires direct source re-analysis
3. what should become Architecture-owned operating code now
4. what should become Runtime handoff candidate later
5. what should be excluded as baggage

Mixed-value handling should not collapse into either:
- reopening the whole source unnecessarily
- routing the whole source to Runtime because runtime value exists somewhere inside it

## Required fields

- `partition_id`
- `partition_date`
- `source_id`
- `source_reference`
- `packet_inputs_reused`
- `packet_coverage_scope`
- `source_reanalysis_required`
- `architecture_retained_mechanisms`
- `runtime_candidate_mechanisms`
- `excluded_baggage`
- `split_rationale`
- `architecture_artifact_targets`
- `runtime_handoff_candidates`
- `defer_or_revisit_conditions`

## Relationship to other contracts

- Works with: `source-analysis-contract`
- Works with: `adaptation-decision-contract`
- Works with: `architecture-adoption-criteria`
- Works with: `architecture-to-runtime`
- Works with: `architecture-mechanism-packet`
- Works with: `cross-source-synthesis-packet`
- Feeds into: `architecture-cycle-evaluation.md`
- Uses: `shared/templates/mixed-value-source-partition.md`
