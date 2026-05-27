# Audience scope trim list

Documents what relocates from core README narrative to `docs/lineage/`. The kernel's locked audience is general-workflow; this trim list identifies research-specific content that stays in the codebase but moves out of the README's first-page framing.

| Surface | Disposition | Notes |
|---|---|---|
| `runtime/capabilities/literature-access/` | Retain in core; document in lineage doc | arXiv, OpenAlex, Unpaywall callables continue to ship and work. Documented in `docs/lineage/research-curation.md` as one supported domain. |
| `runtime/capabilities/research-vault-source-pack/` | Same | Source-pack curation for research workflows. Ships, works, documented in lineage. |
| `discovery/research-engine/` | Retain as opt-in workspace member; document in lineage | Python workspace for research-engine ingestion. Active, not deprecated. Referenced in `docs/lineage/research-curation.md` not in README first paragraph. |
| Lines in README pointing at `discovery/research-engine/README.md` for live providers | Keep; add one-line note | Keep the reference (already deep enough in README) but add: "(used primarily by the research-curation domain — see [`docs/lineage/research-curation.md`](./docs/lineage/research-curation.md))" |
| `shared/templates/literature-monitoring-*.md` | Retain as templates | Research-shape templates. Documented in lineage doc. |
| `shared/contracts/literature-monitoring-degraded-state-guard.md` | Already a stub per F5 | No change. |
