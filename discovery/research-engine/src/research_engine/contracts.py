from __future__ import annotations

from typing import Any

from research_engine.models import (
    DW_DISCOVERY_PACKET_CONTRACT_VERSION,
    DW_DISCOVERY_PACKET_KIND,
    DW_IMPORT_BUNDLE_CONTRACT_VERSION,
    DW_IMPORT_BUNDLE_KIND,
    SOURCE_INTELLIGENCE_PACKET_CONTRACT_VERSION,
    SOURCE_INTELLIGENCE_PACKET_KIND,
)


def _expect_keys(payload: dict[str, Any], required: set[str], label: str) -> None:
    missing = sorted(required - set(payload))
    if missing:
        raise ValueError(f"{label} missing required keys: {', '.join(missing)}")


def _expect_list_of_dicts(value: Any, label: str) -> list[dict[str, Any]]:
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{label} must be a list of objects.")
    return value


def validate_dw_discovery_packet(payload: dict[str, Any]) -> None:
    _expect_keys(
        payload,
        {
            "packet_kind",
            "contract_version",
            "mission_id",
            "generated_at",
            "decision_boundary",
            "candidates",
            "holds_and_rejections",
        },
        "dw_discovery_packet",
    )
    if payload["packet_kind"] != DW_DISCOVERY_PACKET_KIND:
        raise ValueError("dw_discovery_packet packet_kind is invalid.")
    if payload["contract_version"] != DW_DISCOVERY_PACKET_CONTRACT_VERSION:
        raise ValueError("dw_discovery_packet contract_version is invalid.")
    if not isinstance(payload["decision_boundary"], str) or "Discovery" not in payload["decision_boundary"]:
        raise ValueError("dw_discovery_packet decision_boundary must clearly preserve Discovery authority.")
    for label in ("candidates", "holds_and_rejections"):
        for item in _expect_list_of_dicts(payload[label], f"dw_discovery_packet.{label}"):
            _expect_keys(
                item,
                {
                    "candidate_id",
                    "candidate_name",
                    "source_type",
                    "source_reference",
                    "mission_relevance",
                    "source_kind",
                    "initial_value_hypothesis",
                    "initial_baggage_signals",
                    "capability_gap_hint",
                    "evidence_bundle_refs",
                    "evidence_cluster_summary",
                    "contradiction_flags",
                    "rejection_or_hold_reasons",
                    "provenance_summary",
                    "discovery_signal_band",
                    "signal_total_score",
                    "signal_score_summary",
                    "freshness_summary",
                    "freshness_signal",
                    "freshest_source_updated_at",
                    "freshest_source_age_days",
                    "structural_signal_band",
                    "structural_signal_summary",
                    "workflow_phase_labels",
                    "provider_seam_summary",
                    "workflow_boundary_shape_hint",
                    "recommended_lane_target",
                    "lane_target_rationale",
                    "workflow_phase_scores",
                    "structural_extraction_recommendations",
                    "structural_avoid_recommendations",
                    "review_guidance_summary",
                    "review_guidance_action",
                    "review_guidance_stop_line",
                    "uncertainty_notes",
                },
                f"dw_discovery_packet.{label}[]",
            )


def validate_source_intelligence_packet(payload: dict[str, Any]) -> None:
    _expect_keys(
        payload,
        {
            "packet_kind",
            "contract_version",
            "mission_id",
            "generated_at",
            "decision_boundary",
            "research_frame",
            "baseline_context",
            "candidate_intelligence",
            "signal_scoring",
            "strong_signals",
            "weak_signals",
            "structural_signals",
            "lane_target_signals",
            "structural_recommendations",
            "review_guidance",
            "review_queue",
            "open_uncertainties",
            "machine_friendly_research_packet",
        },
        "source_intelligence_packet",
    )
    if payload["packet_kind"] != SOURCE_INTELLIGENCE_PACKET_KIND:
        raise ValueError("source_intelligence_packet packet_kind is invalid.")
    if payload["contract_version"] != SOURCE_INTELLIGENCE_PACKET_CONTRACT_VERSION:
        raise ValueError("source_intelligence_packet contract_version is invalid.")
    if not isinstance(payload["decision_boundary"], str) or "does not decide" not in payload["decision_boundary"].lower():
        raise ValueError("source_intelligence_packet decision_boundary must preserve non-decision authority.")
    _expect_keys(
        payload["research_frame"],
        {
            "capability_under_investigation",
            "evaluation_criteria",
            "rejection_criteria",
            "novelty_criteria",
            "what_counts_as_a_strong_signal",
        },
        "source_intelligence_packet.research_frame",
    )
    _expect_keys(
        payload["baseline_context"],
        {"known_baseline", "already_known_candidate_set"},
        "source_intelligence_packet.baseline_context",
    )
    for label in (
        "candidate_intelligence",
        "signal_scoring",
        "strong_signals",
        "weak_signals",
        "structural_signals",
        "lane_target_signals",
        "structural_recommendations",
        "review_guidance",
        "review_queue",
    ):
        _expect_list_of_dicts(payload[label], f"source_intelligence_packet.{label}")
    if not isinstance(payload["open_uncertainties"], list):
        raise ValueError("source_intelligence_packet.open_uncertainties must be a list.")
    _expect_keys(
        payload["machine_friendly_research_packet"],
        {
            "strong_signals",
            "weak_signals",
            "structural_signals",
            "lane_target_signals",
            "structural_recommendations",
            "review_guidance",
            "review_queue",
            "rejected_candidates",
            "novelty_notes",
            "evidence_gaps",
            "recommended_followup_queries",
        },
        "source_intelligence_packet.machine_friendly_research_packet",
    )


def validate_dw_import_bundle(payload: dict[str, Any]) -> None:
    _expect_keys(
        payload,
        {
            "packet_kind",
            "contract_version",
            "mission_id",
            "generated_at",
            "decision_boundary",
            "import_ready",
            "artifact_refs",
            "counts",
            "schema_refs",
            "import_notes",
        },
        "dw_import_bundle",
    )
    if payload["packet_kind"] != DW_IMPORT_BUNDLE_KIND:
        raise ValueError("dw_import_bundle packet_kind is invalid.")
    if payload["contract_version"] != DW_IMPORT_BUNDLE_CONTRACT_VERSION:
        raise ValueError("dw_import_bundle contract_version is invalid.")
    if payload["import_ready"] is not True:
        raise ValueError("dw_import_bundle import_ready must be true for an emitted bundle.")
    _expect_keys(
        payload["artifact_refs"],
        {
            "research_record",
            "query_plan",
            "provider_health",
            "discovery_hits",
            "evidence_bundle",
            "candidate_dossiers",
            "rejections",
            "source_intelligence_packet",
            "dw_discovery_packet",
            "inspection_html",
            "recommendations_markdown",
        },
        "dw_import_bundle.artifact_refs",
    )
    _expect_keys(
        payload["schema_refs"],
        {
            "source_intelligence_packet",
            "dw_discovery_packet",
            "dw_import_bundle",
        },
        "dw_import_bundle.schema_refs",
    )
