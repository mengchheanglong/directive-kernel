from __future__ import annotations

import re

from research_engine.catalog import get_catalog_entry
from research_engine.models import CandidateDossier, EvidenceItem, RejectionRecord, ResearchMission, ScoreCard


REJECTION_THRESHOLD = 60
CRITICAL_REJECTION_FLAGS = {
    "no-primary-source",
    "insufficient-technical-facts",
}


def _keyword_terms(text: str) -> set[str]:
    return {term for term in re.findall(r"[a-z0-9]+", text.lower()) if len(term) >= 5}


def _baggage_penalty(baggage_signals: list[str]) -> int:
    penalty = 0
    for signal in baggage_signals:
        normalized = signal.lower()
        if "ui" in normalized or "answer-first" in normalized or "product" in normalized:
            penalty += 4
        elif "provider sprawl" in normalized or "large feature surface" in normalized:
            penalty += 3
        elif "constraint" in normalized or "report" in normalized:
            penalty += 2
        else:
            penalty += 1
    return -penalty


def _recency_decay(source_age_days: int | None) -> int:
    if source_age_days is None:
        return 2
    if source_age_days <= 30:
        return 0
    if source_age_days <= 180:
        return 1
    if source_age_days <= 365:
        return 2
    if source_age_days <= 730:
        return 3
    return 4


def _maintenance_health(
    candidate: CandidateDossier,
    evidence_items: list[EvidenceItem],
    trust_signals: set[str],
    high_confidence: int,
    medium_confidence: int,
) -> tuple[int, int, int]:
    base_score = min(
        10,
        2 + (high_confidence * 2) + medium_confidence + (2 if "primary" in trust_signals else 0),
    )
    dated_items = [item for item in evidence_items if item.source_age_days is not None]
    freshness_bonus = 0
    if candidate.freshest_source_age_days is not None and candidate.freshest_source_age_days <= 30:
        freshness_bonus += 1
    if dated_items and (len(dated_items) * 2) >= len(evidence_items):
        freshness_bonus += 1
    if candidate.freshness_signal == "stale":
        freshness_bonus -= 1
    recency_decay = _recency_decay(candidate.freshest_source_age_days)
    maintenance_health = max(0, min(10, base_score + freshness_bonus - recency_decay))
    return maintenance_health, recency_decay, len(dated_items)


def _extraction_fidelity_penalty(evidence_items: list[EvidenceItem]) -> tuple[int, int, int, int]:
    fallback_count = sum(1 for item in evidence_items if item.extraction_fidelity == "fallback")
    derived_count = sum(1 for item in evidence_items if item.extraction_fidelity == "derived")
    direct_count = sum(1 for item in evidence_items if item.extraction_fidelity == "direct")
    if not evidence_items:
        return 0, fallback_count, derived_count, direct_count
    fallback_ratio = fallback_count / len(evidence_items)
    if fallback_count == 0:
        penalty = 0
    elif fallback_ratio <= 0.25:
        penalty = -2
    elif fallback_ratio <= 0.5:
        penalty = -4
    elif fallback_ratio <= 0.75:
        penalty = -6
    else:
        penalty = -8
    return penalty, fallback_count, derived_count, direct_count


def score_candidates(
    candidates: list[CandidateDossier],
    evidence_bundle: list[EvidenceItem],
    mission: ResearchMission,
) -> tuple[list[CandidateDossier], list[RejectionRecord]]:
    accepted: list[CandidateDossier] = []
    rejected: list[RejectionRecord] = []
    mission_terms = _keyword_terms(mission.objective)
    evidence_by_candidate: dict[str, list[EvidenceItem]] = {}
    for item in evidence_bundle:
        evidence_by_candidate.setdefault(item.candidate_id, []).append(item)

    for candidate in candidates:
        try:
            entry = get_catalog_entry(candidate.candidate_id)
            entry_rejection_reason = entry.rejection_reason
            entry_reconsider_if = entry.reconsider_if
            avoid_copying = entry.avoid_copying
        except KeyError:
            entry = None
            entry_rejection_reason = ""
            entry_reconsider_if = (
                "Re-open when additional high-confidence evidence confirms direct mission fit."
            )
            avoid_copying = [
                "Do not adopt before completing source-analysis and baggage mapping.",
            ]
        evidence_items = evidence_by_candidate.get(candidate.candidate_id, [])
        candidate_terms = _keyword_terms(
            " ".join([candidate.summary, candidate.problem_solved, candidate.value_hypothesis])
        )
        overlap = len(mission_terms & candidate_terms)
        fact_types = {item.fact_type for item in evidence_items}
        high_confidence = sum(1 for item in evidence_items if item.confidence == "high")
        medium_confidence = sum(1 for item in evidence_items if item.confidence == "medium")
        trust_signals = {item.trust_signal for item in evidence_items}
        critical_flags = [flag for flag in candidate.rejection_flags if flag in CRITICAL_REJECTION_FLAGS]
        soft_flags = [flag for flag in candidate.rejection_flags if flag not in CRITICAL_REJECTION_FLAGS]

        mission_fit = min(20, 8 + (overlap * 2))
        evidence_density = min(15, candidate.evidence_cluster_count * 3)
        implementation_leverage = min(
            18,
            6 + (3 * sum(1 for fact in fact_types if fact in {"architecture", "workflow", "integration"})),
        )
        self_hostability = (
            12
            if candidate.source_refs
            and ("github.com" in candidate.source_refs[0] or "gitlab.com" in candidate.source_refs[0])
            else 8
        )
        composability = 12
        if any("ui" in signal.lower() or "answer-first" in signal.lower() for signal in candidate.baggage_signals):
            composability -= 4
        if candidate.usefulness_level_hint in {"direct", "structural"}:
            composability += 1
        composability = max(4, min(12, composability))
        maintenance_health, recency_decay, dated_item_count = _maintenance_health(
            candidate,
            evidence_items,
            trust_signals,
            high_confidence,
            medium_confidence,
        )
        (
            extraction_fidelity_penalty,
            fallback_fidelity_count,
            derived_fidelity_count,
            direct_fidelity_count,
        ) = _extraction_fidelity_penalty(evidence_items)
        baggage_penalty = _baggage_penalty(candidate.baggage_signals)
        evidence_risk_penalty = -(
            (len(critical_flags) * 7)
            + (len(soft_flags) * 3)
            + (len(candidate.contradiction_flags) * 2)
        )
        adoption_clarity = 8 if candidate.adoption_target_hint and candidate.usefulness_level_hint else 4

        breakdown = {
            "mission_fit": mission_fit,
            "evidence_density": evidence_density,
            "implementation_leverage": implementation_leverage,
            "self_hostability": self_hostability,
            "composability": composability,
            "maintenance_health": maintenance_health,
            "extraction_fidelity_penalty": extraction_fidelity_penalty,
            "baggage_penalty": baggage_penalty,
            "evidence_risk_penalty": evidence_risk_penalty,
            "adoption_clarity": adoption_clarity,
        }
        total = sum(breakdown.values())
        rationale = [
            f"Matched {overlap} mission terms across dossier summary and problem framing.",
            f"Collected {len(evidence_items)} normalized evidence items across {candidate.evidence_cluster_count} clusters and {len(fact_types)} fact types.",
            f"Trust signals observed: {', '.join(sorted(trust_signals)) or 'none'}.",
        ]
        rationale.extend(candidate.evidence_cluster_summary[:3])
        rationale.append(candidate.extraction_fidelity_summary)
        if candidate.freshest_source_age_days is None:
            rationale.append(
                f"Freshness signal: {candidate.freshness_signal}; no source-updated timestamp extracted, so maintenance health applied a default recency decay of {recency_decay}."
            )
        else:
            rationale.append(
                f"Freshness signal: {candidate.freshness_signal}; freshest source was {candidate.freshest_source_age_days} days old at capture with {dated_item_count}/{len(evidence_items)} dated evidence items, so maintenance health applied recency decay {recency_decay}."
            )
        if candidate.baggage_signals:
            rationale.append(f"Baggage signals: {', '.join(candidate.baggage_signals)}.")
        if candidate.rejection_flags:
            rationale.append(f"Derived evidence flags: {', '.join(candidate.rejection_flags)}.")
        if candidate.contradiction_flags:
            rationale.append(f"Contradiction flags: {', '.join(candidate.contradiction_flags)}.")
        if candidate.reconsideration_triggers:
            rationale.append(f"Reconsideration triggers: {'; '.join(candidate.reconsideration_triggers)}.")
        if fallback_fidelity_count:
            rationale.append(
                "Fallback-derived evidence penalty applied: "
                f"{fallback_fidelity_count} fallback, {derived_fidelity_count} derived, "
                f"{direct_fidelity_count} direct evidence items."
            )
        rationale.extend(avoid_copying[:1])
        if entry is None:
            rationale.append("No catalog profile found; scored from live evidence only.")
        candidate.scorecard = ScoreCard(
            total=total,
            breakdown=breakdown,
            rationale=rationale,
        )
        if total >= REJECTION_THRESHOLD and not entry_rejection_reason and not critical_flags:
            accepted.append(candidate)
            continue
        if entry_rejection_reason:
            reason = entry_rejection_reason
        elif candidate.rejection_flags:
            reason = f"Derived evidence flags: {', '.join(candidate.rejection_flags)}."
        else:
            reason = "; ".join(candidate.baggage_signals) or "Candidate did not meet acceptance threshold."
        reconsider_if = entry_reconsider_if
        if entry is None and candidate.reconsideration_triggers:
            reconsider_if = " | ".join(candidate.reconsideration_triggers)
        rejected.append(
            RejectionRecord(
                candidate_id=candidate.candidate_id,
                reason=reason,
                evidence_ids=list(candidate.evidence_ids),
                reconsider_if=reconsider_if,
                derived_flags=list(candidate.rejection_flags),
            )
        )

    accepted.sort(key=lambda item: item.scorecard.total if item.scorecard else 0, reverse=True)
    rejected.sort(key=lambda item: item.candidate_id)
    return accepted, rejected
