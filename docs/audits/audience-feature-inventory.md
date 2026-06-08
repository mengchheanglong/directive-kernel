# Kernel feature inventory for audience decision

Walk of `engine/`, `runtime/`, `discovery/`, `architecture/`, `hosts/`, `shared/`, `ui/` to score each capability + contract on research-coupling and generalizability.

## Generic kernel infrastructure (audience-agnostic)

These surfaces are source-type-agnostic. They serve any domain that needs an intake → routing → decision pipeline.

| Surface | Generalizes? | Notes |
|---|---|---|
| `engine/orchestration/` | Yes | Coordination + execution + lifecycle, fully generic |
| `engine/cases/` | Yes | Mirrored case records; one per submission |
| `engine/mission/` | Yes | Goal + gap management; mission-conditioned, not source-conditioned |
| `engine/planning/` | Yes | Plan construction + consumption |
| `engine/routing/` | Yes | Lane scoring, assessment, decisions — all source-type-agnostic |
| `engine/state/` | Yes | Workspace state resolution |
| `engine/maintenance/` | Yes | F14 archive + rotation, generic |
| `engine/decision-policy-ledger.ts` | Yes | Append-only ledger, generic |
| `engine/process-fingerprint.ts` | Yes | Deduplication, generic |
| `engine/source-input-normalization.ts` | Yes | Generic |
| `discovery/lib/intake/` | Yes | Queue + lifecycle, generic |
| `discovery/lib/front-door/` | Yes | Submission + routing, generic |
| `discovery/lib/gaps/` | Yes | Capability gap worklist, generic |
| `discovery/lib/routing/` | Yes | Routing record writers + review resolution, generic |
| `discovery/lib/records/` | Yes | Fast-path + case-record writers, generic |
| `runtime/lib/operations/` | Yes | F9 merged surface (openers + runners + sequences), generic |
| `runtime/lib/control/` | Yes | Automation eligibility, loop control, manual control, generic |
| `runtime/lib/host/` | Yes | Host integration seam, generic |
| `runtime/lib/projections/` | Yes | State projections, generic |
| `runtime/lib/writers/` | Yes | Record persistence, generic |
| `architecture/` | Yes | Adoption + materialization + experiments, generic |
| `hosts/standalone-host/` | Yes | Reference local host, generic |
| `hosts/web-host/` | Yes | Read-only operator dashboard (post-F8), generic |
| `hosts/integration-kit/` | Yes | Adapter surface for embedding, generic |
| `shared/lib/` | Yes | All utilities (process-lock, file-io, schemas, etc.) generic |
| `shared/contracts/` | Mixed | 18 enforced + 6 schema-shaped + 31 docs-only (post-F5) — most are generic governance, a handful are research-flavored |
| `shared/schemas/` | Yes | All JSON schemas, generic |
| `shared/templates/` | Yes | Generic markdown templates |
| `ui/` | Yes | Read-only Lit dashboard (post-F8), generic |

**Verdict:** ~85% of the kernel is genuinely audience-agnostic. The engine + discovery + architecture + most of runtime + every host + every shared surface fit any domain.

## Research-coupled surfaces

These surfaces are research-curation-shaped and would not be the first thing a non-research adopter wires up.

| Surface | Coupling | Disposition |
|---|---|---|
| `runtime/capabilities/literature-access/` | Strong (arXiv, OpenAlex, Unpaywall fetchers) | Stay in codebase as one capability family. Document in `docs/lineage/research-curation.md` as the research-domain surface. Do not feature in core README. |
| `runtime/capabilities/research-vault-source-pack/` | Strong (Scientify-style source packs) | Same as above — stays, but moved out of front-page narrative. |
| `discovery/research-engine/` | Strong (Python sub-workspace for research providers like Tavily, Exa, Firecrawl, GitHub) | Stays. Already a separate workspace member. Documented as opt-in for research workflows. |
| `runtime/capabilities/code-normalizer/` | Weak (was research-flavored but is a generic source-normalizer) | Stays in core. Generic enough to serve any domain. |
| `shared/contracts/citation-set-fallback.md` | Strong | Moved to `docs/contracts/` in F5 already — already de-emphasized. |
| `shared/contracts/bounded-literature-monitoring-workflow.md` | Strong | Already in `docs/contracts/` per F5. |
| `shared/contracts/literature-monitoring-degraded-state-guard.md` | Strong | Already a stub in `shared/contracts/` (F5 schema-shaped). |
| `shared/templates/literature-monitoring-*.md` | Strong | Stays as templates; not in front-page narrative. |
| Vocabulary: "source", "candidate", "extraction", "adaptation" | Weak | Domain-neutral terms that happen to fit research vocabulary. Keep — they generalize fine. |
| Vocabulary: "citation", "evidence" | Medium | Mostly used in proof/evaluation context, generalizes to any domain that needs evidence-backed decisions. |

**Verdict:** ~15% of the kernel is research-flavored. Mostly the literature-access capability set + the research-engine sub-workspace + a handful of templates. Already largely contained to opt-in surfaces.

## Cost estimate

### Option (a) — Research_Curation_Path

- **Time:** ~4 hours of doc work.
- **Risk:** Solidifies the niche; future generalization requires un-positioning.
- **Output:** `AUDIENCE.md` + README rewrite + minor scope-trim list.

### Option (b) — General_Workflow_Path (CHOSEN)

- **Time:** ~3-5 days for someone who knows the kernel.
- **Scope:**
  - `AUDIENCE.md` at repo root
  - README "What This Repo Is For" rewrite
  - `audience-scope-trim.md` listing what relocates to `docs/lineage/`
  - `docs/lineage/research-curation.md` capturing the research-domain framing
  - 2 new example consumers under `hosts/integration-kit/examples/<name>/`:
    1. `bug-report-triage` (GitHub issue → fix-now / backlog / wontfix / duplicate)
    2. `incident-triage` (alert webhook → page-on-call / monitor-only / auto-resolve / noise)
  - Each example: goal envelope JSON + sample source JSON + README walkthrough + integration test
  - 2 new integration tests under `tests/integration/<name>.test.ts`
- **Risk:** Examples need to actually run, not just exist.
- **Output:** Locked audience, two proven non-research workflows, lineage relocated to a tracked sub-doc.

## Decision rationale

Option (b) chosen because:

1. The kernel is structurally generic — 85% of surfaces serve any domain. Pitching it as research-only would understate what it does.
2. Two non-research example consumers prove the claim cheaply. Without them, "general workflow kernel" is aspirational.
3. The research lineage stays in the codebase — capability-access + research-engine continue to work for adopters who want them. Moving them out of the front-page narrative is positioning, not deletion.
4. `bug-report-triage` and `incident-triage` are universal dev-team workflows. They don't pull in compliance baggage (PII, CVE feeds) that customer-facing or security examples would add.
