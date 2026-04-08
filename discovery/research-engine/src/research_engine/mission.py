from __future__ import annotations

import json
from pathlib import Path

from research_engine.models import MissionConstraints, ResearchMission, TrustPreferences


def _load_default_source_intelligence_context() -> dict[str, list[str]]:
    context_path = Path(__file__).with_name("default_source_intelligence_context.json")
    return json.loads(context_path.read_text(encoding="utf-8"))


def default_mission() -> ResearchMission:
    context = _load_default_source_intelligence_context()
    return ResearchMission(
        objective=(
            "Find reusable open-source systems for bounded external research, source discovery, "
            "evidence assembly, and later Directive Workspace Discovery integration."
        ),
        planning_preset="balanced-discovery",
        required_track_ids=[],
        excluded_track_ids=[],
        required_query_types_by_track={},
        excluded_query_types_by_track={},
        track_provider_preferences={},
        known_baseline_names=context.get("known_baseline_names", []),
        known_candidate_anchor_names=context.get("known_candidate_anchor_names", []),
        constraints=MissionConstraints(
            exclude_domains=[],
            exclude_keywords=["consumer chat", "general-purpose agent shell"],
            time_budget_minutes=30,
            max_queries=8,
            max_candidates=10,
            max_fetches=20,
            max_requests=240,
            per_provider_max_requests={},
        ),
        trust_preferences=TrustPreferences(
            policy_preset="balanced-discovery",
            prefer_official_docs=True,
            prefer_active_repos=True,
            prefer_self_hostable=True,
        ),
    )


def load_mission(path: Path) -> ResearchMission:
    payload = json.loads(path.read_text(encoding="utf-8"))
    constraints = MissionConstraints(**payload.get("constraints", {}))
    trust_preferences = TrustPreferences(**payload.get("trust_preferences", {}))
    return ResearchMission(
        mission_id=payload.get("mission_id", "custom-mission"),
        objective=payload["objective"],
        planning_preset=payload.get(
            "planning_preset",
            trust_preferences.policy_preset or "balanced-discovery",
        ),
        required_track_ids=payload.get("required_track_ids", []),
        excluded_track_ids=payload.get("excluded_track_ids", []),
        required_query_types_by_track=payload.get("required_query_types_by_track", {}),
        excluded_query_types_by_track=payload.get("excluded_query_types_by_track", {}),
        track_provider_preferences=payload.get("track_provider_preferences", {}),
        subsystem_gap=payload.get(
            "subsystem_gap",
            "Need a bounded source-finding and evidence-assembly subsystem.",
        ),
        known_baseline_names=payload.get("known_baseline_names", []),
        known_candidate_anchor_names=payload.get("known_candidate_anchor_names", []),
        exclusion_rules=payload.get("exclusion_rules", []),
        constraints=constraints,
        trust_preferences=trust_preferences,
    )
