from __future__ import annotations

from research_engine.catalog import get_catalog_entry
from research_engine.models import DiscoveryHit, SourceDocument, SourceFact, utc_now_iso


def fetch_documents(hits: list[DiscoveryHit]) -> list[SourceDocument]:
    documents: list[SourceDocument] = []
    for hit in hits:
        entry = get_catalog_entry(hit.candidate_id)
        facts = [
            SourceFact(
                fact_type=fact.fact_type,
                confidence=fact.confidence,
                excerpt=fact.excerpt,
                notes=fact.notes,
            )
            for fact in entry.facts
        ]
        metadata_segments: list[str] = []
        if entry.repository_stars is not None:
            metadata_segments.append(f"stars={entry.repository_stars}")
        if entry.repository_forks is not None:
            metadata_segments.append(f"forks={entry.repository_forks}")
        if entry.repository_open_issues is not None:
            metadata_segments.append(f"open_issues={entry.repository_open_issues}")
        if entry.repository_last_pushed_at:
            metadata_segments.append(f"last_push={entry.repository_last_pushed_at}")
        if entry.latest_release_published_at:
            metadata_segments.append(
                f"latest_release_published_at={entry.latest_release_published_at}"
            )
        if entry.releases_last_180d is not None:
            metadata_segments.append(f"releases_last_180d={entry.releases_last_180d}")
        if metadata_segments:
            facts.append(
                SourceFact(
                    fact_type="maintenance",
                    confidence="high",
                    excerpt=f"Catalog repo metadata: {', '.join(metadata_segments)}.",
                    notes=[
                        "Deterministic catalog metadata fixture for freshness and maintenance scoring."
                    ],
                )
            )
        documents.append(
            SourceDocument(
                candidate_id=entry.candidate_id,
                source_url=entry.repository_url,
                source_type="github-repo",
                title=entry.name,
                summary=entry.summary,
                provider=hit.provider,
                track_id=hit.track_id,
                fetched_at=utc_now_iso(),
                facts=facts,
            )
        )
    return documents
