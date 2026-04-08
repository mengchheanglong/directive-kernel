from __future__ import annotations

from dataclasses import dataclass, field
from collections import Counter
import base64
import json
import os
from datetime import UTC, datetime
from math import log
from pathlib import Path
import re
import socket
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urljoin, urlparse
from urllib.request import Request, urlopen

from research_engine.catalog import REFERENCE_CATALOG
from research_engine.discovery import discover_candidates
from research_engine.fetch import fetch_documents
from research_engine.live_extract import (
    extract_source_profile_from_html,
    extract_source_updated_at_from_html,
    extract_title_from_html,
    extract_visible_text,
)
from research_engine.models import (
    DiscoveryHit,
    ProviderHealth,
    ResearchMission,
    SearchPlan,
    SourceDocument,
    SourceFact,
    to_jsonable,
    utc_now_iso,
)

LIVE_REQUEST_TIMEOUT_SECONDS = 12
LIVE_RETRY_DELAYS_SECONDS = (0.25, 0.5)
LIVE_PROVIDER_KEYS = (
    "github-discovery",
    "gitlab-discovery",
    "tavily-discovery",
    "exa-discovery",
    "firecrawl-discovery",
    "web-discovery",
    "github-fetch",
    "gitlab-fetch",
    "firecrawl-fetch",
    "web-fetch",
)
OPTIONAL_PROVIDER_KEYS = ("tavily", "exa", "firecrawl")

WEB_SOURCE_AUTHORITY_WEIGHTS = {
    "github-repo": 5,
    "gitlab-repo": 5,
    "api-doc": 5,
    "product-doc": 4,
    "academic-paper": 4,
    "blog-post": 3,
    "news-article": 2,
    "forum-thread": 2,
    "unknown": 2,
}
WEB_COMPARATIVE_CUES = (
    "comparison",
    "compare",
    "tradeoff",
    "versus",
    " vs ",
    "benchmark",
    "limitation",
    "discussion",
    "experience",
)
WEB_DOC_INTENT_CUES = (
    "docs",
    "documentation",
    "reference",
    "api",
    "quickstart",
    "getting-started",
    "tutorial",
    "guide",
)
FOLLOW_UP_MAX_QUERIES = 3
FOLLOW_UP_MAX_HITS = 6
FOLLOW_UP_QUERY_HIT_LIMIT = 3
WEB_DOC_FOLLOW_THROUGH_MAX_PAGES = 2
WEB_DOC_FOLLOW_THROUGH_MAX_CANDIDATES = 6
WEB_ACADEMIC_FOLLOW_THROUGH_MAX_PAGES = 1
WEB_ACADEMIC_FOLLOW_THROUGH_MAX_CANDIDATES = 4


def _signal_fidelity(excerpt: str, fallback: str) -> str:
    return "fallback" if excerpt == fallback else "direct"


@dataclass(slots=True)
class AcquisitionResult:
    discovery_hits: list[DiscoveryHit]
    source_documents: list[SourceDocument]
    notes: list[str]
    provider_health: list[ProviderHealth]


@dataclass(slots=True)
class EvidenceGapFollowUpResult:
    discovery_hits: list[DiscoveryHit]
    source_documents: list[SourceDocument]
    notes: list[str]
    provider_health: list[ProviderHealth] = field(default_factory=list)


@dataclass(slots=True)
class AcquisitionPending(Exception):
    message: str
    session_dir: Path

    def __str__(self) -> str:
        return self.message


@dataclass(slots=True)
class RequestTelemetry:
    request_attempts: int = 0
    request_successes: int = 0
    request_failures: int = 0
    retry_attempts: int = 0
    timeout_count: int = 0
    backoff_events: int = 0
    total_backoff_seconds: float = 0.0
    max_backoff_seconds: float = 0.0
    notes: list[str] = field(default_factory=list)


class RequestBudgetExhausted(Exception):
    def __init__(self, provider_key: str, scope: str, used: int, limit: int) -> None:
        self.provider_key = provider_key
        self.scope = scope
        self.used = used
        self.limit = limit
        super().__init__(
            f"Request budget exhausted: {scope} for {provider_key} "
            f"(used={used}, limit={limit})"
        )


@dataclass(slots=True)
class RequestBudget:
    max_requests: int
    per_provider_max_requests: dict[str, int]
    aggregate_used: int = 0
    per_provider_used: dict[str, int] = field(default_factory=dict)
    exhaustion_events: list[str] = field(default_factory=list)

    def check(self, provider_key: str) -> None:
        if self.aggregate_used >= self.max_requests:
            raise RequestBudgetExhausted(
                provider_key, "aggregate", self.aggregate_used, self.max_requests
            )
        provider_limit = self.per_provider_max_requests.get(provider_key)
        if provider_limit is not None:
            used = self.per_provider_used.get(provider_key, 0)
            if used >= provider_limit:
                raise RequestBudgetExhausted(
                    provider_key, "per-provider", used, provider_limit
                )

    def record(self, provider_key: str) -> None:
        self.aggregate_used += 1
        self.per_provider_used[provider_key] = (
            self.per_provider_used.get(provider_key, 0) + 1
        )

    def has_remaining(self, provider_key: str | None = None) -> bool:
        if self.aggregate_used >= self.max_requests:
            return False
        if provider_key is not None:
            provider_limit = self.per_provider_max_requests.get(provider_key)
            if provider_limit is not None:
                used = self.per_provider_used.get(provider_key, 0)
                if used >= provider_limit:
                    return False
        return True

    def record_exhaustion(self, event: str) -> None:
        if event not in self.exhaustion_events:
            self.exhaustion_events.append(event)

    @property
    def aggregate_remaining(self) -> int:
        return max(0, self.max_requests - self.aggregate_used)


@dataclass(slots=True)
class LocalCorpusDocument:
    candidate_id: str
    path: Path
    relative_path: str
    title: str
    text: str
    source_type: str
    last_modified: str


class AcquisitionProvider:
    mode = "base"

    def acquire(
        self,
        plan: SearchPlan,
        mission: ResearchMission,
        output_dir: Path | None = None,
    ) -> AcquisitionResult:
        raise NotImplementedError

    def acquire_evidence_gap_follow_up(
        self,
        *,
        plan: SearchPlan,
        mission: ResearchMission,
        gap_directives: list[dict[str, object]],
        existing_documents: list[SourceDocument],
    ) -> EvidenceGapFollowUpResult:
        del plan, mission, gap_directives, existing_documents
        return EvidenceGapFollowUpResult(
            discovery_hits=[],
            source_documents=[],
            notes=[],
        )


class CatalogAcquisitionProvider(AcquisitionProvider):
    mode = "catalog"

    def acquire(
        self,
        plan: SearchPlan,
        mission: ResearchMission,
        output_dir: Path | None = None,
    ) -> AcquisitionResult:
        hits = discover_candidates(plan, mission)
        documents = fetch_documents(hits)
        return AcquisitionResult(
            discovery_hits=hits,
            source_documents=documents,
            notes=[
                "Catalog acquisition uses the curated reference pool as a deterministic stand-in for live discovery.",
                "This mode preserves the artifact contract while live acquisition adapters are still being built.",
            ],
            provider_health=[
                ProviderHealth(
                    provider="catalog",
                    discovery_queries=len(plan.queries),
                    discovery_hits=len(hits),
                    fetch_attempts=len(hits),
                    fetch_successes=len(documents),
                    fetch_failures=max(0, len(hits) - len(documents)),
                    fallback_used=False,
                    reason_codes=["deterministic-mode"],
                    status_summary="Catalog deterministic acquisition path.",
                    notes=["Deterministic reference catalog mode."],
                )
            ],
        )


class CodexSessionAcquisitionProvider(AcquisitionProvider):
    mode = "codex-session"

    def acquire(
        self,
        plan: SearchPlan,
        mission: ResearchMission,
        output_dir: Path | None = None,
    ) -> AcquisitionResult:
        if output_dir is None:
            raise ValueError("codex-session acquisition requires an output directory.")
        session_dir = output_dir / "codex-session"
        input_dir = session_dir / "input"
        output_session_dir = session_dir / "output"
        self._prepare_session_bundle(input_dir, output_session_dir, mission, plan)

        hits_path = output_session_dir / "discovery_hits.jsonl"
        documents_path = output_session_dir / "source_documents.jsonl"
        if not hits_path.exists() or not documents_path.exists():
            raise AcquisitionPending(
                message=(
                    "codex-session prepared. Fill the session output files and rerun the same command."
                ),
                session_dir=session_dir,
            )

        discovery_hits = self._load_discovery_hits(hits_path)
        source_documents = self._load_source_documents(documents_path)
        if not discovery_hits or not source_documents:
            raise AcquisitionPending(
                message=(
                    "codex-session output files exist but are empty. Fill them with bounded acquisition results and rerun."
                ),
                session_dir=session_dir,
            )
        return AcquisitionResult(
            discovery_hits=discovery_hits,
            source_documents=source_documents,
            notes=[
                "codex-session acquisition resumed from workspace-visible handoff files.",
                f"Session directory: {session_dir}",
            ],
            provider_health=[
                ProviderHealth(
                    provider="codex-session",
                    discovery_queries=len(plan.queries),
                    discovery_hits=len(discovery_hits),
                    fetch_attempts=len(discovery_hits),
                    fetch_successes=len(source_documents),
                    fetch_failures=max(0, len(discovery_hits) - len(source_documents)),
                    fallback_used=False,
                    reason_codes=["operator-session"],
                    status_summary="Codex-session resumed from operator-provided files.",
                    notes=["Bounded handoff resume mode."],
                )
            ],
        )

    def _prepare_session_bundle(
        self,
        input_dir: Path,
        output_dir: Path,
        mission: ResearchMission,
        plan: SearchPlan,
    ) -> None:
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        self._write_json(input_dir / "mission.json", mission)
        self._write_json(input_dir / "query_plan.json", plan)
        (input_dir / "instructions.md").write_text(
            self._render_instructions(output_dir),
            encoding="utf-8",
        )
        self._write_json(
            input_dir / "output-schema.json",
            {
                "required_outputs": [
                    "output/discovery_hits.jsonl",
                    "output/source_documents.jsonl",
                ],
                "discovery_hit_fields": [
                    "provider",
                    "track_id",
                    "query",
                    "url",
                    "title",
                    "snippet",
                    "hit_type",
                    "candidate_id",
                    "matched_terms",
                ],
                "source_document_fields": [
                    "candidate_id",
                    "source_url",
                    "source_type",
                    "title",
                    "summary",
                    "provider",
                    "track_id",
                    "fetched_at",
                    "facts",
                ],
            },
        )
        hits_path = output_dir / "discovery_hits.jsonl"
        documents_path = output_dir / "source_documents.jsonl"
        if not hits_path.exists():
            hits_path.write_text("", encoding="utf-8")
        if not documents_path.exists():
            documents_path.write_text("", encoding="utf-8")

    def _render_instructions(self, output_dir: Path) -> str:
        return "\n".join(
            [
                "# Codex Session Handoff",
                "",
                "Fill the session outputs with bounded acquisition results, then rerun the same Research Engine command.",
                "",
                "Required files:",
                "",
                f"- `{output_dir / 'discovery_hits.jsonl'}`",
                f"- `{output_dir / 'source_documents.jsonl'}`",
                "",
                "Rules:",
                "",
                "- preserve query track ids from the provided query plan",
                "- only include sources that materially support candidate judgment",
                "- keep source documents factual and extraction-oriented",
                "- do not emit final recommendations here",
                "- Research Engine will handle normalization, scoring, rejection, and DW packet export after resume",
            ]
        )

    def _write_json(self, path: Path, payload: object) -> None:
        path.write_text(json.dumps(to_jsonable(payload), indent=2), encoding="utf-8")

    def _load_discovery_hits(self, path: Path) -> list[DiscoveryHit]:
        hits: list[DiscoveryHit] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            hits.append(DiscoveryHit(**payload))
        return hits

    def _load_source_documents(self, path: Path) -> list[SourceDocument]:
        documents: list[SourceDocument] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            facts = [SourceFact(**fact) for fact in payload.pop("facts", [])]
            documents.append(SourceDocument(facts=facts, **payload))
        return documents


class LocalFirstAcquisitionProvider(AcquisitionProvider):
    mode = "local-first"
    DEFAULT_SUPPORTED_EXTENSIONS = {".md", ".txt", ".rst", ".json", ".yaml", ".yml"}
    DEFAULT_STOP_TERMS = {
        "the",
        "and",
        "for",
        "with",
        "from",
        "that",
        "this",
        "these",
        "those",
        "into",
        "onto",
        "than",
        "then",
        "also",
        "such",
        "via",
        "use",
        "uses",
        "used",
        "using",
        "about",
        "http",
        "https",
        "www",
        "com",
        "org",
        "net",
        "you",
        "your",
        "our",
        "ours",
    }

    def acquire(
        self,
        plan: SearchPlan,
        mission: ResearchMission,
        output_dir: Path | None = None,
    ) -> AcquisitionResult:
        corpus_dir = self._resolve_corpus_dir(output_dir)
        corpus_documents = self._load_local_corpus_documents(corpus_dir)
        notes = [f"Local-first acquisition scanning corpus directory: {corpus_dir.resolve()}."]
        top_k_per_query = self._local_top_k_per_query()
        max_match_chars = self._local_max_match_chars()
        strict_no_fallback = self._local_strict_no_fallback()
        notes.append(
            f"Local-first tuning: top_k_per_query={top_k_per_query}, max_match_chars={max_match_chars}, strict_no_fallback={strict_no_fallback}."
        )
        diagnostics_note = self._local_term_diagnostics_note(
            corpus_documents=corpus_documents,
            plan=plan,
            max_match_chars=max_match_chars,
        )
        if diagnostics_note:
            notes.append(diagnostics_note)

        if not corpus_documents:
            if strict_no_fallback:
                notes.append("No local corpus files found; strict local-first mode prevented fallback.")
                return AcquisitionResult(
                    discovery_hits=[],
                    source_documents=[],
                    notes=notes,
                    provider_health=[
                        ProviderHealth(
                            provider="local-corpus",
                            discovery_queries=len(plan.queries),
                            discovery_hits=0,
                            fetch_attempts=0,
                            fetch_successes=0,
                            fetch_failures=0,
                            fallback_used=False,
                            status="degraded",
                            reason_codes=["local-corpus-empty", "strict-no-fallback"],
                            status_summary="No local corpus files were available and strict local-first mode prevented fallback.",
                            notes=self._with_optional_note(
                                ["No local files available for query matching."],
                                diagnostics_note,
                            ),
                        )
                    ],
                )
            notes.append("No local corpus files found; fell back to catalog discovery.")
            hits = discover_candidates(plan, mission)
            documents = fetch_documents(hits)
            return AcquisitionResult(
                discovery_hits=hits,
                source_documents=documents,
                notes=notes,
                provider_health=[
                    ProviderHealth(
                        provider="local-corpus",
                        discovery_queries=len(plan.queries),
                        discovery_hits=0,
                        fetch_attempts=0,
                        fetch_successes=0,
                        fetch_failures=0,
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["local-corpus-empty", "fallback-engaged"],
                        status_summary="No local corpus files were available; catalog fallback engaged.",
                        notes=self._with_optional_note(
                            ["No local files available for query matching."],
                            diagnostics_note,
                        ),
                    ),
                    ProviderHealth(
                        provider="catalog-fallback",
                        discovery_queries=len(plan.queries),
                        discovery_hits=len(hits),
                        fetch_attempts=len(hits),
                        fetch_successes=len(documents),
                        fetch_failures=max(0, len(hits) - len(documents)),
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["fallback-engaged", "local-corpus-empty"],
                        status_summary="Catalog fallback after missing local corpus files.",
                        notes=["Fallback path after missing local corpus files."],
                    ),
                ],
            )

        documents_by_candidate = {item.candidate_id: item for item in corpus_documents}
        hits: list[DiscoveryHit] = []
        seen_candidates: set[str] = set()
        max_candidates = mission.constraints.max_candidates
        for query in plan.queries:
            if len(hits) >= max_candidates:
                break
            ranked_matches = self._rank_documents_for_query(
                query=query.text,
                corpus_documents=corpus_documents,
                seen_candidates=seen_candidates,
                max_match_chars=max_match_chars,
            )
            for match in ranked_matches[:top_k_per_query]:
                if len(hits) >= max_candidates:
                    break
                hits.append(
                    self._local_hit_from_document(
                        query=query.text,
                        track_id=query.track_id,
                        document=match,
                    )
                )
                seen_candidates.add(match.candidate_id)

        if not hits:
            if strict_no_fallback:
                notes.append("Local corpus search returned no matches; strict local-first mode prevented fallback.")
                return AcquisitionResult(
                    discovery_hits=[],
                    source_documents=[],
                    notes=notes,
                    provider_health=[
                        ProviderHealth(
                            provider="local-corpus",
                            discovery_queries=len(plan.queries),
                            discovery_hits=0,
                            fetch_attempts=0,
                            fetch_successes=0,
                            fetch_failures=0,
                            fallback_used=False,
                            status="degraded",
                            reason_codes=["local-corpus-no-match", "strict-no-fallback"],
                            status_summary="No local query matches were found and strict local-first mode prevented fallback.",
                            notes=self._with_optional_note(
                                ["No local query matches found in corpus files."],
                                diagnostics_note,
                            ),
                        )
                    ],
                )
            notes.append("Local corpus search returned no matches; fell back to catalog discovery.")
            fallback_hits = discover_candidates(plan, mission)
            fallback_documents = fetch_documents(fallback_hits)
            return AcquisitionResult(
                discovery_hits=fallback_hits,
                source_documents=fallback_documents,
                notes=notes,
                provider_health=[
                    ProviderHealth(
                        provider="local-corpus",
                        discovery_queries=len(plan.queries),
                        discovery_hits=0,
                        fetch_attempts=0,
                        fetch_successes=0,
                        fetch_failures=0,
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["local-corpus-no-match", "fallback-engaged"],
                        status_summary="Local corpus files were present but did not match active queries; catalog fallback engaged.",
                        notes=self._with_optional_note(
                            ["No local query matches found in corpus files."],
                            diagnostics_note,
                        ),
                    ),
                    ProviderHealth(
                        provider="catalog-fallback",
                        discovery_queries=len(plan.queries),
                        discovery_hits=len(fallback_hits),
                        fetch_attempts=len(fallback_hits),
                        fetch_successes=len(fallback_documents),
                        fetch_failures=max(0, len(fallback_hits) - len(fallback_documents)),
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["fallback-engaged", "local-corpus-no-match"],
                        status_summary="Catalog fallback after local corpus query miss.",
                        notes=["Fallback path after local corpus miss."],
                    ),
                ],
            )

        fetch_hits = hits[: mission.constraints.max_fetches]
        source_documents = [
            self._local_source_document_from_hit(
                hit=hit,
                document=documents_by_candidate[hit.candidate_id],
            )
            for hit in fetch_hits
            if hit.candidate_id in documents_by_candidate
        ]
        notes.append(
            f"Local-first acquisition collected {len(hits)} discovery hits and {len(source_documents)} source documents."
        )
        return AcquisitionResult(
            discovery_hits=hits,
            source_documents=source_documents,
            notes=notes,
            provider_health=[
                ProviderHealth(
                    provider="local-corpus",
                    discovery_queries=len(plan.queries),
                    discovery_hits=len(hits),
                    fetch_attempts=len(fetch_hits),
                    fetch_successes=len(source_documents),
                    fetch_failures=max(0, len(fetch_hits) - len(source_documents)),
                    fallback_used=False,
                    status="healthy",
                    reason_codes=["local-corpus-match"],
                    status_summary="Local corpus provided query matches and source documents.",
                    notes=self._with_optional_note(
                        ["Offline local-corpus acquisition path."],
                        diagnostics_note,
                    ),
                )
            ],
        )

    def _resolve_corpus_dir(self, output_dir: Path | None) -> Path:
        configured = os.getenv("RESEARCH_ENGINE_LOCAL_CORPUS_DIR", "").strip()
        if configured:
            return Path(configured)
        if output_dir is not None:
            return output_dir / "local-first" / "corpus"
        return Path(".research") / "local-corpus"

    def _load_local_corpus_documents(self, corpus_dir: Path) -> list[LocalCorpusDocument]:
        if not corpus_dir.exists() or not corpus_dir.is_dir():
            return []
        supported_extensions = self._local_supported_extensions()
        documents: list[LocalCorpusDocument] = []
        for path in sorted(corpus_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in supported_extensions:
                continue
            try:
                content = path.read_text(encoding="utf-8")
            except Exception:
                continue
            text = content.strip()
            if not text:
                continue
            relative_path = path.relative_to(corpus_dir).as_posix()
            stem = path.with_suffix("").relative_to(corpus_dir).as_posix()
            documents.append(
                LocalCorpusDocument(
                    candidate_id=f"local-{self._slug(stem)}",
                    path=path.resolve(),
                    relative_path=relative_path,
                    title=path.stem,
                    text=text,
                    source_type=self._source_type_for_local_path(path),
                    last_modified=self._file_last_modified_iso(path),
                )
            )
        return documents

    def _source_type_for_local_path(self, path: Path) -> str:
        normalized = path.as_posix().lower()
        extension = path.suffix.lower()
        if extension in {".json", ".yaml", ".yml"} or "/api" in normalized:
            return "api-doc"
        if "/blog" in normalized:
            return "blog-post"
        if "/forum" in normalized or "/discuss" in normalized or "/thread" in normalized:
            return "forum-thread"
        if "/news" in normalized:
            return "news-article"
        return "product-doc"

    def _file_last_modified_iso(self, path: Path) -> str:
        modified = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC).replace(microsecond=0)
        return modified.isoformat()

    def _rank_documents_for_query(
        self,
        query: str,
        corpus_documents: list[LocalCorpusDocument],
        seen_candidates: set[str],
        max_match_chars: int,
    ) -> list[LocalCorpusDocument]:
        query_terms = self._terms(query)
        if not query_terms:
            return []
        query_phrase = re.sub(r"\s+", " ", query.lower()).strip()
        query_bigrams = self._ordered_bigrams(query)
        query_term_count = len(query_terms)
        terms_by_candidate: dict[str, set[str]] = {}
        frequency_by_term: dict[str, int] = {}
        for document in corpus_documents:
            if document.candidate_id in seen_candidates:
                continue
            haystack_terms = self._terms(f"{document.title} {document.text[:max_match_chars]}")
            if not haystack_terms:
                continue
            terms_by_candidate[document.candidate_id] = haystack_terms
            for term in haystack_terms:
                frequency_by_term[term] = frequency_by_term.get(term, 0) + 1

        document_count = max(1, len(terms_by_candidate))
        scored: list[tuple[float, int, int, int, LocalCorpusDocument]] = []
        for document in corpus_documents:
            if document.candidate_id in seen_candidates:
                continue
            haystack_terms = terms_by_candidate.get(document.candidate_id)
            if not haystack_terms:
                continue
            overlap = len(query_terms & haystack_terms)
            if overlap == 0:
                continue
            weighted_overlap = sum(
                1.0 + log((document_count + 1.0) / (frequency_by_term.get(term, 0) + 1.0))
                for term in (query_terms & haystack_terms)
            )
            coverage = overlap / query_term_count
            preview_text = re.sub(
                r"\s+",
                " ",
                f"{document.title} {document.text[:max_match_chars]}".lower(),
            )
            bigram_hits = sum(1 for bigram in query_bigrams if bigram in preview_text)
            phrase_bonus = 1.0 if query_phrase and len(query_phrase) >= 14 and query_phrase in preview_text else 0.0
            title_overlap = len(query_terms & self._terms(document.title))
            sparse_penalty = 0.35 if len(document.text) < 180 and coverage < 0.5 else 0.0
            score = (
                weighted_overlap
                + (1.6 * coverage)
                + (0.45 * bigram_hits)
                + phrase_bonus
                + (0.2 * title_overlap)
                - sparse_penalty
            )
            scored.append((score, overlap, bigram_hits, len(document.text), document))
        scored.sort(
            key=lambda pair: (pair[0], pair[1], pair[2], pair[3]),
            reverse=True,
        )
        return [pair[4] for pair in scored]

    def _local_hit_from_document(
        self,
        query: str,
        track_id: str,
        document: LocalCorpusDocument,
    ) -> DiscoveryHit:
        snippet = re.sub(r"\s+", " ", document.text)[:180]
        return DiscoveryHit(
            provider="local-corpus",
            track_id=track_id,
            query=query,
            url=document.path.as_uri(),
            title=document.relative_path,
            snippet=snippet,
            hit_type="local-doc",
            candidate_id=document.candidate_id,
            matched_terms=sorted(self._terms(query) & self._terms(document.text))[:6],
        )

    def _local_source_document_from_hit(
        self,
        hit: DiscoveryHit,
        document: LocalCorpusDocument,
    ) -> SourceDocument:
        normalized_text = re.sub(r"\s+", " ", document.text)
        summary = normalized_text[:400]
        architecture_excerpt = self._extract_local_signal(
            document.text,
            ["architecture", "design", "component", "system", "boundary"],
            fallback=summary,
        )
        workflow_excerpt = self._extract_local_signal(
            document.text,
            ["workflow", "pipeline", "process", "steps", "iteration"],
            fallback=summary,
        )
        integration_excerpt = self._extract_local_signal(
            document.text,
            ["api", "integration", "provider", "adapter", "endpoint", "tool"],
            fallback=summary,
        )
        facts = [
            SourceFact(
                fact_type="signal",
                confidence="medium",
                excerpt=summary,
                notes=[
                    "Local corpus source.",
                    f"Matched terms: {', '.join(hit.matched_terms) or 'none'}",
                ],
                extraction_fidelity="derived",
            ),
            SourceFact(
                fact_type="architecture",
                confidence="medium",
                excerpt=architecture_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(architecture_excerpt, summary),
            ),
            SourceFact(
                fact_type="workflow",
                confidence="medium",
                excerpt=workflow_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(workflow_excerpt, summary),
            ),
            SourceFact(
                fact_type="integration",
                confidence="medium",
                excerpt=integration_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(integration_excerpt, summary),
            ),
            SourceFact(
                fact_type="maintenance",
                confidence="high",
                excerpt=f"Local file last_updated={document.last_modified}.",
                notes=[f"path={document.relative_path}"],
                extraction_fidelity="derived",
            ),
        ]
        return SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type=document.source_type,
            title=document.title,
            summary=summary,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at=utc_now_iso(),
            facts=facts,
        )

    def _extract_local_signal(self, text: str, keywords: list[str], fallback: str) -> str:
        segments = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+|[\r\n]+", text) if segment.strip()]
        best_segment = ""
        best_score = 0
        for segment in segments:
            if len(segment) < 30 or len(segment) > 260:
                continue
            normalized = segment.lower()
            score = sum(1 for keyword in keywords if keyword in normalized)
            if score > best_score:
                best_segment = segment
                best_score = score
        return best_segment or fallback

    def _terms(self, text: str) -> set[str]:
        return set(self._ordered_terms(text))

    def _ordered_bigrams(self, text: str) -> list[str]:
        ordered_terms = self._ordered_terms(text)
        return [f"{ordered_terms[index]} {ordered_terms[index + 1]}" for index in range(len(ordered_terms) - 1)]

    def _ordered_terms(self, text: str) -> list[str]:
        stop_terms = self._local_stop_terms()
        return [
            term
            for term in re.findall(r"[a-z0-9]+", text.lower())
            if len(term) >= 3 and term not in stop_terms
        ]

    def _local_stop_terms(self) -> set[str]:
        raw_value = os.getenv("RESEARCH_ENGINE_LOCAL_STOP_TERMS", "").strip()
        if not raw_value:
            return set(self.DEFAULT_STOP_TERMS)
        parsed = {item.strip().lower() for item in raw_value.split(",") if item.strip()}
        return set(self.DEFAULT_STOP_TERMS) | parsed

    def _local_term_diagnostics_note(
        self,
        corpus_documents: list[LocalCorpusDocument],
        plan: SearchPlan,
        max_match_chars: int,
    ) -> str | None:
        if not corpus_documents:
            return None
        document_frequency: Counter[str] = Counter()
        corpus_frequency: Counter[str] = Counter()
        for document in corpus_documents:
            excerpt = f"{document.title} {document.text[:max_match_chars]}"
            ordered_terms = self._ordered_terms(excerpt)
            if not ordered_terms:
                continue
            corpus_frequency.update(ordered_terms)
            document_frequency.update(set(ordered_terms))
        if not corpus_frequency:
            return None

        top_terms = ", ".join(
            f"{term}({count})"
            for term, count in corpus_frequency.most_common(6)
        )
        query_terms = {term for query in plan.queries for term in self._terms(query.text)}
        min_doc_frequency = max(4, int((len(corpus_documents) * 0.4) + 0.999))
        suggestion_candidates = sorted(
            (
                (term, doc_count, corpus_frequency[term])
                for term, doc_count in document_frequency.items()
                if doc_count >= min_doc_frequency and term not in query_terms
            ),
            key=lambda item: (item[1], item[2], item[0]),
            reverse=True,
        )
        suggested_terms = [term for term, _, _ in suggestion_candidates[:8]]
        suggested_label = ", ".join(suggested_terms) if suggested_terms else "none"
        return (
            "Local-first lexical diagnostics: "
            f"docs={len(corpus_documents)}, unique_terms={len(corpus_frequency)}, "
            f"top_terms={top_terms or 'none'}, suggested_stop_terms={suggested_label}."
        )

    def _with_optional_note(self, notes: list[str], optional_note: str | None) -> list[str]:
        if optional_note:
            return [*notes, optional_note]
        return notes

    def _slug(self, value: str) -> str:
        return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")

    def _local_supported_extensions(self) -> set[str]:
        raw_value = os.getenv("RESEARCH_ENGINE_LOCAL_EXTENSIONS", "").strip()
        if not raw_value:
            return set(self.DEFAULT_SUPPORTED_EXTENSIONS)
        parsed = {
            item.strip().lower()
            if item.strip().startswith(".")
            else f".{item.strip().lower()}"
            for item in raw_value.split(",")
            if item.strip()
        }
        return parsed or set(self.DEFAULT_SUPPORTED_EXTENSIONS)

    def _local_top_k_per_query(self) -> int:
        raw_value = os.getenv("RESEARCH_ENGINE_LOCAL_TOP_K_PER_QUERY", "").strip()
        try:
            parsed = int(raw_value) if raw_value else 2
        except ValueError:
            parsed = 2
        return max(1, min(parsed, 10))

    def _local_max_match_chars(self) -> int:
        raw_value = os.getenv("RESEARCH_ENGINE_LOCAL_MAX_MATCH_CHARS", "").strip()
        try:
            parsed = int(raw_value) if raw_value else 3000
        except ValueError:
            parsed = 3000
        return max(400, min(parsed, 20000))

    def _local_strict_no_fallback(self) -> bool:
        raw_value = os.getenv("RESEARCH_ENGINE_LOCAL_STRICT_NO_FALLBACK", "").strip().lower()
        return raw_value in {"1", "true", "yes", "on"}


class LiveHybridAcquisitionProvider(AcquisitionProvider):
    mode = "live-hybrid"

    def __init__(
        self,
        *,
        aggregate_provider_name: str = "live-hybrid",
        fallback_to_catalog: bool = True,
        mode_note: str = "Live hybrid acquisition enabled (GitHub + GitLab + lightweight web search).",
    ) -> None:
        self._request_telemetry: dict[str, RequestTelemetry] = {}
        self._fetch_backend_attempts: Counter[str] = Counter()
        self._fetch_backend_successes: Counter[str] = Counter()
        self._aggregate_provider_name = aggregate_provider_name
        self._fallback_to_catalog = fallback_to_catalog
        self._mode_note = mode_note
        self._request_budget: RequestBudget | None = None

    def acquire(
        self,
        plan: SearchPlan,
        mission: ResearchMission,
        output_dir: Path | None = None,
    ) -> AcquisitionResult:
        del output_dir
        self._reset_request_telemetry()
        self._reset_fetch_backend_counters()
        self._request_budget = RequestBudget(
            max_requests=mission.constraints.max_requests,
            per_provider_max_requests=dict(mission.constraints.per_provider_max_requests),
        )
        hits: list[DiscoveryHit] = []
        seen_candidates: set[str] = set()
        notes: list[str] = [self._mode_note]
        notes.extend(self._live_auth_notes())
        notes.append(
            "Track provider preferences: "
            + "; ".join(
                f"{track_id}={','.join(preferences)}"
                for track_id, preferences in sorted(plan.track_provider_preferences.items())
            )
        )
        max_candidates = mission.constraints.max_candidates
        github_query_attempts = 0
        gitlab_query_attempts = 0
        tavily_query_attempts = 0
        exa_query_attempts = 0
        firecrawl_query_attempts = 0
        web_query_attempts = 0
        github_hit_count = 0
        gitlab_hit_count = 0
        tavily_hit_count = 0
        exa_hit_count = 0
        firecrawl_hit_count = 0
        web_hit_count = 0

        for query in plan.queries:
            if len(hits) >= max_candidates:
                break
            if not self._request_budget.has_remaining():
                notes.append("Discovery loop stopped early: aggregate request budget exhausted.")
                break
            for provider_name in self._provider_sequence_for_track(plan, query.track_id):
                if len(hits) >= max_candidates:
                    break
                if not self._request_budget.has_remaining(provider_name):
                    continue
                if provider_name == "github":
                    github_query_attempts += 1
                    github_hits = self._github_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    github_hit_count += len(github_hits)
                    hits.extend(github_hits)
                    continue
                if provider_name == "gitlab":
                    gitlab_query_attempts += 1
                    gitlab_hits = self._gitlab_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    gitlab_hit_count += len(gitlab_hits)
                    hits.extend(gitlab_hits)
                    continue
                if provider_name == "tavily":
                    tavily_query_attempts += 1
                    tavily_hits = self._tavily_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    tavily_hit_count += len(tavily_hits)
                    hits.extend(tavily_hits)
                    continue
                if provider_name == "exa":
                    exa_query_attempts += 1
                    exa_hits = self._exa_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    exa_hit_count += len(exa_hits)
                    hits.extend(exa_hits)
                    continue
                if provider_name == "firecrawl":
                    firecrawl_query_attempts += 1
                    firecrawl_hits = self._firecrawl_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    firecrawl_hit_count += len(firecrawl_hits)
                    hits.extend(firecrawl_hits)
                    continue
                if provider_name == "web":
                    web_query_attempts += 1
                    web_hits = self._web_hits_for_query(
                        query.text,
                        query.track_id,
                        max_candidates,
                        seen_candidates,
                    )
                    web_hit_count += len(web_hits)
                    hits.extend(web_hits)

        if not hits:
            if self._fallback_to_catalog:
                notes.append("Live discovery returned no hits; fell back to catalog discovery.")
                hits = discover_candidates(plan, mission)
                documents = fetch_documents(hits)
                provider_health = self._build_live_provider_health(
                    github_query_attempts=github_query_attempts,
                    gitlab_query_attempts=gitlab_query_attempts,
                    tavily_query_attempts=tavily_query_attempts,
                    exa_query_attempts=exa_query_attempts,
                    firecrawl_query_attempts=firecrawl_query_attempts,
                    web_query_attempts=web_query_attempts,
                    github_hit_count=0,
                    gitlab_hit_count=0,
                    tavily_hit_count=0,
                    exa_hit_count=0,
                    firecrawl_hit_count=0,
                    web_hit_count=0,
                    fetch_hits=[],
                    documents=[],
                    fallback_used=True,
                    extra_notes=["No live discovery hits; catalog fallback engaged."],
                    aggregate_provider_name=self._aggregate_provider_name,
                )
                provider_health.append(
                    ProviderHealth(
                        provider="catalog-fallback",
                        discovery_queries=len(plan.queries),
                        discovery_hits=len(hits),
                        fetch_attempts=len(hits),
                        fetch_successes=len(documents),
                        fetch_failures=max(0, len(hits) - len(documents)),
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["fallback-engaged", "live-discovery-empty"],
                        status_summary="Catalog fallback after live discovery returned no hits.",
                        notes=["Fallback path after live discovery miss."],
                    )
                )
                return AcquisitionResult(
                    discovery_hits=hits,
                    source_documents=documents,
                    notes=notes,
                    provider_health=provider_health,
                )
            notes.append("Live discovery returned no hits; strict api-provider mode does not fallback.")
            provider_health = self._build_live_provider_health(
                github_query_attempts=github_query_attempts,
                gitlab_query_attempts=gitlab_query_attempts,
                tavily_query_attempts=tavily_query_attempts,
                exa_query_attempts=exa_query_attempts,
                firecrawl_query_attempts=firecrawl_query_attempts,
                web_query_attempts=web_query_attempts,
                github_hit_count=0,
                gitlab_hit_count=0,
                tavily_hit_count=0,
                exa_hit_count=0,
                firecrawl_hit_count=0,
                web_hit_count=0,
                fetch_hits=[],
                documents=[],
                fallback_used=False,
                extra_notes=["No live discovery hits in strict api-provider mode."],
                aggregate_provider_name=self._aggregate_provider_name,
            )
            return AcquisitionResult(
                discovery_hits=[],
                source_documents=[],
                notes=notes,
                provider_health=provider_health,
            )

        github_hits = [hit for hit in hits if hit.provider.startswith("github")]
        gitlab_hits = [hit for hit in hits if hit.provider.startswith("gitlab")]
        tavily_hits = [hit for hit in hits if hit.provider.startswith("tavily")]
        exa_hits = [hit for hit in hits if hit.provider.startswith("exa")]
        firecrawl_hits = [hit for hit in hits if hit.provider.startswith("firecrawl")]
        web_hits = [hit for hit in hits if hit.provider.startswith("web")]
        notes.append(
            "Live discovery candidates: "
            f"github={len(github_hits)}, gitlab={len(gitlab_hits)}, "
            f"tavily={len(tavily_hits)}, exa={len(exa_hits)}, firecrawl={len(firecrawl_hits)}, web={len(web_hits)}."
        )

        fetch_hits = hits[: mission.constraints.max_fetches]
        documents = self._documents_from_hits(hits, mission.constraints.max_fetches)
        fetch_attempts = len(fetch_hits)
        fetch_successes = len(documents)
        fetch_failures = max(0, fetch_attempts - fetch_successes)
        if not documents:
            if self._fallback_to_catalog:
                notes.append("Live fetch produced no source documents; fell back to catalog fetch.")
                hits = discover_candidates(plan, mission)
                documents = fetch_documents(hits)
                provider_health = self._build_live_provider_health(
                    github_query_attempts=github_query_attempts,
                    gitlab_query_attempts=gitlab_query_attempts,
                    tavily_query_attempts=tavily_query_attempts,
                    exa_query_attempts=exa_query_attempts,
                    firecrawl_query_attempts=firecrawl_query_attempts,
                    web_query_attempts=web_query_attempts,
                    github_hit_count=github_hit_count,
                    gitlab_hit_count=gitlab_hit_count,
                    tavily_hit_count=tavily_hit_count,
                    exa_hit_count=exa_hit_count,
                    firecrawl_hit_count=firecrawl_hit_count,
                    web_hit_count=web_hit_count,
                    fetch_hits=fetch_hits,
                    documents=[],
                    fallback_used=True,
                    extra_notes=["Live discovery succeeded but fetch failed; catalog fetch fallback engaged."],
                    aggregate_provider_name=self._aggregate_provider_name,
                )
                provider_health.append(
                    ProviderHealth(
                        provider="catalog-fallback",
                        discovery_queries=len(plan.queries),
                        discovery_hits=len(hits),
                        fetch_attempts=len(hits),
                        fetch_successes=len(documents),
                        fetch_failures=max(0, len(hits) - len(documents)),
                        fallback_used=True,
                        status="fallback",
                        reason_codes=["fallback-engaged", "live-fetch-empty"],
                        status_summary="Catalog fallback after live fetch produced no documents.",
                        notes=["Fallback path after live fetch miss."],
                    )
                )
            else:
                notes.append(
                    "Live fetch produced no source documents; strict api-provider mode does not fallback."
                )
                provider_health = self._build_live_provider_health(
                    github_query_attempts=github_query_attempts,
                    gitlab_query_attempts=gitlab_query_attempts,
                    tavily_query_attempts=tavily_query_attempts,
                    exa_query_attempts=exa_query_attempts,
                    firecrawl_query_attempts=firecrawl_query_attempts,
                    web_query_attempts=web_query_attempts,
                    github_hit_count=github_hit_count,
                    gitlab_hit_count=gitlab_hit_count,
                    tavily_hit_count=tavily_hit_count,
                    exa_hit_count=exa_hit_count,
                    firecrawl_hit_count=firecrawl_hit_count,
                    web_hit_count=web_hit_count,
                    fetch_hits=fetch_hits,
                    documents=[],
                    fallback_used=False,
                    extra_notes=["Live discovery succeeded but fetch produced no source documents."],
                    aggregate_provider_name=self._aggregate_provider_name,
                )
        else:
            notes.append(f"Live acquisition collected {len(hits)} discovery hits and {len(documents)} source documents.")
            provider_health = self._build_live_provider_health(
                github_query_attempts=github_query_attempts,
                gitlab_query_attempts=gitlab_query_attempts,
                tavily_query_attempts=tavily_query_attempts,
                exa_query_attempts=exa_query_attempts,
                firecrawl_query_attempts=firecrawl_query_attempts,
                web_query_attempts=web_query_attempts,
                github_hit_count=github_hit_count,
                gitlab_hit_count=gitlab_hit_count,
                tavily_hit_count=tavily_hit_count,
                exa_hit_count=exa_hit_count,
                firecrawl_hit_count=firecrawl_hit_count,
                web_hit_count=web_hit_count,
                fetch_hits=fetch_hits,
                documents=documents,
                fallback_used=False,
                extra_notes=[
                    f"GitHub hits: {github_hit_count}.",
                    f"GitLab hits: {gitlab_hit_count}.",
                    f"Tavily hits: {tavily_hit_count}.",
                    f"Exa hits: {exa_hit_count}.",
                    f"Firecrawl hits: {firecrawl_hit_count}.",
                    f"Web hits: {web_hit_count}.",
                ],
                aggregate_provider_name=self._aggregate_provider_name,
            )
        return AcquisitionResult(
            discovery_hits=hits[:max_candidates],
            source_documents=documents,
            notes=notes,
            provider_health=provider_health,
        )

    def acquire_evidence_gap_follow_up(
        self,
        *,
        plan: SearchPlan,
        mission: ResearchMission,
        gap_directives: list[dict[str, object]],
        existing_documents: list[SourceDocument],
    ) -> EvidenceGapFollowUpResult:
        self._reset_request_telemetry()
        self._reset_fetch_backend_counters()
        directives = [directive for directive in gap_directives if isinstance(directive, dict)]
        if not directives:
            return EvidenceGapFollowUpResult(
                discovery_hits=[],
                source_documents=[],
                notes=[],
            )

        query_specs = self._follow_up_queries_from_gap_directives(
            directives,
            max_queries=FOLLOW_UP_MAX_QUERIES,
        )
        if not query_specs:
            return EvidenceGapFollowUpResult(
                discovery_hits=[],
                source_documents=[],
                notes=["Evidence-gap follow-up pass skipped: no actionable bounded queries."],
            )

        notes = [
            f"Evidence-gap follow-up pass engaged with {len(query_specs)} bounded query(ies)."
        ]
        seen_source_urls = {
            self._canonical_hit_url(document.source_url) or document.source_url.strip().lower()
            for document in existing_documents
        }
        best_hit_by_source_key: dict[str, tuple[DiscoveryHit, int]] = {}
        replaced_hits = 0
        skipped_existing_source_urls = 0
        web_query_attempts = 0

        for track_id, query_text, candidate_id, gap_name in query_specs:
            budget = self._request_budget
            if budget is not None and not budget.has_remaining():
                notes.append("Evidence-gap follow-up stopped early: request budget exhausted.")
                break
            web_query_attempts += 1
            web_hits = self._web_hits_for_query(
                query_text,
                track_id,
                FOLLOW_UP_QUERY_HIT_LIMIT,
                set(),
            )
            added_hits = 0
            for hit in web_hits:
                source_key = self._canonical_hit_url(hit.url) or hit.url.strip().lower()
                if source_key in seen_source_urls:
                    skipped_existing_source_urls += 1
                    continue
                quality_score = self._follow_up_hit_quality(hit)
                existing = best_hit_by_source_key.get(source_key)
                if existing is None:
                    best_hit_by_source_key[source_key] = (hit, quality_score)
                    added_hits += 1
                    continue
                if quality_score > existing[1]:
                    best_hit_by_source_key[source_key] = (hit, quality_score)
                    replaced_hits += 1
            notes.append(
                "Evidence-gap follow-up query "
                f"candidate={candidate_id}, gap={gap_name}, added_hits={added_hits}: {query_text}"
            )

        ranked_follow_up_hits = sorted(
            (item[0] for item in best_hit_by_source_key.values()),
            key=lambda hit: self._follow_up_hit_quality(hit),
            reverse=True,
        )
        follow_up_hits = ranked_follow_up_hits[:FOLLOW_UP_MAX_HITS]
        truncated_hits = max(0, len(ranked_follow_up_hits) - len(follow_up_hits))
        if replaced_hits:
            notes.append(
                f"Evidence-gap follow-up dedupe replaced {replaced_hits} weaker duplicate hit(s) with stronger evidence for the same source URL."
            )
        if skipped_existing_source_urls:
            notes.append(
                f"Evidence-gap follow-up skipped {skipped_existing_source_urls} hit(s) that duplicated already-fetched source URLs."
            )
        if truncated_hits:
            notes.append(
                f"Evidence-gap follow-up cap applied: {truncated_hits} hit(s) trimmed beyond global hit cap={FOLLOW_UP_MAX_HITS}."
            )

        if not follow_up_hits:
            notes.append("Evidence-gap follow-up pass found no new follow-up hits.")
            return EvidenceGapFollowUpResult(
                discovery_hits=[],
                source_documents=[],
                notes=notes,
            )

        max_fetches = max(1, min(FOLLOW_UP_MAX_HITS, mission.constraints.max_fetches))
        follow_up_documents = self._documents_from_hits(follow_up_hits, max_fetches=max_fetches)
        unique_documents: list[SourceDocument] = []
        duplicate_documents = 0
        for document in follow_up_documents:
            source_key = self._canonical_hit_url(document.source_url) or document.source_url.strip().lower()
            if source_key in seen_source_urls:
                duplicate_documents += 1
                continue
            seen_source_urls.add(source_key)
            unique_documents.append(document)
        if duplicate_documents:
            notes.append(
                f"Evidence-gap follow-up dropped {duplicate_documents} duplicate fetched document(s) after source-url dedupe."
            )
        notes.append(
            "Evidence-gap follow-up pass collected "
            f"{len(follow_up_hits)} discovery hits and {len(unique_documents)} source documents."
        )
        provider_health = self._build_live_provider_health(
            github_query_attempts=0,
            gitlab_query_attempts=0,
            tavily_query_attempts=0,
            exa_query_attempts=0,
            firecrawl_query_attempts=0,
            web_query_attempts=web_query_attempts,
            github_hit_count=0,
            gitlab_hit_count=0,
            tavily_hit_count=0,
            exa_hit_count=0,
            firecrawl_hit_count=0,
            web_hit_count=len(follow_up_hits),
            fetch_hits=follow_up_hits,
            documents=unique_documents,
            fallback_used=False,
            extra_notes=[
                "Evidence-gap follow-up acquisition pass.",
                f"Follow-up queries: {len(query_specs)}.",
                f"Follow-up hits: {len(follow_up_hits)}.",
                f"Follow-up capped-hit-limit: {FOLLOW_UP_MAX_HITS}.",
            ],
            aggregate_provider_name=f"{self._aggregate_provider_name}-follow-up",
        )
        return EvidenceGapFollowUpResult(
            discovery_hits=follow_up_hits,
            source_documents=unique_documents,
            notes=notes,
            provider_health=provider_health,
        )

    def _follow_up_queries_from_gap_directives(
        self,
        gap_directives: list[dict[str, object]],
        *,
        max_queries: int,
    ) -> list[tuple[str, str, str, str]]:
        if max_queries <= 0:
            return []
        priority_order = [
            "missing-primary-source-evidence",
            "missing-technical-facts",
            "missing-maintenance-freshness",
            "missing-comparative-evidence",
        ]
        directives = sorted(
            gap_directives,
            key=lambda item: len(item.get("gaps", [])) if isinstance(item.get("gaps", []), list) else 0,
            reverse=True,
        )

        queries: list[tuple[str, str, str, str]] = []
        seen_queries: set[str] = set()
        for directive in directives:
            if len(queries) >= max_queries:
                break
            candidate_id = str(directive.get("candidate_id", "unknown-candidate"))
            candidate_name = str(directive.get("candidate_name") or candidate_id)
            gaps = directive.get("gaps", [])
            if not isinstance(gaps, list):
                continue
            ordered_gaps = [gap for gap in priority_order if gap in gaps]
            if not ordered_gaps:
                continue
            selected_gap = ordered_gaps[0]
            track_id, query_text = self._build_gap_follow_up_query(candidate_name, selected_gap)
            normalized_query = re.sub(r"\s+", " ", query_text.strip().lower())
            if not normalized_query or normalized_query in seen_queries:
                continue
            queries.append((track_id, query_text, candidate_id, selected_gap))
            seen_queries.add(normalized_query)
        return queries

    def _follow_up_hit_quality(self, hit: DiscoveryHit) -> int:
        snippet_len = len(re.sub(r"\s+", " ", hit.snippet).strip())
        matched_term_score = len(hit.matched_terms) * 5
        type_score = 6 if hit.hit_type == "repo" else 3
        return matched_term_score + type_score + min(240, snippet_len)

    def _build_gap_follow_up_query(self, candidate_name: str, gap_name: str) -> tuple[str, str]:
        name = re.sub(r"\s+", " ", candidate_name).strip()
        if gap_name == "missing-primary-source-evidence":
            return (
                "official-docs",
                f"{name} official docs repository github gitlab readme",
            )
        if gap_name == "missing-technical-facts":
            return (
                "architecture-patterns",
                f"{name} architecture workflow integration design boundaries",
            )
        if gap_name == "missing-maintenance-freshness":
            return (
                "official-docs",
                f"{name} release changelog last updated maintenance notes",
            )
        if gap_name == "missing-comparative-evidence":
            return (
                "comparisons",
                f"{name} comparison alternatives benchmark tradeoff",
            )
        return (
            "official-docs",
            f"{name} documentation architecture workflow integration",
        )

    def _provider_sequence_for_track(self, plan: SearchPlan, track_id: str) -> list[str]:
        sequence = plan.track_provider_preferences.get(track_id)
        candidate_sequence = sequence or ["github", "exa", "tavily", "firecrawl", "web"]
        normalized: list[str] = []
        seen: set[str] = set()
        for provider_name in candidate_sequence:
            if provider_name in seen:
                continue
            if provider_name in OPTIONAL_PROVIDER_KEYS and not self._optional_provider_enabled(provider_name):
                continue
            normalized.append(provider_name)
            seen.add(provider_name)
        return normalized or ["github", "web"]

    def _optional_provider_enabled(self, provider_name: str) -> bool:
        if provider_name == "tavily":
            return bool(self._tavily_api_key())
        if provider_name == "exa":
            return bool(self._exa_api_key())
        if provider_name == "firecrawl":
            return bool(self._firecrawl_api_key())
        return True

    def _build_live_provider_health(
        self,
        github_query_attempts: int,
        gitlab_query_attempts: int,
        tavily_query_attempts: int,
        exa_query_attempts: int,
        firecrawl_query_attempts: int,
        web_query_attempts: int,
        github_hit_count: int,
        gitlab_hit_count: int,
        tavily_hit_count: int,
        exa_hit_count: int,
        firecrawl_hit_count: int,
        web_hit_count: int,
        fetch_hits: list[DiscoveryHit],
        documents: list[SourceDocument],
        fallback_used: bool,
        extra_notes: list[str],
        aggregate_provider_name: str,
    ) -> list[ProviderHealth]:
        github_fetch_attempts = sum(1 for hit in fetch_hits if hit.provider.startswith("github"))
        gitlab_fetch_attempts = sum(1 for hit in fetch_hits if hit.provider.startswith("gitlab"))
        github_fetch_successes = sum(1 for document in documents if document.provider.startswith("github"))
        gitlab_fetch_successes = sum(1 for document in documents if document.provider.startswith("gitlab"))
        web_fetch_attempts = self._fetch_backend_attempts["web-fetch"]
        web_fetch_successes = self._fetch_backend_successes["web-fetch"]
        firecrawl_fetch_attempts = self._fetch_backend_attempts["firecrawl-fetch"]
        firecrawl_fetch_successes = self._fetch_backend_successes["firecrawl-fetch"]

        aggregate = RequestTelemetry()
        for telemetry in self._request_telemetry.values():
            aggregate.request_attempts += telemetry.request_attempts
            aggregate.request_successes += telemetry.request_successes
            aggregate.request_failures += telemetry.request_failures
            aggregate.retry_attempts += telemetry.retry_attempts
            aggregate.timeout_count += telemetry.timeout_count
            aggregate.backoff_events += telemetry.backoff_events
            aggregate.total_backoff_seconds += telemetry.total_backoff_seconds
            aggregate.max_backoff_seconds = max(
                aggregate.max_backoff_seconds,
                telemetry.max_backoff_seconds,
            )

        aggregate_status = self._provider_status(
            fallback_used=fallback_used,
            discovery_queries=(
                github_query_attempts
                + gitlab_query_attempts
                + tavily_query_attempts
                + exa_query_attempts
                + firecrawl_query_attempts
                + web_query_attempts
            ),
            fetch_attempts=len(fetch_hits),
            fetch_failures=max(0, len(fetch_hits) - len(documents)),
            request_attempts=aggregate.request_attempts,
            retry_attempts=aggregate.retry_attempts,
            timeout_count=aggregate.timeout_count,
        )
        aggregate_reason_codes = self._provider_reason_codes(
            status=aggregate_status,
            fallback_used=fallback_used,
            discovery_queries=(
                github_query_attempts
                + gitlab_query_attempts
                + tavily_query_attempts
                + exa_query_attempts
                + firecrawl_query_attempts
                + web_query_attempts
            ),
            fetch_attempts=len(fetch_hits),
            fetch_failures=max(0, len(fetch_hits) - len(documents)),
            request_attempts=aggregate.request_attempts,
            retry_attempts=aggregate.retry_attempts,
            timeout_count=aggregate.timeout_count,
        )

        health_entries = [
            ProviderHealth(
                provider=aggregate_provider_name,
                discovery_queries=(
                    github_query_attempts
                    + gitlab_query_attempts
                    + tavily_query_attempts
                    + exa_query_attempts
                    + firecrawl_query_attempts
                    + web_query_attempts
                ),
                discovery_hits=(
                    github_hit_count
                    + gitlab_hit_count
                    + tavily_hit_count
                    + exa_hit_count
                    + firecrawl_hit_count
                    + web_hit_count
                ),
                fetch_attempts=len(fetch_hits),
                fetch_successes=len(documents),
                fetch_failures=max(0, len(fetch_hits) - len(documents)),
                fallback_used=fallback_used,
                status=aggregate_status,
                request_attempts=aggregate.request_attempts,
                request_successes=aggregate.request_successes,
                retry_attempts=aggregate.retry_attempts,
                timeout_count=aggregate.timeout_count,
                backoff_events=aggregate.backoff_events,
                total_backoff_seconds=round(aggregate.total_backoff_seconds, 2),
                max_backoff_seconds=round(aggregate.max_backoff_seconds, 2),
                reason_codes=aggregate_reason_codes,
                status_summary=self._provider_status_summary(
                    provider=aggregate_provider_name,
                    status=aggregate_status,
                    reason_codes=aggregate_reason_codes,
                ),
                notes=extra_notes,
                budget_max_requests=(
                    self._request_budget.max_requests
                    if self._request_budget is not None else None
                ),
                budget_used_requests=(
                    self._request_budget.aggregate_used
                    if self._request_budget is not None else None
                ),
                budget_exhaustion_events=(
                    list(self._request_budget.exhaustion_events)
                    if self._request_budget is not None else []
                ),
            ),
            self._provider_health_entry(
                provider_key="github-discovery",
                discovery_queries=github_query_attempts,
                discovery_hits=github_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="web-discovery",
                discovery_queries=web_query_attempts,
                discovery_hits=web_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="tavily-discovery",
                discovery_queries=tavily_query_attempts,
                discovery_hits=tavily_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="exa-discovery",
                discovery_queries=exa_query_attempts,
                discovery_hits=exa_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="firecrawl-discovery",
                discovery_queries=firecrawl_query_attempts,
                discovery_hits=firecrawl_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="gitlab-discovery",
                discovery_queries=gitlab_query_attempts,
                discovery_hits=gitlab_hit_count,
                fetch_attempts=0,
                fetch_successes=0,
                fetch_failures=0,
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="github-fetch",
                discovery_queries=0,
                discovery_hits=0,
                fetch_attempts=github_fetch_attempts,
                fetch_successes=github_fetch_successes,
                fetch_failures=max(0, github_fetch_attempts - github_fetch_successes),
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="web-fetch",
                discovery_queries=0,
                discovery_hits=0,
                fetch_attempts=web_fetch_attempts,
                fetch_successes=web_fetch_successes,
                fetch_failures=max(0, web_fetch_attempts - web_fetch_successes),
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="firecrawl-fetch",
                discovery_queries=0,
                discovery_hits=0,
                fetch_attempts=firecrawl_fetch_attempts,
                fetch_successes=firecrawl_fetch_successes,
                fetch_failures=max(0, firecrawl_fetch_attempts - firecrawl_fetch_successes),
                fallback_used=fallback_used,
            ),
            self._provider_health_entry(
                provider_key="gitlab-fetch",
                discovery_queries=0,
                discovery_hits=0,
                fetch_attempts=gitlab_fetch_attempts,
                fetch_successes=gitlab_fetch_successes,
                fetch_failures=max(0, gitlab_fetch_attempts - gitlab_fetch_successes),
                fallback_used=fallback_used,
            ),
        ]
        return health_entries

    def _provider_health_entry(
        self,
        provider_key: str,
        discovery_queries: int,
        discovery_hits: int,
        fetch_attempts: int,
        fetch_successes: int,
        fetch_failures: int,
        fallback_used: bool,
    ) -> ProviderHealth:
        telemetry = self._telemetry_bucket(provider_key)
        status = self._provider_status(
            fallback_used=fallback_used,
            discovery_queries=discovery_queries,
            fetch_attempts=fetch_attempts,
            fetch_failures=fetch_failures,
            request_attempts=telemetry.request_attempts,
            retry_attempts=telemetry.retry_attempts,
            timeout_count=telemetry.timeout_count,
        )
        reason_codes = self._provider_reason_codes(
            status=status,
            fallback_used=fallback_used,
            discovery_queries=discovery_queries,
            fetch_attempts=fetch_attempts,
            fetch_failures=fetch_failures,
            request_attempts=telemetry.request_attempts,
            retry_attempts=telemetry.retry_attempts,
            timeout_count=telemetry.timeout_count,
        )
        return ProviderHealth(
            provider=provider_key,
            discovery_queries=discovery_queries,
            discovery_hits=discovery_hits,
            fetch_attempts=fetch_attempts,
            fetch_successes=fetch_successes,
            fetch_failures=fetch_failures,
            fallback_used=fallback_used,
            status=status,
            request_attempts=telemetry.request_attempts,
            request_successes=telemetry.request_successes,
            retry_attempts=telemetry.retry_attempts,
            timeout_count=telemetry.timeout_count,
            backoff_events=telemetry.backoff_events,
            total_backoff_seconds=round(telemetry.total_backoff_seconds, 2),
            max_backoff_seconds=round(telemetry.max_backoff_seconds, 2),
            reason_codes=reason_codes,
            status_summary=self._provider_status_summary(
                provider=provider_key,
                status=status,
                reason_codes=reason_codes,
            ),
            notes=list(telemetry.notes),
        )

    def _provider_status(
        self,
        fallback_used: bool,
        discovery_queries: int,
        fetch_attempts: int,
        fetch_failures: int,
        request_attempts: int,
        retry_attempts: int,
        timeout_count: int,
    ) -> str:
        if fallback_used:
            return "fallback"
        if request_attempts == 0 and discovery_queries == 0 and fetch_attempts == 0:
            return "idle"
        if timeout_count > 0 or retry_attempts > 0 or fetch_failures > 0:
            return "degraded"
        return "healthy"

    def _provider_reason_codes(
        self,
        status: str,
        fallback_used: bool,
        discovery_queries: int,
        fetch_attempts: int,
        fetch_failures: int,
        request_attempts: int,
        retry_attempts: int,
        timeout_count: int,
    ) -> list[str]:
        reason_codes: list[str] = []
        if fallback_used:
            reason_codes.append("fallback-engaged")
        if timeout_count > 0:
            reason_codes.append("timeout")
        if retry_attempts > 0:
            reason_codes.append("retried")
        if fetch_failures > 0:
            reason_codes.append("fetch-failures")
        if status == "idle":
            reason_codes.append("idle")
        if status == "healthy" and not reason_codes:
            reason_codes.append("healthy")
        if status == "degraded" and not reason_codes:
            reason_codes.append("degraded")
        if request_attempts == 0 and discovery_queries == 0 and fetch_attempts == 0 and "idle" not in reason_codes:
            reason_codes.append("idle")
        return reason_codes

    def _provider_status_summary(
        self,
        provider: str,
        status: str,
        reason_codes: list[str],
    ) -> str:
        if reason_codes:
            return f"{provider} status={status}; reasons={', '.join(reason_codes)}."
        return f"{provider} status={status}."

    def _reset_request_telemetry(self) -> None:
        self._request_telemetry = {
            provider_key: RequestTelemetry()
            for provider_key in LIVE_PROVIDER_KEYS
        }

    def _reset_fetch_backend_counters(self) -> None:
        self._fetch_backend_attempts = Counter()
        self._fetch_backend_successes = Counter()

    def _telemetry_bucket(self, provider_key: str) -> RequestTelemetry:
        if provider_key not in self._request_telemetry:
            self._request_telemetry[provider_key] = RequestTelemetry()
        return self._request_telemetry[provider_key]

    def _request_with_retry(
        self,
        provider_key: str,
        operation: str,
        request_fn,
    ) -> dict | str:
        budget = self._request_budget
        if budget is not None:
            try:
                budget.check(provider_key)
            except RequestBudgetExhausted as exc:
                budget.record_exhaustion(
                    f"{operation}: budget exhausted ({exc.scope}, "
                    f"used={exc.used}, limit={exc.limit})"
                )
                raise
        telemetry = self._telemetry_bucket(provider_key)
        max_attempts = len(LIVE_RETRY_DELAYS_SECONDS) + 1
        for attempt in range(1, max_attempts + 1):
            telemetry.request_attempts += 1
            if budget is not None:
                budget.record(provider_key)
            try:
                response = request_fn()
                telemetry.request_successes += 1
                return response
            except Exception as error:
                error_label = self._error_label(error)
                telemetry.request_failures += 1
                if self._is_timeout_error(error):
                    telemetry.timeout_count += 1
                if attempt >= max_attempts:
                    self._append_telemetry_note(
                        telemetry,
                        f"{operation} failed after {attempt} attempts: {error_label}.",
                    )
                    self._close_error_response(error)
                    raise
                delay_seconds = LIVE_RETRY_DELAYS_SECONDS[attempt - 1]
                telemetry.retry_attempts += 1
                telemetry.backoff_events += 1
                telemetry.total_backoff_seconds += delay_seconds
                telemetry.max_backoff_seconds = max(telemetry.max_backoff_seconds, delay_seconds)
                self._append_telemetry_note(
                    telemetry,
                    f"{operation} retry {attempt}/{max_attempts - 1} after {error_label}; backoff={delay_seconds:.2f}s.",
                )
                self._close_error_response(error)
                sleep(delay_seconds)
        raise RuntimeError(f"Retry loop exhausted for {provider_key}:{operation}.")

    def _close_error_response(self, error: Exception) -> None:
        if not isinstance(error, HTTPError):
            return
        try:
            error.close()
        except Exception:
            return

    def _append_telemetry_note(self, telemetry: RequestTelemetry, note: str) -> None:
        if note not in telemetry.notes:
            telemetry.notes.append(note)

    def _is_timeout_error(self, error: Exception) -> bool:
        if isinstance(error, (TimeoutError, socket.timeout)):
            return True
        if isinstance(error, URLError):
            reason = getattr(error, "reason", None)
            return isinstance(reason, (TimeoutError, socket.timeout))
        return False

    def _error_label(self, error: Exception) -> str:
        if isinstance(error, HTTPError):
            return f"http-{error.code}"
        if self._is_timeout_error(error):
            return "timeout"
        if isinstance(error, URLError):
            reason = getattr(error, "reason", None)
            if reason:
                return str(reason)
        return error.__class__.__name__

    def _github_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        endpoint = (
            "https://api.github.com/search/repositories"
            f"?q={quote_plus(query)}&sort=stars&order=desc&per_page=3"
        )
        try:
            payload = self._read_json(endpoint, provider_key="github-discovery")
        except Exception:
            return []
        results: list[DiscoveryHit] = []
        for item in payload.get("items", []):
            repo_url = item.get("html_url", "")
            if not repo_url:
                continue
            candidate_id = self._candidate_id_from_repo_url(repo_url)
            if candidate_id in seen_candidates:
                continue
            title = item.get("full_name", repo_url)
            description = item.get("description") or "GitHub repository candidate."
            matched_terms = self._matched_terms(query, f"{title} {description}")
            results.append(
                DiscoveryHit(
                    provider="github-live",
                    track_id=track_id,
                    query=query,
                    url=repo_url,
                    title=title,
                    snippet=description,
                    hit_type="repo",
                    candidate_id=candidate_id,
                    matched_terms=matched_terms,
                )
            )
            seen_candidates.add(candidate_id)
            if len(seen_candidates) >= max_candidates:
                break
        return results

    def _gitlab_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        endpoint = (
            "https://gitlab.com/api/v4/projects"
            f"?search={quote_plus(query)}&order_by=star_count&sort=desc&per_page=3&simple=true"
        )
        try:
            payload = self._read_json(endpoint, provider_key="gitlab-discovery")
        except Exception:
            return []
        if not isinstance(payload, list):
            return []
        results: list[DiscoveryHit] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            repo_url = item.get("web_url", "")
            if not repo_url:
                continue
            candidate_id = self._candidate_id_from_repo_url(repo_url)
            if candidate_id in seen_candidates:
                continue
            title = item.get("path_with_namespace") or item.get("name") or repo_url
            description = item.get("description") or "GitLab repository candidate."
            matched_terms = self._matched_terms(query, f"{title} {description}")
            results.append(
                DiscoveryHit(
                    provider="gitlab-live",
                    track_id=track_id,
                    query=query,
                    url=repo_url,
                    title=title,
                    snippet=description,
                    hit_type="repo",
                    candidate_id=candidate_id,
                    matched_terms=matched_terms,
                )
            )
            seen_candidates.add(candidate_id)
            if len(seen_candidates) >= max_candidates:
                break
        return results

    def _tavily_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        api_key = self._tavily_api_key()
        if not api_key:
            return []
        available_slots = max(0, max_candidates - len(seen_candidates))
        if available_slots <= 0:
            return []
        payload = self._post_json(
            "https://api.tavily.com/search",
            provider_key="tavily-discovery",
            body={
                "query": query,
                "search_depth": "basic",
                "topic": "general",
                "max_results": min(3, available_slots),
                "include_raw_content": False,
            },
        )
        if not isinstance(payload, dict):
            return []
        results: list[DiscoveryHit] = []
        for item in payload.get("results", []):
            hit = self._external_web_hit_from_result(
                provider_name="tavily-live",
                query=query,
                track_id=track_id,
                raw_url=item.get("url", ""),
                raw_title=item.get("title", ""),
                raw_text=item.get("content") or item.get("snippet") or "",
                seen_candidates=seen_candidates,
            )
            if hit is None:
                continue
            results.append(hit)
            seen_candidates.add(hit.candidate_id)
            if len(seen_candidates) >= max_candidates:
                break
        return results

    def _exa_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        if not self._exa_api_key():
            return []
        available_slots = max(0, max_candidates - len(seen_candidates))
        if available_slots <= 0:
            return []
        payload = self._post_json(
            "https://api.exa.ai/search",
            provider_key="exa-discovery",
            body={
                "query": query,
                "numResults": min(3, available_slots),
                "contents": {
                    "summary": {"maxSentences": 2},
                    "text": {"maxCharacters": 600},
                },
            },
        )
        if not isinstance(payload, dict):
            return []
        results: list[DiscoveryHit] = []
        for item in payload.get("results", []):
            summary = (
                item.get("summary")
                or item.get("text")
                or " ".join(item.get("highlights", [])[:2])
                or ""
            )
            hit = self._external_web_hit_from_result(
                provider_name="exa-live",
                query=query,
                track_id=track_id,
                raw_url=item.get("url", ""),
                raw_title=item.get("title", ""),
                raw_text=summary,
                seen_candidates=seen_candidates,
            )
            if hit is None:
                continue
            results.append(hit)
            seen_candidates.add(hit.candidate_id)
            if len(seen_candidates) >= max_candidates:
                break
        return results

    def _firecrawl_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        if not self._firecrawl_api_key():
            return []
        available_slots = max(0, max_candidates - len(seen_candidates))
        if available_slots <= 0:
            return []
        payload = self._post_json(
            "https://api.firecrawl.dev/v2/search",
            provider_key="firecrawl-discovery",
            body={
                "query": query,
                "limit": min(3, available_slots),
                "sources": ["web"],
            },
        )
        if not isinstance(payload, dict):
            return []
        raw_results = payload.get("data")
        if isinstance(raw_results, dict):
            items = raw_results.get("web", [])
        else:
            items = raw_results or []
        results: list[DiscoveryHit] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            hit = self._external_web_hit_from_result(
                provider_name="firecrawl-live",
                query=query,
                track_id=track_id,
                raw_url=item.get("url") or item.get("sourceURL", ""),
                raw_title=item.get("title", ""),
                raw_text=item.get("description") or item.get("markdown") or "",
                seen_candidates=seen_candidates,
            )
            if hit is None:
                continue
            results.append(hit)
            seen_candidates.add(hit.candidate_id)
            if len(seen_candidates) >= max_candidates:
                break
        return results

    def _external_web_hit_from_result(
        self,
        *,
        provider_name: str,
        query: str,
        track_id: str,
        raw_url: str,
        raw_title: str,
        raw_text: str,
        seen_candidates: set[str],
    ) -> DiscoveryHit | None:
        url = (raw_url or "").strip()
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not url:
            return None
        host = urlparse(url).netloc.lower()
        owner_repo = self._owner_repo_from_url(url)
        is_github_repo = "github.com" in host and owner_repo is not None
        is_gitlab_repo = "gitlab.com" in host and bool(self._project_path_from_repo_url(url))
        if is_github_repo or is_gitlab_repo:
            candidate_id = self._candidate_id_from_repo_url(url)
            hit_type = "repo"
            title = raw_title.strip() or (
                f"{owner_repo[0]}/{owner_repo[1]}" if owner_repo is not None else host or url
            )
        else:
            candidate_id = self._candidate_id_from_url(url)
            hit_type = "doc"
            title = raw_title.strip() or host or url
        if candidate_id in seen_candidates:
            return None
        matched_terms = self._matched_terms(query, f"{title} {text}")
        if not matched_terms and len(text) < 40:
            return None
        snippet = text[:240] or f"{provider_name} discovery hit."
        return DiscoveryHit(
            provider=provider_name,
            track_id=track_id,
            query=query,
            url=url,
            title=title,
            snippet=snippet,
            hit_type=hit_type,
            candidate_id=candidate_id,
            matched_terms=matched_terms,
        )

    def _web_hits_for_query(
        self,
        query: str,
        track_id: str,
        max_candidates: int,
        seen_candidates: set[str],
    ) -> list[DiscoveryHit]:
        endpoint = (
            "https://api.duckduckgo.com/"
            f"?q={quote_plus(query)}&format=json&no_html=1&no_redirect=1&skip_disambig=1"
        )
        try:
            payload = self._read_json(endpoint, provider_key="web-discovery")
        except Exception:
            return []
        raw_topics = self._duckduckgo_candidates(payload)
        available_slots = max(0, max_candidates - len(seen_candidates))
        if available_slots <= 0:
            return []
        ranked_candidates = self._rank_web_candidates_for_query(
            query=query,
            raw_topics=raw_topics,
            seen_candidates=seen_candidates,
        )
        selected_candidates = self._select_web_candidates_for_fetch(
            ranked_candidates,
            max_results=available_slots,
        )
        results: list[DiscoveryHit] = []
        for candidate in selected_candidates:
            url = str(candidate["url"])
            candidate_id = str(candidate["candidate_id"])
            title = str(candidate["title"])
            hit_type = str(candidate["hit_type"])
            text = str(candidate["text"])
            matched_terms = list(candidate["matched_terms"])
            snippet = re.sub(r"\s+", " ", text).strip()[:240]
            results.append(
                DiscoveryHit(
                    provider="web-live",
                    track_id=track_id,
                    query=query,
                    url=url,
                    title=title,
                    snippet=snippet,
                    hit_type=hit_type,
                    candidate_id=candidate_id,
                    matched_terms=matched_terms,
                )
            )
            seen_candidates.add(candidate_id)
        return results

    def _rank_web_candidates_for_query(
        self,
        *,
        query: str,
        raw_topics: list[dict[str, str]],
        seen_candidates: set[str],
    ) -> list[dict[str, object]]:
        best_by_quality_key: dict[str, dict[str, object]] = {}
        for topic in raw_topics:
            url = topic.get("url", "")
            text = topic.get("text", "")
            if not url or not text:
                continue
            canonical_url = self._canonical_hit_url(url)
            if not canonical_url:
                continue
            host = urlparse(url).netloc.lower()
            owner_repo = self._owner_repo_from_url(url)
            is_github_repo = "github.com" in host and owner_repo is not None
            is_gitlab_repo = "gitlab.com" in host and bool(self._project_path_from_repo_url(url))
            if is_github_repo or is_gitlab_repo:
                candidate_id = self._candidate_id_from_repo_url(url)
                hit_type = "repo"
                if owner_repo is not None:
                    title = f"{owner_repo[0]}/{owner_repo[1]}"
                else:
                    title = topic.get("title", "") or host or "web-source"
                source_type = "github-repo" if is_github_repo else "gitlab-repo"
            else:
                candidate_id = self._candidate_id_from_url(url)
                hit_type = "doc"
                title = topic.get("title", "") or host or "web-source"
                source_type = self._classify_web_source_type(url, title, text)

            if candidate_id in seen_candidates:
                continue

            matched_terms = self._matched_terms(query, f"{title} {text}")
            if not matched_terms and len(text.strip()) < 60:
                continue

            (
                mission_fit_score,
                authority_score,
                comparative_bonus,
            ) = self._web_candidate_selection_components(
                source_type=source_type,
                url=url,
                title=title,
                text=text,
                matched_terms=matched_terms,
            )
            doc_intent_bonus = self._web_doc_intent_bonus(url=url, title=title, text=text)
            noise_penalty = self._web_noise_penalty(url=url, text=text, source_type=source_type)
            selection_score = (
                mission_fit_score
                + authority_score
                + comparative_bonus
                + doc_intent_bonus
                - noise_penalty
            )
            if selection_score <= 0:
                continue

            quality_key = self._web_candidate_quality_key(
                canonical_url=canonical_url,
                source_type=source_type,
                title=title,
                text=text,
            )
            candidate: dict[str, object] = {
                "url": url,
                "canonical_url": canonical_url,
                "text": text,
                "title": title,
                "hit_type": hit_type,
                "candidate_id": candidate_id,
                "matched_terms": matched_terms,
                "source_type": source_type,
                "selection_score": selection_score,
                "mission_fit_score": mission_fit_score,
                "authority_score": authority_score,
                "comparative_bonus": comparative_bonus,
            }
            existing = best_by_quality_key.get(quality_key)
            if existing is not None and int(existing["selection_score"]) >= selection_score:
                continue
            best_by_quality_key[quality_key] = candidate

        ranked_candidates = sorted(
            best_by_quality_key.values(),
            key=lambda item: (
                int(item["selection_score"]),
                int(item["mission_fit_score"]),
                int(item["authority_score"]),
                int(item["comparative_bonus"]),
                len(list(item["matched_terms"])),
            ),
            reverse=True,
        )
        return ranked_candidates

    def _select_web_candidates_for_fetch(
        self,
        candidates: list[dict[str, object]],
        *,
        max_results: int,
    ) -> list[dict[str, object]]:
        if max_results <= 0 or not candidates:
            return []

        selected: list[dict[str, object]] = []
        selected_keys: set[str] = set()
        represented_source_types: set[str] = set()
        weak_comparative_types = {"forum-thread", "blog-post", "news-article", "academic-paper"}

        # Pass 0: keep the strongest candidate first.
        for candidate in candidates:
            if len(selected) >= max_results:
                break
            candidate_key = f"{candidate['candidate_id']}|{candidate['canonical_url']}"
            if candidate_key in selected_keys:
                continue
            if int(candidate["selection_score"]) < 4:
                continue
            selected.append(candidate)
            selected_keys.add(candidate_key)
            represented_source_types.add(str(candidate["source_type"]))
            break

        # Pass 0.5: preserve uniquely comparative weaker-source signals when present.
        for candidate in candidates:
            if len(selected) >= max_results:
                break
            source_type = str(candidate["source_type"])
            candidate_key = f"{candidate['candidate_id']}|{candidate['canonical_url']}"
            if candidate_key in selected_keys:
                continue
            if source_type not in weak_comparative_types:
                continue
            if int(candidate["comparative_bonus"]) < 3:
                continue
            if int(candidate["selection_score"]) < 4:
                continue
            selected.append(candidate)
            selected_keys.add(candidate_key)
            represented_source_types.add(source_type)

        # Pass 1: keep top quality source-type diversity when candidates are minimally strong.
        for candidate in candidates:
            if len(selected) >= max_results:
                break
            source_type = str(candidate["source_type"])
            selection_score = int(candidate["selection_score"])
            candidate_key = f"{candidate['candidate_id']}|{candidate['canonical_url']}"
            if candidate_key in selected_keys:
                continue
            if source_type in represented_source_types:
                continue
            if selection_score < 4:
                continue
            selected.append(candidate)
            selected_keys.add(candidate_key)
            represented_source_types.add(source_type)

        # Pass 2: fill remaining slots by best remaining quality.
        for candidate in candidates:
            if len(selected) >= max_results:
                break
            candidate_key = f"{candidate['candidate_id']}|{candidate['canonical_url']}"
            if candidate_key in selected_keys:
                continue
            if int(candidate["selection_score"]) < 4:
                continue
            selected.append(candidate)
            selected_keys.add(candidate_key)

        selected.sort(
            key=lambda item: (
                int(item["selection_score"]),
                int(item["mission_fit_score"]),
                int(item["authority_score"]),
                int(item["comparative_bonus"]),
            ),
            reverse=True,
        )
        return selected[:max_results]

    def _web_candidate_selection_components(
        self,
        *,
        source_type: str,
        url: str,
        title: str,
        text: str,
        matched_terms: list[str],
    ) -> tuple[int, int, int]:
        mission_fit_score = len(matched_terms) * 4
        authority_score = WEB_SOURCE_AUTHORITY_WEIGHTS.get(source_type, WEB_SOURCE_AUTHORITY_WEIGHTS["unknown"])
        combined = f"{url} {title} {text}".lower()
        comparative_bonus = 0
        if any(cue in combined for cue in WEB_COMPARATIVE_CUES):
            if source_type in {"forum-thread", "blog-post", "news-article", "academic-paper"}:
                comparative_bonus = 3
            else:
                comparative_bonus = 1
        return mission_fit_score, authority_score, comparative_bonus

    def _web_doc_intent_bonus(self, *, url: str, title: str, text: str) -> int:
        combined = f"{url} {title} {text}".lower()
        return 2 if any(cue in combined for cue in WEB_DOC_INTENT_CUES) else 0

    def _web_noise_penalty(self, *, url: str, text: str, source_type: str) -> int:
        penalty = 0
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        path = parsed.path.strip("/")
        normalized_text = re.sub(r"\s+", " ", text).strip()

        if len(normalized_text) < 40:
            penalty += 3
        if not path and source_type not in {"github-repo", "gitlab-repo"}:
            penalty += 1
        if "duckduckgo.com" in host:
            penalty += 3
        return penalty

    def _web_candidate_quality_key(
        self,
        *,
        canonical_url: str,
        source_type: str,
        title: str,
        text: str,
    ) -> str:
        parsed = urlparse(canonical_url)
        host = parsed.netloc.lower()
        path = parsed.path.lower().rstrip("/")
        excerpt_tokens = re.findall(r"[a-z0-9]+", f"{title} {text}".lower())[:8]
        excerpt_head = "-".join(excerpt_tokens)
        return f"{source_type}|{host}|{path}|{excerpt_head}"

    def _documents_from_hits(self, hits: list[DiscoveryHit], max_fetches: int) -> list[SourceDocument]:
        documents: list[SourceDocument] = []
        budget = self._request_budget
        for hit in hits[:max_fetches]:
            if budget is not None and not budget.has_remaining():
                budget.record_exhaustion(
                    f"Fetch loop stopped after {len(documents)} document(s): "
                    f"aggregate budget exhausted ({budget.aggregate_used}/{budget.max_requests})."
                )
                break
            try:
                if hit.provider.startswith("github"):
                    document = self._build_github_document(hit)
                elif hit.provider.startswith("gitlab"):
                    document = self._build_gitlab_document(hit)
                else:
                    parsed = urlparse(hit.url)
                    host = parsed.netloc.lower()
                    if hit.hit_type == "repo" and "github.com" in host:
                        document = self._build_github_document(hit)
                    elif hit.hit_type == "repo" and "gitlab.com" in host:
                        document = self._build_gitlab_document(hit)
                    else:
                        document = self._build_web_document(hit)
            except RequestBudgetExhausted:
                break
            if document is None:
                continue
            documents.append(document)
        return documents

    def _build_github_document(self, hit: DiscoveryHit) -> SourceDocument | None:
        owner_repo = self._owner_repo_from_url(hit.url)
        if owner_repo is None:
            return self._fallback_document(hit)
        owner, repo = owner_repo
        repo_api = f"https://api.github.com/repos/{owner}/{repo}"
        repo_data = self._read_json(repo_api, provider_key="github-fetch", github=True)
        if not isinstance(repo_data, dict):
            return self._fallback_document(hit)

        readme_text = self._fetch_github_readme(owner, repo)
        description = repo_data.get("description") or hit.snippet
        stars = repo_data.get("stargazers_count", 0)
        forks = repo_data.get("forks_count", 0)
        open_issues = repo_data.get("open_issues_count", 0)
        language = repo_data.get("language") or "unknown"
        updated_at = repo_data.get("pushed_at") or "unknown"
        topics = ", ".join(repo_data.get("topics", [])[:6]) if isinstance(repo_data.get("topics"), list) else ""
        homepage = repo_data.get("homepage") or ""
        budget = self._request_budget
        enrich = budget is None or budget.aggregate_remaining > 6
        latest_release_published_at = (
            self._fetch_github_latest_release_published_at(owner, repo)
            if enrich else ""
        )
        homepage_last_updated = (
            self._fetch_homepage_last_updated(homepage)
            if enrich else ""
        )
        docs_pages: list[tuple[str, str]] = (
            self._official_docs_followthrough(
                repo_url=hit.url,
                homepage=homepage,
                readme_text=readme_text,
                seed_urls=[],
                max_pages=3,
            )
            if enrich else []
        )
        docs_text = "\n".join(page_text for _, page_text in docs_pages)
        repo_signal_text = docs_text or readme_text

        architecture_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["architecture", "design", "components", "system"],
            fallback=description,
        )
        workflow_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["workflow", "pipeline", "steps", "research", "process"],
            fallback=hit.snippet,
        )
        integration_fallback = (
            f"Homepage: {homepage}" if homepage else "No homepage integration signal found."
        )
        integration_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["integration", "api", "provider", "mcp", "tool"],
            fallback=integration_fallback,
        )
        dependency_excerpt = (
            f"Primary language: {language}. Topics: {topics or 'none listed'}."
        )
        maintenance_excerpt = (
            f"Stars={stars}, forks={forks}, open_issues={open_issues}, last_push={updated_at}."
        )
        maintenance_notes: list[str] = []
        if latest_release_published_at:
            maintenance_notes.append(f"latest_release_published_at={latest_release_published_at}")
        if homepage:
            maintenance_notes.append(f"homepage={homepage}")
        if homepage_last_updated:
            maintenance_notes.append(f"homepage_last_updated={homepage_last_updated}")
        if docs_pages:
            maintenance_notes.append(f"docs_followthrough_pages={len(docs_pages)}")
            maintenance_notes.append(
                "docs_followthrough_urls=" + ", ".join(url for url, _ in docs_pages)
            )

        facts: list[SourceFact] = []
        if docs_pages:
            facts.append(
                SourceFact(
                    fact_type="signal",
                    confidence="high",
                    excerpt=f"Official docs follow-through captured {len(docs_pages)} page(s).",
                    notes=["Primary-source docs/reference/quickstart evidence enriched before scoring."],
                    extraction_fidelity="derived",
                )
            )
        facts.extend([
            SourceFact(
                fact_type="architecture",
                confidence="medium" if architecture_excerpt == description else "high",
                excerpt=architecture_excerpt,
                notes=[f"Matched terms: {', '.join(hit.matched_terms) or 'none'}"],
                extraction_fidelity=_signal_fidelity(architecture_excerpt, description),
            ),
            SourceFact(
                fact_type="workflow",
                confidence="medium" if workflow_excerpt == hit.snippet else "high",
                excerpt=workflow_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(workflow_excerpt, hit.snippet),
            ),
            SourceFact(
                fact_type="integration",
                confidence=(
                    "high"
                    if docs_pages and integration_excerpt != integration_fallback
                    else "medium"
                ),
                excerpt=integration_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(
                    integration_excerpt,
                    integration_fallback,
                ),
            ),
            SourceFact(
                fact_type="dependency",
                confidence="high",
                excerpt=dependency_excerpt,
                notes=[],
                extraction_fidelity="derived",
            ),
            SourceFact(
                fact_type="maintenance",
                confidence="high",
                excerpt=maintenance_excerpt,
                notes=maintenance_notes,
                extraction_fidelity="derived",
            ),
        ])
        return SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type="github-repo",
            title=repo_data.get("full_name", hit.title),
            summary=description,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at=utc_now_iso(),
            facts=facts,
        )

    def _build_gitlab_document(self, hit: DiscoveryHit) -> SourceDocument | None:
        project_path = self._project_path_from_repo_url(hit.url)
        if not project_path:
            return self._fallback_document(hit)
        project_key = quote_plus(project_path, safe="")
        project_api = f"https://gitlab.com/api/v4/projects/{project_key}"
        project_data = self._read_json(project_api, provider_key="gitlab-fetch")
        if not isinstance(project_data, dict):
            return self._fallback_document(hit)

        description = project_data.get("description") or hit.snippet
        stars = project_data.get("star_count", 0)
        forks = project_data.get("forks_count", 0)
        open_issues = project_data.get("open_issues_count", 0)
        updated_at = project_data.get("last_activity_at") or "unknown"
        language = project_data.get("language") or "unknown"
        topics = project_data.get("topics") if isinstance(project_data.get("topics"), list) else []
        topics_text = ", ".join(topics[:6]) if topics else "none listed"
        budget = self._request_budget
        enrich = budget is None or budget.aggregate_remaining > 6
        latest_release_published_at = (
            self._fetch_gitlab_latest_release_published_at(project_key)
            if enrich else ""
        )
        homepage = project_data.get("homepage") or ""
        repository_surface = project_data.get("web_url") or hit.url
        readme_url = project_data.get("readme_url") if isinstance(project_data.get("readme_url"), str) else ""
        docs_pages: list[tuple[str, str]] = (
            self._official_docs_followthrough(
                repo_url=hit.url,
                homepage=homepage or repository_surface,
                readme_text=description,
                seed_urls=[homepage, repository_surface, readme_url],
                max_pages=3,
            )
            if enrich else []
        )
        docs_text = "\n".join(page_text for _, page_text in docs_pages)
        repo_signal_text = docs_text or description

        architecture_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["architecture", "design", "components", "system"],
            fallback=description,
        )
        workflow_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["workflow", "pipeline", "steps", "research", "process"],
            fallback=hit.snippet,
        )
        integration_excerpt = self._extract_signal_line(
            repo_signal_text,
            ["integration", "api", "provider", "tool", "adapter"],
            fallback=description,
        )
        maintenance_excerpt = (
            f"Stars={stars}, forks={forks}, open_issues={open_issues}, last_push={updated_at}."
        )
        maintenance_notes: list[str] = []
        if latest_release_published_at:
            maintenance_notes.append(f"latest_release_published_at={latest_release_published_at}")
        if docs_pages:
            maintenance_notes.append(f"docs_followthrough_pages={len(docs_pages)}")
            maintenance_notes.append(
                "docs_followthrough_urls=" + ", ".join(url for url, _ in docs_pages)
            )

        facts: list[SourceFact] = []
        if docs_pages:
            facts.append(
                SourceFact(
                    fact_type="signal",
                    confidence="high",
                    excerpt=f"Official docs follow-through captured {len(docs_pages)} page(s).",
                    notes=["Primary-source docs/reference/quickstart evidence enriched before scoring."],
                    extraction_fidelity="derived",
                )
            )
        facts.extend([
            SourceFact(
                fact_type="architecture",
                confidence="medium",
                excerpt=architecture_excerpt,
                notes=[f"Matched terms: {', '.join(hit.matched_terms) or 'none'}"],
                extraction_fidelity=_signal_fidelity(architecture_excerpt, description),
            ),
            SourceFact(
                fact_type="workflow",
                confidence="medium",
                excerpt=workflow_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(workflow_excerpt, hit.snippet),
            ),
            SourceFact(
                fact_type="integration",
                confidence="high" if docs_pages and integration_excerpt != description else "medium",
                excerpt=integration_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(integration_excerpt, description),
            ),
            SourceFact(
                fact_type="dependency",
                confidence="high",
                excerpt=f"Primary language: {language}. Topics: {topics_text}.",
                notes=[],
                extraction_fidelity="derived",
            ),
            SourceFact(
                fact_type="maintenance",
                confidence="high",
                excerpt=maintenance_excerpt,
                notes=maintenance_notes,
                extraction_fidelity="derived",
            ),
        ])
        return SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type="gitlab-repo",
            title=project_data.get("path_with_namespace", hit.title),
            summary=description,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at=utc_now_iso(),
            facts=facts,
        )

    def _build_web_document(self, hit: DiscoveryHit) -> SourceDocument | None:
        html = self._read_web_text(hit.url)
        if not html:
            return self._fallback_document(hit)
        title = extract_title_from_html(html) or hit.title
        source_profile = extract_source_profile_from_html(html)
        source_updated_at = extract_source_updated_at_from_html(html)
        visible_text = extract_visible_text(html)
        summary = visible_text[:400] if visible_text else source_profile.get("description", hit.snippet)
        raw_summary = summary
        if not source_updated_at:
            source_updated_at = source_profile.get("modified_at") or source_profile.get("published_at", "")
        source_type = self._classify_web_source_type(hit.url, title, summary)
        max_follow_through_pages = WEB_DOC_FOLLOW_THROUGH_MAX_PAGES
        max_follow_through_candidates = WEB_DOC_FOLLOW_THROUGH_MAX_CANDIDATES
        if source_type == "academic-paper":
            max_follow_through_pages = WEB_ACADEMIC_FOLLOW_THROUGH_MAX_PAGES
            max_follow_through_candidates = WEB_ACADEMIC_FOLLOW_THROUGH_MAX_CANDIDATES
        follow_through_pages = self._web_authoritative_followthrough(
            base_url=hit.url,
            base_html=html,
            source_type=source_type,
            max_pages=max_follow_through_pages,
            max_candidates=max_follow_through_candidates,
        )
        follow_through_text = "\n".join(page_text for _, page_text in follow_through_pages)
        evidence_text = "\n".join(part for part in [visible_text, follow_through_text] if part)
        keyword_profile = self._web_keyword_profile(source_type)
        profile_name = self._web_extraction_profile_name(source_type)
        shaped_summary = self._extract_signal_line(
            evidence_text,
            keyword_profile["signal"],
            fallback=summary,
        )
        summary = shaped_summary[:400] if shaped_summary else summary
        (
            signal_confidence,
            architecture_confidence,
            workflow_confidence,
            integration_confidence,
        ) = self._web_confidence_by_source_type(source_type)
        architecture_excerpt = self._extract_signal_line(
            evidence_text,
            keyword_profile["architecture"],
            fallback=summary,
        )
        workflow_excerpt = self._extract_signal_line(
            evidence_text,
            keyword_profile["workflow"],
            fallback=hit.snippet,
        )
        integration_excerpt = self._extract_signal_line(
            evidence_text,
            keyword_profile["integration"],
            fallback=summary,
        )
        signal_notes = [
            f"Matched terms: {', '.join(hit.matched_terms) or 'none'}",
            f"Web source type: {source_type}",
            f"Extraction profile: {profile_name}",
        ]
        if follow_through_pages:
            signal_notes.append(
                f"Follow-through pages: {len(follow_through_pages)} (cap={max_follow_through_pages})."
            )
        elif source_type == "academic-paper":
            signal_notes.append(
                "Academic follow-through captured 0 pages (same-host non-PDF candidates unavailable or unreadable)."
            )
        if source_profile.get("author"):
            signal_notes.append(f"Author: {source_profile['author']}")
        if source_profile.get("site_name"):
            signal_notes.append(f"Site: {source_profile['site_name']}")
        if source_profile.get("schema_type"):
            signal_notes.append(f"Schema type: {source_profile['schema_type']}")

        facts: list[SourceFact] = []
        follow_through_fact_label = self._web_followthrough_fact_label(source_type)
        follow_through_fact_note = self._web_followthrough_fact_note(source_type)
        if follow_through_pages:
            facts.append(
                SourceFact(
                    fact_type="signal",
                    confidence="high",
                    excerpt=f"{follow_through_fact_label} captured {len(follow_through_pages)} page(s).",
                    notes=[
                        follow_through_fact_note,
                        "followthrough_urls=" + ", ".join(url for url, _ in follow_through_pages),
                    ],
                    extraction_fidelity="derived",
                )
            )
        facts.extend([
            SourceFact(
                fact_type="signal",
                confidence=signal_confidence,
                excerpt=summary,
                notes=signal_notes,
                extraction_fidelity=_signal_fidelity(summary, raw_summary),
            ),
            SourceFact(
                fact_type="architecture",
                confidence=architecture_confidence,
                excerpt=architecture_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(architecture_excerpt, summary),
            ),
            SourceFact(
                fact_type="workflow",
                confidence=workflow_confidence,
                excerpt=workflow_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(workflow_excerpt, hit.snippet),
            ),
            SourceFact(
                fact_type="integration",
                confidence=(
                    "low"
                    if integration_confidence != "high" and integration_excerpt == summary
                    else integration_confidence
                ),
                excerpt=integration_excerpt,
                notes=[],
                extraction_fidelity=_signal_fidelity(integration_excerpt, summary),
            ),
        ])
        if source_updated_at:
            maintenance_notes: list[str] = []
            if source_profile.get("published_at"):
                maintenance_notes.append(f"published_at={source_profile['published_at']}")
            if source_profile.get("modified_at"):
                maintenance_notes.append(f"modified_at={source_profile['modified_at']}")
            if follow_through_pages:
                maintenance_notes.append(f"web_followthrough_pages={len(follow_through_pages)}")
            facts.append(
                SourceFact(
                    fact_type="maintenance",
                    confidence="high",
                    excerpt=f"Page last_updated={source_updated_at}.",
                    notes=maintenance_notes,
                    extraction_fidelity="derived",
                )
            )
        return SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type=source_type,
            title=title,
            summary=summary,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at=utc_now_iso(),
            facts=facts,
        )

    def _fallback_document(self, hit: DiscoveryHit) -> SourceDocument:
        source_type = "product-doc"
        if "github.com" in hit.url:
            source_type = "github-repo"
        elif "gitlab.com" in hit.url:
            source_type = "gitlab-repo"
        return SourceDocument(
            candidate_id=hit.candidate_id,
            source_url=hit.url,
            source_type=source_type,
            title=hit.title,
            summary=hit.snippet,
            provider=hit.provider,
            track_id=hit.track_id,
            fetched_at=utc_now_iso(),
            facts=[
                SourceFact(
                    fact_type="signal",
                    confidence="medium",
                    excerpt=hit.snippet,
                    notes=[f"Matched terms: {', '.join(hit.matched_terms) or 'none'}"],
                    extraction_fidelity="fallback",
                )
            ],
        )

    def _flatten_topics(self, topics: list[dict]) -> list[dict]:
        flattened: list[dict] = []
        for topic in topics:
            if not isinstance(topic, dict):
                continue
            if "FirstURL" in topic:
                flattened.append(topic)
                continue
            for subtopic in topic.get("Topics", []):
                if "FirstURL" in subtopic:
                    flattened.append(subtopic)
        return flattened

    def _duckduckgo_candidates(self, payload: dict) -> list[dict[str, str]]:
        candidates: list[dict[str, str]] = []

        abstract_url = payload.get("AbstractURL", "")
        abstract_text = payload.get("AbstractText", "")
        if isinstance(abstract_url, str) and isinstance(abstract_text, str):
            if abstract_url.strip() and abstract_text.strip():
                heading = payload.get("Heading", "")
                title = heading.strip() if isinstance(heading, str) else ""
                candidates.append({"url": abstract_url.strip(), "text": abstract_text.strip(), "title": title})

        for item in payload.get("Results", []):
            if not isinstance(item, dict):
                continue
            url = item.get("FirstURL", "")
            text = item.get("Text", "")
            if not isinstance(url, str) or not isinstance(text, str):
                continue
            if not url.strip() or not text.strip():
                continue
            candidates.append({"url": url.strip(), "text": text.strip(), "title": ""})

        for topic in self._flatten_topics(payload.get("RelatedTopics", [])):
            url = topic.get("FirstURL", "")
            text = topic.get("Text", "")
            if not isinstance(url, str) or not isinstance(text, str):
                continue
            if not url.strip() or not text.strip():
                continue
            candidates.append({"url": url.strip(), "text": text.strip(), "title": ""})

        return candidates

    def _canonical_hit_url(self, url: str) -> str:
        parsed = urlparse(url.strip())
        if not parsed.scheme or not parsed.netloc:
            return ""
        path = parsed.path.rstrip("/") or "/"
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"

    def _read_json(self, url: str, provider_key: str, github: bool = False) -> dict:
        headers = {"User-Agent": "research-engine/0.1"}
        if github:
            headers["Accept"] = "application/vnd.github+json"
            headers["X-GitHub-Api-Version"] = "2022-11-28"
        headers.update(self._auth_headers_for_url(url, github=github))
        request = Request(url, headers=headers)
        payload = self._request_with_retry(
            provider_key,
            operation=f"GET {urlparse(url).netloc or url}",
            request_fn=lambda: self._read_bytes(request),
        )
        return json.loads(payload.decode("utf-8"))

    def _post_json(self, url: str, provider_key: str, body: dict[str, object]) -> dict:
        headers = {
            "User-Agent": "research-engine/0.1",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        headers.update(self._auth_headers_for_url(url, github=False))
        request = Request(
            url,
            headers=headers,
            data=json.dumps(body).encode("utf-8"),
            method="POST",
        )
        payload = self._request_with_retry(
            provider_key,
            operation=f"POST {urlparse(url).netloc or url}",
            request_fn=lambda: self._read_bytes(request),
        )
        return json.loads(payload.decode("utf-8"))

    def _read_text(self, url: str, provider_key: str) -> str:
        headers = {"User-Agent": "research-engine/0.1"}
        headers.update(self._auth_headers_for_url(url, github=False))
        request = Request(url, headers=headers)
        try:
            payload = self._request_with_retry(
                provider_key,
                operation=f"GET {urlparse(url).netloc or url}",
                request_fn=lambda: self._read_bytes(request),
            )
            return payload.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def _read_web_text(self, url: str) -> str:
        firecrawl_text = self._firecrawl_scrape_text(url)
        if firecrawl_text:
            self._fetch_backend_successes["firecrawl-fetch"] += 1
            return firecrawl_text
        self._fetch_backend_attempts["web-fetch"] += 1
        text = self._read_text(url, provider_key="web-fetch")
        if text:
            self._fetch_backend_successes["web-fetch"] += 1
        return text

    def _firecrawl_scrape_text(self, url: str) -> str:
        if not self._firecrawl_api_key():
            return ""
        self._fetch_backend_attempts["firecrawl-fetch"] += 1
        try:
            payload = self._post_json(
                "https://api.firecrawl.dev/v2/scrape",
                provider_key="firecrawl-fetch",
                body={
                    "url": url,
                    "formats": ["markdown", "html"],
                    "onlyMainContent": True,
                },
            )
        except Exception:
            return ""
        if not isinstance(payload, dict):
            return ""
        data = payload.get("data", {})
        if not isinstance(data, dict):
            return ""
        markdown = data.get("markdown")
        if isinstance(markdown, str) and markdown.strip():
            return markdown
        html = data.get("html")
        if isinstance(html, str) and html.strip():
            return html
        content = data.get("content")
        if isinstance(content, str) and content.strip():
            return content
        return ""

    def _read_bytes(self, request: Request) -> bytes:
        with urlopen(request, timeout=LIVE_REQUEST_TIMEOUT_SECONDS) as response:
            return response.read()

    def _fetch_github_readme(self, owner: str, repo: str) -> str:
        endpoint = f"https://api.github.com/repos/{owner}/{repo}/readme"
        try:
            payload = self._read_json(endpoint, provider_key="github-fetch", github=True)
        except Exception:
            return ""
        if not isinstance(payload, dict):
            return ""
        content = payload.get("content")
        encoding = payload.get("encoding", "")
        if not content or encoding != "base64":
            return ""
        try:
            decoded = base64.b64decode(content).decode("utf-8", errors="ignore")
            return decoded
        except Exception:
            return ""

    def _fetch_github_latest_release_published_at(self, owner: str, repo: str) -> str:
        endpoint = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
        try:
            payload = self._read_json(endpoint, provider_key="github-fetch", github=True)
        except HTTPError as error:
            if error.code == 404:
                return ""
            return ""
        except Exception:
            return ""
        if not isinstance(payload, dict):
            return ""
        return payload.get("published_at") or payload.get("created_at") or ""

    def _fetch_gitlab_latest_release_published_at(self, project_key: str) -> str:
        endpoint = f"https://gitlab.com/api/v4/projects/{project_key}/releases/permalink/latest"
        try:
            payload = self._read_json(endpoint, provider_key="gitlab-fetch")
        except HTTPError as error:
            if error.code == 404:
                return ""
            return ""
        except Exception:
            return ""
        if not isinstance(payload, dict):
            return ""
        return payload.get("released_at") or payload.get("created_at") or ""

    def _fetch_homepage_last_updated(self, homepage: str) -> str:
        if not homepage:
            return ""
        html = self._read_web_text(homepage)
        if not html:
            return ""
        return extract_source_updated_at_from_html(html)

    def _official_docs_followthrough(
        self,
        *,
        repo_url: str,
        homepage: str,
        readme_text: str,
        seed_urls: list[str],
        max_pages: int,
    ) -> list[tuple[str, str]]:
        candidate_urls: list[str] = [url for url in seed_urls if isinstance(url, str) and url.strip()]
        candidate_urls.extend(self._extract_markdown_links(readme_text))
        candidate_urls.extend(self._extract_plain_urls(readme_text))

        homepage_html = ""
        homepage_canonical = ""
        if homepage:
            homepage_canonical = self._canonical_hit_url(homepage)
            candidate_urls.append(homepage)
            homepage_html = self._read_web_text(homepage)
            if homepage_html:
                candidate_urls.extend(self._extract_html_links(homepage_html, base_url=homepage))

        ranked_urls = self._rank_official_doc_candidates(
            candidate_urls,
            repo_url=repo_url,
            homepage=homepage,
        )
        pages: list[tuple[str, str]] = []
        for candidate_url in ranked_urls:
            if len(pages) >= max_pages:
                break
            canonical = self._canonical_hit_url(candidate_url)
            if not canonical:
                continue
            html = ""
            if homepage_html and homepage_canonical and canonical == homepage_canonical:
                html = homepage_html
            else:
                html = self._read_web_text(candidate_url)
            if not html:
                continue
            visible_text = extract_visible_text(html)
            if not visible_text:
                continue
            pages.append((candidate_url, visible_text[:5000]))
        return pages

    def _rank_official_doc_candidates(
        self,
        candidate_urls: list[str],
        *,
        repo_url: str,
        homepage: str,
    ) -> list[str]:
        ranked: list[tuple[int, str]] = []
        seen: set[str] = set()
        homepage_host = urlparse(homepage).netloc.lower()
        repo_host = urlparse(repo_url).netloc.lower()
        for candidate_url in candidate_urls:
            canonical = self._canonical_hit_url(candidate_url)
            if not canonical or canonical in seen:
                continue
            score = self._official_doc_candidate_score(
                canonical,
                homepage_host=homepage_host,
                repo_host=repo_host,
            )
            if score <= 0:
                continue
            ranked.append((score, canonical))
            seen.add(canonical)
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [url for _, url in ranked]

    def _official_doc_candidate_score(
        self,
        candidate_url: str,
        *,
        homepage_host: str,
        repo_host: str,
    ) -> int:
        parsed = urlparse(candidate_url)
        host = parsed.netloc.lower()
        path = parsed.path.lower()
        combined = f"{host}{path}"

        score = 0
        if "docs" in combined or "documentation" in combined:
            score += 4
        if "reference" in combined or "/api" in path:
            score += 5
        if "quickstart" in combined or "getting-started" in combined or "get-started" in combined:
            score += 5
        if "guide" in combined or "tutorial" in combined:
            score += 2
        if host.startswith("docs.") or "readthedocs" in host:
            score += 3
        if homepage_host and host == homepage_host:
            score += 2

        if repo_host and host == repo_host and "/blob/" in path:
            score -= 3

        if score <= 0:
            return 0
        if (
            homepage_host
            and host != homepage_host
            and not host.startswith("docs.")
            and "readthedocs" not in host
            and "docs" not in host
            and "reference" not in path
            and "api" not in path
        ):
            return 0
        return score

    def _extract_markdown_links(self, text: str) -> list[str]:
        if not text:
            return []
        pattern = re.compile(r"\[[^\]]+\]\((https?://[^)\s]+)\)", flags=re.IGNORECASE)
        return [match.group(1).strip() for match in pattern.finditer(text)]

    def _extract_plain_urls(self, text: str) -> list[str]:
        if not text:
            return []
        pattern = re.compile(r"https?://[^\s)\]>\"']+", flags=re.IGNORECASE)
        return [
            match.group(0).rstrip(".,);]")
            for match in pattern.finditer(text)
        ]

    def _extract_html_links(self, html: str, *, base_url: str) -> list[str]:
        if not html:
            return []
        links: list[str] = []
        pattern = re.compile(r"href=[\"']([^\"']+)[\"']", flags=re.IGNORECASE)
        for match in pattern.finditer(html):
            href = match.group(1).strip()
            if not href or href.startswith("#"):
                continue
            lowered = href.lower()
            if lowered.startswith("mailto:") or lowered.startswith("javascript:"):
                continue
            absolute = urljoin(base_url, href)
            if absolute.startswith("http://") or absolute.startswith("https://"):
                links.append(absolute)
        return links

    def _web_authoritative_followthrough(
        self,
        *,
        base_url: str,
        base_html: str,
        source_type: str,
        max_pages: int,
        max_candidates: int,
    ) -> list[tuple[str, str]]:
        if max_pages <= 0:
            return []
        if source_type not in {"api-doc", "product-doc", "academic-paper"}:
            return []
        candidate_urls = self._extract_html_links(base_html, base_url=base_url)
        ranked_urls = self._rank_web_followthrough_candidates(
            candidate_urls,
            base_url=base_url,
            source_type=source_type,
            max_candidates=max_candidates,
        )
        pages: list[tuple[str, str]] = []
        for candidate_url in ranked_urls:
            if len(pages) >= max_pages:
                break
            html = self._read_web_text(candidate_url)
            if not html:
                continue
            visible_text = extract_visible_text(html)
            if not visible_text:
                continue
            pages.append((candidate_url, visible_text[:5000]))
        return pages

    def _rank_web_followthrough_candidates(
        self,
        candidate_urls: list[str],
        *,
        base_url: str,
        source_type: str,
        max_candidates: int,
    ) -> list[str]:
        base_canonical = self._canonical_hit_url(base_url)
        base_host = urlparse(base_url).netloc.lower()
        ranked: list[tuple[int, str]] = []
        seen: set[str] = set()
        for candidate_url in candidate_urls:
            canonical = self._canonical_hit_url(candidate_url)
            if not canonical or canonical in seen or canonical == base_canonical:
                continue
            score = self._web_followthrough_candidate_score(
                canonical,
                base_host=base_host,
                source_type=source_type,
            )
            if score <= 0:
                continue
            ranked.append((score, canonical))
            seen.add(canonical)
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [url for _, url in ranked[:max_candidates]]

    def _web_followthrough_candidate_score(
        self,
        candidate_url: str,
        *,
        base_host: str,
        source_type: str,
    ) -> int:
        parsed = urlparse(candidate_url)
        host = parsed.netloc.lower()
        if host != base_host:
            return 0

        path = parsed.path.lower()
        combined = f"{host}{path}"
        score = 0

        if source_type == "api-doc":
            if "/api" in path or "reference" in combined:
                score += 5
            if "quickstart" in combined or "getting-started" in combined or "get-started" in combined:
                score += 4
            if "auth" in combined or "oauth" in combined or "token" in combined:
                score += 3
            if "docs" in combined or "guide" in combined or "tutorial" in combined:
                score += 2
        elif source_type == "product-doc":
            if "docs" in combined or "documentation" in combined:
                score += 4
            if "guide" in combined or "tutorial" in combined or "quickstart" in combined:
                score += 3
            if "/api" in path or "reference" in combined:
                score += 2
        elif source_type == "academic-paper":
            if path.endswith(".pdf") or "/pdf/" in path:
                return 0
            if any(marker in path for marker in ("/abs/", "/html/", "/forum", "/supplementary", "/appendix")):
                score += 5
            if any(marker in combined for marker in ("method", "evaluation", "results", "benchmark", "ablation")):
                score += 3
            if "arxiv.org" in host and path.startswith("/html/"):
                score += 3
            if "openreview.net" in host and "/forum" in path:
                score += 3

        if source_type != "academic-paper" and any(marker in combined for marker in ("/blog", "/forum", "/news", "/press")):
            score -= 2
        return max(score, 0)

    def _web_followthrough_fact_label(self, source_type: str) -> str:
        if source_type == "academic-paper":
            return "Academic authoritative follow-through"
        return "Web authoritative follow-through"

    def _web_followthrough_fact_note(self, source_type: str) -> str:
        if source_type == "academic-paper":
            return (
                "Same-host bounded abstract/html/supplementary follow-through enriched "
                "academic evidence before scoring."
            )
        return "Same-host bounded docs/reference/quickstart follow-through enriched web evidence before scoring."

    def _project_path_from_repo_url(self, url: str) -> str:
        parsed = urlparse(url)
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) < 2:
            return ""
        return "/".join(parts)

    def _owner_repo_from_url(self, url: str) -> tuple[str, str] | None:
        parsed = urlparse(url)
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) < 2:
            return None
        return parts[0], parts[1]

    def _extract_signal_line(self, text: str, keywords: list[str], fallback: str) -> str:
        best_segment = ""
        best_score = 0
        for segment in self._candidate_segments(text):
            normalized = segment.lower()
            score = sum(1 for keyword in keywords if keyword in normalized)
            if score > best_score:
                best_score = score
                best_segment = segment
        if best_segment:
            return best_segment
        return fallback

    def _candidate_segments(self, text: str) -> list[str]:
        normalized_text = text or ""
        line_candidates = [
            segment.strip("-#* \t")
            for segment in re.split(r"[\r\n]+", normalized_text)
            if segment.strip()
        ]
        line_candidates = [segment for segment in line_candidates if 30 <= len(segment) <= 260]
        if len(line_candidates) >= 2:
            return line_candidates

        sentence_candidates = [
            segment.strip("-#* \t")
            for segment in re.split(r"(?<=[.!?])\s+", normalized_text)
            if segment.strip()
        ]
        sentence_candidates = [segment for segment in sentence_candidates if 30 <= len(segment) <= 260]
        if sentence_candidates:
            return sentence_candidates
        return line_candidates

    def _web_keyword_profile(self, source_type: str) -> dict[str, list[str]]:
        if source_type == "academic-paper":
            return {
                "signal": ["method", "dataset", "evaluation", "results", "benchmark", "ablation"],
                "architecture": ["framework", "architecture", "method", "model", "system", "approach"],
                "workflow": ["pipeline", "procedure", "steps", "protocol", "experiment"],
                "integration": ["implementation", "api", "tooling", "repository", "dependency"],
            }
        if source_type == "api-doc":
            return {
                "signal": [
                    "api",
                    "endpoint",
                    "request",
                    "response",
                    "authentication",
                    "authorization",
                    "reference",
                ],
                "architecture": ["overview", "model", "design", "system", "component", "architecture"],
                "workflow": ["quickstart", "guide", "steps", "tutorial", "setup", "getting started"],
                "integration": [
                    "endpoint",
                    "api",
                    "oauth",
                    "token",
                    "bearer",
                    "post /",
                    "get /",
                    "curl",
                    "webhook",
                ],
            }
        if source_type == "blog-post":
            return {
                "signal": ["analysis", "design", "approach", "architecture", "lesson", "tradeoff"],
                "architecture": ["architecture", "design", "boundary", "system", "component"],
                "workflow": ["workflow", "process", "steps", "iteration", "pipeline"],
                "integration": ["integration", "provider", "api", "adapter", "tooling"],
            }
        if source_type == "forum-thread":
            return {
                "signal": ["discussion", "experience", "tradeoff", "issue", "problem", "solution"],
                "architecture": ["architecture", "design", "system", "pattern", "boundary"],
                "workflow": ["we use", "we run", "three-step", "steps", "process", "pipeline"],
                "integration": ["integration", "api", "provider", "tool", "compatibility", "error"],
            }
        if source_type == "news-article":
            return {
                "signal": ["announced", "launched", "released", "report", "analysis", "update"],
                "architecture": ["architecture", "design", "system", "platform"],
                "workflow": ["workflow", "process", "pipeline"],
                "integration": ["integration", "api", "platform", "provider"],
            }
        return {
            "signal": ["architecture", "workflow", "integration", "research", "system", "pipeline"],
            "architecture": ["architecture", "design", "component", "system"],
            "workflow": ["workflow", "pipeline", "process", "steps", "research"],
            "integration": ["api", "integration", "provider", "endpoint", "tool"],
        }

    def _web_extraction_profile_name(self, source_type: str) -> str:
        if source_type == "academic-paper":
            return "academic-paper-shaping"
        if source_type == "api-doc":
            return "api-doc-shaping"
        if source_type == "blog-post":
            return "blog-shaping"
        if source_type == "forum-thread":
            return "forum-shaping"
        if source_type == "news-article":
            return "news-shaping"
        return "generic-doc-shaping"

    def _web_confidence_by_source_type(
        self,
        source_type: str,
    ) -> tuple[str, str, str, str]:
        if source_type == "academic-paper":
            return "high", "high", "medium", "low"
        if source_type == "api-doc":
            return "high", "medium", "medium", "high"
        if source_type == "product-doc":
            return "medium", "medium", "medium", "medium"
        if source_type == "blog-post":
            return "medium", "medium", "medium", "low"
        if source_type == "news-article":
            return "medium", "low", "low", "low"
        if source_type == "forum-thread":
            return "low", "low", "low", "low"
        return "medium", "medium", "medium", "medium"

    def _classify_web_source_type(self, url: str, title: str, summary: str) -> str:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        path = parsed.path.lower()
        combined = f"{host} {path} {title.lower()} {summary.lower()}"

        if any(
            academic_host in host
            for academic_host in (
                "arxiv.org",
                "openreview.net",
                "aclanthology.org",
                "semanticscholar.org",
                "doi.org",
                "paperswithcode.com",
            )
        ) or any(
            marker in combined
            for marker in (
                "preprint",
                "arxiv",
                "openreview",
                "doi",
                "proceedings",
                "abstract",
                "peer review",
                "conference",
            )
        ):
            return "academic-paper"

        if any(
            forum_host in host
            for forum_host in ("reddit.com", "news.ycombinator.com", "stackoverflow.com", "discuss.")
        ) or any(marker in combined for marker in ("/forum", "/discuss", "/thread", "/question")):
            return "forum-thread"
        if any(news_host in host for news_host in ("techcrunch.com", "venturebeat.com", "theverge.com")):
            return "news-article"
        if host.startswith("blog.") or any(marker in combined for marker in ("/blog", "medium.com", "dev.to")):
            return "blog-post"
        if any(
            marker in combined
            for marker in ("/api", "/reference", "/sdk", "openapi", "swagger", "endpoint")
        ):
            return "api-doc"
        if any(marker in combined for marker in ("/docs", "/documentation", "readthedocs", "doc site")):
            return "product-doc"
        return "product-doc"

    def _candidate_id_from_repo_url(self, repo_url: str) -> str:
        for entry in REFERENCE_CATALOG:
            if entry.repository_url.lower().rstrip("/") == repo_url.lower().rstrip("/"):
                return entry.candidate_id
        parsed = urlparse(repo_url)
        slug = parsed.path.strip("/").replace("/", "-")
        return f"repo-{self._slug(slug)}"

    def _candidate_id_from_url(self, url: str) -> str:
        parsed = urlparse(url)
        host = parsed.netloc.replace(".", "-")
        path = [segment for segment in parsed.path.strip("/").split("/") if segment]
        tail = "-".join(path[:3]) if path else "root"
        return f"web-{self._slug(f'{host}-{tail}')}"

    def _matched_terms(self, query: str, text: str) -> list[str]:
        query_terms = set(re.findall(r"[a-z0-9]+", query.lower()))
        text_terms = set(re.findall(r"[a-z0-9]+", text.lower()))
        return sorted(term for term in (query_terms & text_terms) if len(term) >= 4)[:6]

    def _slug(self, value: str) -> str:
        return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")

    def _live_auth_notes(self) -> list[str]:
        notes: list[str] = []
        if self._github_token():
            notes.append("GitHub API token detected for authenticated GitHub requests.")
        if self._gitlab_token():
            notes.append("GitLab token detected for authenticated GitLab requests.")
        if self._tavily_api_key():
            notes.append("Tavily API key detected for bounded live web discovery.")
        if self._exa_api_key():
            notes.append("Exa API key detected for bounded live discovery search.")
        if self._firecrawl_api_key():
            notes.append("Firecrawl API key detected for bounded live search and scrape.")
        return notes

    def _auth_headers_for_url(self, url: str, github: bool) -> dict[str, str]:
        headers: dict[str, str] = {}
        if github:
            github_token = self._github_token()
            if github_token:
                headers["Authorization"] = f"Bearer {github_token}"
            return headers
        host = urlparse(url).netloc.lower()
        if "gitlab.com" in host:
            gitlab_token = self._gitlab_token()
            if gitlab_token:
                headers["PRIVATE-TOKEN"] = gitlab_token
        if "api.tavily.com" in host:
            tavily_api_key = self._tavily_api_key()
            if tavily_api_key:
                headers["Authorization"] = f"Bearer {tavily_api_key}"
        if "api.exa.ai" in host:
            exa_api_key = self._exa_api_key()
            if exa_api_key:
                headers["x-api-key"] = exa_api_key
        if "api.firecrawl.dev" in host:
            firecrawl_api_key = self._firecrawl_api_key()
            if firecrawl_api_key:
                headers["Authorization"] = f"Bearer {firecrawl_api_key}"
        return headers

    def _github_token(self) -> str:
        return (os.getenv("RESEARCH_ENGINE_GITHUB_TOKEN") or os.getenv("GITHUB_TOKEN") or "").strip()

    def _gitlab_token(self) -> str:
        return (os.getenv("RESEARCH_ENGINE_GITLAB_TOKEN") or os.getenv("GITLAB_TOKEN") or "").strip()

    def _tavily_api_key(self) -> str:
        return (os.getenv("RESEARCH_ENGINE_TAVILY_API_KEY") or os.getenv("TAVILY_API_KEY") or "").strip()

    def _exa_api_key(self) -> str:
        return (os.getenv("RESEARCH_ENGINE_EXA_API_KEY") or os.getenv("EXA_API_KEY") or "").strip()

    def _firecrawl_api_key(self) -> str:
        return (os.getenv("RESEARCH_ENGINE_FIRECRAWL_API_KEY") or os.getenv("FIRECRAWL_API_KEY") or "").strip()


class ApiProviderAcquisitionProvider(LiveHybridAcquisitionProvider):
    mode = "api-provider"

    def __init__(self) -> None:
        super().__init__(
            aggregate_provider_name="api-provider",
            fallback_to_catalog=False,
            mode_note="API-provider acquisition enabled (strict live GitHub + GitLab + web, no catalog fallback).",
        )


def get_acquisition_provider(mode: str) -> AcquisitionProvider:
    normalized = mode.strip().lower()
    if normalized == "catalog":
        return CatalogAcquisitionProvider()
    if normalized == "codex-session":
        return CodexSessionAcquisitionProvider()
    if normalized == "local-first":
        return LocalFirstAcquisitionProvider()
    if normalized == "live-hybrid":
        return LiveHybridAcquisitionProvider()
    if normalized == "api-provider":
        return ApiProviderAcquisitionProvider()
    raise ValueError(f"Unsupported acquisition mode: {mode}")
