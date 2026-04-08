from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SOURCE_INTELLIGENCE_PACKET_KIND = "research_engine.source_intelligence_packet"
DW_DISCOVERY_PACKET_KIND = "research_engine.dw_discovery_packet"
DW_IMPORT_BUNDLE_KIND = "research_engine.dw_import_bundle"
SOURCE_INTELLIGENCE_PACKET_CONTRACT_VERSION = 1
DW_DISCOVERY_PACKET_CONTRACT_VERSION = 1
DW_IMPORT_BUNDLE_CONTRACT_VERSION = 1


def utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def to_jsonable(value: Any) -> Any:
    if is_dataclass(value):
        return {key: to_jsonable(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    return value


@dataclass(slots=True)
class MissionConstraints:
    include_domains: list[str] = field(default_factory=list)
    exclude_domains: list[str] = field(default_factory=list)
    exclude_keywords: list[str] = field(default_factory=list)
    time_budget_minutes: int = 30
    max_queries: int = 8
    max_candidates: int = 10
    max_fetches: int = 20
    max_requests: int = 240
    per_provider_max_requests: dict[str, int] = field(default_factory=dict)


@dataclass(slots=True)
class TrustPreferences:
    policy_preset: str = "balanced-discovery"
    prefer_official_docs: bool = True
    prefer_active_repos: bool = True
    prefer_self_hostable: bool = True
    source_type_overrides: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class ResearchMission:
    objective: str
    mission_id: str = "research-engine-reference-pool"
    planning_preset: str = "balanced-discovery"
    required_track_ids: list[str] = field(default_factory=list)
    excluded_track_ids: list[str] = field(default_factory=list)
    required_query_types_by_track: dict[str, list[str]] = field(default_factory=dict)
    excluded_query_types_by_track: dict[str, list[str]] = field(default_factory=dict)
    track_provider_preferences: dict[str, list[str]] = field(default_factory=dict)
    subsystem_gap: str = (
        "Need a bounded source-finding and evidence-assembly subsystem for engineering research."
    )
    known_baseline_names: list[str] = field(default_factory=list)
    known_candidate_anchor_names: list[str] = field(default_factory=list)
    exclusion_rules: list[str] = field(
        default_factory=lambda: [
            "Do not build a search engine from scratch",
            "Do not optimize for consumer chat UX",
            "Do not include runtime execution concerns",
        ]
    )
    trust_preferences: TrustPreferences = field(default_factory=TrustPreferences)
    constraints: MissionConstraints = field(default_factory=MissionConstraints)
    generated_at: str = field(default_factory=utc_now_iso)


@dataclass(slots=True)
class SearchQuery:
    query_id: str
    track_id: str
    query_type: str
    text: str
    rationale: str


@dataclass(slots=True)
class SearchTrack:
    track_id: str
    name: str
    intent: str
    priority: int
    provider_hint: str


@dataclass(slots=True)
class SearchPlan:
    mission_id: str
    planning_preset: str
    required_track_ids: list[str]
    excluded_track_ids: list[str]
    required_query_types_by_track: dict[str, list[str]]
    excluded_query_types_by_track: dict[str, list[str]]
    track_provider_preferences: dict[str, list[str]]
    selected_acquisition_mode: str
    tracks: list[SearchTrack]
    queries: list[SearchQuery]
    planning_notes: list[str]


@dataclass(slots=True)
class DiscoveryHit:
    provider: str
    track_id: str
    query: str
    url: str
    title: str
    snippet: str
    hit_type: str
    candidate_id: str
    matched_terms: list[str]


@dataclass(slots=True)
class SourceFact:
    fact_type: str
    confidence: str
    excerpt: str
    notes: list[str] = field(default_factory=list)
    extraction_fidelity: str = "direct"


@dataclass(slots=True)
class SourceDocument:
    candidate_id: str
    source_url: str
    source_type: str
    title: str
    summary: str
    provider: str
    track_id: str
    fetched_at: str
    facts: list[SourceFact]


@dataclass(slots=True)
class EvidenceItem:
    evidence_id: str
    candidate_id: str
    source_url: str
    source_type: str
    title: str
    excerpt: str
    fact_type: str
    confidence: str
    captured_at: str
    matched_via: str
    trust_signal: str
    rejection_flags: list[str]
    notes: list[str]
    extraction_fidelity: str
    source_updated_at: str | None
    source_age_days: int | None
    freshness_signal: str
    cluster_id: str
    duplicate_evidence_ids: list[str]
    contradiction_evidence_ids: list[str]


@dataclass(slots=True)
class ScoreCard:
    total: int
    breakdown: dict[str, int]
    rationale: list[str]


@dataclass(slots=True)
class CandidateDossier:
    candidate_id: str
    name: str
    candidate_type: str
    source_refs: list[str]
    summary: str
    problem_solved: str
    value_hypothesis: str
    baggage_signals: list[str]
    adoption_target_hint: str
    usefulness_level_hint: str
    capability_gap_hint: str
    evidence_ids: list[str]
    evidence_cluster_count: int
    duplicate_evidence_count: int
    contradiction_flags: list[str]
    evidence_cluster_summary: list[str]
    provenance_summary: list[str]
    extraction_fidelity_summary: str
    fallback_evidence_count: int
    freshness_summary: str
    freshness_signal: str
    freshest_source_updated_at: str | None
    freshest_source_age_days: int | None
    rejection_flags: list[str]
    reconsideration_triggers: list[str]
    scorecard: ScoreCard | None


@dataclass(slots=True)
class RejectionRecord:
    candidate_id: str
    reason: str
    evidence_ids: list[str]
    reconsider_if: str
    derived_flags: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ProviderHealth:
    provider: str
    discovery_queries: int
    discovery_hits: int
    fetch_attempts: int
    fetch_successes: int
    fetch_failures: int
    fallback_used: bool
    status: str = "healthy"
    request_attempts: int = 0
    request_successes: int = 0
    retry_attempts: int = 0
    timeout_count: int = 0
    backoff_events: int = 0
    total_backoff_seconds: float = 0.0
    max_backoff_seconds: float = 0.0
    reason_codes: list[str] = field(default_factory=list)
    status_summary: str = ""
    notes: list[str] = field(default_factory=list)
    budget_max_requests: int | None = None
    budget_used_requests: int | None = None
    budget_exhaustion_events: list[str] = field(default_factory=list)


@dataclass(slots=True)
class DwCandidatePacket:
    candidate_id: str
    candidate_name: str
    source_type: str
    source_reference: str
    mission_relevance: str
    source_kind: str
    initial_value_hypothesis: str
    initial_baggage_signals: list[str]
    capability_gap_hint: str
    evidence_bundle_refs: list[str]
    evidence_cluster_summary: list[str]
    contradiction_flags: list[str]
    rejection_or_hold_reasons: list[str]
    provenance_summary: list[str]
    discovery_signal_band: str
    signal_total_score: int | None
    signal_score_summary: str
    freshness_summary: str
    freshness_signal: str
    freshest_source_updated_at: str | None
    freshest_source_age_days: int | None
    structural_signal_band: str
    structural_signal_summary: str
    workflow_phase_labels: list[str]
    provider_seam_summary: str | None
    workflow_boundary_shape_hint: str | None
    recommended_lane_target: str | None
    lane_target_rationale: str | None
    workflow_phase_scores: dict[str, int]
    structural_extraction_recommendations: list[str]
    structural_avoid_recommendations: list[str]
    review_guidance_summary: str
    review_guidance_action: str
    review_guidance_stop_line: str
    uncertainty_notes: list[str]


@dataclass(slots=True)
class DwDiscoveryPacket:
    packet_kind: str
    contract_version: int
    mission_id: str
    generated_at: str
    decision_boundary: str
    candidates: list[DwCandidatePacket]
    holds_and_rejections: list[DwCandidatePacket]


@dataclass(slots=True)
class ResearchRecord:
    mission: ResearchMission
    plan: SearchPlan
    trust_policy: dict[str, str]
    acquisition_notes: list[str]
    provider_health: list[ProviderHealth]
    discovery_hits: list[DiscoveryHit]
    source_documents: list[SourceDocument]
    evidence_bundle: list[EvidenceItem]
    candidates: list[CandidateDossier]
    rejections: list[RejectionRecord]
    dw_discovery_packet: DwDiscoveryPacket
    generated_at: str = field(default_factory=utc_now_iso)
