from __future__ import annotations

import re

from research_engine.catalog import REFERENCE_CATALOG
from research_engine.models import DiscoveryHit, ResearchMission, SearchPlan


def _normalize_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _known_state(entry_name: str, entry_id: str, mission: ResearchMission) -> int:
    normalized_values = {_normalize_label(entry_name), _normalize_label(entry_id)}
    baseline = {_normalize_label(value) for value in mission.known_baseline_names}
    anchors = {_normalize_label(value) for value in mission.known_candidate_anchor_names}
    if normalized_values & baseline:
        return 2
    if normalized_values & anchors:
        return 1
    return 0


def discover_candidates(plan: SearchPlan, mission: ResearchMission) -> list[DiscoveryHit]:
    hits: list[DiscoveryHit] = []
    seen_ids: set[str] = set()
    exclude_tokens = {token.lower() for token in mission.constraints.exclude_keywords}
    for query in plan.queries:
        query_terms = set(query.text.lower().split())
        query_matches = []
        for entry in REFERENCE_CATALOG:
            keyword_terms = set(" ".join(entry.keywords).lower().split())
            matched_terms = sorted(query_terms & keyword_terms)
            if not matched_terms:
                continue
            if exclude_tokens & keyword_terms:
                continue
            query_matches.append((entry, matched_terms))
        query_matches.sort(
            key=lambda item: (
                _known_state(item[0].name, item[0].candidate_id, mission),
                -len(item[1]),
                -sum(item[0].score_hint.values()),
                item[0].candidate_id,
            )
        )
        for entry, matched_terms in query_matches:
            if entry.candidate_id in seen_ids:
                continue
            hits.append(
                DiscoveryHit(
                    provider="catalog",
                    track_id=query.track_id,
                    query=query.text,
                    url=entry.repository_url,
                    title=entry.name,
                    snippet=entry.summary,
                    hit_type="repo",
                    candidate_id=entry.candidate_id,
                    matched_terms=matched_terms,
                )
            )
            seen_ids.add(entry.candidate_id)
        if len(hits) >= mission.constraints.max_candidates:
            break
    return hits[: mission.constraints.max_candidates]
