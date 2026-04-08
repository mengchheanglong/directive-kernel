from __future__ import annotations

import re

from research_engine.models import ResearchMission, SearchPlan, SearchQuery, SearchTrack

PLANNING_PRESET_ALIASES = {
    "balanced": "balanced-discovery",
    "default": "balanced-discovery",
    "official": "official-first",
    "implementation": "implementation-scout",
    "survey": "landscape-survey",
}
PROVIDER_PREFERENCE_ALIASES = {
    "github": "github",
    "github-live": "github",
    "gitlab": "gitlab",
    "gitlab-live": "gitlab",
    "tavily": "tavily",
    "tavily-live": "tavily",
    "exa": "exa",
    "exa-live": "exa",
    "firecrawl": "firecrawl",
    "firecrawl-live": "firecrawl",
    "web": "web",
    "web-live": "web",
    "web-docs": "web",
}

MISSION_DIVERSIFICATION_STOP_TERMS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "through",
    "without",
    "about",
    "find",
    "need",
    "system",
    "systems",
    "source",
    "sources",
    "research",
    "workflow",
    "workflows",
    "open",
    "opensource",
}
MISSION_DIVERSIFICATION_MAX_NEW_QUERIES = 2
MISSION_DIVERSIFICATION_TERMS_PER_QUERY = 3

TRACK_LIBRARY = {
    "official-docs": {
        "name": "Official Docs",
        "intent": "Prioritize primary documentation and project-owned materials.",
        "priority": 1,
        "provider_hint": "web-docs",
    },
    "api-docs": {
        "name": "API Docs",
        "intent": "Look for inspectable API surfaces and integration boundaries.",
        "priority": 1,
        "provider_hint": "web-docs",
    },
    "github-repos": {
        "name": "GitHub Repos",
        "intent": "Find maintainable source repos and implementation surfaces.",
        "priority": 1,
        "provider_hint": "github",
    },
    "architecture-patterns": {
        "name": "Architecture Patterns",
        "intent": "Find workflow and orchestration patterns that can be borrowed safely.",
        "priority": 2,
        "provider_hint": "web-architecture",
    },
    "comparisons": {
        "name": "Comparisons",
        "intent": "Surface differentiating tradeoffs and simplification pressure.",
        "priority": 3,
        "provider_hint": "web-general",
    },
}

TRACK_QUERY_LIBRARY = {
    "official-docs": [
        (
            "official-docs",
            "official documentation open source deep research workflow provider abstraction",
            "Find project-owned docs that explain architecture and provider boundaries directly.",
        )
    ],
    "api-docs": [
        (
            "api-docs",
            "api docs source discovery research pipeline provider adapters",
            "Capture explicit interface boundaries before reading community summaries.",
        )
    ],
    "github-repos": [
        (
            "repo-discovery",
            "open source deep research workflow source discovery evidence assembly",
            "Find repos that already treat research as a multi-stage workflow.",
        )
    ],
    "architecture-patterns": [
        (
            "implementation-patterns",
            "minimal deep research recursive search firecrawl repo",
            "Find simplification references that prove the smallest useful deep-research loop.",
        )
    ],
    "comparisons": [
        (
            "comparison",
            "open source deep research frameworks comparison self hosted",
            "Map the major reusable approaches before choosing a donor system.",
        )
    ],
}


def normalize_planning_preset_name(name: str) -> str:
    normalized = (name or "").strip().lower()
    if not normalized:
        return "balanced-discovery"
    return PLANNING_PRESET_ALIASES.get(normalized, normalized)


def _normalize_track_ids(track_ids: list[str]) -> list[str]:
    normalized_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in track_ids:
        track_id = (raw_id or "").strip().lower()
        if not track_id or track_id in seen:
            continue
        normalized_ids.append(track_id)
        seen.add(track_id)
    return normalized_ids


def _normalize_query_type_map(query_types_by_track: dict[str, list[str]]) -> dict[str, list[str]]:
    normalized_map: dict[str, list[str]] = {}
    for raw_track_id, raw_query_types in query_types_by_track.items():
        track_id = (raw_track_id or "").strip().lower()
        if not track_id:
            continue
        normalized_query_types: list[str] = []
        seen: set[str] = set()
        for raw_query_type in raw_query_types:
            query_type = (raw_query_type or "").strip().lower()
            if not query_type or query_type in seen:
                continue
            normalized_query_types.append(query_type)
            seen.add(query_type)
        if normalized_query_types:
            normalized_map[track_id] = normalized_query_types
    return normalized_map


def _normalize_provider_preference_map(
    provider_preferences_by_track: dict[str, list[str]],
) -> dict[str, list[str]]:
    normalized_map: dict[str, list[str]] = {}
    for raw_track_id, raw_preferences in provider_preferences_by_track.items():
        track_id = (raw_track_id or "").strip().lower()
        if not track_id:
            continue
        normalized_preferences: list[str] = []
        seen: set[str] = set()
        for raw_preference in raw_preferences:
            candidate = (raw_preference or "").strip().lower()
            normalized = PROVIDER_PREFERENCE_ALIASES.get(candidate)
            if normalized is None or normalized in seen:
                continue
            normalized_preferences.append(normalized)
            seen.add(normalized)
        if normalized_preferences:
            normalized_map[track_id] = normalized_preferences
    return normalized_map


def _default_provider_preferences_for_tracks(tracks: list[SearchTrack]) -> dict[str, list[str]]:
    defaults: dict[str, list[str]] = {}
    for track in tracks:
        hint = track.provider_hint.strip().lower()
        if "github" in hint:
            defaults[track.track_id] = ["github", "gitlab", "exa", "tavily", "firecrawl", "web"]
        elif "web" in hint:
            defaults[track.track_id] = ["exa", "tavily", "firecrawl", "web", "github", "gitlab"]
        else:
            defaults[track.track_id] = ["github", "gitlab", "exa", "tavily", "firecrawl", "web"]
    return defaults


def _resolve_track_provider_preferences(
    tracks: list[SearchTrack],
    provider_preferences_by_track: dict[str, list[str]],
) -> tuple[dict[str, list[str]], list[str]]:
    notes: list[str] = []
    defaults = _default_provider_preferences_for_tracks(tracks)
    normalized_overrides = _normalize_provider_preference_map(provider_preferences_by_track)
    track_ids = {track.track_id for track in tracks}
    for track_id, preferences in normalized_overrides.items():
        if track_id not in track_ids:
            notes.append(f"Unknown provider-preference track ignored: {track_id}.")
            continue
        defaults[track_id] = preferences
        notes.append(
            f"Applied provider preference for {track_id}: {', '.join(preferences)}."
        )
    return defaults, notes


def _track_from_library(track_id: str) -> SearchTrack | None:
    template = TRACK_LIBRARY.get(track_id)
    if template is None:
        return None
    return SearchTrack(
        track_id=track_id,
        name=template["name"],
        intent=template["intent"],
        priority=template["priority"],
        provider_hint=template["provider_hint"],
    )


def _query_templates_for_track(track_id: str) -> list[SearchQuery]:
    templates = TRACK_QUERY_LIBRARY.get(track_id, [])
    return [
        SearchQuery(
            query_id=f"{track_id}-template-{index}",
            track_id=track_id,
            query_type=query_type,
            text=text,
            rationale=rationale,
        )
        for index, (query_type, text, rationale) in enumerate(templates, start=1)
    ]


def _query_template_for_track_and_type(track_id: str, query_type: str) -> SearchQuery | None:
    for template in _query_templates_for_track(track_id):
        if template.query_type == query_type:
            return template
    return None


def _unique_query_id(base_id: str, existing_ids: set[str]) -> str:
    if base_id not in existing_ids:
        return base_id
    index = 2
    while f"{base_id}-{index}" in existing_ids:
        index += 1
    return f"{base_id}-{index}"


def _apply_track_overrides(
    tracks: list[SearchTrack],
    queries: list[SearchQuery],
    required_track_ids: list[str],
    excluded_track_ids: list[str],
) -> tuple[list[SearchTrack], list[SearchQuery], list[str], list[str], list[str]]:
    notes: list[str] = []
    required_ids = _normalize_track_ids(required_track_ids)
    excluded_ids = _normalize_track_ids(excluded_track_ids)

    conflicting_ids = [track_id for track_id in required_ids if track_id in excluded_ids]
    if conflicting_ids:
        notes.append(
            "Required tracks override exclusions for: " + ", ".join(conflicting_ids) + "."
        )

    required_set = set(required_ids)
    resolved_excluded_ids = [track_id for track_id in excluded_ids if track_id not in required_set]
    excluded_set = set(resolved_excluded_ids)

    track_map = {track.track_id: track for track in tracks if track.track_id not in excluded_set}
    for required_id in required_ids:
        if required_id in track_map:
            continue
        required_track = _track_from_library(required_id)
        if required_track is None:
            notes.append(f"Unknown required track ignored: {required_id}.")
            continue
        track_map[required_id] = required_track
        notes.append(f"Added required track: {required_id}.")

    resolved_required_ids = [track_id for track_id in required_ids if track_id in track_map]
    filtered_queries = [query for query in queries if query.track_id in track_map]
    existing_query_ids = {query.query_id for query in filtered_queries}
    for required_id in resolved_required_ids:
        if any(query.track_id == required_id for query in filtered_queries):
            continue
        templates = _query_templates_for_track(required_id)
        if not templates:
            notes.append(f"Required track has no query templates: {required_id}.")
            continue
        required_query = templates[0]
        required_query.query_id = _unique_query_id(
            f"{required_id}-required-1",
            existing_query_ids,
        )
        existing_query_ids.add(required_query.query_id)
        filtered_queries.append(required_query)
        notes.append(f"Added required query seed for track: {required_id}.")

    return list(track_map.values()), filtered_queries, notes, resolved_required_ids, resolved_excluded_ids


def _apply_query_type_overrides(
    queries: list[SearchQuery],
    tracks: list[SearchTrack],
    required_query_types_by_track: dict[str, list[str]],
    excluded_query_types_by_track: dict[str, list[str]],
) -> tuple[list[SearchQuery], list[str], dict[str, list[str]], dict[str, list[str]]]:
    notes: list[str] = []
    track_ids = {track.track_id for track in tracks}
    required_map = _normalize_query_type_map(required_query_types_by_track)
    excluded_map = _normalize_query_type_map(excluded_query_types_by_track)

    resolved_required_map: dict[str, list[str]] = {}
    for track_id, query_types in required_map.items():
        if track_id not in track_ids:
            notes.append(f"Unknown required query-type track ignored: {track_id}.")
            continue
        resolved_required_map[track_id] = query_types

    resolved_excluded_map: dict[str, list[str]] = {}
    for track_id, query_types in excluded_map.items():
        if track_id not in track_ids:
            notes.append(f"Unknown excluded query-type track ignored: {track_id}.")
            continue
        required_types = set(resolved_required_map.get(track_id, []))
        conflicting_types = [query_type for query_type in query_types if query_type in required_types]
        if conflicting_types:
            notes.append(
                f"Required query types override exclusions for {track_id}: {', '.join(conflicting_types)}."
            )
        remaining_excluded = [query_type for query_type in query_types if query_type not in required_types]
        if remaining_excluded:
            resolved_excluded_map[track_id] = remaining_excluded

    filtered_queries = [
        query
        for query in queries
        if query.query_type
        not in set(resolved_excluded_map.get(query.track_id, []))
    ]
    existing_query_ids = {query.query_id for query in filtered_queries}
    for track_id, required_query_types in resolved_required_map.items():
        for query_type in required_query_types:
            has_required_query = any(
                query.track_id == track_id and query.query_type == query_type
                for query in filtered_queries
            )
            if has_required_query:
                continue
            required_query = _query_template_for_track_and_type(track_id, query_type)
            if required_query is None:
                notes.append(
                    f"Required query type has no template for {track_id}: {query_type}."
                )
                continue
            required_query.query_id = _unique_query_id(
                f"{track_id}-{query_type}-required-1",
                existing_query_ids,
            )
            existing_query_ids.add(required_query.query_id)
            filtered_queries.append(required_query)
            notes.append(
                f"Added required query type for {track_id}: {query_type}."
            )

    return filtered_queries, notes, resolved_required_map, resolved_excluded_map


def _apply_query_budget(
    queries: list[SearchQuery],
    max_queries: int,
    required_track_ids: list[str],
    required_query_types_by_track: dict[str, list[str]],
) -> tuple[list[SearchQuery], list[str]]:
    if max_queries <= 0:
        return [], ["Mission max_queries is 0; query plan intentionally empty."]
    if len(queries) <= max_queries:
        return queries, []

    notes: list[str] = []
    first_required_query_ids: list[str] = []
    for required_track_id, required_query_types in required_query_types_by_track.items():
        for required_query_type in required_query_types:
            required_query = next(
                (
                    query
                    for query in queries
                    if query.track_id == required_track_id and query.query_type == required_query_type
                ),
                None,
            )
            if required_query is not None:
                first_required_query_ids.append(required_query.query_id)
    for required_track_id in required_track_ids:
        required_query = next(
            (query for query in queries if query.track_id == required_track_id),
            None,
        )
        if required_query is not None:
            first_required_query_ids.append(required_query.query_id)

    selected_queries: list[SearchQuery] = []
    selected_ids: set[str] = set()
    for query in queries:
        if query.query_id not in first_required_query_ids:
            continue
        if query.query_id in selected_ids:
            continue
        selected_queries.append(query)
        selected_ids.add(query.query_id)

    if len(selected_queries) > max_queries:
        selected_queries = selected_queries[:max_queries]
        notes.append(
            "Query budget is lower than required-track coverage; truncated required tracks to fit max_queries."
        )
        return selected_queries, notes

    for query in queries:
        if len(selected_queries) >= max_queries:
            break
        if query.query_id in selected_ids:
            continue
        selected_queries.append(query)
        selected_ids.add(query.query_id)

    if len(selected_queries) < len(queries):
        notes.append(
            f"Query budget truncated plan to {len(selected_queries)}/{len(queries)} queries."
        )
    return selected_queries, notes


def _query_text_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _keyword_terms(value: str) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for token in re.findall(r"[a-z0-9][a-z0-9-]+", value.lower()):
        if token in seen:
            continue
        if len(token) < 4:
            continue
        if token in MISSION_DIVERSIFICATION_STOP_TERMS:
            continue
        terms.append(token)
        seen.add(token)
    return terms


def _apply_mission_query_diversification(
    queries: list[SearchQuery],
    tracks: list[SearchTrack],
    mission: ResearchMission,
) -> tuple[list[SearchQuery], list[str], dict[str, str]]:
    notes: list[str] = []
    added_notes_by_query_id: dict[str, str] = {}
    if mission.constraints.max_queries <= len(queries):
        notes.append("Mission diversification skipped: query budget already saturated.")
        return queries, notes, added_notes_by_query_id

    mission_terms = _keyword_terms(mission.objective)
    if not mission_terms:
        notes.append("Mission diversification skipped: objective has no novel diversification terms.")
        return queries, notes, added_notes_by_query_id

    prioritized_tracks = sorted(
        tracks,
        key=lambda track: (track.priority, track.track_id),
    )
    diversified_queries = list(queries)
    existing_ids = {query.query_id for query in diversified_queries}
    existing_text_keys = {_query_text_key(query.text) for query in diversified_queries}

    added = 0
    for track in prioritized_tracks:
        if added >= MISSION_DIVERSIFICATION_MAX_NEW_QUERIES:
            break
        base_query = next((query for query in queries if query.track_id == track.track_id), None)
        if base_query is None:
            continue

        base_terms = set(_keyword_terms(base_query.text))
        novel_terms = [term for term in mission_terms if term not in base_terms]
        if len(novel_terms) < 2:
            continue

        term_slice = novel_terms[:MISSION_DIVERSIFICATION_TERMS_PER_QUERY]
        diversified_text = re.sub(
            r"\s+",
            " ",
            f"{base_query.text} {' '.join(term_slice)}",
        ).strip()
        diversified_text_key = _query_text_key(diversified_text)
        if diversified_text_key in existing_text_keys:
            continue

        query_id = _unique_query_id(f"{base_query.query_id}-mission", existing_ids)
        existing_ids.add(query_id)
        existing_text_keys.add(diversified_text_key)
        diversified_queries.append(
            SearchQuery(
                query_id=query_id,
                track_id=base_query.track_id,
                query_type=base_query.query_type,
                text=diversified_text,
                rationale=(
                    f"{base_query.rationale} "
                    "Mission-conditioned diversification adds bounded objective terms for stronger recall."
                ),
            )
        )
        added_notes_by_query_id[query_id] = (
            f"Added mission-diversified query for {track.track_id}: {', '.join(term_slice)}."
        )
        added += 1

    if added == 0:
        notes.append("Mission diversification skipped: no bounded novel terms survived track-level checks.")
    return diversified_queries, notes, added_notes_by_query_id


def _balanced_discovery_plan() -> tuple[list[SearchTrack], list[SearchQuery], list[str]]:
    tracks = [
        SearchTrack(
            track_id="official-docs",
            name="Official Docs",
            intent="Prioritize primary documentation and project-owned materials.",
            priority=1,
            provider_hint="web-docs",
        ),
        SearchTrack(
            track_id="github-repos",
            name="GitHub Repos",
            intent="Find maintainable source repos and implementation surfaces.",
            priority=1,
            provider_hint="github",
        ),
        SearchTrack(
            track_id="architecture-patterns",
            name="Architecture Patterns",
            intent="Find workflow and orchestration patterns that can be borrowed safely.",
            priority=2,
            provider_hint="web-architecture",
        ),
        SearchTrack(
            track_id="comparisons",
            name="Comparisons",
            intent="Surface differentiating tradeoffs and simplification pressure.",
            priority=3,
            provider_hint="web-general",
        ),
    ]
    queries = [
        SearchQuery(
            query_id="official-docs-1",
            track_id="official-docs",
            query_type="official-docs",
            text="official documentation open source deep research workflow provider abstraction",
            rationale="Find project-owned docs that explain architecture and provider boundaries directly.",
        ),
        SearchQuery(
            query_id="github-repos-1",
            track_id="github-repos",
            query_type="repo-discovery",
            text="open source deep research workflow source discovery evidence assembly",
            rationale="Find repos that already treat research as a multi-stage workflow.",
        ),
        SearchQuery(
            query_id="github-repos-2",
            track_id="github-repos",
            query_type="repo-discovery",
            text="self hosted research orchestration repo search provider abstraction mcp",
            rationale="Find reusable orchestration and provider-boundary patterns.",
        ),
        SearchQuery(
            query_id="architecture-patterns-1",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="minimal deep research recursive search firecrawl repo",
            rationale="Find simplification references that prove the smallest useful deep-research loop.",
        ),
        SearchQuery(
            query_id="architecture-patterns-2",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="local first deep research iterative reflection repo",
            rationale="Check whether local-first is strong enough for primary adoption or only a later option.",
        ),
        SearchQuery(
            query_id="comparisons-1",
            track_id="comparisons",
            query_type="comparison",
            text="self hosted answer engine searxng search mode source inspection",
            rationale="Capture UX-level inspiration without confusing it for the core architecture.",
        ),
    ]
    notes = [
        "Preset keeps primary sources, repos, architecture patterns, and comparison pressure in one bounded run.",
        "Use when the mission needs a broad Discovery pass instead of a single-source search posture.",
    ]
    return tracks, queries, notes


def _official_first_plan() -> tuple[list[SearchTrack], list[SearchQuery], list[str]]:
    tracks = [
        SearchTrack(
            track_id="official-docs",
            name="Official Docs",
            intent="Start from project-owned documentation before secondary commentary.",
            priority=1,
            provider_hint="web-docs",
        ),
        SearchTrack(
            track_id="api-docs",
            name="API Docs",
            intent="Look for inspectable API surfaces and integration boundaries.",
            priority=1,
            provider_hint="web-docs",
        ),
        SearchTrack(
            track_id="github-repos",
            name="GitHub Repos",
            intent="Confirm that documented systems still expose real implementation surfaces.",
            priority=2,
            provider_hint="github",
        ),
        SearchTrack(
            track_id="architecture-patterns",
            name="Architecture Patterns",
            intent="Borrow only patterns that are still anchored by primary documentation.",
            priority=3,
            provider_hint="web-architecture",
        ),
    ]
    queries = [
        SearchQuery(
            query_id="official-docs-1",
            track_id="official-docs",
            query_type="official-docs",
            text="official documentation open source deep research workflow provider abstraction",
            rationale="Begin with project-owned descriptions of the workflow and boundaries.",
        ),
        SearchQuery(
            query_id="official-docs-2",
            track_id="official-docs",
            query_type="official-docs",
            text="official docs evidence bundle artifact export discovery packet",
            rationale="Look for product-owned explanations of artifact and evidence contracts.",
        ),
        SearchQuery(
            query_id="api-docs-1",
            track_id="api-docs",
            query_type="api-docs",
            text="api docs source discovery research pipeline provider adapters",
            rationale="Capture explicit interface boundaries before reading community summaries.",
        ),
        SearchQuery(
            query_id="github-repos-1",
            track_id="github-repos",
            query_type="repo-discovery",
            text="official repo deep research source discovery evidence assembly",
            rationale="Cross-check documentation claims against live implementation surfaces.",
        ),
        SearchQuery(
            query_id="architecture-patterns-1",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="architecture docs typed research workflow phases provider boundary",
            rationale="Keep architecture pattern borrowing anchored to documented systems.",
        ),
    ]
    notes = [
        "Preset biases query volume toward project-owned docs and API descriptions before broader repo scanning.",
        "Use when evidence quality matters more than breadth and the mission already prefers primary sources.",
    ]
    return tracks, queries, notes


def _implementation_scout_plan() -> tuple[list[SearchTrack], list[SearchQuery], list[str]]:
    tracks = [
        SearchTrack(
            track_id="github-repos",
            name="GitHub Repos",
            intent="Maximize direct implementation discovery and reusable code surfaces.",
            priority=1,
            provider_hint="github",
        ),
        SearchTrack(
            track_id="architecture-patterns",
            name="Architecture Patterns",
            intent="Find implementation-level workflow shapes that can survive simplification.",
            priority=1,
            provider_hint="web-architecture",
        ),
        SearchTrack(
            track_id="official-docs",
            name="Official Docs",
            intent="Use docs as a confirmation layer instead of the primary search posture.",
            priority=2,
            provider_hint="web-docs",
        ),
        SearchTrack(
            track_id="comparisons",
            name="Comparisons",
            intent="Keep a thin tradeoff track without letting it dominate discovery.",
            priority=3,
            provider_hint="web-general",
        ),
    ]
    queries = [
        SearchQuery(
            query_id="github-repos-1",
            track_id="github-repos",
            query_type="repo-discovery",
            text="open source research orchestration repo source discovery evidence assembly",
            rationale="Find codebases that already decompose research into reusable stages.",
        ),
        SearchQuery(
            query_id="github-repos-2",
            track_id="github-repos",
            query_type="repo-discovery",
            text="self hosted research pipeline repo provider abstraction mcp",
            rationale="Find implementation seams around search providers and adapters.",
        ),
        SearchQuery(
            query_id="github-repos-3",
            track_id="github-repos",
            query_type="repo-discovery",
            text="bounded deep research repo typed state artifact export",
            rationale="Prioritize systems that already produce inspectable artifacts.",
        ),
        SearchQuery(
            query_id="architecture-patterns-1",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="minimal deep research recursive search repo",
            rationale="Look for the smallest useful implementation loops worth copying.",
        ),
        SearchQuery(
            query_id="architecture-patterns-2",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="evidence normalization candidate scoring repo workflow",
            rationale="Find repos that already expose post-acquisition judgment layers.",
        ),
        SearchQuery(
            query_id="official-docs-1",
            track_id="official-docs",
            query_type="official-docs",
            text="official docs architecture research workflow provider adapters",
            rationale="Validate implementation finds against project-owned explanations.",
        ),
    ]
    notes = [
        "Preset front-loads repo and implementation-pattern queries when reusable code shapes matter more than product positioning.",
        "Use when the mission is scouting for adoption-ready implementation seams.",
    ]
    return tracks, queries, notes


def _landscape_survey_plan() -> tuple[list[SearchTrack], list[SearchQuery], list[str]]:
    tracks = [
        SearchTrack(
            track_id="comparisons",
            name="Comparisons",
            intent="Start by mapping the landscape and differentiating tradeoffs.",
            priority=1,
            provider_hint="web-general",
        ),
        SearchTrack(
            track_id="official-docs",
            name="Official Docs",
            intent="Pull primary-source validation into the landscape pass.",
            priority=1,
            provider_hint="web-docs",
        ),
        SearchTrack(
            track_id="github-repos",
            name="GitHub Repos",
            intent="Sample implementation surfaces after the landscape is visible.",
            priority=2,
            provider_hint="github",
        ),
        SearchTrack(
            track_id="architecture-patterns",
            name="Architecture Patterns",
            intent="Capture shape-of-system references without overcommitting to one stack.",
            priority=2,
            provider_hint="web-architecture",
        ),
    ]
    queries = [
        SearchQuery(
            query_id="comparisons-1",
            track_id="comparisons",
            query_type="comparison",
            text="open source deep research frameworks comparison self hosted",
            rationale="Map the major reusable approaches before choosing a donor system.",
        ),
        SearchQuery(
            query_id="comparisons-2",
            track_id="comparisons",
            query_type="comparison",
            text="answer engine vs deep research evidence pipeline open source",
            rationale="Separate product-shell references from true evidence-pipeline systems.",
        ),
        SearchQuery(
            query_id="official-docs-1",
            track_id="official-docs",
            query_type="official-docs",
            text="official docs open source deep research workflow",
            rationale="Bring primary-source validation into the survey pass.",
        ),
        SearchQuery(
            query_id="github-repos-1",
            track_id="github-repos",
            query_type="repo-discovery",
            text="open source deep research workflow source discovery repo",
            rationale="Sample live implementation surfaces after the broad survey.",
        ),
        SearchQuery(
            query_id="architecture-patterns-1",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="local first deep research iterative reflection repo",
            rationale="Check if later-mode patterns are worth carrying into the option set.",
        ),
        SearchQuery(
            query_id="architecture-patterns-2",
            track_id="architecture-patterns",
            query_type="implementation-patterns",
            text="minimal research agent source acquisition architecture",
            rationale="Capture simplification references while the landscape is still wide.",
        ),
    ]
    notes = [
        "Preset starts wide with landscape and comparison pressure, then samples primary docs and repos for validation.",
        "Use when the mission needs option mapping more than immediate implementation adoption.",
    ]
    return tracks, queries, notes


def _plan_for_preset(preset_name: str) -> tuple[list[SearchTrack], list[SearchQuery], list[str]]:
    if preset_name == "official-first":
        return _official_first_plan()
    if preset_name == "implementation-scout":
        return _implementation_scout_plan()
    if preset_name == "landscape-survey":
        return _landscape_survey_plan()
    return _balanced_discovery_plan()


def build_search_plan(mission: ResearchMission) -> SearchPlan:
    preset_name = normalize_planning_preset_name(
        mission.planning_preset or mission.trust_preferences.policy_preset
    )
    tracks, queries, notes = _plan_for_preset(preset_name)
    (
        tracks,
        queries,
        override_notes,
        required_track_ids,
        excluded_track_ids,
    ) = _apply_track_overrides(
        tracks=tracks,
        queries=queries,
        required_track_ids=mission.required_track_ids,
        excluded_track_ids=mission.excluded_track_ids,
    )
    (
        queries,
        query_type_override_notes,
        required_query_types_by_track,
        excluded_query_types_by_track,
    ) = _apply_query_type_overrides(
        queries=queries,
        tracks=tracks,
        required_query_types_by_track=mission.required_query_types_by_track,
        excluded_query_types_by_track=mission.excluded_query_types_by_track,
    )
    (
        track_provider_preferences,
        provider_preference_notes,
    ) = _resolve_track_provider_preferences(
        tracks=tracks,
        provider_preferences_by_track=mission.track_provider_preferences,
    )
    queries, diversification_notes, diversification_added_notes = _apply_mission_query_diversification(
        queries=queries,
        tracks=tracks,
        mission=mission,
    )
    queries, budget_notes = _apply_query_budget(
        queries=queries,
        max_queries=mission.constraints.max_queries,
        required_track_ids=required_track_ids,
        required_query_types_by_track=required_query_types_by_track,
    )
    final_query_ids = {query.query_id for query in queries}
    added_note_count = 0
    for query_id, note in diversification_added_notes.items():
        if query_id in final_query_ids:
            diversification_notes.append(note)
            added_note_count += 1
    dropped_diversification_count = len(diversification_added_notes) - added_note_count
    if dropped_diversification_count > 0:
        diversification_notes.append(
            f"Mission diversification dropped {dropped_diversification_count} query(ies) due to query budget."
        )

    notes.extend(override_notes)
    notes.extend(query_type_override_notes)
    notes.extend(provider_preference_notes)
    notes.extend(diversification_notes)
    notes.extend(budget_notes)
    notes.extend(
        [
            f"Planning preset: {preset_name}",
            f"Required tracks: {', '.join(required_track_ids) if required_track_ids else 'none'}",
            f"Excluded tracks: {', '.join(excluded_track_ids) if excluded_track_ids else 'none'}",
            (
                "Required query types: "
                + (
                    "; ".join(
                        f"{track_id}={','.join(query_types)}"
                        for track_id, query_types in sorted(required_query_types_by_track.items())
                    )
                    if required_query_types_by_track
                    else "none"
                )
            ),
            (
                "Excluded query types: "
                + (
                    "; ".join(
                        f"{track_id}={','.join(query_types)}"
                        for track_id, query_types in sorted(excluded_query_types_by_track.items())
                    )
                    if excluded_query_types_by_track
                    else "none"
                )
            ),
            (
                "Track provider preferences: "
                + "; ".join(
                    f"{track_id}={','.join(preferences)}"
                    for track_id, preferences in sorted(track_provider_preferences.items())
                )
            ),
            f"Trust preset: {mission.trust_preferences.policy_preset}",
            "Selected acquisition mode can switch between catalog, codex-session, local-first, live-hybrid, and api-provider backends.",
            f"Mission objective: {mission.objective}",
        ]
    )
    return SearchPlan(
        mission_id=mission.mission_id,
        planning_preset=preset_name,
        required_track_ids=required_track_ids,
        excluded_track_ids=excluded_track_ids,
        required_query_types_by_track=required_query_types_by_track,
        excluded_query_types_by_track=excluded_query_types_by_track,
        track_provider_preferences=track_provider_preferences,
        selected_acquisition_mode="catalog",
        tracks=tracks,
        queries=queries,
        planning_notes=notes,
    )
