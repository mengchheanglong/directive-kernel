# Research Engine Architecture Aligned To Directive Workspace

Last updated: 2026-04-01
Status: working design

## 1. Purpose

Research Engine is a product-owned Discovery capability inside Directive Workspace.

Its job is to:

- take a bounded research mission or subsystem gap
- discover relevant external systems, repos, docs, and references
- gather and normalize evidence
- group and score candidates
- emit inspectable research artifacts

It does not own Directive Workspace lane execution.
It is a Discovery-front-door acquisition and evidence capability that feeds Directive Workspace Discovery cleanly.

## 2. Non-Goals

Research Engine is not:

- a consumer answer engine
- a generic chatbot
- a Perplexity clone
- a crawler or search engine built from scratch
- a Runtime executor
- an Architecture proof system
- a replacement for the Directive Engine

## 3. Directive Workspace Alignment

Directive Workspace imposes the following constraints:

1. External inputs enter through Discovery first.
2. Lane is chosen by adoption target, not by source type.
3. Mission-conditioned usefulness must be explicit.
4. Baggage and exclusions must be explicit.
5. Downstream value must be inspectable.
6. Artifact movement without transformation does not count as processing.

Research Engine therefore should not decide final Directive Workspace routing as authority.
It should produce structured research packets that make Discovery and Architecture decisions easier, faster, and more evidence-backed.

## 4. Correct Product Boundary

### Research Engine owns

- bounded mission intake for external research
- query planning for source discovery
- multi-provider discovery
- fetch and extraction
- evidence normalization
- candidate grouping
- candidate scoring and ranking
- rejection and uncertainty recording
- standalone research artifacts
- Directive Workspace Discovery packet generation

### Research Engine does not own

- Directive Engine mission model
- final DW route authority
- Architecture extraction/adaptation/improvement execution
- Runtime follow-up or promotion flow
- host-specific execution
- final product integration decisions

## 5. System Shape

Research Engine should be a library-first Python system with a thin CLI.

Primary shape:

1. `mission`
2. `planning`
3. `discovery`
4. `fetch`
5. `normalize`
6. `score`
7. `synthesize`
8. `export`

The key rule is that every stage produces durable intermediate artifacts.
The primary product is not the final prose report.
The primary product is the research record and candidate evidence.

## 6. Canonical Flow

Research Engine canonical flow:

1. Mission intake
2. Query plan generation
3. Source discovery
4. Fetch and extraction
5. Evidence normalization
6. Candidate grouping
7. Candidate scoring
8. Recommendation and rejection synthesis
9. Export of standalone artifacts
10. Export of DW-compatible Discovery packet

This flow is intentionally earlier than the Directive Workspace canonical loop.
It supports DW's front door instead of replacing it.

## 7. Core Data Models

Research Engine should use explicit typed models.

### Mission

```json
{
  "mission_id": "optional",
  "objective": "bounded external research objective",
  "planning_preset": "balanced-discovery",
  "required_track_ids": [],
  "excluded_track_ids": [],
  "required_query_types_by_track": {},
  "excluded_query_types_by_track": {},
  "track_provider_preferences": {},
  "constraints": {
    "include_domains": [],
    "exclude_domains": [],
    "exclude_keywords": [],
    "time_budget_minutes": 30,
    "max_queries": 12,
    "max_candidates": 25,
    "max_fetches": 40
  },
  "trust_preferences": {
    "policy_preset": "balanced-discovery",
    "prefer_official_docs": true,
    "prefer_active_repos": true,
    "prefer_self_hostable": true
  }
}
```

Mission-level planning presets should stay explicit and bounded.
Use preset selection to shape track/query mix, then let downstream artifacts record which planning posture was used.
Mission-level required/excluded track overrides should stay explicit and inspectable in `query_plan` artifacts.
Mission-level required/excluded query-type overrides should stay explicit and inspectable in `query_plan` artifacts.
Mission-level track provider preferences should stay explicit and inspectable in `query_plan` artifacts.

### DiscoveryHit

```json
{
  "provider": "exa|tavily|github|searxng",
  "query": "search query",
  "url": "https://...",
  "title": "candidate title",
  "snippet": "provider snippet",
  "hit_type": "repo|doc|article|paper|issue|discussion"
}
```

### EvidenceItem

```json
{
  "evidence_id": "stable id",
  "candidate_key": "normalized candidate identity",
  "source_url": "https://...",
  "source_type": "github-repo|product-doc|paper|technical-essay|workflow-writeup|external-system",
  "title": "source title",
  "excerpt": "normalized excerpt",
  "fact_type": "architecture|workflow|dependency|integration|maintenance|signal",
  "confidence": "high|medium|low",
  "notes": [],
  "source_updated_at": "optional ISO timestamp",
  "source_age_days": 14,
  "freshness_signal": "current|recent|aging|stale|unknown",
  "cluster_id": "candidate cluster id",
  "duplicate_evidence_ids": [],
  "contradiction_evidence_ids": []
}
```

### CandidateDossier

```json
{
  "candidate_id": "stable id",
  "name": "candidate name",
  "candidate_type": "repo|system|framework|method",
  "source_refs": [],
  "summary": "what it is",
  "problem_solved": "what it actually solves",
  "value_hypothesis": "why it matters",
  "baggage_signals": [],
  "adoption_target_hint": "discovery|architecture|runtime|monitor|reference",
  "usefulness_level_hint": "direct|structural|meta",
  "evidence_ids": [],
  "evidence_cluster_count": 4,
  "duplicate_evidence_count": 1,
  "contradiction_flags": [],
  "evidence_cluster_summary": [],
  "scorecard": {}
}
```

### RejectionRecord

```json
{
  "candidate_id": "stable id",
  "reason": "why rejected",
  "evidence_ids": [],
  "reconsider_if": "trigger for reopening"
}
```

## 8. Scoring Model

Research Engine should not use a vague single score.
It should use a visible scorecard.

Suggested dimensions:

- mission fit
- evidence density
- implementation leverage
- self-hostability
- composability
- maintenance health
- baggage penalty
- adoption clarity

Output form:

```json
{
  "total": 78,
  "breakdown": {
    "mission_fit": 18,
    "evidence_density": 14,
    "implementation_leverage": 16,
    "self_hostability": 10,
    "composability": 12,
    "maintenance_health": 8,
    "baggage_penalty": -6,
    "adoption_clarity": 6
  },
  "rationale": [
    "Strong mission fit for source acquisition and evidence assembly",
    "Clean reusable workflow boundary",
    "Dependency surface is manageable",
    "UI/product baggage is significant"
  ]
}
```

This keeps scoring inspectable and makes later DW usefulness/routing review easier.

## 9. Mapping To Directive Workspace

Research Engine should emit a DW bridge artifact rather than trying to emit final lane records directly.

### DW bridge packet

The packet should provide:

- `candidate_id`
- `candidate_name`
- `source_type`
- `source_reference`
- `mission_relevance`
- `source_kind`
- `initial_value_hypothesis`
- `initial_baggage_signals`
- `capability_gap_hint`
- `evidence_bundle_refs`
- `evidence_cluster_summary`
- `contradiction_flags`
- `rejection_or_hold_reasons`
- `provenance_summary`
- `discovery_signal_band`
- `signal_total_score`
- `signal_score_summary`
- `freshness_summary`
- `uncertainty_notes`

The DW packet should not carry route authority or downstream adoption hints.
Those remain Research Engine-internal judgment aids and Discovery-review inputs, not Directive Workspace decisions.
It should carry one compact RE-owned signal summary so Discovery can triage imported candidates without opening the full dossier set first.

The packet should also carry explicit contract metadata:

- `packet_kind`
- `contract_version`
- `generated_at`
- `decision_boundary`

This is intentionally close to:

- Discovery fast-path prep
- Discovery to Architecture handoff
- Architecture source-analysis preparation

but remains Research Engine-owned and standalone.

## 10. DW-Compatible Output Set

Research Engine V1 should emit:

- `artifacts/research_record.json`
- `artifacts/query_plan.json`
- `artifacts/discovery_hits.jsonl`
- `artifacts/evidence_bundle.jsonl`
- `artifacts/candidate_dossiers.json`
- `artifacts/rejections.json`
- `artifacts/source_intelligence_packet.json`
- `artifacts/recommendations.md`
- `artifacts/dw_discovery_packet.json`
- `artifacts/dw_import_bundle.json`

### Why this set is correct

- `research_record.json` is the full run truth
- `evidence_bundle.jsonl` is the inspectable evidence substrate
- `candidate_dossiers.json` is the review surface
- `rejections.json` prevents survivorship bias
- `dw_discovery_packet.json` is the integration seam
- `dw_import_bundle.json` is the bounded Discovery import manifest for shadow integration

## 11. Recommended Technical Stack

Use a small Python stack:

- Python 3.11+
- Pydantic v2
- Typer
- httpx
- orjson
- Jinja2 or plain Markdown templates
- pytest

Provider adapters:

- Exa or Tavily for search
- GitHub API for repo metadata
- Firecrawl for extraction
- optional SearXNG fallback for self-hosted search

Do not make LangGraph mandatory in V1.
Do not make vector databases mandatory in V1.
Do not make browser automation mandatory in V1.

## 12. Recommended Reuse From Reference Repos

### Use Open Deep Research for

- typed configuration boundaries
- explicit stage decomposition
- search-tool seams
- future MCP-friendly structure

### Use GPT Researcher for

- sub-query planning ideas
- retriever/scraper separation
- source curation concepts
- deep multi-source evidence assembly

### Use dzhng/deep-research for

- size discipline
- recursive bounded research
- strong reuse of external acquisition plumbing

### Use local-deep-researcher for

- simple reflect-and-refine loop ideas

### Use Vane for

- inspectable search-step UX ideas only

## 13. Guardrails

Research Engine must not drift into:

- answer-first behavior
- product-chat UX work
- generic agent shells
- Runtime-like execution
- Architecture proof orchestration
- hidden scoring
- output without evidence

The main anti-drift rule:

If a stage does not improve source finding, evidence quality, candidate judgment, or DW handoff quality, it should not be in V1.

## 14. Smallest Useful V1

Build one bounded vertical slice:

Input:

- mission: find reusable systems for deep source discovery and evidence assembly

Pipeline:

- generate queries
- search web and GitHub
- fetch top candidates
- normalize evidence
- score candidates
- emit dossiers and DW packet

Expected output:

- ranked dossiers for the chosen source pool
- explicit rejected candidates
- explicit uncertainty notes
- one DW-compatible packet for downstream Discovery use

## 15. First Implementation Slice

### Goal

Produce a standalone research run that evaluates the Research Engine source pool and emits DW-compatible artifacts.

### Initial modules

- `src/research_engine/models.py`
- `src/research_engine/mission.py`
- `src/research_engine/planning.py`
- `src/research_engine/discovery.py`
- `src/research_engine/fetch.py`
- `src/research_engine/normalize.py`
- `src/research_engine/score.py`
- `src/research_engine/export.py`
- `src/research_engine/cli.py`

### Stop line

Stop when the system can:

- accept a mission
- discover candidate systems
- fetch usable evidence
- produce inspectable candidate dossiers
- emit a `dw_discovery_packet.json`

Do not add:

- UI
- local-model mode
- general browser automation
- Directive Engine emulation
- Runtime lane execution
- Architecture proof generation

## 16. Bottom Line

Research Engine should be built as:

- a Discovery-owned source-discovery and evidence-assembly capability
- artifact-first
- DW-aware
- Discovery-aligned
- not coupled to DW route or adoption authority

The correct integration posture is:

Research Engine finds and structures external value.
Directive Workspace decides what to do with it.
