from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from html import escape as html_escape
from urllib.error import HTTPError
from unittest import mock
from pathlib import Path

from research_engine.acquisition import (
    AcquisitionResult,
    EvidenceGapFollowUpResult,
    LiveHybridAcquisitionProvider,
    RequestBudget,
    RequestBudgetExhausted,
    get_acquisition_provider,
)
from research_engine.cli import _extract_local_stop_term_suggestion, _load_local_dotenv
from research_engine.contracts import (
    validate_dw_discovery_packet,
    validate_dw_import_bundle,
    validate_source_intelligence_packet,
)
from research_engine.export import (
    build_source_intelligence_packet,
    build_dw_packet,
    render_inspection_html,
    render_recommendations_markdown,
)
from research_engine.fetch import fetch_documents
from research_engine.live_extract import extract_visible_text
from research_engine.models import (
    DiscoveryHit,
    MissionConstraints,
    ProviderHealth,
    ResearchMission,
    SearchPlan,
    SearchQuery,
    SearchTrack,
    SourceDocument,
    SourceFact,
    ResearchRecord,
    TrustPreferences,
)
from research_engine.normalize import (
    build_candidate_shells,
    build_source_type_trust_policy,
    detect_actionable_evidence_gaps,
    normalize_evidence,
)
from research_engine.orchestrator import run_mission
from research_engine.planning import build_search_plan
from research_engine.score import score_candidates


ROOT = Path(__file__).resolve().parents[1]


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload

    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def read(self) -> bytes:
        return self._payload


class ResearchEngineRunTest(unittest.TestCase):
    def test_cli_writes_expected_artifacts(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        output_dir = temp_root / "test-artifacts"
        shutil.rmtree(output_dir, ignore_errors=True)
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT / "src")
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "research_engine",
                "--output-dir",
                str(output_dir),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        expected_files = {
            "research_record.json",
            "query_plan.json",
            "provider_health.json",
            "discovery_hits.jsonl",
            "evidence_bundle.jsonl",
            "candidate_dossiers.json",
            "rejections.json",
            "dw_discovery_packet.json",
            "source_intelligence_packet.json",
            "dw_import_bundle.json",
            "inspection.html",
            "recommendations.md",
        }
        self.assertEqual(expected_files, {path.name for path in output_dir.iterdir()})

        query_plan = json.loads((output_dir / "query_plan.json").read_text(encoding="utf-8"))
        self.assertEqual(query_plan["planning_preset"], "balanced-discovery")
        self.assertEqual(query_plan["required_track_ids"], [])
        self.assertEqual(query_plan["excluded_track_ids"], [])
        self.assertEqual(query_plan["required_query_types_by_track"], {})
        self.assertEqual(query_plan["excluded_query_types_by_track"], {})
        self.assertIn("track_provider_preferences", query_plan)
        self.assertEqual(query_plan["selected_acquisition_mode"], "catalog")
        self.assertGreaterEqual(len(query_plan["tracks"]), 4)
        research_record = json.loads((output_dir / "research_record.json").read_text(encoding="utf-8"))
        self.assertIn("acquisition_notes", research_record)
        self.assertGreaterEqual(len(research_record["acquisition_notes"]), 1)
        self.assertIn("trust_policy", research_record)
        self.assertIn("provider_health", research_record)
        self.assertGreaterEqual(len(research_record["provider_health"]), 1)
        self.assertEqual(research_record["mission"]["planning_preset"], "balanced-discovery")
        self.assertEqual(research_record["mission"]["required_track_ids"], [])
        self.assertEqual(research_record["mission"]["excluded_track_ids"], [])
        self.assertEqual(research_record["mission"]["required_query_types_by_track"], {})
        self.assertEqual(research_record["mission"]["excluded_query_types_by_track"], {})
        self.assertEqual(research_record["mission"]["track_provider_preferences"], {})
        self.assertEqual(
            research_record["mission"]["trust_preferences"]["policy_preset"],
            "balanced-discovery",
        )
        self.assertIn("known_baseline_names", research_record["mission"])
        self.assertIn("known_candidate_anchor_names", research_record["mission"])

        dossiers = json.loads((output_dir / "candidate_dossiers.json").read_text(encoding="utf-8"))
        dossier_ids = {dossier["candidate_id"] for dossier in dossiers}
        self.assertIn("paperqa2", dossier_ids)
        self.assertIn("storm", dossier_ids)
        first_dossier = dossiers[0]
        self.assertIn("provenance_summary", first_dossier)
        self.assertIn("freshness_summary", first_dossier)
        self.assertNotEqual(first_dossier["freshness_signal"], "unknown")
        self.assertIn("freshest_source_updated_at", first_dossier)
        self.assertIn("freshest_source_age_days", first_dossier)
        self.assertIn("evidence_cluster_count", first_dossier)
        self.assertIn("duplicate_evidence_count", first_dossier)
        self.assertIn("contradiction_flags", first_dossier)
        self.assertIn("evidence_cluster_summary", first_dossier)
        self.assertIn("rejection_flags", first_dossier)
        self.assertIn("reconsideration_triggers", first_dossier)

        discovery_hits = (output_dir / "discovery_hits.jsonl").read_text(encoding="utf-8").strip().splitlines()
        first_hit = json.loads(discovery_hits[0])
        self.assertIn("track_id", first_hit)
        self.assertIn("matched_terms", first_hit)

        evidence_lines = (output_dir / "evidence_bundle.jsonl").read_text(encoding="utf-8").strip().splitlines()
        first_evidence = json.loads(evidence_lines[0])
        self.assertIn("captured_at", first_evidence)
        self.assertIn("matched_via", first_evidence)
        self.assertIn("trust_signal", first_evidence)
        self.assertIn("source_updated_at", first_evidence)
        self.assertIn("source_age_days", first_evidence)
        self.assertIn("freshness_signal", first_evidence)
        self.assertIn("cluster_id", first_evidence)
        self.assertIn("duplicate_evidence_ids", first_evidence)
        self.assertIn("contradiction_evidence_ids", first_evidence)

        provider_health = json.loads((output_dir / "provider_health.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(provider_health), 1)
        self.assertIn("provider", provider_health[0])
        self.assertIn("status", provider_health[0])
        self.assertIn("fetch_successes", provider_health[0])
        self.assertIn("request_attempts", provider_health[0])
        self.assertIn("retry_attempts", provider_health[0])
        self.assertIn("timeout_count", provider_health[0])
        self.assertIn("total_backoff_seconds", provider_health[0])
        self.assertIn("reason_codes", provider_health[0])
        self.assertIn("status_summary", provider_health[0])

        rejections = json.loads((output_dir / "rejections.json").read_text(encoding="utf-8"))
        self.assertEqual(rejections[0]["candidate_id"], "vane")
        self.assertIn("derived_flags", rejections[0])

        dw_packet = json.loads((output_dir / "dw_discovery_packet.json").read_text(encoding="utf-8"))
        validate_dw_discovery_packet(dw_packet)
        self.assertEqual(dw_packet["packet_kind"], "research_engine.dw_discovery_packet")
        self.assertEqual(dw_packet["contract_version"], 1)
        self.assertIn("Discovery", dw_packet["decision_boundary"])
        self.assertIn("provenance_summary", dw_packet["candidates"][0])
        self.assertIn("freshness_summary", dw_packet["candidates"][0])
        self.assertIn("freshness_signal", dw_packet["candidates"][0])
        self.assertIn("freshest_source_updated_at", dw_packet["candidates"][0])
        self.assertIn("freshest_source_age_days", dw_packet["candidates"][0])
        self.assertIn("workflow_phase_labels", dw_packet["candidates"][0])
        self.assertIn("provider_seam_summary", dw_packet["candidates"][0])
        self.assertIn("workflow_boundary_shape_hint", dw_packet["candidates"][0])
        self.assertIn("structural_signal_band", dw_packet["candidates"][0])
        self.assertIn("structural_signal_summary", dw_packet["candidates"][0])
        self.assertIn("recommended_lane_target", dw_packet["candidates"][0])
        self.assertIn("lane_target_rationale", dw_packet["candidates"][0])
        self.assertIn("workflow_phase_scores", dw_packet["candidates"][0])
        self.assertIn("structural_extraction_recommendations", dw_packet["candidates"][0])
        self.assertIn("structural_avoid_recommendations", dw_packet["candidates"][0])
        self.assertIn("review_guidance_summary", dw_packet["candidates"][0])
        self.assertIn("review_guidance_action", dw_packet["candidates"][0])
        self.assertIn("review_guidance_stop_line", dw_packet["candidates"][0])
        self.assertIn("source_kind", dw_packet["candidates"][0])
        self.assertIn("initial_baggage_signals", dw_packet["candidates"][0])
        self.assertIn("capability_gap_hint", dw_packet["candidates"][0])
        self.assertIn("evidence_cluster_summary", dw_packet["candidates"][0])
        self.assertIn("contradiction_flags", dw_packet["candidates"][0])
        self.assertIn("discovery_signal_band", dw_packet["candidates"][0])
        self.assertIn("signal_total_score", dw_packet["candidates"][0])
        self.assertIn("signal_score_summary", dw_packet["candidates"][0])
        self.assertEqual(dw_packet["candidates"][0]["discovery_signal_band"], "strong")
        self.assertIsInstance(dw_packet["candidates"][0]["signal_total_score"], int)
        self.assertIn("Score summary:", dw_packet["candidates"][0]["signal_score_summary"])
        self.assertNotIn("adoption_target_hint", dw_packet["candidates"][0])
        self.assertNotIn("usefulness_level_hint", dw_packet["candidates"][0])
        self.assertNotIn("routing_considerations", dw_packet["candidates"][0])
        open_deep_research = next(
            candidate
            for candidate in dw_packet["candidates"]
            if candidate["candidate_id"] == "open-deep-research"
        )
        self.assertIn("planning", open_deep_research["workflow_phase_labels"])
        self.assertIn("discovery", open_deep_research["workflow_phase_labels"])
        self.assertIn("compression", open_deep_research["workflow_phase_labels"])
        self.assertIn("reporting", open_deep_research["workflow_phase_labels"])
        self.assertEqual(
            open_deep_research["provider_seam_summary"],
            "Reusable provider seams for bounded research runs.",
        )
        self.assertEqual(
            open_deep_research["workflow_boundary_shape_hint"],
            "bounded_protocol",
        )
        self.assertEqual(open_deep_research["recommended_lane_target"], "architecture")
        self.assertIn("planning", open_deep_research["workflow_phase_scores"])
        self.assertIn("Extract the explicit phase model", open_deep_research["structural_extraction_recommendations"][0])
        self.assertTrue(
            any("LangGraph-specific orchestration assumptions" in item for item in open_deep_research["structural_avoid_recommendations"])
        )
        self.assertIn("Extractive structural candidate", open_deep_research["review_guidance_summary"])
        self.assertEqual(
            dw_packet["holds_and_rejections"][0]["discovery_signal_band"],
            "hold_or_reject",
        )

        source_intelligence_packet = json.loads(
            (output_dir / "source_intelligence_packet.json").read_text(encoding="utf-8")
        )
        validate_source_intelligence_packet(source_intelligence_packet)
        self.assertEqual(
            source_intelligence_packet["packet_kind"],
            "research_engine.source_intelligence_packet",
        )
        self.assertEqual(source_intelligence_packet["contract_version"], 1)
        self.assertIn("does not decide", source_intelligence_packet["decision_boundary"].lower())
        self.assertIn("research_frame", source_intelligence_packet)
        self.assertIn("baseline_context", source_intelligence_packet)
        self.assertIn("candidate_intelligence", source_intelligence_packet)
        self.assertIn("signal_scoring", source_intelligence_packet)
        self.assertIn("strong_signals", source_intelligence_packet)
        self.assertIn("weak_signals", source_intelligence_packet)
        self.assertIn("lane_target_signals", source_intelligence_packet)
        self.assertIn("structural_recommendations", source_intelligence_packet)
        self.assertIn("review_guidance", source_intelligence_packet)
        self.assertIn("review_queue", source_intelligence_packet)
        self.assertIn("open_uncertainties", source_intelligence_packet)
        self.assertIn("machine_friendly_research_packet", source_intelligence_packet)
        self.assertEqual(
            source_intelligence_packet["baseline_context"]["known_baseline"][0],
            "Vane",
        )
        strong_signal_names = {item["name"] for item in source_intelligence_packet["strong_signals"]}
        weak_signal_names = {item["name"] for item in source_intelligence_packet["weak_signals"]}
        self.assertIn("PaperQA2", strong_signal_names)
        self.assertIn("STORM / Co-STORM", strong_signal_names)
        self.assertIn("Vane", weak_signal_names)
        self.assertIn("structural_signals", source_intelligence_packet)
        structural_signal_names = {
            item["name"] for item in source_intelligence_packet["structural_signals"]
        }
        self.assertIn("Open Deep Research", structural_signal_names)
        lane_target_map = {
            item["name"]: item["target"] for item in source_intelligence_packet["lane_target_signals"]
        }
        self.assertEqual(lane_target_map["Open Deep Research"], "architecture")
        recommendation_map = {
            item["name"]: item for item in source_intelligence_packet["structural_recommendations"]
        }
        self.assertTrue(
            any(
                "Extract the provider seam" in entry
                for entry in recommendation_map["Open Deep Research"]["extract"]
            )
        )
        review_guidance_map = {
            item["name"]: item for item in source_intelligence_packet["review_guidance"]
        }
        self.assertIn(
            "Extractive structural candidate",
            review_guidance_map["Open Deep Research"]["summary"],
        )
        review_queue_map = {
            item["name"]: item for item in source_intelligence_packet["review_queue"]
        }
        self.assertIn("PaperQA2", review_queue_map)
        self.assertIn("priority_score", review_queue_map["PaperQA2"])
        self.assertIn("priority_band", review_queue_map["PaperQA2"])
        self.assertIn("rationale", review_queue_map["PaperQA2"])
        self.assertIn("action", review_queue_map["PaperQA2"])
        self.assertIn("stop_line", review_queue_map["PaperQA2"])
        self.assertIn("uncertainty_count", review_queue_map["PaperQA2"])
        self.assertIsInstance(review_queue_map["PaperQA2"]["priority_score"], int)
        self.assertIn(review_queue_map["PaperQA2"]["priority_band"], {"high", "medium", "low"})
        queue_scores = [item["priority_score"] for item in source_intelligence_packet["review_queue"]]
        self.assertEqual(queue_scores, sorted(queue_scores, reverse=True))
        self.assertIn(
            "structural_signals",
            source_intelligence_packet["machine_friendly_research_packet"],
        )
        self.assertIn(
            "lane_target_signals",
            source_intelligence_packet["machine_friendly_research_packet"],
        )
        self.assertIn(
            "structural_recommendations",
            source_intelligence_packet["machine_friendly_research_packet"],
        )
        self.assertIn(
            "review_guidance",
            source_intelligence_packet["machine_friendly_research_packet"],
        )
        self.assertIn(
            "review_queue",
            source_intelligence_packet["machine_friendly_research_packet"],
        )

        import_bundle = json.loads((output_dir / "dw_import_bundle.json").read_text(encoding="utf-8"))
        validate_dw_import_bundle(import_bundle)
        self.assertEqual(import_bundle["packet_kind"], "research_engine.dw_import_bundle")
        self.assertTrue(import_bundle["import_ready"])
        self.assertIn("source_intelligence_packet", import_bundle["artifact_refs"])
        self.assertIn("dw_discovery_packet", import_bundle["artifact_refs"])
        self.assertIn("dw_import_bundle", import_bundle["schema_refs"])
        self.assertEqual(import_bundle["counts"]["candidates"], len(dossiers))

        recommendations = (output_dir / "recommendations.md").read_text(encoding="utf-8")
        self.assertIn("1. RESEARCH FRAME", recommendations)
        self.assertIn("2. BASELINE CONTEXT", recommendations)
        self.assertIn("3. CANDIDATE INTELLIGENCE", recommendations)
        self.assertIn("4. SIGNAL SCORING", recommendations)
        self.assertIn("5. STRONG SIGNALS", recommendations)
        self.assertIn("6. WEAK / NOISY SIGNALS", recommendations)
        self.assertIn("7. STRUCTURAL RECOMMENDATIONS", recommendations)
        self.assertIn("8. REVIEW GUIDANCE", recommendations)
        self.assertIn("9. REVIEW QUEUE", recommendations)
        self.assertIn("10. OPEN UNCERTAINTIES", recommendations)
        self.assertIn("11. MACHINE-FRIENDLY RESEARCH PACKET", recommendations)
        self.assertIn("known baseline: Vane, GPT Researcher, Open Deep Research", recommendations)
        self.assertIn("PaperQA2", recommendations)
        self.assertIn("recommended lane target:", recommendations)
        self.assertIn("review guidance summary:", recommendations)
        self.assertIn("priority=", recommendations)
        self.assertIn("uncertainties=", recommendations)

        inspection = (output_dir / "inspection.html").read_text(encoding="utf-8")
        self.assertIn("Research Engine Inspection", inspection)
        self.assertIn("Run Snapshot", inspection)
        self.assertIn("Acquisition notes", inspection)
        self.assertIn("Candidates", inspection)
        self.assertIn("Provider Health", inspection)
        self.assertIn("Source-Intelligence Review Queue", inspection)
        self.assertIn("Open Uncertainties", inspection)
        self.assertIn("Summary / Notes", inspection)
        self.assertIn("paperqa2", inspection)
        self.assertIn("source_intelligence_packet.json", inspection)
        self.assertIn("dw_import_bundle.json", inspection)
        self.assertIn("candidates-filter", inspection)
        self.assertIn("providers-filter", inspection)
        self.assertIn("review-queue-filter", inspection)
        self.assertIn("score-desc", inspection)
        top_review_entry = source_intelligence_packet["review_queue"][0]
        self.assertIn(html_escape(top_review_entry["name"]), inspection)
        self.assertIn(html_escape(top_review_entry["stop_line"]), inspection)

        shutil.rmtree(output_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_inspection_review_queue_empty_boundary(self) -> None:
        mission = ResearchMission(objective="Boundary coverage for review queue rendering.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset=mission.planning_preset,
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={},
            selected_acquisition_mode="catalog",
            tracks=[],
            queries=[],
            planning_notes=[],
        )
        record = ResearchRecord(
            mission=mission,
            plan=plan,
            trust_policy={},
            acquisition_notes=[],
            provider_health=[],
            discovery_hits=[],
            source_documents=[],
            evidence_bundle=[],
            candidates=[],
            rejections=[],
            dw_discovery_packet=build_dw_packet(mission, [], [], []),
        )

        inspection = render_inspection_html(record)
        self.assertIn("Source-Intelligence Review Queue", inspection)
        self.assertIn("Open Uncertainties", inspection)
        self.assertIn("none in the current run", inspection)

        recommendations = render_recommendations_markdown(record)
        self.assertIn("9. REVIEW QUEUE", recommendations)
        self.assertIn("10. OPEN UNCERTAINTIES", recommendations)
        self.assertIn("11. MACHINE-FRIENDLY RESEARCH PACKET", recommendations)
        self.assertIn("- none in the current run", recommendations)

    def test_source_intelligence_open_uncertainties_include_strict_acquisition_health_context(self) -> None:
        mission = ResearchMission(objective="Boundary coverage for strict acquisition uncertainty propagation.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset=mission.planning_preset,
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={},
            selected_acquisition_mode="local-first",
            tracks=[],
            queries=[],
            planning_notes=[],
        )
        record = ResearchRecord(
            mission=mission,
            plan=plan,
            trust_policy={},
            acquisition_notes=[
                "Local corpus directory had no files and strict local-first mode prevented catalog fallback."
            ],
            provider_health=[
                ProviderHealth(
                    provider="local-corpus",
                    discovery_queries=1,
                    discovery_hits=0,
                    fetch_attempts=0,
                    fetch_successes=0,
                    fetch_failures=0,
                    fallback_used=False,
                    status="degraded",
                    reason_codes=["local-corpus-empty", "strict-no-fallback"],
                    status_summary=(
                        "No local corpus files were available and strict local-first mode prevented fallback."
                    ),
                    notes=["Strict local-first mode active."],
                )
            ],
            discovery_hits=[],
            source_documents=[],
            evidence_bundle=[],
            candidates=[],
            rejections=[],
            dw_discovery_packet=build_dw_packet(mission, [], [], []),
        )

        source_intelligence_packet = build_source_intelligence_packet(record)
        self.assertTrue(
            any(
                "Acquisition health pressure:" in note
                for note in source_intelligence_packet["open_uncertainties"]
            )
        )
        self.assertTrue(
            any(
                "strict no-fallback" in note.lower()
                for note in source_intelligence_packet["open_uncertainties"]
            )
        )
        machine_packet = source_intelligence_packet["machine_friendly_research_packet"]
        self.assertIn("acquisition_health_uncertainties", machine_packet)
        self.assertTrue(machine_packet["acquisition_health_uncertainties"])

        recommendations = render_recommendations_markdown(record)
        self.assertIn("Acquisition health pressure:", recommendations)
        self.assertIn("strict no-fallback", recommendations.lower())

        inspection = render_inspection_html(record)
        self.assertIn("Acquisition health pressure:", inspection)
        self.assertIn("strict no-fallback", inspection.lower())

    def test_codex_session_prepares_and_resumes(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        output_dir = temp_root / "test-codex-session"
        shutil.rmtree(output_dir, ignore_errors=True)
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT / "src")

        prepare = subprocess.run(
            [
                sys.executable,
                "-m",
                "research_engine",
                "--output-dir",
                str(output_dir),
                "--acquisition-mode",
                "codex-session",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(prepare.returncode, 2, msg=prepare.stderr)
        session_dir = output_dir / "codex-session"
        self.assertTrue((session_dir / "input" / "mission.json").exists())
        self.assertTrue((session_dir / "input" / "query_plan.json").exists())
        self.assertTrue((session_dir / "input" / "instructions.md").exists())
        self.assertTrue((session_dir / "output" / "discovery_hits.jsonl").exists())
        self.assertTrue((session_dir / "output" / "source_documents.jsonl").exists())

        discovery_payload = {
            "provider": "codex-session",
            "track_id": "github-repos",
            "query": "open source deep research workflow source discovery evidence assembly",
            "url": "https://github.com/example-org/example-live-research",
            "title": "example-org/example-live-research",
            "snippet": "Live-discovered research workflow candidate.",
            "hit_type": "repo",
            "candidate_id": "repo-example-org-example-live-research",
            "matched_terms": ["research", "workflow"],
        }
        source_payload = {
            "candidate_id": "repo-example-org-example-live-research",
            "source_url": "https://github.com/example-org/example-live-research",
            "source_type": "github-repo",
            "title": "example-org/example-live-research",
            "summary": "Live-discovered candidate with source-oriented workflow patterns.",
            "provider": "codex-session",
            "track_id": "github-repos",
            "fetched_at": "2026-03-31T12:00:00+00:00",
            "facts": [
                {
                    "fact_type": "architecture",
                    "confidence": "high",
                    "excerpt": "Uses explicit supervisor and researcher phase boundaries with typed run state.",
                    "notes": [],
                },
                {
                    "fact_type": "workflow",
                    "confidence": "medium",
                    "excerpt": "Separates search tools from orchestration so discovery providers can be swapped without rewriting the run loop.",
                    "notes": [],
                },
                {
                    "fact_type": "maintenance",
                    "confidence": "high",
                    "excerpt": "Stars=42, forks=7, open_issues=3, last_push=2026-03-29T00:00:00+00:00.",
                    "notes": [],
                },
            ],
        }
        (session_dir / "output" / "discovery_hits.jsonl").write_text(
            json.dumps(discovery_payload) + "\n",
            encoding="utf-8",
        )
        (session_dir / "output" / "source_documents.jsonl").write_text(
            json.dumps(source_payload) + "\n",
            encoding="utf-8",
        )

        resume = subprocess.run(
            [
                sys.executable,
                "-m",
                "research_engine",
                "--output-dir",
                str(output_dir),
                "--acquisition-mode",
                "codex-session",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

        self.assertEqual(resume.returncode, 0, msg=resume.stderr)
        dossiers = json.loads((output_dir / "candidate_dossiers.json").read_text(encoding="utf-8"))
        self.assertEqual(dossiers[0]["candidate_id"], "repo-example-org-example-live-research")
        self.assertGreaterEqual(dossiers[0]["scorecard"]["total"], 60)
        self.assertIn("provenance_summary", dossiers[0])
        self.assertIn("freshness_summary", dossiers[0])
        self.assertEqual(dossiers[0]["freshness_signal"], "current")
        self.assertEqual(dossiers[0]["freshest_source_age_days"], 2)
        self.assertIn("evidence_cluster_summary", dossiers[0])
        self.assertIn("rejection_flags", dossiers[0])
        self.assertIn("reconsideration_triggers", dossiers[0])

        provider_health = json.loads((output_dir / "provider_health.json").read_text(encoding="utf-8"))
        self.assertEqual(provider_health[0]["provider"], "codex-session")
        self.assertGreaterEqual(provider_health[0]["fetch_successes"], 1)

        shutil.rmtree(output_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_provider_reads_local_corpus(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-success"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        (corpus_dir / "docs" / "api").mkdir(parents=True, exist_ok=True)
        (corpus_dir / "docs" / "api" / "workflow.md").write_text(
            (
                "Architecture boundary: acquisition and scoring are separate systems.\n"
                "Quickstart workflow steps describe local evidence assembly.\n"
                "POST /v1/research/jobs endpoint uses Bearer token authentication.\n"
            ),
            encoding="utf-8",
        )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "gitlab", "web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="research workflow api endpoint acquisition scoring",
                    rationale="Bounded local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {"RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir)},
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertGreaterEqual(len(result.discovery_hits), 1)
        self.assertGreaterEqual(len(result.source_documents), 1)
        self.assertEqual(result.provider_health[0].provider, "local-corpus")
        self.assertFalse(result.provider_health[0].fallback_used)
        self.assertIn("local-corpus-match", result.provider_health[0].reason_codes)
        self.assertEqual(result.source_documents[0].provider, "local-corpus")
        self.assertEqual(result.source_documents[0].source_type, "api-doc")
        self.assertTrue(
            any(
                "Local corpus source." in note
                for fact in result.source_documents[0].facts
                for note in fact.notes
            )
        )

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_provider_falls_back_to_catalog_when_corpus_empty(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-empty"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        corpus_dir.mkdir(parents=True, exist_ok=True)

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "gitlab", "web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded local-first fallback test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {"RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir)},
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertGreaterEqual(len(result.discovery_hits), 1)
        self.assertGreaterEqual(len(result.source_documents), 1)
        self.assertTrue(any(health.provider == "catalog-fallback" for health in result.provider_health))
        local_health = next(health for health in result.provider_health if health.provider == "local-corpus")
        self.assertTrue(local_health.fallback_used)
        self.assertEqual(local_health.status, "fallback")
        self.assertIn("fallback-engaged", local_health.reason_codes)

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_provider_strict_no_fallback_returns_empty_results(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-strict-empty"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        corpus_dir.mkdir(parents=True, exist_ok=True)

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "gitlab", "web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="research workflow docs",
                    rationale="Bounded strict local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {
                "RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir),
                "RESEARCH_ENGINE_LOCAL_STRICT_NO_FALLBACK": "true",
            },
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(result.discovery_hits, [])
        self.assertEqual(result.source_documents, [])
        self.assertFalse(any(health.provider == "catalog-fallback" for health in result.provider_health))
        self.assertEqual(result.provider_health[0].status, "degraded")
        self.assertIn("strict-no-fallback", result.provider_health[0].reason_codes)

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_provider_respects_top_k_per_query(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-topk"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        (corpus_dir / "docs").mkdir(parents=True, exist_ok=True)
        (corpus_dir / "docs" / "one.md").write_text(
            "Research workflow architecture and provider integration guidance.",
            encoding="utf-8",
        )
        (corpus_dir / "docs" / "two.md").write_text(
            "Research workflow process notes with endpoint examples and adapters.",
            encoding="utf-8",
        )
        (corpus_dir / "docs" / "three.md").write_text(
            "Research workflow comparison and evidence clustering walkthrough.",
            encoding="utf-8",
        )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="research workflow integration endpoint",
                    rationale="Bounded top-k local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {
                "RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir),
                "RESEARCH_ENGINE_LOCAL_TOP_K_PER_QUERY": "1",
            },
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(len(result.discovery_hits), 1)
        self.assertEqual(len(result.source_documents), 1)

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_ranking_prefers_phrase_aligned_document(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-semantic-ranking"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        (corpus_dir / "docs").mkdir(parents=True, exist_ok=True)
        (corpus_dir / "docs" / "dense.md").write_text(
            (
                "Acquisition scoring boundary design keeps discovery and judgment stages explicit.\n"
                "The acquisition scoring boundary design is documented as a repeatable workflow pattern.\n"
            ),
            encoding="utf-8",
        )
        (corpus_dir / "docs" / "sparse.md").write_text(
            (
                "Acquisition notes and implementation details are listed in separate sections.\n"
                "Scoring guidance appears later, while boundary remarks and design caveats are isolated.\n"
            ),
            encoding="utf-8",
        )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="acquisition scoring boundary design",
                    rationale="Bounded semantic ranking local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {
                "RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir),
                "RESEARCH_ENGINE_LOCAL_TOP_K_PER_QUERY": "1",
            },
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(len(result.discovery_hits), 1)
        self.assertEqual(len(result.source_documents), 1)
        self.assertEqual(result.discovery_hits[0].candidate_id, "local-docs-dense")
        self.assertEqual(result.source_documents[0].candidate_id, "local-docs-dense")

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_ranking_includes_short_domain_terms(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-short-terms"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        (corpus_dir / "docs").mkdir(parents=True, exist_ok=True)
        (corpus_dir / "docs" / "api-sdk.md").write_text(
            (
                "API SDK integration guide for adapters and auth boundaries.\n"
                "The API SDK surface is designed for external provider hooks.\n"
            ),
            encoding="utf-8",
        )
        (corpus_dir / "docs" / "generic.md").write_text(
            (
                "Architecture workflow guide for adapters and auth details.\n"
                "This guide focuses on process explanations and broad design notes.\n"
            ),
            encoding="utf-8",
        )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="api sdk adapters auth",
                    rationale="Bounded short-domain-term local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {
                "RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir),
                "RESEARCH_ENGINE_LOCAL_TOP_K_PER_QUERY": "1",
            },
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(len(result.discovery_hits), 1)
        self.assertEqual(result.discovery_hits[0].candidate_id, "local-docs-api-sdk")
        self.assertIn("api", result.discovery_hits[0].matched_terms)
        self.assertIn("sdk", result.discovery_hits[0].matched_terms)

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_local_first_stopword_overrides_extend_default_stop_terms(self) -> None:
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {"RESEARCH_ENGINE_LOCAL_STOP_TERMS": "sdk,api"},
            clear=False,
        ):
            terms = provider._terms("API SDK adapters and auth guidance")

        self.assertNotIn("api", terms)
        self.assertNotIn("sdk", terms)
        self.assertNotIn("and", terms)
        self.assertIn("adapters", terms)
        self.assertIn("auth", terms)

    def test_local_first_emits_lexical_diagnostics_note(self) -> None:
        temp_root = ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        corpus_dir = temp_root / "local-corpus-lexical-diagnostics"
        shutil.rmtree(corpus_dir, ignore_errors=True)
        (corpus_dir / "docs").mkdir(parents=True, exist_ok=True)
        for name in ("one.md", "two.md", "three.md", "four.md"):
            (corpus_dir / "docs" / name).write_text(
                (
                    "Guide guide guide for adapters and auth integration workflows.\n"
                    "This guide focuses on integration paths and examples.\n"
                ),
                encoding="utf-8",
            )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="local-first",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find local documentation evidence.",
                    priority=1,
                    provider_hint="local-first",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="api sdk adapters auth",
                    rationale="Bounded lexical diagnostics local-first test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("local-first")

        with mock.patch.dict(
            os.environ,
            {
                "RESEARCH_ENGINE_LOCAL_CORPUS_DIR": str(corpus_dir),
                "RESEARCH_ENGINE_LOCAL_TOP_K_PER_QUERY": "1",
            },
            clear=False,
        ):
            result = provider.acquire(plan, mission)

        diagnostics_notes = [note for note in result.notes if "Local-first lexical diagnostics:" in note]
        self.assertTrue(diagnostics_notes)
        self.assertIn("suggested_stop_terms=", diagnostics_notes[0])
        self.assertIn("guide", diagnostics_notes[0].lower())
        self.assertTrue(
            any(
                "Local-first lexical diagnostics:" in note
                for health in result.provider_health
                for note in health.notes
            )
        )

        shutil.rmtree(corpus_dir, ignore_errors=True)
        shutil.rmtree(temp_root, ignore_errors=True)

    def test_cli_extracts_local_stop_term_suggestion(self) -> None:
        suggestion = _extract_local_stop_term_suggestion(
            [
                "Local-first acquisition scanning corpus directory: C:/tmp/corpus.",
                "Local-first lexical diagnostics: docs=4, unique_terms=11, top_terms=guide(12), suggested_stop_terms=guide, examples, docs.",
            ]
        )
        self.assertEqual(suggestion, "guide, examples, docs")
        self.assertIsNone(
            _extract_local_stop_term_suggestion(
                ["Local-first lexical diagnostics: docs=4, unique_terms=11, top_terms=guide(12), suggested_stop_terms=none."]
            )
        )

    def test_cli_loads_local_dotenv_without_overriding_existing_env(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dotenv_path = Path(temp_dir) / ".env"
            dotenv_path.write_text(
                "\n".join(
                    [
                        "# local-only provider keys",
                        "RESEARCH_ENGINE_TAVILY_API_KEY=dotenv-tavily",
                        "RESEARCH_ENGINE_EXA_API_KEY=dotenv-exa",
                    ]
                ),
                encoding="utf-8",
            )
            with mock.patch.dict(
                os.environ,
                {"RESEARCH_ENGINE_EXA_API_KEY": "existing-exa"},
                clear=False,
            ):
                _load_local_dotenv(dotenv_path)
                self.assertEqual(os.environ.get("RESEARCH_ENGINE_TAVILY_API_KEY"), "dotenv-tavily")
                self.assertEqual(os.environ.get("RESEARCH_ENGINE_EXA_API_KEY"), "existing-exa")

    def test_normalization_extracts_source_age_and_candidate_freshness(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        document = SourceDocument(
            candidate_id="repo-example-recent",
            source_url="https://github.com/example/recent",
            source_type="github-repo",
            title="example/recent",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="architecture",
                    confidence="high",
                    excerpt="Uses explicit phase boundaries for discovery and synthesis.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="workflow",
                    confidence="medium",
                    excerpt="Separates acquisition from scoring so providers remain replaceable.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="integration",
                    confidence="medium",
                    excerpt="Supports external provider adapters and inspectable artifacts.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="maintenance",
                    confidence="high",
                    excerpt="Stars=12, forks=2, open_issues=1, last_push=2026-03-30T00:00:00+00:00.",
                    notes=[],
                ),
            ],
        )

        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        self.assertEqual(evidence[0].source_updated_at, "2026-03-30T00:00:00+00:00")
        self.assertEqual(evidence[0].source_age_days, 2)
        self.assertEqual(evidence[0].freshness_signal, "current")

        dossiers = build_candidate_shells(evidence)
        self.assertEqual(dossiers[0].freshness_signal, "current")
        self.assertEqual(dossiers[0].freshest_source_updated_at, "2026-03-30T00:00:00+00:00")
        self.assertEqual(dossiers[0].freshest_source_age_days, 2)
        self.assertIn("2 days old at capture", dossiers[0].freshness_summary)

    def test_catalog_fetch_emits_repo_metadata_for_freshness(self) -> None:
        hit = DiscoveryHit(
            provider="catalog",
            track_id="github-repos",
            query="open source deep research workflow source discovery evidence assembly",
            url="https://github.com/langchain-ai/open_deep_research",
            title="Open Deep Research",
            snippet="Composable research workflow framework with explicit phase separation and provider seams.",
            hit_type="repo",
            candidate_id="open-deep-research",
            matched_terms=["deep", "research", "workflow"],
        )

        document = fetch_documents([hit])[0]
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertTrue(any("stars=6500" in fact.excerpt for fact in maintenance_facts))
        self.assertTrue(any("open_issues=120" in fact.excerpt for fact in maintenance_facts))
        self.assertTrue(any("last_push=2026-03-29T00:00:00+00:00" in fact.excerpt for fact in maintenance_facts))
        self.assertTrue(
            any(
                "latest_release_published_at=2026-03-18T00:00:00+00:00"
                in fact.excerpt
                for fact in maintenance_facts
            )
        )
        self.assertTrue(any("releases_last_180d=6" in fact.excerpt for fact in maintenance_facts))
        self.assertTrue(
            any(
                "freshness and maintenance scoring" in note
                for fact in maintenance_facts
                for note in fact.notes
            )
        )

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        self.assertEqual(evidence[0].source_updated_at, "2026-03-29T00:00:00+00:00")

    def test_trust_policy_presets_apply_and_allow_mission_overrides(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            trust_preferences=TrustPreferences(
                policy_preset="official-first",
                prefer_official_docs=False,
                prefer_active_repos=False,
                source_type_overrides={"blog-post": "secondary"},
            ),
        )

        policy = build_source_type_trust_policy(mission)
        self.assertEqual(policy["github-repo"], "secondary")
        self.assertEqual(policy["gitlab-repo"], "secondary")
        self.assertEqual(policy["product-doc"], "secondary")
        self.assertEqual(policy["api-doc"], "secondary")
        self.assertEqual(policy["academic-paper"], "primary")
        self.assertEqual(policy["blog-post"], "secondary")

    def test_query_planning_presets_shape_tracks_and_queries(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="implementation-scout",
            constraints=MissionConstraints(max_queries=4),
        )

        plan = build_search_plan(mission)
        self.assertEqual(plan.planning_preset, "implementation-scout")
        self.assertEqual([track.track_id for track in plan.tracks[:2]], ["github-repos", "architecture-patterns"])
        self.assertEqual(len(plan.queries), 4)
        self.assertEqual(plan.queries[0].track_id, "github-repos")
        self.assertTrue(any(query.track_id == "architecture-patterns" for query in plan.queries))
        self.assertTrue(any("Planning preset: implementation-scout" == note for note in plan.planning_notes))
        self.assertFalse(any(query.track_id == "comparisons" for query in plan.queries))

    def test_query_planning_required_and_excluded_tracks_apply(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="official-first",
            required_track_ids=["comparisons"],
            excluded_track_ids=["api-docs"],
            constraints=MissionConstraints(max_queries=4),
        )

        plan = build_search_plan(mission)
        self.assertEqual(plan.required_track_ids, ["comparisons"])
        self.assertEqual(plan.excluded_track_ids, ["api-docs"])
        self.assertTrue(any(track.track_id == "comparisons" for track in plan.tracks))
        self.assertFalse(any(track.track_id == "api-docs" for track in plan.tracks))
        self.assertTrue(any(query.track_id == "comparisons" for query in plan.queries))
        self.assertFalse(any(query.track_id == "api-docs" for query in plan.queries))
        self.assertTrue(any("Added required track: comparisons." == note for note in plan.planning_notes))

    def test_query_planning_required_tracks_override_exclusions(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="balanced-discovery",
            required_track_ids=["github-repos"],
            excluded_track_ids=["github-repos"],
            constraints=MissionConstraints(max_queries=2),
        )

        plan = build_search_plan(mission)
        self.assertEqual(plan.required_track_ids, ["github-repos"])
        self.assertEqual(plan.excluded_track_ids, [])
        self.assertTrue(any(track.track_id == "github-repos" for track in plan.tracks))
        self.assertTrue(any(query.track_id == "github-repos" for query in plan.queries))
        self.assertTrue(
            any(
                "Required tracks override exclusions for: github-repos." == note
                for note in plan.planning_notes
            )
        )

    def test_query_planning_required_and_excluded_query_types_apply(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="balanced-discovery",
            required_query_types_by_track={"official-docs": ["official-docs"]},
            excluded_query_types_by_track={"comparisons": ["comparison"]},
            constraints=MissionConstraints(max_queries=6),
        )

        plan = build_search_plan(mission)
        self.assertEqual(
            plan.required_query_types_by_track,
            {"official-docs": ["official-docs"]},
        )
        self.assertEqual(
            plan.excluded_query_types_by_track,
            {"comparisons": ["comparison"]},
        )
        self.assertTrue(
            any(
                query.track_id == "official-docs" and query.query_type == "official-docs"
                for query in plan.queries
            )
        )
        self.assertFalse(
            any(
                query.track_id == "comparisons" and query.query_type == "comparison"
                for query in plan.queries
            )
        )

    def test_query_planning_required_query_types_override_exclusions(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="balanced-discovery",
            required_query_types_by_track={"github-repos": ["repo-discovery"]},
            excluded_query_types_by_track={"github-repos": ["repo-discovery"]},
            constraints=MissionConstraints(max_queries=3),
        )

        plan = build_search_plan(mission)
        self.assertEqual(
            plan.required_query_types_by_track,
            {"github-repos": ["repo-discovery"]},
        )
        self.assertEqual(plan.excluded_query_types_by_track, {})
        self.assertTrue(
            any(
                query.track_id == "github-repos" and query.query_type == "repo-discovery"
                for query in plan.queries
            )
        )
        self.assertTrue(
            any(
                "Required query types override exclusions for github-repos: repo-discovery."
                == note
                for note in plan.planning_notes
            )
        )

    def test_query_planning_track_provider_preferences_apply(self) -> None:
        mission = ResearchMission(
            objective="Find reusable research workflow systems.",
            planning_preset="official-first",
            track_provider_preferences={"official-docs": ["github"]},
            constraints=MissionConstraints(max_queries=4),
        )

        plan = build_search_plan(mission)
        self.assertEqual(
            plan.track_provider_preferences["official-docs"],
            ["github"],
        )
        self.assertEqual(
            plan.track_provider_preferences["github-repos"],
            ["github", "gitlab", "exa", "tavily", "firecrawl", "web"],
        )
        self.assertTrue(
            any(
                "Applied provider preference for official-docs: github." == note
                for note in plan.planning_notes
            )
        )

    def test_query_planning_adds_mission_diversified_queries_when_budget_allows(self) -> None:
        mission = ResearchMission(
            objective=(
                "Find reusable research workflow systems with provenance attestation, "
                "verification envelopes, and evidence lineage traceability."
            ),
            planning_preset="balanced-discovery",
            constraints=MissionConstraints(max_queries=8),
        )

        plan = build_search_plan(mission)
        diversified_queries = [query for query in plan.queries if "-mission" in query.query_id]
        self.assertEqual(len(plan.queries), 8)
        self.assertTrue(diversified_queries)
        self.assertTrue(any("provenance" in query.text for query in diversified_queries))
        self.assertTrue(
            any(
                "Added mission-diversified query for official-docs:" in note
                for note in plan.planning_notes
            )
        )

    def test_query_planning_mission_diversification_respects_saturated_budget(self) -> None:
        mission = ResearchMission(
            objective=(
                "Find reusable research workflow systems with provenance attestation, "
                "verification envelopes, and evidence lineage traceability."
            ),
            planning_preset="balanced-discovery",
            constraints=MissionConstraints(max_queries=6),
        )

        plan = build_search_plan(mission)
        self.assertEqual(len(plan.queries), 6)
        self.assertFalse(any("-mission" in query.query_id for query in plan.queries))
        self.assertTrue(
            any(
                "Mission diversification skipped: query budget already saturated." == note
                for note in plan.planning_notes
            )
        )

    def test_query_planning_mission_diversification_notes_match_budgeted_queries(self) -> None:
        mission = ResearchMission(
            objective=(
                "Find reusable research workflow systems with provenance attestation, "
                "verification envelopes, and evidence lineage traceability."
            ),
            planning_preset="balanced-discovery",
            constraints=MissionConstraints(max_queries=7),
        )

        plan = build_search_plan(mission)
        diversified_queries = [query for query in plan.queries if "-mission" in query.query_id]
        added_notes = [
            note
            for note in plan.planning_notes
            if note.startswith("Added mission-diversified query for ")
        ]
        self.assertEqual(len(plan.queries), 7)
        self.assertEqual(len(added_notes), len(diversified_queries))
        self.assertTrue(
            any(
                "Mission diversification dropped 1 query(ies) due to query budget." == note
                for note in plan.planning_notes
            )
        )

    def test_candidate_clustering_collapses_duplicates_and_flags_contradictions(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        document = SourceDocument(
            candidate_id="repo-example-clustered",
            source_url="https://github.com/example/clustered",
            source_type="github-repo",
            title="example/clustered",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="architecture",
                    confidence="high",
                    excerpt="Uses explicit reusable phase boundaries for discovery.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="architecture",
                    confidence="high",
                    excerpt="Uses explicit reusable phase boundaries for discovery.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="workflow",
                    confidence="high",
                    excerpt="Provides a clean bounded workflow for evidence review.",
                    notes=[],
                ),
                SourceFact(
                    fact_type="workflow",
                    confidence="medium",
                    excerpt="Provides a weak shallow workflow that is not reusable.",
                    notes=[],
                ),
            ],
        )

        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        dossiers = build_candidate_shells(evidence)
        dossier = dossiers[0]

        self.assertEqual(dossier.evidence_cluster_count, 3)
        self.assertEqual(dossier.duplicate_evidence_count, 1)
        self.assertEqual(dossier.contradiction_flags, ["workflow-contradiction"])
        self.assertIn("contradictory-evidence", dossier.rejection_flags)
        self.assertTrue(any("duplicate architecture items" in line for line in dossier.evidence_cluster_summary))
        self.assertTrue(any("workflow contradiction" in line for line in dossier.evidence_cluster_summary))

        first_duplicate = next(item for item in evidence if item.evidence_id == "repo-example-clustered-e1")
        self.assertEqual(first_duplicate.cluster_id, "repo-example-clustered-c1")
        self.assertEqual(first_duplicate.duplicate_evidence_ids, ["repo-example-clustered-e2"])
        contradictory_item = next(item for item in evidence if item.evidence_id == "repo-example-clustered-e3")
        self.assertEqual(contradictory_item.contradiction_evidence_ids, ["repo-example-clustered-e4"])

    def test_detect_actionable_evidence_gaps_identifies_missing_classes(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        document = SourceDocument(
            candidate_id="candidate-gap-a",
            source_url="https://blog.example.com/candidate-gap-a",
            source_type="blog-post",
            title="candidate-gap-a",
            summary="Blog summary without primary-source or maintenance coverage.",
            provider="web-live",
            track_id="comparisons",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="architecture",
                    confidence="medium",
                    excerpt="Architecture overview only.",
                    notes=[],
                )
            ],
        )

        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        candidates = build_candidate_shells(evidence)
        directives = detect_actionable_evidence_gaps(candidates, evidence, max_directives=3)

        self.assertEqual(len(directives), 1)
        gaps = set(directives[0]["gaps"])
        self.assertIn("missing-primary-source-evidence", gaps)
        self.assertIn("missing-technical-facts", gaps)
        self.assertIn("missing-maintenance-freshness", gaps)
        self.assertIn("missing-comparative-evidence", gaps)

    def test_run_mission_executes_single_evidence_gap_follow_up_pass(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find candidate references.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="official-docs",
                    query_type="official-docs",
                    text="candidate gap evidence",
                    rationale="Bounded test query.",
                )
            ],
            planning_notes=[],
        )
        initial_hit = DiscoveryHit(
            provider="web-live",
            track_id="official-docs",
            query="candidate gap evidence",
            url="https://blog.example.com/candidate-gap-a",
            title="candidate-gap-a",
            snippet="Blog summary without strong primary evidence.",
            hit_type="doc",
            candidate_id="candidate-gap-a",
            matched_terms=["candidate", "evidence"],
        )
        initial_document = SourceDocument(
            candidate_id="candidate-gap-a",
            source_url="https://blog.example.com/candidate-gap-a",
            source_type="blog-post",
            title="candidate-gap-a",
            summary="Blog summary without strong primary evidence.",
            provider="web-live",
            track_id="official-docs",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="architecture",
                    confidence="medium",
                    excerpt="Architecture overview only.",
                    notes=[],
                )
            ],
        )
        follow_up_hit = DiscoveryHit(
            provider="github-live",
            track_id="official-docs",
            query="candidate-gap-a official docs repository github gitlab readme",
            url="https://github.com/example/candidate-gap-a",
            title="example/candidate-gap-a",
            snippet="Repository with workflow, integration, and maintenance signals.",
            hit_type="repo",
            candidate_id="candidate-gap-a",
            matched_terms=["repository", "workflow"],
        )
        follow_up_document = SourceDocument(
            candidate_id="candidate-gap-a",
            source_url="https://github.com/example/candidate-gap-a",
            source_type="github-repo",
            title="example/candidate-gap-a",
            summary="Repository follow-up evidence.",
            provider="github-live",
            track_id="official-docs",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("workflow", "high", "Workflow stages are explicit and bounded.", []),
                SourceFact("integration", "high", "Integration uses provider adapters.", []),
                SourceFact(
                    "maintenance",
                    "high",
                    "Stars=12, forks=2, open_issues=1, last_push=2026-03-31T00:00:00+00:00.",
                    [],
                ),
            ],
        )

        class _FakeGapProvider:
            def __init__(self) -> None:
                self.follow_up_calls = 0
                self.received_gap_directives: list[dict[str, object]] = []

            def acquire(self, plan: SearchPlan, mission: ResearchMission, output_dir: Path | None = None) -> AcquisitionResult:
                del plan, mission, output_dir
                return AcquisitionResult(
                    discovery_hits=[initial_hit],
                    source_documents=[initial_document],
                    notes=["Initial acquisition for bounded gap-follow-up test."],
                    provider_health=[
                        ProviderHealth(
                            provider="live-hybrid",
                            discovery_queries=1,
                            discovery_hits=1,
                            fetch_attempts=1,
                            fetch_successes=1,
                            fetch_failures=0,
                            fallback_used=False,
                        )
                    ],
                )

            def acquire_evidence_gap_follow_up(
                self,
                *,
                plan: SearchPlan,
                mission: ResearchMission,
                gap_directives: list[dict[str, object]],
                existing_documents: list[SourceDocument],
            ) -> EvidenceGapFollowUpResult:
                del plan, mission, existing_documents
                self.follow_up_calls += 1
                self.received_gap_directives = gap_directives
                return EvidenceGapFollowUpResult(
                    discovery_hits=[follow_up_hit],
                    source_documents=[follow_up_document],
                    notes=["Evidence-gap follow-up pass engaged in bounded test."],
                    provider_health=[
                        ProviderHealth(
                            provider="live-hybrid-follow-up",
                            discovery_queries=1,
                            discovery_hits=1,
                            fetch_attempts=1,
                            fetch_successes=1,
                            fetch_failures=0,
                            fallback_used=False,
                            notes=["Follow-up provider telemetry preserved."],
                        )
                    ],
                )

        provider = _FakeGapProvider()
        with (
            mock.patch("research_engine.orchestrator.build_search_plan", return_value=plan),
            mock.patch("research_engine.orchestrator.get_acquisition_provider", return_value=provider),
        ):
            record = run_mission(mission, output_dir=None, acquisition_mode="live-hybrid")

        self.assertEqual(provider.follow_up_calls, 1)
        self.assertGreaterEqual(len(provider.received_gap_directives), 1)
        self.assertEqual(len(record.source_documents), 2)
        self.assertTrue(any("Evidence-gap scan found" in note for note in record.acquisition_notes))
        self.assertTrue(any("Evidence-gap follow-up pass engaged" in note for note in record.acquisition_notes))
        self.assertTrue(any(health.provider == "live-hybrid-follow-up" for health in record.provider_health))
        self.assertTrue(
            any(
                item.trust_signal == "primary"
                for item in record.evidence_bundle
                if item.candidate_id == "candidate-gap-a"
            )
        )

    def test_scoring_applies_recency_decay_to_maintenance_health(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        documents = [
            SourceDocument(
                candidate_id="repo-example-recent",
                source_url="https://github.com/example/recent",
                source_type="github-repo",
                title="example/recent",
                summary="Recent repository summary.",
                provider="github-live",
                track_id="github-repos",
                fetched_at="2026-04-01T00:00:00+00:00",
                facts=[
                    SourceFact("architecture", "high", "Uses explicit phase boundaries.", []),
                    SourceFact("workflow", "high", "Separates acquisition from scoring.", []),
                    SourceFact("integration", "medium", "Supports provider adapters.", []),
                    SourceFact(
                        "maintenance",
                        "high",
                        "Stars=12, forks=2, open_issues=1, last_push=2026-03-30T00:00:00+00:00.",
                        [],
                    ),
                ],
            ),
            SourceDocument(
                candidate_id="repo-example-stale",
                source_url="https://github.com/example/stale",
                source_type="github-repo",
                title="example/stale",
                summary="Stale repository summary.",
                provider="github-live",
                track_id="github-repos",
                fetched_at="2026-04-01T00:00:00+00:00",
                facts=[
                    SourceFact("architecture", "high", "Uses explicit phase boundaries.", []),
                    SourceFact("workflow", "high", "Separates acquisition from scoring.", []),
                    SourceFact("integration", "medium", "Supports provider adapters.", []),
                    SourceFact(
                        "maintenance",
                        "high",
                        "Stars=12, forks=2, open_issues=1, last_push=2022-03-30T00:00:00+00:00.",
                        [],
                    ),
                ],
            ),
        ]

        evidence = normalize_evidence(
            documents,
            trust_policy=build_source_type_trust_policy(mission),
        )
        candidates = build_candidate_shells(evidence)
        accepted, rejected = score_candidates(candidates, evidence, mission)
        scored = {candidate.candidate_id: candidate for candidate in accepted}
        scored.update(
            {
                rejection.candidate_id: next(
                    candidate for candidate in candidates if candidate.candidate_id == rejection.candidate_id
                )
                for rejection in rejected
            }
        )

        recent = scored["repo-example-recent"]
        stale = scored["repo-example-stale"]
        self.assertGreater(
            recent.scorecard.breakdown["maintenance_health"],
            stale.scorecard.breakdown["maintenance_health"],
        )
        self.assertTrue(any("Freshness signal: current" in line for line in recent.scorecard.rationale))
        self.assertTrue(any("Freshness signal: stale" in line for line in stale.scorecard.rationale))

    def test_scoring_treats_gitlab_repo_as_self_hostable(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        document = SourceDocument(
            candidate_id="repo-example-gitlab-self-hostable",
            source_url="https://gitlab.com/example/research-engine",
            source_type="gitlab-repo",
            title="example/research-engine",
            summary="Composable GitLab workflow candidate.",
            provider="gitlab-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("architecture", "high", "Uses explicit phase boundaries.", []),
                SourceFact("workflow", "high", "Separates acquisition from scoring.", []),
                SourceFact("integration", "medium", "Supports provider adapters.", []),
                SourceFact(
                    "maintenance",
                    "high",
                    "Stars=12, forks=2, open_issues=1, last_push=2026-03-30T00:00:00+00:00.",
                    [],
                ),
            ],
        )

        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        candidates = build_candidate_shells(evidence)
        accepted, rejected = score_candidates(candidates, evidence, mission)
        scored = {candidate.candidate_id: candidate for candidate in accepted}
        scored.update(
            {
                rejection.candidate_id: next(
                    candidate for candidate in candidates if candidate.candidate_id == rejection.candidate_id
                )
                for rejection in rejected
            }
        )

        gitlab_candidate = scored["repo-example-gitlab-self-hostable"]
        self.assertEqual(gitlab_candidate.scorecard.breakdown["self_hostability"], 12)

    def test_scoring_uses_clusters_for_evidence_density_and_contradiction_risk(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        duplicate_document = SourceDocument(
            candidate_id="repo-example-duplicates",
            source_url="https://github.com/example/duplicates",
            source_type="github-repo",
            title="example/duplicates",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("architecture", "high", "Uses explicit reusable phase boundaries.", []),
                SourceFact("architecture", "high", "Uses explicit reusable phase boundaries.", []),
                SourceFact("workflow", "high", "Supports bounded workflow review.", []),
                SourceFact("integration", "medium", "Supports provider adapters.", []),
            ],
        )
        contradiction_document = SourceDocument(
            candidate_id="repo-example-contradiction",
            source_url="https://github.com/example/contradiction",
            source_type="github-repo",
            title="example/contradiction",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("architecture", "high", "Uses explicit reusable phase boundaries.", []),
                SourceFact("workflow", "high", "Supports a clean bounded workflow.", []),
                SourceFact("workflow", "medium", "Uses a weak shallow workflow that is not reusable.", []),
                SourceFact("integration", "medium", "Supports provider adapters.", []),
            ],
        )

        evidence = normalize_evidence(
            [duplicate_document, contradiction_document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        candidates = build_candidate_shells(evidence)
        accepted, rejected = score_candidates(candidates, evidence, mission)
        scored = {candidate.candidate_id: candidate for candidate in accepted}
        scored.update(
            {
                rejection.candidate_id: next(
                    candidate for candidate in candidates if candidate.candidate_id == rejection.candidate_id
                )
                for rejection in rejected
            }
        )

        duplicates = scored["repo-example-duplicates"]
        contradiction = scored["repo-example-contradiction"]
        self.assertEqual(duplicates.scorecard.breakdown["evidence_density"], 9)
        self.assertEqual(contradiction.scorecard.breakdown["evidence_density"], 12)
        self.assertLess(
            contradiction.scorecard.breakdown["evidence_risk_penalty"],
            duplicates.scorecard.breakdown["evidence_risk_penalty"],
        )
        self.assertTrue(any("Collapsed 4 evidence items into 3 clusters." in line for line in duplicates.scorecard.rationale))
        self.assertTrue(any("Contradiction flags: workflow-contradiction." in line for line in contradiction.scorecard.rationale))

    def test_scoring_penalizes_fallback_majority_evidence(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        direct_document = SourceDocument(
            candidate_id="repo-example-direct-evidence",
            source_url="https://github.com/example/direct",
            source_type="github-repo",
            title="example/direct",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("architecture", "high", "Uses explicit phase boundaries.", [], "direct"),
                SourceFact("workflow", "high", "Separates acquisition from scoring.", [], "direct"),
                SourceFact("integration", "medium", "Supports provider adapters.", [], "direct"),
                SourceFact(
                    "maintenance",
                    "high",
                    "Stars=12, forks=2, open_issues=1, last_push=2026-03-30T00:00:00+00:00.",
                    [],
                    "derived",
                ),
            ],
        )
        fallback_document = SourceDocument(
            candidate_id="repo-example-fallback-evidence",
            source_url="https://github.com/example/fallback",
            source_type="github-repo",
            title="example/fallback",
            summary="Repository summary.",
            provider="github-live",
            track_id="github-repos",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact("architecture", "medium", "Repository summary.", [], "fallback"),
                SourceFact("workflow", "medium", "Repository summary.", [], "fallback"),
                SourceFact("integration", "medium", "Repository summary.", [], "fallback"),
                SourceFact(
                    "maintenance",
                    "high",
                    "Stars=12, forks=2, open_issues=1, last_push=2026-03-30T00:00:00+00:00.",
                    [],
                    "derived",
                ),
            ],
        )

        evidence = normalize_evidence(
            [direct_document, fallback_document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        candidates = build_candidate_shells(evidence)
        accepted, rejected = score_candidates(candidates, evidence, mission)
        scored = {candidate.candidate_id: candidate for candidate in accepted}
        scored.update(
            {
                rejection.candidate_id: next(
                    candidate for candidate in candidates if candidate.candidate_id == rejection.candidate_id
                )
                for rejection in rejected
            }
        )

        direct = scored["repo-example-direct-evidence"]
        fallback = scored["repo-example-fallback-evidence"]
        self.assertGreater(direct.scorecard.total, fallback.scorecard.total)
        self.assertEqual(direct.scorecard.breakdown["extraction_fidelity_penalty"], 0)
        self.assertLess(fallback.scorecard.breakdown["extraction_fidelity_penalty"], 0)
        self.assertIn("fallback-evidence-majority", fallback.rejection_flags)
        self.assertIn("fallback=3", fallback.extraction_fidelity_summary)
        self.assertTrue(
            any("Fallback-derived evidence penalty applied" in line for line in fallback.scorecard.rationale)
        )

    def test_live_hybrid_request_retry_telemetry_records_timeout_and_backoff(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        provider._reset_request_telemetry()

        with (
            mock.patch("research_engine.acquisition.sleep"),
            mock.patch(
                "research_engine.acquisition.urlopen",
                side_effect=[
                    TimeoutError("timed out"),
                    _FakeResponse(b'{"items": []}'),
                ],
            ),
        ):
            payload = provider._read_json(
                "https://api.github.com/search/repositories?q=research-engine",
                provider_key="github-discovery",
                github=True,
            )

        telemetry = provider._request_telemetry["github-discovery"]
        self.assertEqual(payload, {"items": []})
        self.assertEqual(telemetry.request_attempts, 2)
        self.assertEqual(telemetry.request_successes, 1)
        self.assertEqual(telemetry.retry_attempts, 1)
        self.assertEqual(telemetry.timeout_count, 1)
        self.assertEqual(telemetry.backoff_events, 1)
        self.assertAlmostEqual(telemetry.total_backoff_seconds, 0.25)
        self.assertAlmostEqual(telemetry.max_backoff_seconds, 0.25)
        self.assertTrue(any("backoff=0.25s" in note for note in telemetry.notes))

    def test_read_json_uses_github_auth_header_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        captured_headers: dict[str, str] = {}

        def fake_read_bytes(request):
            nonlocal captured_headers
            captured_headers = {key.lower(): value for key, value in request.header_items()}
            return b'{"items": []}'

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_GITHUB_TOKEN": "gh-test-token"}, clear=False),
            mock.patch.object(provider, "_read_bytes", side_effect=fake_read_bytes),
        ):
            payload = provider._read_json(
                "https://api.github.com/search/repositories?q=research-engine",
                provider_key="github-discovery",
                github=True,
            )

        self.assertEqual(payload, {"items": []})
        self.assertEqual(captured_headers.get("authorization"), "Bearer gh-test-token")

    def test_read_json_uses_gitlab_auth_header_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        captured_headers: dict[str, str] = {}

        def fake_read_bytes(request):
            nonlocal captured_headers
            captured_headers = {key.lower(): value for key, value in request.header_items()}
            return b"[]"

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_GITLAB_TOKEN": "gl-test-token"}, clear=False),
            mock.patch.object(provider, "_read_bytes", side_effect=fake_read_bytes),
        ):
            payload = provider._read_json(
                "https://gitlab.com/api/v4/projects?search=research-engine",
                provider_key="gitlab-discovery",
            )

        self.assertEqual(payload, [])
        self.assertEqual(captured_headers.get("private-token"), "gl-test-token")

    def test_post_json_uses_exa_auth_header_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        captured_headers: dict[str, str] = {}

        def fake_read_bytes(request):
            nonlocal captured_headers
            captured_headers = {key.lower(): value for key, value in request.header_items()}
            return b'{"results": []}'

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_EXA_API_KEY": "exa-test-key"}, clear=False),
            mock.patch.object(provider, "_read_bytes", side_effect=fake_read_bytes),
        ):
            payload = provider._post_json(
                "https://api.exa.ai/search",
                provider_key="exa-discovery",
                body={"query": "research workflow"},
            )

        self.assertEqual(payload, {"results": []})
        self.assertEqual(captured_headers.get("x-api-key"), "exa-test-key")

    def test_post_json_uses_tavily_auth_header_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        captured_headers: dict[str, str] = {}

        def fake_read_bytes(request):
            nonlocal captured_headers
            captured_headers = {key.lower(): value for key, value in request.header_items()}
            return b'{"results": []}'

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_TAVILY_API_KEY": "tv-test-key"}, clear=False),
            mock.patch.object(provider, "_read_bytes", side_effect=fake_read_bytes),
        ):
            payload = provider._post_json(
                "https://api.tavily.com/search",
                provider_key="tavily-discovery",
                body={"query": "research workflow"},
            )

        self.assertEqual(payload, {"results": []})
        self.assertEqual(captured_headers.get("authorization"), "Bearer tv-test-key")

    def test_post_json_uses_firecrawl_auth_header_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        captured_headers: dict[str, str] = {}

        def fake_read_bytes(request):
            nonlocal captured_headers
            captured_headers = {key.lower(): value for key, value in request.header_items()}
            return b'{"data": {"markdown": "# ok"}}'

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_FIRECRAWL_API_KEY": "fc-test-key"}, clear=False),
            mock.patch.object(provider, "_read_bytes", side_effect=fake_read_bytes),
        ):
            payload = provider._post_json(
                "https://api.firecrawl.dev/v1/scrape",
                provider_key="firecrawl-fetch",
                body={"url": "https://example.com"},
            )

        self.assertEqual(payload, {"data": {"markdown": "# ok"}})
        self.assertEqual(captured_headers.get("authorization"), "Bearer fc-test-key")

    def test_read_json_closes_http_error_response_handle_on_failure(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        response_fp = tempfile.TemporaryFile()
        response_fp.write(b"forbidden")
        response_fp.seek(0)
        error = HTTPError(
            url="https://api.github.com/search/repositories?q=research-engine",
            code=403,
            msg="Forbidden",
            hdrs=None,
            fp=response_fp,
        )

        try:
            with (
                mock.patch("research_engine.acquisition.sleep"),
                mock.patch.object(provider, "_read_bytes", side_effect=error),
            ):
                with self.assertRaises(HTTPError):
                    provider._read_json(
                        "https://api.github.com/search/repositories?q=research-engine",
                        provider_key="github-discovery",
                        github=True,
                    )
            self.assertTrue(response_fp.closed)
        finally:
            if not response_fp.closed:
                response_fp.close()

    def test_live_hybrid_notes_include_detected_auth_tokens(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "gitlab", "web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded auth-note test query.",
                )
            ],
            planning_notes=[],
        )
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch.dict(
                os.environ,
                {
                    "RESEARCH_ENGINE_GITHUB_TOKEN": "gh-test-token",
                    "RESEARCH_ENGINE_GITLAB_TOKEN": "gl-test-token",
                    "RESEARCH_ENGINE_TAVILY_API_KEY": "tv-test-key",
                    "RESEARCH_ENGINE_EXA_API_KEY": "exa-test-key",
                    "RESEARCH_ENGINE_FIRECRAWL_API_KEY": "fc-test-key",
                },
                clear=False,
            ),
            mock.patch.object(provider, "_github_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_gitlab_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_tavily_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_exa_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_firecrawl_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_web_hits_for_query", return_value=[]),
        ):
            result = provider.acquire(plan, mission)

        self.assertTrue(any("GitHub API token detected" in note for note in result.notes))
        self.assertTrue(any("GitLab token detected" in note for note in result.notes))
        self.assertTrue(any("Tavily API key detected" in note for note in result.notes))
        self.assertTrue(any("Exa API key detected" in note for note in result.notes))
        self.assertTrue(any("Firecrawl API key detected" in note for note in result.notes))

    def test_live_hybrid_provider_health_reports_retry_timeout_telemetry(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded live test query.",
                )
            ],
            planning_notes=[],
        )
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch("research_engine.acquisition.sleep"),
            mock.patch(
                "research_engine.acquisition.urlopen",
                side_effect=[
                    TimeoutError("timed out"),
                    _FakeResponse(b'{"items": []}'),
                    _FakeResponse(b'{"RelatedTopics": []}'),
                ],
            ),
        ):
            result = provider.acquire(plan, mission)

        live_health = result.provider_health[0]
        github_discovery = next(
            health for health in result.provider_health if health.provider == "github-discovery"
        )
        web_discovery = next(
            health for health in result.provider_health if health.provider == "web-discovery"
        )

        self.assertTrue(live_health.fallback_used)
        self.assertEqual(live_health.retry_attempts, 1)
        self.assertEqual(live_health.timeout_count, 1)
        self.assertEqual(live_health.backoff_events, 1)
        self.assertAlmostEqual(live_health.total_backoff_seconds, 0.25)
        self.assertEqual(github_discovery.request_attempts, 2)
        self.assertEqual(github_discovery.request_successes, 1)
        self.assertEqual(github_discovery.retry_attempts, 1)
        self.assertEqual(github_discovery.timeout_count, 1)
        self.assertEqual(web_discovery.request_attempts, 1)
        self.assertGreaterEqual(len(result.discovery_hits), 1)
        self.assertEqual(live_health.status, "fallback")
        self.assertEqual(github_discovery.status, "fallback")
        self.assertEqual(web_discovery.status, "fallback")
        self.assertIn("fallback-engaged", live_health.reason_codes)
        self.assertIn("timeout", github_discovery.reason_codes)
        self.assertTrue(github_discovery.status_summary)

    def test_live_hybrid_respects_track_provider_preferences(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded live test query.",
                )
            ],
            planning_notes=[],
        )
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch.object(provider, "_github_hits_for_query", return_value=[]) as github_query,
            mock.patch.object(provider, "_web_hits_for_query", return_value=[]) as web_query,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(github_query.call_count, 0)
        self.assertEqual(web_query.call_count, 1)
        github_discovery = next(
            health for health in result.provider_health if health.provider == "github-discovery"
        )
        web_discovery = next(
            health for health in result.provider_health if health.provider == "web-discovery"
        )
        self.assertEqual(github_discovery.discovery_queries, 0)
        self.assertEqual(web_discovery.discovery_queries, 1)

    def test_live_hybrid_supports_gitlab_provider_preference(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["gitlab"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded live test query.",
                )
            ],
            planning_notes=[],
        )
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch.object(provider, "_github_hits_for_query", return_value=[]) as github_query,
            mock.patch.object(provider, "_gitlab_hits_for_query", return_value=[]) as gitlab_query,
            mock.patch.object(provider, "_web_hits_for_query", return_value=[]) as web_query,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(github_query.call_count, 0)
        self.assertEqual(gitlab_query.call_count, 1)
        self.assertEqual(web_query.call_count, 0)
        gitlab_discovery = next(
            health for health in result.provider_health if health.provider == "gitlab-discovery"
        )
        self.assertEqual(gitlab_discovery.discovery_queries, 1)
        self.assertTrue(any(health.provider == "catalog-fallback" for health in result.provider_health))

    def test_live_hybrid_supports_optional_provider_preferences_when_enabled(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["exa", "tavily", "firecrawl"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded optional provider test query.",
                )
            ],
            planning_notes=[],
        )
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch.dict(
                os.environ,
                {
                    "RESEARCH_ENGINE_TAVILY_API_KEY": "tv-test-key",
                    "RESEARCH_ENGINE_EXA_API_KEY": "exa-test-key",
                    "RESEARCH_ENGINE_FIRECRAWL_API_KEY": "fc-test-key",
                },
                clear=False,
            ),
            mock.patch.object(provider, "_exa_hits_for_query", return_value=[]) as exa_query,
            mock.patch.object(provider, "_tavily_hits_for_query", return_value=[]) as tavily_query,
            mock.patch.object(provider, "_firecrawl_hits_for_query", return_value=[]) as firecrawl_query,
            mock.patch.object(provider, "_web_hits_for_query", return_value=[]) as web_query,
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(exa_query.call_count, 1)
        self.assertEqual(tavily_query.call_count, 1)
        self.assertEqual(firecrawl_query.call_count, 1)
        self.assertEqual(web_query.call_count, 0)
        self.assertEqual(
            next(health for health in result.provider_health if health.provider == "exa-discovery").discovery_queries,
            1,
        )
        self.assertEqual(
            next(health for health in result.provider_health if health.provider == "tavily-discovery").discovery_queries,
            1,
        )
        self.assertEqual(
            next(health for health in result.provider_health if health.provider == "firecrawl-discovery").discovery_queries,
            1,
        )

    def test_tavily_hits_for_query_maps_search_results(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "results": [
                {
                    "url": "https://docs.example.com/api/reference",
                    "title": "Example API Reference",
                    "content": "Official API reference for a reusable research workflow.",
                }
            ]
        }

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_TAVILY_API_KEY": "tv-test-key"}, clear=False),
            mock.patch.object(provider, "_post_json", return_value=payload),
        ):
            hits = provider._tavily_hits_for_query(
                "reusable research workflow",
                "official-docs",
                3,
                set(),
            )

        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].provider, "tavily-live")
        self.assertEqual(hits[0].hit_type, "doc")
        self.assertEqual(hits[0].url, "https://docs.example.com/api/reference")

    def test_exa_hits_for_query_maps_search_results(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "results": [
                {
                    "url": "https://github.com/example/research-engine",
                    "title": "example/research-engine",
                    "summary": "Composable research workflow repository with bounded provider seams.",
                }
            ]
        }

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_EXA_API_KEY": "exa-test-key"}, clear=False),
            mock.patch.object(provider, "_post_json", return_value=payload),
        ):
            hits = provider._exa_hits_for_query(
                "reusable research workflow",
                "github-repos",
                3,
                set(),
            )

        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].provider, "exa-live")
        self.assertEqual(hits[0].hit_type, "repo")
        self.assertEqual(hits[0].candidate_id, "repo-example-research-engine")

    def test_read_web_text_prefers_firecrawl_scrape_when_token_present(self) -> None:
        provider = LiveHybridAcquisitionProvider()

        with (
            mock.patch.dict(os.environ, {"RESEARCH_ENGINE_FIRECRAWL_API_KEY": "fc-test-key"}, clear=False),
            mock.patch.object(
                provider,
                "_post_json",
                return_value={"data": {"markdown": "# Firecrawl summary\nUseful research workflow details."}},
            ) as post_json,
            mock.patch.object(provider, "_read_text", side_effect=AssertionError("raw web fetch should not run")),
        ):
            text = provider._read_web_text("https://docs.example.com/api/reference")

        self.assertIn("Firecrawl summary", text)
        self.assertEqual(provider._fetch_backend_attempts["firecrawl-fetch"], 1)
        self.assertEqual(provider._fetch_backend_successes["firecrawl-fetch"], 1)
        post_json.assert_called_once()

    def test_live_web_hits_include_abstract_results_and_related_topics(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "Heading": "Example Docs",
            "AbstractURL": "https://docs.example.com/overview",
            "AbstractText": "Official documentation overview for a bounded research workflow.",
            "Results": [
                {
                    "FirstURL": "https://github.com/example/research-engine",
                    "Text": "example/research-engine repository with reusable provider seams.",
                }
            ],
            "RelatedTopics": [
                {
                    "FirstURL": "https://example.com/docs/api/reference",
                    "Text": "API reference for workflow endpoints and auth details.",
                }
            ],
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow api",
                track_id="official-docs",
                max_candidates=10,
                seen_candidates=set(),
            )

        self.assertEqual(len(hits), 3)
        repo_hit = next(hit for hit in hits if "github.com" in hit.url)
        self.assertEqual(repo_hit.hit_type, "repo")
        self.assertTrue(repo_hit.candidate_id.startswith("repo-"))
        doc_hit = next(hit for hit in hits if "example.com/docs/api/reference" in hit.url)
        self.assertEqual(doc_hit.hit_type, "doc")

    def test_live_web_hits_prefetch_selection_prefers_authoritative_when_fit_is_similar(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "RelatedTopics": [
                {
                    "FirstURL": "https://blog.example.com/posts/research-workflow-integration",
                    "Text": "Research workflow API integration walkthrough and implementation notes.",
                },
                {
                    "FirstURL": "https://docs.example.com/api/reference",
                    "Text": "Official API reference for research workflow integration endpoints.",
                },
            ]
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow api integration",
                track_id="official-docs",
                max_candidates=1,
                seen_candidates=set(),
            )

        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].url, "https://docs.example.com/api/reference")

    def test_live_web_hits_prefetch_preserves_unique_forum_comparative_signal(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "RelatedTopics": [
                {
                    "FirstURL": "https://docs.example.com/api/reference",
                    "Text": "Official API reference for research workflow integration endpoints.",
                },
                {
                    "FirstURL": "https://docs.example.com/getting-started",
                    "Text": "Getting started setup guide for the research workflow API.",
                },
                {
                    "FirstURL": "https://news.ycombinator.com/item?id=999",
                    "Text": "Discussion of workflow tradeoff and benchmark comparison across provider approaches.",
                },
            ]
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow api integration",
                track_id="comparisons",
                max_candidates=2,
                seen_candidates=set(),
            )

        self.assertEqual(len(hits), 2)
        urls = {hit.url for hit in hits}
        self.assertIn("https://docs.example.com/api/reference", urls)
        self.assertIn("https://news.ycombinator.com/item?id=999", urls)

    def test_live_web_hits_prefetch_reduces_duplicate_and_low_value_noise(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "RelatedTopics": [
                {
                    "FirstURL": "https://docs.example.com/reference?ref=one",
                    "Text": "Reference page for research workflow benchmark methods and integration boundaries.",
                },
                {
                    "FirstURL": "https://docs.example.com/reference?ref=two",
                    "Text": "Reference page for research workflow benchmark methods and integration boundaries.",
                },
                {
                    "FirstURL": "https://arxiv.org/abs/2501.01234",
                    "Text": "Research paper abstract with benchmark evaluation protocol for workflow systems.",
                },
                {
                    "FirstURL": "https://example.com/",
                    "Text": "hello",
                },
            ]
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow benchmark",
                track_id="architecture-patterns",
                max_candidates=5,
                seen_candidates=set(),
            )

        urls = [hit.url for hit in hits]
        self.assertEqual(sum(1 for url in urls if "docs.example.com/reference" in url), 1)
        self.assertIn("https://arxiv.org/abs/2501.01234", urls)
        self.assertNotIn("https://example.com/", urls)

    def test_live_web_hits_prefetch_keeps_best_same_url_entry(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "RelatedTopics": [
                {
                    "FirstURL": "https://docs.example.com/api/reference",
                    "Text": "Short note.",
                },
                {
                    "FirstURL": "https://docs.example.com/api/reference",
                    "Text": "Official API reference for research workflow integration endpoints, authentication, and provider setup.",
                },
            ]
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow api integration",
                track_id="official-docs",
                max_candidates=3,
                seen_candidates=set(),
            )

        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].url, "https://docs.example.com/api/reference")
        self.assertIn("authentication", hits[0].snippet.lower())

    def test_live_web_hits_prefetch_does_not_fill_with_weak_leftovers(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        payload = {
            "RelatedTopics": [
                {
                    "FirstURL": "https://docs.example.com/api/reference",
                    "Text": "Official API reference for research workflow integration endpoints.",
                },
                {
                    "FirstURL": "https://example.com/",
                    "Text": "tiny",
                },
                {
                    "FirstURL": "https://example.org/",
                    "Text": "short",
                },
            ]
        }

        with mock.patch.object(provider, "_read_json", return_value=payload):
            hits = provider._web_hits_for_query(
                query="research workflow api integration",
                track_id="official-docs",
                max_candidates=3,
                seen_candidates=set(),
            )

        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0].url, "https://docs.example.com/api/reference")

    def test_live_evidence_gap_follow_up_pass_is_bounded(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[],
            queries=[],
            planning_notes=[],
        )
        gap_directives = [
            {
                "candidate_id": "candidate-a",
                "candidate_name": "candidate-a",
                "gaps": ["missing-primary-source-evidence"],
            },
            {
                "candidate_id": "candidate-b",
                "candidate_name": "candidate-b",
                "gaps": ["missing-technical-facts"],
            },
            {
                "candidate_id": "candidate-c",
                "candidate_name": "candidate-c",
                "gaps": ["missing-maintenance-freshness"],
            },
            {
                "candidate_id": "candidate-d",
                "candidate_name": "candidate-d",
                "gaps": ["missing-comparative-evidence"],
            },
        ]

        call_counter = {"value": 0}

        def fake_web_hits(
            query: str,
            track_id: str,
            max_candidates: int,
            seen_candidates: set[str],
        ) -> list[DiscoveryHit]:
            del track_id, max_candidates, seen_candidates
            call_counter["value"] += 1
            index = call_counter["value"]
            return [
                DiscoveryHit(
                    provider="web-live",
                    track_id="official-docs",
                    query=query,
                    url=f"https://docs.example.com/follow-up/{index}",
                    title=f"follow-up-{index}",
                    snippet="Follow-up evidence candidate.",
                    hit_type="doc",
                    candidate_id=f"web-follow-up-{index}",
                    matched_terms=["follow", "evidence"],
                )
            ]

        def fake_documents_from_hits(hits: list[DiscoveryHit], max_fetches: int) -> list[SourceDocument]:
            del max_fetches
            return [
                SourceDocument(
                    candidate_id=hit.candidate_id,
                    source_url=hit.url,
                    source_type="product-doc",
                    title=hit.title,
                    summary=hit.snippet,
                    provider=hit.provider,
                    track_id=hit.track_id,
                    fetched_at="2026-04-01T00:00:00+00:00",
                    facts=[
                        SourceFact(
                            fact_type="signal",
                            confidence="medium",
                            excerpt=hit.snippet,
                            notes=[],
                        )
                    ],
                )
                for hit in hits
            ]

        with (
            mock.patch.object(provider, "_web_hits_for_query", side_effect=fake_web_hits) as web_query,
            mock.patch.object(provider, "_documents_from_hits", side_effect=fake_documents_from_hits),
        ):
            result = provider.acquire_evidence_gap_follow_up(
                plan=plan,
                mission=mission,
                gap_directives=gap_directives,
                existing_documents=[],
            )

        self.assertEqual(web_query.call_count, 3)
        self.assertEqual(len(result.discovery_hits), 3)
        self.assertEqual(len(result.source_documents), 3)
        self.assertTrue(any("Evidence-gap follow-up pass engaged" in note for note in result.notes))

    def test_live_evidence_gap_follow_up_does_not_silently_drop_later_query_hits(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[],
            queries=[],
            planning_notes=[],
        )
        gap_directives = [
            {
                "candidate_id": "candidate-a",
                "candidate_name": "candidate-a",
                "gaps": ["missing-primary-source-evidence"],
            },
            {
                "candidate_id": "candidate-b",
                "candidate_name": "candidate-b",
                "gaps": ["missing-technical-facts"],
            },
        ]

        first_query_hits = [
            DiscoveryHit(
                provider="web-live",
                track_id="official-docs",
                query="q1",
                url=f"https://docs.example.com/start/{index}",
                title=f"start-{index}",
                snippet="Seed follow-up evidence.",
                hit_type="doc",
                candidate_id=f"web-seed-{index}",
                matched_terms=["seed", "evidence"],
            )
            for index in range(1, 4)
        ]
        second_query_hits = [
            DiscoveryHit(
                provider="web-live",
                track_id="architecture-patterns",
                query="q2",
                url="https://docs.example.com/second/query-hit",
                title="second-query-hit",
                snippet="Second query enrichment signal.",
                hit_type="doc",
                candidate_id="web-second-query-hit",
                matched_terms=["second", "enrichment"],
            )
        ]

        query_results = [first_query_hits, second_query_hits]

        def fake_web_hits(
            query: str,
            track_id: str,
            max_candidates: int,
            seen_candidates: set[str],
        ) -> list[DiscoveryHit]:
            del query, track_id, max_candidates, seen_candidates
            return query_results.pop(0) if query_results else []

        def fake_documents_from_hits(hits: list[DiscoveryHit], max_fetches: int) -> list[SourceDocument]:
            return [
                SourceDocument(
                    candidate_id=hit.candidate_id,
                    source_url=hit.url,
                    source_type="product-doc",
                    title=hit.title,
                    summary=hit.snippet,
                    provider=hit.provider,
                    track_id=hit.track_id,
                    fetched_at="2026-04-01T00:00:00+00:00",
                    facts=[SourceFact("signal", "medium", hit.snippet, [])],
                )
                for hit in hits[:max_fetches]
            ]

        with (
            mock.patch.object(provider, "_web_hits_for_query", side_effect=fake_web_hits),
            mock.patch.object(provider, "_documents_from_hits", side_effect=fake_documents_from_hits),
        ):
            result = provider.acquire_evidence_gap_follow_up(
                plan=plan,
                mission=mission,
                gap_directives=gap_directives,
                existing_documents=[],
            )

        urls = {hit.url for hit in result.discovery_hits}
        self.assertIn("https://docs.example.com/second/query-hit", urls)
        self.assertEqual(len(result.discovery_hits), 4)

    def test_live_evidence_gap_follow_up_replaces_weaker_duplicate_url_and_enforces_global_cap(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[],
            queries=[],
            planning_notes=[],
        )
        gap_directives = [
            {
                "candidate_id": "candidate-a",
                "candidate_name": "candidate-a",
                "gaps": ["missing-primary-source-evidence"],
            },
            {
                "candidate_id": "candidate-b",
                "candidate_name": "candidate-b",
                "gaps": ["missing-technical-facts"],
            },
            {
                "candidate_id": "candidate-c",
                "candidate_name": "candidate-c",
                "gaps": ["missing-maintenance-freshness"],
            },
        ]

        duplicate_short = DiscoveryHit(
            provider="web-live",
            track_id="official-docs",
            query="q1",
            url="https://docs.example.com/reference",
            title="reference",
            snippet="short note",
            hit_type="doc",
            candidate_id="web-ref-short",
            matched_terms=["reference"],
        )
        duplicate_strong = DiscoveryHit(
            provider="web-live",
            track_id="official-docs",
            query="q2",
            url="https://docs.example.com/reference",
            title="reference",
            snippet=(
                "Official API reference for research workflow integration, authentication, maintenance details, and examples."
            ),
            hit_type="doc",
            candidate_id="web-ref-strong",
            matched_terms=["official", "reference", "workflow", "integration"],
        )

        query_results = [
            [
                duplicate_short,
                *[
                    DiscoveryHit(
                        provider="web-live",
                        track_id="official-docs",
                        query="q1",
                        url=f"https://docs.example.com/start/{index}",
                        title=f"start-{index}",
                        snippet="Seed evidence item.",
                        hit_type="doc",
                        candidate_id=f"web-seed-{index}",
                        matched_terms=["seed", "evidence"],
                    )
                    for index in range(1, 4)
                ],
            ],
            [
                duplicate_strong,
                *[
                    DiscoveryHit(
                        provider="web-live",
                        track_id="architecture-patterns",
                        query="q2",
                        url=f"https://docs.example.com/extra/{index}",
                        title=f"extra-{index}",
                        snippet="Extra evidence item for cap pressure.",
                        hit_type="doc",
                        candidate_id=f"web-extra-{index}",
                        matched_terms=["extra", "evidence"],
                    )
                    for index in range(1, 5)
                ],
            ],
            [
                DiscoveryHit(
                    provider="web-live",
                    track_id="comparisons",
                    query="q3",
                    url="https://news.example.com/analysis",
                    title="analysis",
                    snippet="Comparative analysis and tradeoff discussion.",
                    hit_type="doc",
                    candidate_id="web-analysis",
                    matched_terms=["analysis", "tradeoff"],
                )
            ],
        ]

        def fake_web_hits(
            query: str,
            track_id: str,
            max_candidates: int,
            seen_candidates: set[str],
        ) -> list[DiscoveryHit]:
            del query, track_id, max_candidates, seen_candidates
            return query_results.pop(0) if query_results else []

        def fake_documents_from_hits(hits: list[DiscoveryHit], max_fetches: int) -> list[SourceDocument]:
            return [
                SourceDocument(
                    candidate_id=hit.candidate_id,
                    source_url=hit.url,
                    source_type="product-doc",
                    title=hit.title,
                    summary=hit.snippet,
                    provider=hit.provider,
                    track_id=hit.track_id,
                    fetched_at="2026-04-01T00:00:00+00:00",
                    facts=[SourceFact("signal", "medium", hit.snippet, [])],
                )
                for hit in hits[:max_fetches]
            ]

        with (
            mock.patch.object(provider, "_web_hits_for_query", side_effect=fake_web_hits),
            mock.patch.object(provider, "_documents_from_hits", side_effect=fake_documents_from_hits),
        ):
            result = provider.acquire_evidence_gap_follow_up(
                plan=plan,
                mission=mission,
                gap_directives=gap_directives,
                existing_documents=[],
            )

        self.assertLessEqual(len(result.discovery_hits), 6)
        self.assertLessEqual(len(result.source_documents), 6)
        reference_hits = [hit for hit in result.discovery_hits if "docs.example.com/reference" in hit.url]
        self.assertEqual(len(reference_hits), 1)
        self.assertIn("Official API reference", reference_hits[0].snippet)
        self.assertTrue(any("dedupe replaced" in note for note in result.notes))
        self.assertTrue(any("cap applied" in note for note in result.notes))

    def test_live_evidence_gap_follow_up_can_enrich_existing_candidate(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"official-docs": ["web"]},
            selected_acquisition_mode="live-hybrid",
            tracks=[
                SearchTrack(
                    track_id="official-docs",
                    name="Official Docs",
                    intent="Find candidate references.",
                    priority=1,
                    provider_hint="live-hybrid",
                )
            ],
            queries=[],
            planning_notes=[],
        )
        gap_directives = [
            {
                "candidate_id": "candidate-gap-a",
                "gaps": ["missing-primary-source-evidence"],
                "source_type": "blog-post",
                "evidence_count": 1,
            }
        ]
        existing_hit = DiscoveryHit(
            provider="web-live",
            track_id="official-docs",
            query="candidate gap evidence",
            url="https://blog.example.com/candidate-gap-a",
            title="candidate-gap-a",
            snippet="Existing low-trust evidence.",
            hit_type="doc",
            candidate_id="candidate-gap-a",
            matched_terms=["candidate", "evidence"],
        )
        existing_document = SourceDocument(
            candidate_id="candidate-gap-a",
            source_url="https://blog.example.com/candidate-gap-a",
            source_type="blog-post",
            title="candidate-gap-a",
            summary="Existing low-trust evidence.",
            provider="web-live",
            track_id="official-docs",
            fetched_at="2026-04-01T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="architecture",
                    confidence="medium",
                    excerpt="Architecture overview only.",
                    notes=[],
                )
            ],
        )

        def fake_web_hits(
            query: str,
            track_id: str,
            max_candidates: int,
            seen_candidates: set[str],
        ) -> list[DiscoveryHit]:
            del query, track_id, max_candidates
            if "candidate-gap-a" in seen_candidates:
                return []
            return [
                DiscoveryHit(
                    provider="github-live",
                    track_id="official-docs",
                    query="candidate-gap-a official docs repository github gitlab readme",
                    url="https://github.com/example/candidate-gap-a",
                    title="example/candidate-gap-a",
                    snippet="Repository with workflow, integration, and maintenance signals.",
                    hit_type="repo",
                    candidate_id="candidate-gap-a",
                    matched_terms=["repository", "workflow"],
                )
            ]

        def fake_documents_from_hits(hits: list[DiscoveryHit], *, max_fetches: int) -> list[SourceDocument]:
            del max_fetches
            return [
                SourceDocument(
                    candidate_id=hit.candidate_id,
                    source_url=hit.url,
                    source_type="github-repo",
                    title=hit.title,
                    summary="Repository follow-up evidence.",
                    provider=hit.provider,
                    track_id=hit.track_id,
                    fetched_at="2026-04-01T00:00:00+00:00",
                    facts=[
                        SourceFact("workflow", "high", "Workflow stages are explicit and bounded.", []),
                        SourceFact("integration", "high", "Integration uses provider adapters.", []),
                        SourceFact(
                            "maintenance",
                            "high",
                            "Stars=12, forks=2, open_issues=1, last_push=2026-03-31T00:00:00+00:00.",
                            [],
                        ),
                    ],
                )
                for hit in hits
            ]

        with (
            mock.patch.object(provider, "_web_hits_for_query", side_effect=fake_web_hits),
            mock.patch.object(provider, "_documents_from_hits", side_effect=fake_documents_from_hits),
        ):
            result = provider.acquire_evidence_gap_follow_up(
                plan=plan,
                mission=mission,
                gap_directives=gap_directives,
                existing_documents=[existing_document],
            )

        self.assertEqual(len(result.discovery_hits), 1)
        self.assertEqual(result.discovery_hits[0].candidate_id, "candidate-gap-a")
        self.assertEqual(len(result.source_documents), 1)
        self.assertTrue(any(health.provider == "live-hybrid-follow-up" for health in result.provider_health))

    def test_web_candidate_ids_distinguish_deeper_paths(self) -> None:
        provider = LiveHybridAcquisitionProvider()

        api_ref = provider._candidate_id_from_url("https://example.com/docs/api/reference")
        docs_guide = provider._candidate_id_from_url("https://example.com/docs/guide/start")

        self.assertNotEqual(api_ref, docs_guide)

    def test_documents_from_hits_routes_web_repo_hits_to_repo_fetch(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="github-repos",
            query="reusable research workflow",
            url="https://github.com/example/research-engine",
            title="example/research-engine",
            snippet="Repository candidate from web search.",
            hit_type="repo",
            candidate_id="repo-example-research-engine",
            matched_terms=["research", "workflow"],
        )
        expected = SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type="github-repo",
            title=hit.title,
            summary=hit.snippet,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at="2026-04-07T00:00:00+00:00",
            facts=[
                SourceFact(
                    fact_type="signal",
                    confidence="medium",
                    excerpt=hit.snippet,
                    notes=[],
                )
            ],
        )

        with (
            mock.patch.object(provider, "_build_github_document", return_value=expected) as github_fetch,
            mock.patch.object(provider, "_build_web_document") as web_fetch,
        ):
            documents = provider._documents_from_hits([hit], max_fetches=1)

        self.assertEqual(len(documents), 1)
        self.assertEqual(documents[0].source_type, "github-repo")
        self.assertEqual(github_fetch.call_count, 1)
        self.assertEqual(web_fetch.call_count, 0)

    def test_official_docs_followthrough_is_bounded_to_three_pages(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        homepage = "https://docs.example.com"
        homepage_html = """
        <html>
          <body>
            <a href="/getting-started">Getting started</a>
            <a href="/api/reference">API reference</a>
            <a href="/guides/tutorial">Tutorial guide</a>
            <a href="/docs/architecture">Architecture docs</a>
          </body>
        </html>
        """
        page_html = {
            "https://docs.example.com/": homepage_html,
            "https://docs.example.com/getting-started": "<html><body><main>Getting started steps for setup and workflow.</main></body></html>",
            "https://docs.example.com/api/reference": "<html><body><main>API reference for POST /v1/research/jobs endpoint.</main></body></html>",
            "https://docs.example.com/guides/tutorial": "<html><body><main>Tutorial guide for bounded integration flows.</main></body></html>",
            "https://docs.example.com/docs/architecture": "<html><body><main>Architecture docs for system boundaries.</main></body></html>",
        }

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            return page_html.get(canonical, "")

        with mock.patch.object(provider, "_read_text", side_effect=fake_read_text):
            pages = provider._official_docs_followthrough(
                repo_url="https://github.com/example/research-engine",
                homepage=homepage,
                readme_text="",
                seed_urls=[],
                max_pages=3,
            )

        self.assertEqual(len(pages), 3)
        self.assertTrue(all(url.startswith("https://docs.example.com") for url, _ in pages))

    def test_live_github_document_follows_official_docs_for_stronger_evidence(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="github-live",
            track_id="github-repos",
            query="reusable research workflow",
            url="https://github.com/example/research-engine",
            title="example/research-engine",
            snippet="Repository candidate.",
            hit_type="repo",
            candidate_id="repo-example-research-engine",
            matched_terms=["research", "workflow"],
        )
        repo_payload = {
            "full_name": "example/research-engine",
            "description": "Composable research workflow candidate.",
            "stargazers_count": 42,
            "forks_count": 7,
            "open_issues_count": 3,
            "language": "Python",
            "pushed_at": "2026-03-30T10:00:00Z",
            "topics": ["research", "workflow"],
            "homepage": "https://docs.example.com",
        }
        release_payload = {
            "published_at": "2026-03-28T12:00:00Z",
        }
        readme_text = (
            "[Quickstart](https://docs.example.com/getting-started)\n"
            "[API Reference](https://docs.example.com/api/reference)"
        )
        page_html = {
            "https://docs.example.com/": """
            <html>
              <head><meta property=\"article:modified_time\" content=\"2026-03-30T08:15:00Z\" /></head>
              <body>
                <main>
                  <a href=\"/getting-started\">Getting started</a>
                  <a href=\"/api/reference\">API reference</a>
                </main>
              </body>
            </html>
            """,
            "https://docs.example.com/getting-started": """
            <html><body><main>Quickstart guide steps for setting up the research workflow.</main></body></html>
            """,
            "https://docs.example.com/api/reference": """
            <html><body><main>API reference covers provider integration with POST /v1/research/jobs.</main></body></html>
            """,
        }

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            return page_html.get(canonical, "")

        with (
            mock.patch.object(provider, "_read_json", side_effect=[repo_payload, release_payload]),
            mock.patch.object(provider, "_fetch_github_readme", return_value=readme_text),
            mock.patch.object(provider, "_read_text", side_effect=fake_read_text),
        ):
            document = provider._build_github_document(hit)

        self.assertIsNotNone(document)
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        self.assertTrue(any("Official docs follow-through captured" in fact.excerpt for fact in signal_facts))
        workflow_facts = [fact for fact in document.facts if fact.fact_type == "workflow"]
        integration_facts = [fact for fact in document.facts if fact.fact_type == "integration"]
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertIn("Quickstart guide steps", workflow_facts[0].excerpt)
        self.assertIn("POST /v1/research/jobs", integration_facts[0].excerpt)
        self.assertIn("docs_followthrough_pages=3", maintenance_facts[0].notes)

    def test_api_provider_mode_is_strict_and_does_not_fallback_to_catalog(self) -> None:
        mission = ResearchMission(objective="Find reusable research workflow systems.")
        plan = SearchPlan(
            mission_id=mission.mission_id,
            planning_preset="balanced-discovery",
            required_track_ids=[],
            excluded_track_ids=[],
            required_query_types_by_track={},
            excluded_query_types_by_track={},
            track_provider_preferences={"github-repos": ["github", "web"]},
            selected_acquisition_mode="api-provider",
            tracks=[
                SearchTrack(
                    track_id="github-repos",
                    name="GitHub Repos",
                    intent="Find candidate repositories.",
                    priority=1,
                    provider_hint="api-provider",
                )
            ],
            queries=[
                SearchQuery(
                    query_id="q1",
                    track_id="github-repos",
                    query_type="repo-search",
                    text="reusable research workflow",
                    rationale="Bounded strict-api test query.",
                )
            ],
            planning_notes=[],
        )
        provider = get_acquisition_provider("api-provider")
        self.assertEqual(provider.mode, "api-provider")

        with (
            mock.patch.object(provider, "_github_hits_for_query", return_value=[]),
            mock.patch.object(provider, "_web_hits_for_query", return_value=[]),
        ):
            result = provider.acquire(plan, mission)

        self.assertEqual(result.discovery_hits, [])
        self.assertEqual(result.source_documents, [])
        self.assertTrue(
            any("strict api-provider mode does not fallback" in note for note in result.notes)
        )
        self.assertFalse(any(health.provider == "catalog-fallback" for health in result.provider_health))
        self.assertEqual(result.provider_health[0].provider, "api-provider")
        self.assertFalse(result.provider_health[0].fallback_used)

    def test_live_gitlab_document_uses_release_timestamp_for_freshness(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="gitlab-live",
            track_id="github-repos",
            query="reusable research workflow",
            url="https://gitlab.com/example/research-engine",
            title="example/research-engine",
            snippet="Repository candidate.",
            hit_type="repo",
            candidate_id="repo-example-gitlab-research-engine",
            matched_terms=["research", "workflow"],
        )
        project_payload = {
            "path_with_namespace": "example/research-engine",
            "description": "Composable GitLab research workflow candidate.",
            "star_count": 12,
            "forks_count": 3,
            "open_issues_count": 2,
            "last_activity_at": "2026-03-27T12:00:00Z",
            "language": "Python",
            "topics": ["research", "workflow"],
        }
        release_payload = {
            "released_at": "2026-03-29T09:30:00Z",
        }
        with mock.patch.object(provider, "_read_json", side_effect=[project_payload, release_payload]):
            document = provider._build_gitlab_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "gitlab-repo")
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertEqual(len(maintenance_facts), 1)
        self.assertIn("latest_release_published_at=2026-03-29T09:30:00Z", maintenance_facts[0].notes)

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        self.assertEqual(evidence[0].source_updated_at, "2026-03-29T09:30:00+00:00")

    def test_live_gitlab_document_follows_official_docs_links_from_description(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="gitlab-live",
            track_id="github-repos",
            query="reusable research workflow",
            url="https://gitlab.com/example/research-engine",
            title="example/research-engine",
            snippet="Repository candidate.",
            hit_type="repo",
            candidate_id="repo-example-gitlab-research-engine",
            matched_terms=["research", "workflow"],
        )
        project_payload = {
            "path_with_namespace": "example/research-engine",
            "description": "Docs: https://docs.example.org/getting-started for workflow setup and provider integration.",
            "star_count": 12,
            "forks_count": 3,
            "open_issues_count": 2,
            "last_activity_at": "2026-03-27T12:00:00Z",
            "language": "Python",
            "topics": ["research", "workflow"],
            "web_url": "https://gitlab.com/example/research-engine",
        }
        release_payload = {
            "released_at": "2026-03-29T09:30:00Z",
        }

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            if "docs.example.org/getting-started" in url:
                return (
                    "<html><body><main>Getting started steps for provider integration and API workflow setup."
                    "</main></body></html>"
                )
            return ""

        with (
            mock.patch.object(provider, "_read_json", side_effect=[project_payload, release_payload]),
            mock.patch.object(provider, "_read_text", side_effect=fake_read_text),
        ):
            document = provider._build_gitlab_document(hit)

        self.assertIsNotNone(document)
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        self.assertTrue(any("Official docs follow-through captured" in fact.excerpt for fact in signal_facts))
        workflow_facts = [fact for fact in document.facts if fact.fact_type == "workflow"]
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertIn("Getting started steps", workflow_facts[0].excerpt)
        self.assertIn("docs_followthrough_pages=1", maintenance_facts[0].notes)

    def test_live_web_document_extracts_source_updated_timestamp(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="official-docs",
            query="research workflow docs",
            url="https://example.com/docs/research",
            title="example.com",
            snippet="Documentation page.",
            hit_type="doc",
            candidate_id="web-example-docs",
            matched_terms=["research", "workflow"],
        )
        html = """
        <html>
          <head>
            <title>Example Research Docs</title>
            <meta property="article:modified_time" content="2026-03-28T08:15:00Z" />
          </head>
          <body>
            <main>
              <p>Architecture overview for a bounded research workflow.</p>
              <p>Integration guide for provider adapters and evidence review.</p>
            </main>
          </body>
        </html>
        """
        with mock.patch.object(provider, "_read_text", return_value=html):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertEqual(len(maintenance_facts), 1)
        self.assertIn("2026-03-28T08:15:00+00:00", maintenance_facts[0].excerpt)

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        self.assertEqual(evidence[0].source_updated_at, "2026-03-28T08:15:00+00:00")

    def test_live_web_document_classifies_api_doc_source_type(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="api-docs",
            query="research workflow api docs",
            url="https://example.com/docs/api/reference",
            title="Example API Reference",
            snippet="API documentation page.",
            hit_type="doc",
            candidate_id="web-example-api-docs",
            matched_terms=["api", "workflow"],
        )
        html = """
        <html>
          <head><title>Example API Reference</title></head>
          <body>
            <main>
              <p>API reference overview for the research workflow service.</p>
              <p>Quickstart guide covers setup steps before making requests.</p>
              <p>POST /v1/research/jobs requires Bearer token authentication and returns JSON response payloads.</p>
            </main>
          </body>
        </html>
        """
        with mock.patch.object(provider, "_read_text", return_value=html):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "api-doc")
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        workflow_facts = [fact for fact in document.facts if fact.fact_type == "workflow"]
        integration_facts = [fact for fact in document.facts if fact.fact_type == "integration"]
        self.assertTrue(any("Extraction profile: api-doc-shaping" in note for note in signal_facts[0].notes))
        self.assertIn("Quickstart guide", workflow_facts[0].excerpt)
        self.assertIn("POST /v1/research/jobs", integration_facts[0].excerpt)
        self.assertEqual(integration_facts[0].confidence, "high")

    def test_live_web_document_followthrough_enriches_api_doc_signals(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="api-docs",
            query="research workflow api docs",
            url="https://docs.example.com/getting-started",
            title="Example Getting Started",
            snippet="Getting started guide.",
            hit_type="doc",
            candidate_id="web-example-api-docs-followthrough",
            matched_terms=["api", "workflow"],
        )
        page_html = {
            "https://docs.example.com/getting-started": """
            <html>
              <head><title>Getting Started</title></head>
              <body>
                <main>
                  <p>Quickstart guide covers setup basics.</p>
                  <a href="/api/reference">API reference</a>
                  <a href="/docs/authentication">Authentication docs</a>
                </main>
              </body>
            </html>
            """,
            "https://docs.example.com/api/reference": """
            <html><body><main>API endpoint POST /v1/research/jobs returns JSON payloads for workflow execution.</main></body></html>
            """,
            "https://docs.example.com/docs/authentication": """
            <html><body><main>Bearer token authentication is required for API calls.</main></body></html>
            """,
        }

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            return page_html.get(canonical, "")

        with mock.patch.object(provider, "_read_text", side_effect=fake_read_text):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        integration_facts = [fact for fact in document.facts if fact.fact_type == "integration"]
        self.assertTrue(any("Web authoritative follow-through captured 2 page(s)." in fact.excerpt for fact in signal_facts))
        self.assertTrue(any("Follow-through pages: 2" in note for fact in signal_facts for note in fact.notes))
        self.assertIn("POST /v1/research/jobs", integration_facts[0].excerpt)

    def test_live_web_document_followthrough_is_same_host_and_capped(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="api-docs",
            query="research workflow api docs",
            url="https://docs.example.com/docs/start",
            title="Example Docs Start",
            snippet="Documentation start page.",
            hit_type="doc",
            candidate_id="web-example-api-docs-followthrough-cap",
            matched_terms=["api", "workflow"],
        )
        page_html = {
            "https://docs.example.com/docs/start": """
            <html>
              <body>
                <main>
                  <a href="/api/reference-a">Reference A</a>
                  <a href="/api/reference-b">Reference B</a>
                  <a href="/api/reference-c">Reference C</a>
                  <a href="https://external.example.org/api/reference-z">External Reference</a>
                </main>
              </body>
            </html>
            """,
            "https://docs.example.com/api/reference-a": """
            <html><body><main>Endpoint A details.</main></body></html>
            """,
            "https://docs.example.com/api/reference-b": """
            <html><body><main>Endpoint B details.</main></body></html>
            """,
            "https://docs.example.com/api/reference-c": """
            <html><body><main>Endpoint C details.</main></body></html>
            """,
            "https://external.example.org/api/reference-z": """
            <html><body><main>SHOULD_NOT_APPEAR</main></body></html>
            """,
        }
        requested: list[str] = []

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            requested.append(canonical)
            return page_html.get(canonical, "")

        with mock.patch.object(provider, "_read_text", side_effect=fake_read_text):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        integration_facts = [fact for fact in document.facts if fact.fact_type == "integration"]
        self.assertTrue(any("Web authoritative follow-through captured 2 page(s)." in fact.excerpt for fact in signal_facts))
        self.assertTrue(any("Follow-through pages: 2" in note for fact in signal_facts for note in fact.notes))
        self.assertNotIn("SHOULD_NOT_APPEAR", integration_facts[0].excerpt)
        self.assertFalse(any("external.example.org" in url for url in requested))
        self.assertIn("https://docs.example.com/api/reference-a", requested)
        self.assertIn("https://docs.example.com/api/reference-b", requested)
        self.assertNotIn("https://docs.example.com/api/reference-c", requested)

    def test_live_web_document_followthrough_enriches_academic_paper_signals(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="comparisons",
            query="research workflow benchmarking paper",
            url="https://arxiv.org/abs/2501.01234",
            title="A Bounded Research Pipeline Paper",
            snippet="Academic paper summary.",
            hit_type="doc",
            candidate_id="web-example-academic-paper-followthrough",
            matched_terms=["research", "workflow", "benchmark"],
        )
        page_html = {
            "https://arxiv.org/abs/2501.01234": """
            <html>
              <body>
                <main>
                  <p>We present a bounded method for evidence assembly.</p>
                  <a href="/html/2501.01234">Paper HTML</a>
                  <a href="/pdf/2501.01234">Paper PDF</a>
                  <a href="https://external.example.org/post">External commentary</a>
                </main>
              </body>
            </html>
            """,
            "https://arxiv.org/html/2501.01234": """
            <html><body><main>Evaluation results include ablation studies across benchmark datasets.</main></body></html>
            """,
            "https://arxiv.org/pdf/2501.01234": "PDF_SHOULD_NOT_BE_FETCHED",
            "https://external.example.org/post": "EXTERNAL_SHOULD_NOT_BE_FETCHED",
        }
        requested: list[str] = []

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            requested.append(canonical)
            return page_html.get(canonical, "")

        with mock.patch.object(provider, "_read_text", side_effect=fake_read_text):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "academic-paper")
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        self.assertTrue(
            any("Academic authoritative follow-through captured 1 page(s)." in fact.excerpt for fact in signal_facts)
        )
        self.assertTrue(any("Follow-through pages: 1" in note for fact in signal_facts for note in fact.notes))
        shaped_excerpts = " ".join(
            fact.excerpt.lower()
            for fact in document.facts
            if fact.fact_type in {"signal", "architecture", "workflow"}
        )
        self.assertIn("ablation", shaped_excerpts)
        self.assertIn("https://arxiv.org/html/2501.01234", requested)
        self.assertNotIn("https://arxiv.org/pdf/2501.01234", requested)
        self.assertFalse(any("external.example.org" in url for url in requested))

    def test_live_web_document_academic_followthrough_skips_pdf_only_candidates(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="comparisons",
            query="research workflow preprint",
            url="https://arxiv.org/abs/2501.09999",
            title="PDF-only academic source",
            snippet="Academic source with limited follow-through links.",
            hit_type="doc",
            candidate_id="web-example-academic-paper-pdf-only",
            matched_terms=["research", "workflow"],
        )
        page_html = {
            "https://arxiv.org/abs/2501.09999": """
            <html>
              <body>
                <main>
                  <p>Preprint abstract with method summary.</p>
                  <a href="/pdf/2501.09999">Download PDF</a>
                  <a href="https://external.example.org/discussion">Discussion</a>
                </main>
              </body>
            </html>
            """,
            "https://arxiv.org/pdf/2501.09999": "PDF_SHOULD_NOT_BE_FETCHED",
            "https://external.example.org/discussion": "EXTERNAL_SHOULD_NOT_BE_FETCHED",
        }
        requested: list[str] = []

        def fake_read_text(url: str, provider_key: str) -> str:
            del provider_key
            canonical = provider._canonical_hit_url(url)
            requested.append(canonical)
            return page_html.get(canonical, "")

        with mock.patch.object(provider, "_read_text", side_effect=fake_read_text):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "academic-paper")
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        self.assertFalse(any("Academic authoritative follow-through captured" in fact.excerpt for fact in signal_facts))
        self.assertTrue(any("Extraction profile: academic-paper-shaping" in note for fact in signal_facts for note in fact.notes))
        self.assertTrue(any("Academic follow-through captured 0 pages" in note for fact in signal_facts for note in fact.notes))
        self.assertEqual(requested.count("https://arxiv.org/abs/2501.09999"), 1)
        self.assertNotIn("https://arxiv.org/pdf/2501.09999", requested)
        self.assertFalse(any("external.example.org" in url for url in requested))

    def test_live_web_document_classifies_forum_source_type(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="comparisons",
            query="research workflow discussion",
            url="https://news.ycombinator.com/item?id=123456",
            title="Show HN: Research workflow project",
            snippet="Forum discussion thread.",
            hit_type="doc",
            candidate_id="web-example-forum-thread",
            matched_terms=["research", "workflow"],
        )
        html = """
        <html>
          <head><title>Show HN: Research workflow project</title></head>
          <body>
            <main>
              <p>Community discussion about tradeoffs and reliability problems across providers.</p>
              <p>We run a three-step workflow: gather sources, cluster evidence, and score candidates.</p>
            </main>
          </body>
        </html>
        """
        with mock.patch.object(provider, "_read_text", return_value=html):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "forum-thread")
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        workflow_facts = [fact for fact in document.facts if fact.fact_type == "workflow"]
        integration_facts = [fact for fact in document.facts if fact.fact_type == "integration"]
        self.assertTrue(any("Extraction profile: forum-shaping" in note for note in signal_facts[0].notes))
        self.assertIn("three-step workflow", workflow_facts[0].excerpt)
        self.assertEqual(signal_facts[0].confidence, "low")
        self.assertEqual(integration_facts[0].confidence, "low")

    def test_live_web_document_marks_generic_fallback_evidence(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="comparisons",
            query="research workflow discussion",
            url="https://example.com/overview",
            title="Example overview",
            snippet="Generic product summary for a research workflow tool.",
            hit_type="doc",
            candidate_id="web-example-generic-overview",
            matched_terms=["research", "workflow"],
        )
        html = """
        <html>
          <head><title>Example overview</title></head>
          <body>
            <main>
              <p>Generic product summary for a research workflow tool.</p>
            </main>
          </body>
        </html>
        """
        with mock.patch.object(provider, "_read_text", return_value=html):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(
                ResearchMission(objective="Find reusable research workflow systems.")
            ),
        )
        signal_item = next(item for item in evidence if item.fact_type == "signal")
        self.assertEqual(signal_item.extraction_fidelity, "fallback")
        self.assertIn("fallback-derived-evidence", signal_item.rejection_flags)

    def test_live_web_document_captures_jsonld_profile_metadata(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="web-live",
            track_id="architecture-patterns",
            query="research workflow design",
            url="https://blog.example.com/posts/research-architecture",
            title="Research architecture post",
            snippet="Blog post candidate.",
            hit_type="doc",
            candidate_id="web-example-blog-jsonld",
            matched_terms=["research", "architecture"],
        )
        html = """
        <html>
          <head>
            <title>Research Architecture Post</title>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": "Research Architecture Post",
                "author": { "@type": "Person", "name": "Casey Doe" },
                "publisher": { "@type": "Organization", "name": "Example Engineering Blog" },
                "datePublished": "2026-03-25T10:15:00Z",
                "dateModified": "2026-03-27T08:30:00Z"
              }
            </script>
          </head>
          <body>
            <main>
              <p>This post explains architecture boundaries for reusable research workflows.</p>
            </main>
          </body>
        </html>
        """
        with mock.patch.object(provider, "_read_text", return_value=html):
            document = provider._build_web_document(hit)

        self.assertIsNotNone(document)
        self.assertEqual(document.source_type, "blog-post")
        signal_facts = [fact for fact in document.facts if fact.fact_type == "signal"]
        architecture_facts = [fact for fact in document.facts if fact.fact_type == "architecture"]
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertTrue(any("Extraction profile: blog-shaping" in note for note in signal_facts[0].notes))
        self.assertIn("architecture boundaries", architecture_facts[0].excerpt)
        self.assertTrue(any("Author: Casey Doe" in note for note in signal_facts[0].notes))
        self.assertTrue(any("Site: Example Engineering Blog" in note for note in signal_facts[0].notes))
        self.assertTrue(any("Schema type: BlogPosting" in note for note in signal_facts[0].notes))
        self.assertTrue(any("published_at=2026-03-25T10:15:00+00:00" in note for note in maintenance_facts[0].notes))
        self.assertTrue(any("modified_at=2026-03-27T08:30:00+00:00" in note for note in maintenance_facts[0].notes))

    def test_visible_text_extractor_returns_main_text_content(self) -> None:
        html = """
        <html>
          <head><title>Example</title></head>
          <body>
            <header>Navigation</header>
            <main>
              <p>Architecture overview for a bounded research workflow.</p>
              <p>Integration guide for provider adapters.</p>
            </main>
            <script>console.log('ignore')</script>
          </body>
        </html>
        """
        extracted = extract_visible_text(html)
        self.assertIn("Architecture overview for a bounded research workflow.", extracted)
        self.assertIn("Integration guide for provider adapters.", extracted)
        self.assertNotIn("console.log", extracted)

    def test_live_github_document_uses_release_and_homepage_dates_for_freshness(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        hit = DiscoveryHit(
            provider="github-live",
            track_id="github-repos",
            query="reusable research workflow",
            url="https://github.com/example/research-engine",
            title="example/research-engine",
            snippet="Repository candidate.",
            hit_type="repo",
            candidate_id="repo-example-research-engine",
            matched_terms=["research", "workflow"],
        )
        repo_payload = {
            "full_name": "example/research-engine",
            "description": "Composable research workflow candidate.",
            "stargazers_count": 42,
            "forks_count": 7,
            "open_issues_count": 3,
            "language": "Python",
            "pushed_at": "",
            "topics": ["research", "workflow"],
            "homepage": "https://example.com/research",
        }
        release_payload = {
            "published_at": "2026-03-28T12:00:00Z",
        }
        homepage_html = """
        <html>
          <head>
            <meta property="article:modified_time" content="2026-03-30T08:15:00Z" />
          </head>
          <body>
            <main>
              <p>Architecture overview for a bounded research workflow.</p>
            </main>
          </body>
        </html>
        """
        with (
            mock.patch.object(provider, "_read_json", side_effect=[repo_payload, release_payload]),
            mock.patch.object(
                provider,
                "_fetch_github_readme",
                return_value=(
                    "Architecture uses explicit phase boundaries.\n"
                    "Workflow keeps discovery and scoring separate.\n"
                    "Integration uses provider adapters."
                ),
            ),
            mock.patch.object(provider, "_read_text", return_value=homepage_html),
        ):
            document = provider._build_github_document(hit)

        self.assertIsNotNone(document)
        maintenance_facts = [fact for fact in document.facts if fact.fact_type == "maintenance"]
        self.assertEqual(len(maintenance_facts), 1)
        self.assertIn("latest_release_published_at=2026-03-28T12:00:00Z", maintenance_facts[0].notes)
        self.assertIn("homepage_last_updated=2026-03-30T08:15:00+00:00", maintenance_facts[0].notes)

        mission = ResearchMission(objective="Find reusable research workflow systems.")
        evidence = normalize_evidence(
            [document],
            trust_policy=build_source_type_trust_policy(mission),
        )
        self.assertEqual(evidence[0].source_updated_at, "2026-03-30T08:15:00+00:00")


class RequestBudgetTest(unittest.TestCase):
    def test_budget_allows_requests_within_limit(self) -> None:
        budget = RequestBudget(max_requests=5, per_provider_max_requests={})
        for _ in range(5):
            budget.check("github-fetch")
            budget.record("github-fetch")
        self.assertEqual(budget.aggregate_used, 5)
        self.assertEqual(budget.per_provider_used["github-fetch"], 5)
        self.assertTrue(budget.aggregate_remaining == 0)

    def test_budget_rejects_when_aggregate_exhausted(self) -> None:
        budget = RequestBudget(max_requests=3, per_provider_max_requests={})
        for _ in range(3):
            budget.check("github-fetch")
            budget.record("github-fetch")
        with self.assertRaises(RequestBudgetExhausted) as ctx:
            budget.check("github-fetch")
        self.assertEqual(ctx.exception.scope, "aggregate")
        self.assertEqual(ctx.exception.used, 3)
        self.assertEqual(ctx.exception.limit, 3)

    def test_budget_rejects_when_per_provider_exhausted(self) -> None:
        budget = RequestBudget(
            max_requests=100,
            per_provider_max_requests={"github-fetch": 2},
        )
        for _ in range(2):
            budget.check("github-fetch")
            budget.record("github-fetch")
        with self.assertRaises(RequestBudgetExhausted) as ctx:
            budget.check("github-fetch")
        self.assertEqual(ctx.exception.scope, "per-provider")
        self.assertEqual(ctx.exception.used, 2)
        self.assertEqual(ctx.exception.limit, 2)
        budget.check("web-fetch")
        budget.record("web-fetch")
        self.assertEqual(budget.aggregate_used, 3)

    def test_has_remaining_reflects_state(self) -> None:
        budget = RequestBudget(
            max_requests=5,
            per_provider_max_requests={"github-fetch": 2},
        )
        self.assertTrue(budget.has_remaining())
        self.assertTrue(budget.has_remaining("github-fetch"))
        budget.record("github-fetch")
        budget.record("github-fetch")
        self.assertTrue(budget.has_remaining())
        self.assertFalse(budget.has_remaining("github-fetch"))
        self.assertTrue(budget.has_remaining("web-fetch"))

    def test_budget_exhaustion_events_recorded(self) -> None:
        budget = RequestBudget(max_requests=1, per_provider_max_requests={})
        budget.record("github-fetch")
        budget.record_exhaustion("test-event: budget exhausted")
        self.assertEqual(len(budget.exhaustion_events), 1)
        budget.record_exhaustion("test-event: budget exhausted")
        self.assertEqual(len(budget.exhaustion_events), 1)

    def test_mission_constraints_new_fields_defaults(self) -> None:
        constraints = MissionConstraints()
        self.assertEqual(constraints.max_requests, 240)
        self.assertEqual(constraints.per_provider_max_requests, {})

    def test_default_budget_preserves_bounded_live_headroom(self) -> None:
        constraints = MissionConstraints()
        self.assertGreaterEqual(
            constraints.max_requests,
            200,
            "Default request budget should cover the bounded live envelope without clipping normal capability.",
        )

    def test_mission_constraints_custom_budget(self) -> None:
        constraints = MissionConstraints(
            max_requests=50,
            per_provider_max_requests={"github-fetch": 10},
        )
        self.assertEqual(constraints.max_requests, 50)
        self.assertEqual(constraints.per_provider_max_requests["github-fetch"], 10)

    def test_live_provider_initializes_budget_from_mission(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(
            objective="Test budget initialization.",
            constraints=MissionConstraints(
                max_requests=25,
                per_provider_max_requests={"github-discovery": 5},
            ),
        )
        plan = build_search_plan(mission)
        plan.selected_acquisition_mode = "live-hybrid"
        plan.queries = []
        result = provider.acquire(plan, mission)
        self.assertIsNotNone(provider._request_budget)
        self.assertEqual(provider._request_budget.max_requests, 25)
        self.assertEqual(
            provider._request_budget.per_provider_max_requests,
            {"github-discovery": 5},
        )
        self.assertEqual(provider._request_budget.aggregate_used, 0)

    def test_fetch_loop_stops_gracefully_on_budget_exhaustion(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        provider._request_budget = RequestBudget(
            max_requests=0,
            per_provider_max_requests={},
        )
        hits = [
            DiscoveryHit(
                provider="github-live",
                track_id="test-track",
                query="test",
                url="https://github.com/test/repo",
                title="test/repo",
                snippet="Test repo",
                hit_type="repo",
                candidate_id="test-repo",
                matched_terms=["test"],
            ),
        ]
        documents = provider._documents_from_hits(hits, max_fetches=10)
        self.assertEqual(documents, [])
        self.assertGreaterEqual(len(provider._request_budget.exhaustion_events), 1)

    def test_budget_surfaces_in_provider_health(self) -> None:
        provider = LiveHybridAcquisitionProvider()
        mission = ResearchMission(
            objective="Test budget health reporting.",
            constraints=MissionConstraints(
                max_requests=50,
                per_provider_max_requests={},
            ),
        )
        plan = build_search_plan(mission)
        plan.selected_acquisition_mode = "live-hybrid"
        plan.queries = []
        result = provider.acquire(plan, mission)
        aggregate_health = result.provider_health[0]
        self.assertEqual(aggregate_health.budget_max_requests, 50)
        self.assertIsNotNone(aggregate_health.budget_used_requests)
        self.assertIsInstance(aggregate_health.budget_exhaustion_events, list)


if __name__ == "__main__":
    unittest.main()
