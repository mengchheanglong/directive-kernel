from __future__ import annotations

from collections import Counter
from collections import defaultdict
from datetime import UTC, datetime
import re

from research_engine.catalog import get_catalog_entry
from research_engine.models import CandidateDossier, EvidenceItem, ResearchMission, ScoreCard, SourceDocument


DEFAULT_SOURCE_TYPE_TRUST_POLICY = {
    "github-repo": "primary",
    "gitlab-repo": "primary",
    "product-doc": "primary",
    "api-doc": "primary",
    "academic-paper": "primary",
    "blog-post": "secondary",
    "news-article": "secondary",
    "forum-thread": "tertiary",
    "social-post": "tertiary",
    "unknown": "secondary",
}
TRUST_POLICY_PRESETS = {
    "balanced-discovery": dict(DEFAULT_SOURCE_TYPE_TRUST_POLICY),
    "official-first": {
        "github-repo": "secondary",
        "gitlab-repo": "secondary",
        "product-doc": "primary",
        "api-doc": "primary",
        "academic-paper": "primary",
        "blog-post": "tertiary",
        "news-article": "tertiary",
        "forum-thread": "tertiary",
        "social-post": "tertiary",
        "unknown": "secondary",
    },
    "implementation-scout": {
        "github-repo": "primary",
        "gitlab-repo": "primary",
        "product-doc": "primary",
        "api-doc": "primary",
        "academic-paper": "secondary",
        "blog-post": "secondary",
        "news-article": "secondary",
        "forum-thread": "tertiary",
        "social-post": "tertiary",
        "unknown": "secondary",
    },
    "landscape-survey": {
        "github-repo": "secondary",
        "gitlab-repo": "secondary",
        "product-doc": "secondary",
        "api-doc": "secondary",
        "academic-paper": "primary",
        "blog-post": "secondary",
        "news-article": "secondary",
        "forum-thread": "tertiary",
        "social-post": "tertiary",
        "unknown": "secondary",
    },
}

DATE_HINT_KEYWORDS = (
    "updated",
    "last updated",
    "last modified",
    "published",
    "release",
    "released",
    "push",
    "pushed",
    "last_push",
    "commit",
)
POSITIVE_EVIDENCE_CUES = {
    "active",
    "bounded",
    "clean",
    "clear",
    "composable",
    "durable",
    "explicit",
    "maintained",
    "mature",
    "readable",
    "reusable",
    "separates",
    "strong",
    "supports",
    "typed",
    "useful",
}
NEGATIVE_EVIDENCE_CUES = {
    "answer",
    "baggage",
    "broad",
    "constraint",
    "heavy",
    "insufficient",
    "large",
    "low",
    "not",
    "reject",
    "shallow",
    "snippet",
    "sprawl",
    "stale",
    "thin",
    "ui",
    "weak",
}
COMPARATIVE_EVIDENCE_CUES = (
    "compare",
    "comparison",
    "tradeoff",
    "versus",
    " vs ",
    "benchmark",
    "alternative",
    "compared to",
)
TIMESTAMP_PATTERN = re.compile(
    r"\d{4}-\d{2}-\d{2}(?:[T ][0-2]\d:[0-5]\d(?::[0-5]\d)?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?"
)


def _parse_timestamp(raw: str) -> datetime | None:
    normalized = raw.strip().rstrip(".,);]")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", normalized):
        normalized = f"{normalized}T00:00:00+00:00"
    normalized = normalized.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).replace(microsecond=0)


def freshness_signal_for_age(source_age_days: int | None) -> str:
    if source_age_days is None:
        return "unknown"
    if source_age_days <= 30:
        return "current"
    if source_age_days <= 180:
        return "recent"
    if source_age_days <= 365:
        return "aging"
    return "stale"


def normalize_policy_preset_name(name: str) -> str:
    normalized = name.strip().lower()
    return normalized or "balanced-discovery"


def _normalized_excerpt_key(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def _excerpt_polarity(text: str) -> str:
    tokens = set(re.findall(r"[a-z0-9]+", text.lower()))
    positive_hits = sum(1 for token in tokens if token in POSITIVE_EVIDENCE_CUES)
    negative_hits = sum(1 for token in tokens if token in NEGATIVE_EVIDENCE_CUES)
    if positive_hits and positive_hits > negative_hits:
        return "positive"
    if negative_hits and negative_hits > positive_hits:
        return "negative"
    return "neutral"


def _should_scan_for_source_age(text: str) -> bool:
    normalized = text.lower()
    return any(keyword in normalized for keyword in DATE_HINT_KEYWORDS)


def _extract_source_age(document: SourceDocument) -> tuple[str | None, int | None, str]:
    captured_at = _parse_timestamp(document.fetched_at)
    if captured_at is None:
        return None, None, "unknown"

    observed_updates: list[datetime] = []
    for fact in document.facts:
        scan_blocks = [fact.excerpt, *fact.notes]
        should_scan = fact.fact_type == "maintenance"
        for block in scan_blocks:
            if not block:
                continue
            if not should_scan and not _should_scan_for_source_age(block):
                continue
            for match in TIMESTAMP_PATTERN.finditer(block):
                parsed = _parse_timestamp(match.group(0))
                if parsed is not None and parsed <= captured_at:
                    observed_updates.append(parsed)

    if _should_scan_for_source_age(document.summary):
        for match in TIMESTAMP_PATTERN.finditer(document.summary):
            parsed = _parse_timestamp(match.group(0))
            if parsed is not None and parsed <= captured_at:
                observed_updates.append(parsed)

    if not observed_updates:
        return None, None, "unknown"

    source_updated_at = max(observed_updates)
    source_age_days = max(0, int((captured_at - source_updated_at).total_seconds() // 86400))
    return source_updated_at.isoformat(), source_age_days, freshness_signal_for_age(source_age_days)


def summarize_candidate_freshness(
    evidence_items: list[EvidenceItem],
) -> tuple[str, str | None, int | None, str]:
    latest_capture = max((item.captured_at for item in evidence_items), default="unknown")
    dated_items = [
        item for item in evidence_items if item.source_updated_at is not None and item.source_age_days is not None
    ]
    if not dated_items:
        return (
            "unknown",
            None,
            None,
            (
                f"Latest normalized evidence captured at {latest_capture}. "
                "No source-updated timestamp extracted from normalized evidence; signal=unknown."
            ),
        )

    freshest_item = min(
        dated_items,
        key=lambda item: item.source_age_days if item.source_age_days is not None else 10**9,
    )
    freshness_signal = freshness_signal_for_age(freshest_item.source_age_days)
    freshness_summary = (
        f"Latest normalized evidence captured at {latest_capture}. "
        f"Freshest observed source update at {freshest_item.source_updated_at} "
        f"({freshest_item.source_age_days} days old at capture; "
        f"{len(dated_items)}/{len(evidence_items)} evidence items carried source dates; "
        f"signal={freshness_signal})."
    )
    return (
        freshness_signal,
        freshest_item.source_updated_at,
        freshest_item.source_age_days,
        freshness_summary,
    )


def summarize_extraction_fidelity(
    evidence_items: list[EvidenceItem],
) -> tuple[str, int]:
    fidelity_counter = Counter(item.extraction_fidelity for item in evidence_items)
    fallback_count = fidelity_counter.get("fallback", 0)
    derived_count = fidelity_counter.get("derived", 0)
    direct_count = fidelity_counter.get("direct", 0)
    total_count = len(evidence_items)
    summary = (
        f"Extraction fidelity: direct={direct_count}, derived={derived_count}, "
        f"fallback={fallback_count} across {total_count} evidence items."
    )
    return summary, fallback_count


def detect_actionable_evidence_gaps(
    candidates: list[CandidateDossier],
    evidence_bundle: list[EvidenceItem],
    *,
    max_directives: int = 3,
) -> list[dict[str, object]]:
    if max_directives <= 0:
        return []

    evidence_by_candidate: dict[str, list[EvidenceItem]] = defaultdict(list)
    for item in evidence_bundle:
        evidence_by_candidate[item.candidate_id].append(item)

    directives: list[dict[str, object]] = []
    for candidate in candidates:
        evidence_items = evidence_by_candidate.get(candidate.candidate_id, [])
        if not evidence_items:
            continue

        trust_signals = {item.trust_signal for item in evidence_items}
        fact_types = {item.fact_type for item in evidence_items}
        missing_fact_types = [
            fact_type
            for fact_type in ("architecture", "workflow", "integration")
            if fact_type not in fact_types
        ]

        has_maintenance_signal = any(
            item.fact_type == "maintenance" or item.source_updated_at is not None
            for item in evidence_items
        )
        has_comparative_signal = False
        for item in evidence_items:
            text = " ".join([item.excerpt, *item.notes]).lower()
            if any(cue in text for cue in COMPARATIVE_EVIDENCE_CUES):
                has_comparative_signal = True
                break

        gaps: list[str] = []
        if "primary" not in trust_signals:
            gaps.append("missing-primary-source-evidence")
        if missing_fact_types:
            gaps.append("missing-technical-facts")
        if not has_maintenance_signal:
            gaps.append("missing-maintenance-freshness")
        if not has_comparative_signal:
            gaps.append("missing-comparative-evidence")
        if not gaps:
            continue

        directives.append(
            {
                "candidate_id": candidate.candidate_id,
                "candidate_name": candidate.name,
                "gaps": gaps,
                "missing_fact_types": missing_fact_types,
                "evidence_count": len(evidence_items),
            }
        )

    directives.sort(
        key=lambda item: (
            len(item.get("gaps", [])) if isinstance(item.get("gaps", []), list) else 0,
            int(item.get("evidence_count", 0)),
        ),
        reverse=True,
    )
    return directives[:max_directives]


def derive_evidence_clusters(
    candidate_id: str,
    evidence_items: list[EvidenceItem],
) -> tuple[int, int, list[str], list[str]]:
    cluster_buckets: dict[tuple[str, str, str], list[EvidenceItem]] = defaultdict(list)
    sorted_items = sorted(
        evidence_items,
        key=lambda item: (
            item.source_url,
            item.fact_type,
            _normalized_excerpt_key(item.excerpt),
            item.evidence_id,
        ),
    )
    for item in sorted_items:
        cluster_key = (
            item.source_url,
            item.fact_type,
            _normalized_excerpt_key(item.excerpt),
        )
        cluster_buckets[cluster_key].append(item)

    ordered_clusters = list(cluster_buckets.items())
    cluster_records: list[dict[str, object]] = []
    duplicate_evidence_count = 0
    evidence_cluster_summary: list[str] = [
        f"Collapsed {len(evidence_items)} evidence items into {len(ordered_clusters)} clusters."
    ]

    for index, ((source_url, fact_type, _), items) in enumerate(ordered_clusters, start=1):
        cluster_id = f"{candidate_id}-c{index}"
        evidence_ids = [item.evidence_id for item in items]
        duplicate_evidence_count += max(0, len(items) - 1)
        for item in items:
            item.cluster_id = cluster_id
            item.duplicate_evidence_ids = [evidence_id for evidence_id in evidence_ids if evidence_id != item.evidence_id]
            item.contradiction_evidence_ids = []
        cluster_records.append(
            {
                "cluster_id": cluster_id,
                "fact_type": fact_type,
                "source_url": source_url,
                "items": items,
                "polarity": _excerpt_polarity(" ".join(item.excerpt for item in items)),
            }
        )
        if len(items) > 1:
            evidence_cluster_summary.append(
                f"{cluster_id}: {len(items)} duplicate {fact_type} items from {source_url} collapsed into one scoring cluster."
            )

    contradiction_flags: list[str] = []
    clusters_by_fact_type: dict[str, list[dict[str, object]]] = defaultdict(list)
    for cluster in cluster_records:
        clusters_by_fact_type[str(cluster["fact_type"])].append(cluster)

    for fact_type, clusters in sorted(clusters_by_fact_type.items()):
        positive_clusters = [cluster for cluster in clusters if cluster["polarity"] == "positive"]
        negative_clusters = [cluster for cluster in clusters if cluster["polarity"] == "negative"]
        if not positive_clusters or not negative_clusters:
            continue
        contradiction_flags.append(f"{fact_type}-contradiction")
        contradiction_cluster_ids: set[str] = set()
        for positive_cluster in positive_clusters:
            positive_items = list(positive_cluster["items"])
            for negative_cluster in negative_clusters:
                negative_items = list(negative_cluster["items"])
                contradiction_cluster_ids.add(str(positive_cluster["cluster_id"]))
                contradiction_cluster_ids.add(str(negative_cluster["cluster_id"]))
                negative_ids = [item.evidence_id for item in negative_items]
                positive_ids = [item.evidence_id for item in positive_items]
                for item in positive_items:
                    item.contradiction_evidence_ids = sorted(
                        set(item.contradiction_evidence_ids) | set(negative_ids)
                    )
                for item in negative_items:
                    item.contradiction_evidence_ids = sorted(
                        set(item.contradiction_evidence_ids) | set(positive_ids)
                    )
        evidence_cluster_summary.append(
            f"{fact_type} contradiction across clusters: {', '.join(sorted(contradiction_cluster_ids))}."
        )

    if duplicate_evidence_count == 0:
        evidence_cluster_summary.append("No duplicate evidence clusters detected.")
    if not contradiction_flags:
        evidence_cluster_summary.append("No contradiction flags detected across clustered evidence.")

    return len(ordered_clusters), duplicate_evidence_count, contradiction_flags, evidence_cluster_summary


def build_source_type_trust_policy(mission: ResearchMission) -> dict[str, str]:
    preset_name = normalize_policy_preset_name(mission.trust_preferences.policy_preset)
    policy = dict(TRUST_POLICY_PRESETS.get(preset_name, TRUST_POLICY_PRESETS["balanced-discovery"]))
    preferences = mission.trust_preferences
    if not preferences.prefer_official_docs:
        policy["product-doc"] = "secondary"
        policy["api-doc"] = "secondary"
    if not preferences.prefer_active_repos:
        policy["github-repo"] = "secondary"
        policy["gitlab-repo"] = "secondary"
    for source_type, trust_signal in preferences.source_type_overrides.items():
        normalized = trust_signal.strip().lower()
        if normalized in {"primary", "secondary", "tertiary"}:
            policy[source_type.strip().lower()] = normalized
    return policy


def normalize_evidence(
    documents: list[SourceDocument],
    trust_policy: dict[str, str],
) -> list[EvidenceItem]:
    evidence: list[EvidenceItem] = []
    for document in documents:
        source_type = document.source_type.strip().lower()
        trust_signal = trust_policy.get(source_type, trust_policy["unknown"])
        source_updated_at, source_age_days, freshness_signal = _extract_source_age(document)
        for index, fact in enumerate(document.facts, start=1):
            rejection_flags = []
            if fact.confidence == "low":
                rejection_flags.append("low-confidence")
            if trust_signal == "tertiary":
                rejection_flags.append("low-trust-source")
            if fact.confidence == "low" and trust_signal != "primary":
                rejection_flags.append("weak-source-evidence")
            if fact.extraction_fidelity == "fallback":
                rejection_flags.append("fallback-derived-evidence")
            evidence.append(
                EvidenceItem(
                    evidence_id=f"{document.candidate_id}-e{index}",
                    candidate_id=document.candidate_id,
                    source_url=document.source_url,
                    source_type=source_type,
                    title=document.title,
                    excerpt=fact.excerpt,
                    fact_type=fact.fact_type,
                    confidence=fact.confidence,
                    captured_at=document.fetched_at,
                    matched_via=f"{document.provider}:{document.track_id}",
                    trust_signal=trust_signal,
                    rejection_flags=rejection_flags,
                    notes=fact.notes,
                    extraction_fidelity=fact.extraction_fidelity,
                    source_updated_at=source_updated_at,
                    source_age_days=source_age_days,
                    freshness_signal=freshness_signal,
                    cluster_id="",
                    duplicate_evidence_ids=[],
                    contradiction_evidence_ids=[],
                )
            )
    return evidence


def build_candidate_shells(evidence_bundle: list[EvidenceItem]) -> list[CandidateDossier]:
    evidence_by_candidate: dict[str, list[EvidenceItem]] = defaultdict(list)
    for item in evidence_bundle:
        evidence_by_candidate[item.candidate_id].append(item)

    dossiers: list[CandidateDossier] = []
    for candidate_id, evidence_items in evidence_by_candidate.items():
        try:
            entry = get_catalog_entry(candidate_id)
        except KeyError:
            entry = None
        provenance_summary = sorted(
            {
                f"{item.trust_signal} via {item.matched_via} ({item.source_type})"
                for item in evidence_items
            }
        )
        trust_counter = Counter(item.trust_signal for item in evidence_items)
        low_confidence_count = sum(1 for item in evidence_items if item.confidence == "low")
        fact_types = {item.fact_type for item in evidence_items}
        rejection_flags: list[str] = []
        reconsideration_triggers: list[str] = []
        if trust_counter.get("primary", 0) == 0:
            rejection_flags.append("no-primary-source")
            reconsideration_triggers.append(
                "Add at least one primary-source evidence item (official docs or repo metadata/readme)."
            )
        if low_confidence_count >= max(2, (len(evidence_items) + 1) // 2):
            rejection_flags.append("low-confidence-majority")
            reconsideration_triggers.append(
                "Replace low-confidence excerpts with high-confidence source-backed facts."
            )
        extraction_fidelity_summary, fallback_evidence_count = summarize_extraction_fidelity(evidence_items)
        if fallback_evidence_count >= max(2, (len(evidence_items) + 1) // 2):
            rejection_flags.append("fallback-evidence-majority")
            reconsideration_triggers.append(
                "Replace generic fallback summaries/snippets with targeted source excerpts before adoption scoring."
            )
        if not {"architecture", "workflow", "integration"} & fact_types:
            rejection_flags.append("insufficient-technical-facts")
            reconsideration_triggers.append(
                "Capture architecture/workflow/integration facts before adoption scoring."
            )
        (
            evidence_cluster_count,
            duplicate_evidence_count,
            contradiction_flags,
            evidence_cluster_summary,
        ) = derive_evidence_clusters(candidate_id, evidence_items)
        if contradiction_flags:
            rejection_flags.append("contradictory-evidence")
            reconsideration_triggers.append(
                "Resolve contradictory same-fact evidence with stronger primary-source excerpts."
            )
        (
            freshness_signal,
            freshest_source_updated_at,
            freshest_source_age_days,
            freshness_summary,
        ) = summarize_candidate_freshness(evidence_items)
        title = evidence_items[0].title if evidence_items else candidate_id
        source_refs = sorted({item.source_url for item in evidence_items})
        entry_source_refs = (
            sorted({entry.repository_url, entry.homepage_url}) if entry else source_refs
        )
        summary = evidence_items[0].excerpt if evidence_items else "No evidence excerpt captured."
        dossiers.append(
            CandidateDossier(
                candidate_id=entry.candidate_id if entry else candidate_id,
                name=entry.name if entry else title,
                candidate_type=entry.candidate_type if entry else "system",
                source_refs=entry_source_refs,
                summary=entry.summary if entry else summary,
                problem_solved=entry.problem_solved if entry else "Live-discovered candidate requiring source analysis.",
                value_hypothesis=entry.value_hypothesis if entry else "Potential reusable component based on live discovery evidence.",
                baggage_signals=entry.baggage_signals if entry else ["Unverified live candidate profile"],
                adoption_target_hint=entry.adoption_target_hint if entry else "discovery",
                usefulness_level_hint=entry.usefulness_level_hint if entry else "direct",
                capability_gap_hint=entry.capability_gap_hint if entry else "Need source analysis contract pass before adoption.",
                evidence_ids=[item.evidence_id for item in evidence_items],
                evidence_cluster_count=evidence_cluster_count,
                duplicate_evidence_count=duplicate_evidence_count,
                contradiction_flags=contradiction_flags,
                evidence_cluster_summary=evidence_cluster_summary,
                provenance_summary=provenance_summary,
                extraction_fidelity_summary=extraction_fidelity_summary,
                fallback_evidence_count=fallback_evidence_count,
                freshness_summary=freshness_summary,
                freshness_signal=freshness_signal,
                freshest_source_updated_at=freshest_source_updated_at,
                freshest_source_age_days=freshest_source_age_days,
                rejection_flags=rejection_flags,
                reconsideration_triggers=reconsideration_triggers,
                scorecard=ScoreCard(total=0, breakdown={}, rationale=[]),
            )
        )
    return dossiers
