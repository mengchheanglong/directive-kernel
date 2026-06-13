# Research curation lineage

The Directive Kernel was built originally for a research curation workflow (literature discovery, intake queue, routing to a research workspace). It was generalized into a general-workflow kernel, and has now been pivoted (on this branch) into **Hermes's capability acquisition, verification, and self-improvement kernel** — a Jarvis-style system that compounds assistant capability over time.

This document captures the research-curation surfaces retained in the kernel, which now serve the capability kernel: research sources that produce callable tools or measurable system-level experiments feed the verified-capability pipeline; research sources that are purely informational become note-only items.

## What the kernel supports for research curation today

The following surfaces all ship and work:

- **Literature-access capabilities** (`runtime/capabilities/literature-access/`) — arXiv, OpenAlex, and Unpaywall callables for fetching and filtering paper metadata. These are the most mature runtime capabilities in the kernel and are the reference implementation for plugin-style capability architecture.

- **Research-vault source pack** (`runtime/capabilities/research-vault-source-pack/`) — a source-pack wrapper that treats a research vault as the ingest entry point. Used by the research-curation pipeline.

- **Research-engine workspace** (`discovery/research-engine/`) — a Python sub-package that ingests research sources, normalizes them to the kernel's submission shape, and feeds the intake queue. This workspace is a separate, opt-in component; the kernel's TypeScript core does not depend on it.

- **Source-pack curation contracts** — `shared/contracts/source-pack-curation-allowlist.md` (in `docs/contracts/` post-F5) defines allowlist-based curation for source pack ingestion.

- **Citation handling** — `shared/schemas/citation-set-artifact.schema.json` and `shared/contracts/citation-set-fallback.md` (in `docs/contracts/`) define the citation-set artifact shape. These are used by literature-access capabilities when formatting paper metadata.

- **Literature-monitoring templates** — `shared/templates/literature-monitoring-digest.md` and `shared/templates/literature-monitoring-degraded-state-guard.md` are packaged for adopters who want bounded literature monitoring without building their own template from scratch.

- **Live providers** — see [`discovery/research-engine/README.md`](../discovery/research-engine/README.md) for the current list of live research-engine providers.

Research curation is **one supported domain**, not the kernel's primary audience. The primary audience on this branch is Hermes capability compounding (see [`AUDIENCE.md`](../AUDIENCE.md)). The research surfaces above are retained so that the capability kernel can ingest paper/repo sources through the literature-aware intake pipeline and classify them as capability candidates, architecture experiments, note-only items, or training-lab-only research.

## Migration note for research-curation history

When auditing older research-driven registry artifacts, use the Jarvis migration
audit in dry-run mode:

```powershell
npx tsx scripts/migrate-jarvis-capability-kernel.ts
npx tsx scripts/capability-health.ts
```

Interpretation rules:

- a paper or source list does not become a verified capability just because it
  exists in historical intake or registry artifacts
- verified projection-ready still requires verified execution, complete
  contract metadata, and complete Hermes projection metadata
- research artifacts with only informational value should remain note-only
- system-level paper ideas with measurable local experiments belong in
  Architecture, not Runtime

Rollback guidance:

- the migration audit is dry-run safe by default and does not mutate the live
  directive root
- this slice does not enable `--apply`
