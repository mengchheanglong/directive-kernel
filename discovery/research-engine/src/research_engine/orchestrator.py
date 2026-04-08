from __future__ import annotations

from pathlib import Path

from research_engine.acquisition import get_acquisition_provider
from research_engine.export import build_dw_packet, write_artifacts
from research_engine.models import ResearchMission, ResearchRecord
from research_engine.normalize import (
    build_candidate_shells,
    build_source_type_trust_policy,
    detect_actionable_evidence_gaps,
    normalize_evidence,
)
from research_engine.planning import build_search_plan
from research_engine.score import score_candidates


def run_mission(
    mission: ResearchMission,
    output_dir: Path | None = None,
    acquisition_mode: str = "catalog",
) -> ResearchRecord:
    plan = build_search_plan(mission)
    plan.selected_acquisition_mode = acquisition_mode
    provider = get_acquisition_provider(acquisition_mode)
    acquisition = provider.acquire(plan, mission, output_dir=output_dir)
    trust_policy = build_source_type_trust_policy(mission)
    discovery_hits = list(acquisition.discovery_hits)
    source_documents = list(acquisition.source_documents)
    acquisition_notes = list(acquisition.notes)
    provider_health = list(acquisition.provider_health)

    evidence_bundle = normalize_evidence(source_documents, trust_policy=trust_policy)
    candidate_shells = build_candidate_shells(evidence_bundle)
    gap_directives = detect_actionable_evidence_gaps(
        candidate_shells,
        evidence_bundle,
        max_directives=3,
    )
    if gap_directives:
        acquisition_notes.append(
            f"Evidence-gap scan found {len(gap_directives)} actionable gap directive(s)."
        )
        for directive in gap_directives:
            gaps = directive.get("gaps", [])
            candidate_id = directive.get("candidate_id", "unknown-candidate")
            acquisition_notes.append(
                f"Evidence-gap directive candidate={candidate_id}: {', '.join(gaps) if isinstance(gaps, list) else gaps}."
            )
        follow_up = provider.acquire_evidence_gap_follow_up(
            plan=plan,
            mission=mission,
            gap_directives=gap_directives,
            existing_documents=source_documents,
        )
        if follow_up.discovery_hits:
            discovery_hits.extend(follow_up.discovery_hits)
        if follow_up.source_documents:
            source_documents.extend(follow_up.source_documents)
        if follow_up.notes:
            acquisition_notes.extend(follow_up.notes)
        if follow_up.provider_health:
            provider_health.extend(follow_up.provider_health)
        if follow_up.discovery_hits or follow_up.source_documents:
            evidence_bundle = normalize_evidence(source_documents, trust_policy=trust_policy)
            candidate_shells = build_candidate_shells(evidence_bundle)

    candidates, rejections = score_candidates(candidate_shells, evidence_bundle, mission)
    dw_packet = build_dw_packet(mission, candidates, rejections, evidence_bundle)
    record = ResearchRecord(
        mission=mission,
        plan=plan,
        trust_policy=trust_policy,
        acquisition_notes=acquisition_notes,
        provider_health=provider_health,
        discovery_hits=discovery_hits,
        source_documents=source_documents,
        evidence_bundle=evidence_bundle,
        candidates=candidates,
        rejections=rejections,
        dw_discovery_packet=dw_packet,
    )
    if output_dir is not None:
        write_artifacts(output_dir, record)
    return record
