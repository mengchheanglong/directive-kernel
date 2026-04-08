# Supporting Doctrine: Discovery Research Pipeline

Last updated: 2026-04-01
Status: active supporting doctrine
Scope: product boundary, execution posture, progress tracking

## 1. Core Position

Research Engine can be the closest thing to a "Perplexity for Directive Workspace Discovery," but only if it is built as a Discovery-owned research pipeline rather than as a vague agent shell.

This means:

- Research Engine is not "just call Codex and hope"
- Research Engine is not generic chat over the web
- Research Engine is not a consumer answer engine
- Research Engine is a mission-conditioned source-finding, evidence-normalization, and candidate-judgment pipeline

The product value is not the generated answer.
The product value is the structured, reviewable research record that Discovery can trust and reuse.

## 2. Why This Doctrine Exists

The source pool already points in this direction:

- Vane is the closest answer-engine / Perplexity-style reference
- GPT Researcher is stronger for deep cited research behavior
- Open Deep Research is the strongest composable workflow base
- dzhng/deep-research and local-deep-researcher are simplification references

Taken together, those references argue for a bounded pipeline with reusable stages, not for a chat product and not for an unbounded autonomous crawler.

## 3. Correct Discovery Shape

Inside Directive Workspace Discovery, Research Engine should behave as follows.

### Mission Intake

Discovery provides a bounded goal such as:

- find real systems for durable execution
- find architecture-intelligence systems for repo truth
- find reusable subsystems for external source acquisition

It also provides constraints such as:

- prefer official docs
- reject generic linters
- limit to concrete reusable systems
- prefer self-hostable components

The output of this stage is a structured mission file.
It is not an answer.

### Query Planning

Research Engine expands one mission into multiple search tracks, for example:

- official docs
- GitHub repos
- architecture docs
- API docs
- comparison queries
- implementation-pattern queries

This decomposition is one of the main reasons Research Engine can outperform a single conversational prompt.

### Live Acquisition

Research Engine then runs an acquisition mode:

- `catalog` for deterministic local reference runs
- `codex-session` for bounded operator-assisted acquisition
- `local-first` for offline corpus-driven acquisition with bounded local fallback semantics
- `live-hybrid` for live acquisition with bounded catalog fallback
- `api-provider` for strict programmatic live acquisition without catalog fallback

Codex may be one acquisition backend, but it is not the architecture.

### Evidence Normalization

Regardless of who fetched the information, Research Engine converts it into the same internal form:

- URL
- title
- source type
- excerpt
- timestamp
- why it matched
- trust score
- rejection flags
- candidate-system grouping

This is the boundary where thread research becomes reusable Discovery evidence.

### Scoring And Rejection

Research Engine then:

- ranks candidates
- records explicit rejection reasons
- records uncertainty and baggage

This is where Discovery gets real value.
Finding sources is necessary but insufficient.
Judging whether those sources deserve entry into the capability-evolution pipeline is the product.

### DW-Ready Output

The final outputs are structured artifacts such as:

- candidate dossiers
- evidence bundles
- ranked recommendations
- rejected candidates with reasons
- `dw_discovery_packet.json`
- `source_intelligence_packet.json`
- `dw_import_bundle.json`

This is how Research Engine becomes Discovery infrastructure instead of a vague internet bot or a parallel subsystem authority.

## 4. Codex Posture

Codex should be treated as an execution mode, not as the system design.

Correct posture:

- Research Engine owns mission intake
- Research Engine owns query planning
- Research Engine owns normalization
- Research Engine owns scoring and rejection
- Research Engine owns DW packet export, but the exported DW packet must stay Discovery-only
- Codex may perform bounded live acquisition

Incorrect posture:

- ask Codex one big question
- accept whatever thread output appears
- skip normalization and rejection logic
- pretend chat output is a durable Discovery artifact

## 5. Architecture Rule

Research Engine must support multiple acquisition backends against one normalization contract.

The stable contract is:

1. mission
2. query plan
3. discovery hits
4. evidence bundle
5. candidate dossiers
6. rejections
7. DW packet

This keeps Codex-mode, catalog-mode, and API-mode interchangeable at the acquisition layer while preserving one Research Engine-owned judgment pipeline.

## 6. Progress Tracking

Current implementation status:

- done: standalone Python package scaffold
- done: mission -> plan -> discovery -> fetch -> normalize -> score -> export pipeline
- done: deterministic catalog-backed reference run
- done: multi-track query planning
- done: acquisition interface with `catalog` and `codex-session` modes
- done: executable `codex-session` handoff with workspace-visible input/output files
- done: live-hybrid acquisition backend with real GitHub/web discovery and bounded fallback
- done: dedicated `api-provider` acquisition mode for strict live runs with no catalog fallback
- done: `local-first` acquisition mode for offline corpus-driven discovery/fetch with bounded catalog fallback
- done: live-hybrid deeper extraction (GitHub metadata + README signals, web page visible-text extraction)
- done: repo adapter coverage expanded with GitLab live discovery/fetch support
- done: non-repo web adapter now classifies docs/blog/forum/news source types for trust-policy routing
- done: non-repo web extraction now captures source-profile metadata (author/site/schema/published/modified) and source-type-aware confidence
- done: non-repo web extraction now applies source-specific content-shaping profiles for docs/blog/forum/news evidence slices
- done: live GitHub/GitLab request paths now support optional auth-token headers for better rate-limit resilience
- done: provider-health reporting now includes explicit reason codes and status summaries for degraded/fallback states
- done: local-first acquisition now supports tuning controls for top-k, match-window, extension filters, and strict no-fallback behavior
- done: local-first ranking now blends keyword overlap with lightweight semantic signals (rarity weighting, phrase/bigram alignment, sparse-match penalty)
- done: inspection shell now includes provider diagnostic drill-down columns for reasons/summary/notes
- done: inspection shell now includes bounded client-side sorting/filtering controls for candidate and provider tables
- done: local-first tokenization now preserves short domain terms (`api`, `sdk`) with bounded stopword filtering
- done: local-first stopword coverage validated against `.research/` sample corpus in strict offline mode
- done: local-first stopword additions are now configurable via `RESEARCH_ENGINE_LOCAL_STOP_TERMS` for domain tuning
- done: local-first now emits lexical diagnostics (top terms and suggested stop terms) in acquisition/provider notes for corpus calibration
- done: CLI now prints `Suggested RESEARCH_ENGINE_LOCAL_STOP_TERMS` when local-first diagnostics produce stopword candidates
- done: local-first diagnostic suggestion gating tuned for larger corpora (40% document-frequency threshold with bounded top-8 suggestions)
- done: production-corpus local-first calibration pass completed for workspace corpus `.research`; calibrated stop terms applied in runtime as `researcher,gpt,python`
- done: normalized evidence now carries trust, match, and capture metadata
- done: scoring now derives from normalized evidence instead of hardcoded score hints
- done: candidate dossiers and DW packets now carry freshness and provenance summaries
- done: scoring now applies recency decay and source-age weighting to maintenance health
- done: candidate dossiers now cluster evidence, collapse duplicates for scoring, and flag contradictions
- done: normalization now applies source-type trust policy with mission-level overrides
- done: mission trust preferences now support named trust-policy presets for common Discovery objectives
- done: missions now support named query-planning presets so track/query mix can align with trust posture explicitly
- done: missions now support required/excluded query-track overrides without abandoning preset-driven planning
- done: missions now support required/excluded query-type pinning inside each track
- done: missions now support track-level provider preferences for live-hybrid acquisition pressure
- done: catalog-backed runs now carry richer stars/issues/release-cadence snapshots for deterministic maintenance evidence
- done: catalog-backed runs now inject deterministic repo-metadata freshness facts for source-age scoring
- done: live GitHub fetch now adds release/homepage freshness notes so source-age extraction is not limited to `pushed_at`
- done: candidate dossiers now carry derived rejection flags and reconsideration triggers
- done: rejections now include derived evidence flags
- done: provider health telemetry artifact export (`provider_health.json`)
- done: thin inspection UI artifact export (`inspection.html`) for low-friction run review
- done: live-hybrid provider telemetry now records retries, backoff, and timeout counts per provider path
- done: live web extraction now captures page-level updated/published metadata for freshness scoring when available
- done: provider health entries now expose explicit health status labels for fallback/degraded paths
- done: `dw_discovery_packet.json` export
- done: smoke test for artifact emission

Still required to satisfy this doctrine:

- later: broader UI redesign beyond lightweight inspection shell (deferred by queue)

## 7. Anti-Drift Rules

Research Engine is drifting in the wrong direction if:

- the main output becomes prose instead of evidence-backed artifacts
- acquisition backend behavior leaks directly into downstream judgment
- Codex thread output is treated as final truth
- candidate rejection becomes implicit instead of explicit
- Discovery receives suggestions without inspectable evidence

If a proposed feature does not improve:

- source finding
- evidence quality
- candidate judgment
- or DW handoff quality

it does not belong in the current build slice.

## 8. Bottom Line

Research Engine should become:

- a Discovery-aligned external research pipeline
- a bounded evidence assembly system
- a candidate-ranking and rejection engine
- a DW-ready source packet generator

It should not become:

- a generic chat shell
- a single-model wrapper
- a hidden research agent
- a replacement for Directive Workspace decision authority
