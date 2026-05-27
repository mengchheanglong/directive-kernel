# Research curation lineage

The Directive Kernel was built originally for a research curation workflow (literature discovery, intake queue, routing to a research workspace). It was generalized later into the general-workflow kernel it is today. This document captures the surfaces that support research curation and where an adopter who wants that flavor can find them.

## What the kernel supports for research curation today

The following surfaces all ship and work:

- **Literature-access capabilities** (`runtime/capabilities/literature-access/`) — arXiv, OpenAlex, and Unpaywall callables for fetching and filtering paper metadata. These are the most mature runtime capabilities in the kernel and are the reference implementation for plugin-style capability architecture.

- **Research-vault source pack** (`runtime/capabilities/research-vault-source-pack/`) — a source-pack wrapper that treats a research vault as the ingest entry point. Used by the research-curation pipeline.

- **Research-engine workspace** (`discovery/research-engine/`) — a Python sub-package that ingests research sources, normalizes them to the kernel's submission shape, and feeds the intake queue. This workspace is a separate, opt-in component; the kernel's TypeScript core does not depend on it.

- **Source-pack curation contracts** — `shared/contracts/source-pack-curation-allowlist.md` (in `docs/contracts/` post-F5) defines allowlist-based curation for source pack ingestion.

- **Citation handling** — `shared/schemas/citation-set-artifact.schema.json` and `shared/contracts/citation-set-fallback.md` (in `docs/contracts/`) define the citation-set artifact shape. These are used by literature-access capabilities when formatting paper metadata.

- **Literature-monitoring templates** — `shared/templates/literature-monitoring-digest.md` and `shared/templates/literature-monitoring-degraded-state-guard.md` are packaged for adopters who want bounded literature monitoring without building their own template from scratch.

- **Live providers** — see [`discovery/research-engine/README.md`](../discovery/research-engine/README.md) for the current list of live research-engine providers.

Research curation is **one supported domain**, not the kernel's primary audience. The primary audience is dev teams running general source-driven workflows (see [`AUDIENCE.md`](../AUDIENCE.md)). The research surfaces above are retained so that any adopter who needs a literature-aware intake pipeline can use them without the kernel's core engineering changing.
