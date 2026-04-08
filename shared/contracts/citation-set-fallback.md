# Citation Set Fallback Contract

Date: 2026-03-20
Track: Directive Architecture

## Purpose

Define deterministic handling for `CitationSetArtifact` when source outputs are noisy or incomplete.

## Contract Rules

1. Citation URLs must be valid `http/https` URLs.
2. URL deduplication is required (case-insensitive URL identity).
3. If explicit citations are missing or invalid, allow fallback synthesis from normalized `visited_urls`.
4. Fallback synthesis must set `coverage_status` to `partial`, not `complete`.
5. If neither explicit citations nor valid fallback URLs exist, set `coverage_status` to `missing`.
6. Reference markdown should be generated from the same normalized URL set used by citations to prevent drift.

## Allowed Fallback

- structured-output parsing fallback (handled upstream)
- citation URL filtering + dedupe
- fallback synthesis from `visited_urls`

## Disallowed Behavior

- accepting non-URL citation values as valid citations
- silent duplicate citation expansion
- marking synthesized-only citation sets as `complete`

## Validation Hook

- `npm run check:directive-citation-contracts`
