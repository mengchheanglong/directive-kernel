from __future__ import annotations

import json
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html import unescape
import re
from typing import Any

DATE_META_KEYS = (
    "article:modified_time",
    "article:published_time",
    "og:updated_time",
    "last-modified",
    "dateModified",
    "datePublished",
    "modified",
    "published",
)
DATE_PUBLISHED_META_KEYS = (
    "article:published_time",
    "datePublished",
    "published",
    "published_time",
    "pubdate",
)
DATE_MODIFIED_META_KEYS = (
    "article:modified_time",
    "og:updated_time",
    "dateModified",
    "last-modified",
    "modified",
)
AUTHOR_META_KEYS = (
    "author",
    "article:author",
    "parsely-author",
)
SITE_META_KEYS = (
    "og:site_name",
    "application-name",
    "twitter:site",
)
DESCRIPTION_META_KEYS = (
    "description",
    "og:description",
    "twitter:description",
)


def extract_title_from_html(html: str) -> str:
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL)
    if not title_match:
        return ""
    return _normalize_whitespace(unescape(title_match.group(1)))


def extract_visible_text(html: str) -> str:
    # Adapted from GPT Researcher's BeautifulSoup cleaning approach:
    # gpt_researcher/scraper/utils.py clean_soup + get_text_from_soup.
    try:
        from bs4 import BeautifulSoup  # type: ignore
    except Exception:
        return _fallback_text_extract(html)
    try:
        soup = BeautifulSoup(html, "html.parser")
        soup = _clean_soup(soup)
        text = soup.get_text(strip=True, separator="\n")
        text = re.sub(r"\s{2,}", " ", text)
        return _normalize_whitespace(text)
    except Exception:
        return _fallback_text_extract(html)


def extract_source_updated_at_from_html(html: str) -> str:
    candidates: list[datetime] = []
    for key in DATE_META_KEYS:
        for value in _meta_content_values(html, key):
            parsed = _parse_datetime_candidate(value)
            if parsed is not None:
                candidates.append(parsed)

    for match in re.finditer(r"""<time[^>]+datetime=["']([^"']+)["'][^>]*>""", html, flags=re.IGNORECASE):
        parsed = _parse_datetime_candidate(match.group(1))
        if parsed is not None:
            candidates.append(parsed)

    for node in _json_ld_nodes(html):
        for field in ("dateModified", "datePublished", "dateCreated"):
            candidate = _node_value_text(node.get(field))
            if not candidate:
                continue
            parsed = _parse_datetime_candidate(candidate)
            if parsed is not None:
                candidates.append(parsed)

    if not candidates:
        return ""
    return max(candidates).isoformat()


def extract_source_profile_from_html(html: str) -> dict[str, str]:
    profile: dict[str, str] = {}
    nodes = _json_ld_nodes(html)

    author = _first_non_empty(
        _first_meta_match(html, AUTHOR_META_KEYS),
        _json_ld_author(nodes),
    )
    if author:
        profile["author"] = author

    site_name = _first_non_empty(
        _first_meta_match(html, SITE_META_KEYS),
        _json_ld_publisher(nodes),
    )
    if site_name:
        profile["site_name"] = site_name

    description = _first_non_empty(
        _first_meta_match(html, DESCRIPTION_META_KEYS),
        _json_ld_description(nodes),
    )
    if description:
        profile["description"] = description

    schema_type = _json_ld_schema_type(nodes)
    if schema_type:
        profile["schema_type"] = schema_type

    published_candidates = [
        _parse_datetime_candidate(value)
        for value in _meta_matches(html, DATE_PUBLISHED_META_KEYS)
    ]
    published_candidates.extend(
        _parse_datetime_candidate(_node_value_text(node.get("datePublished")))
        for node in nodes
    )
    published_dates = [item for item in published_candidates if item is not None]
    if published_dates:
        profile["published_at"] = min(published_dates).isoformat()

    modified_candidates = [
        _parse_datetime_candidate(value)
        for value in _meta_matches(html, DATE_MODIFIED_META_KEYS)
    ]
    modified_candidates.extend(
        _parse_datetime_candidate(_node_value_text(node.get("dateModified")))
        for node in nodes
    )
    modified_dates = [item for item in modified_candidates if item is not None]
    if modified_dates:
        profile["modified_at"] = max(modified_dates).isoformat()

    return profile


def _clean_soup(soup: Any) -> Any:
    for tag in soup.find_all(
        ["script", "style", "footer", "header", "nav", "menu", "sidebar", "svg"]
    ):
        tag.decompose()

    disallowed_class_set = {"nav", "menu", "sidebar", "footer"}

    def has_disallowed_class(elem: Any) -> bool:
        classes = elem.get("class", []) if hasattr(elem, "get") else []
        return any(cls in disallowed_class_set for cls in classes)

    for tag in soup.find_all(has_disallowed_class):
        tag.decompose()
    return soup


def _fallback_text_extract(html: str) -> str:
    body = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    body = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", body)
    body = re.sub(r"(?s)<[^>]+>", " ", body)
    body = unescape(body)
    return _normalize_whitespace(body)


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _first_non_empty(*values: str) -> str:
    for value in values:
        normalized = _normalize_whitespace(value)
        if normalized:
            return normalized
    return ""


def _meta_content_values(html: str, key: str) -> list[str]:
    pattern = re.compile(
        rf"""<meta[^>]*?(?=[^>]*?(?:name|property|itemprop|http-equiv)=["']{re.escape(key)}["'])(?=[^>]*?content=["']([^"']+)["'])[^>]*>""",
        flags=re.IGNORECASE,
    )
    return [
        _normalize_whitespace(unescape(match.group(1)))
        for match in pattern.finditer(html)
        if _normalize_whitespace(unescape(match.group(1)))
    ]


def _meta_matches(html: str, keys: tuple[str, ...]) -> list[str]:
    values: list[str] = []
    for key in keys:
        values.extend(_meta_content_values(html, key))
    return values


def _first_meta_match(html: str, keys: tuple[str, ...]) -> str:
    for key in keys:
        values = _meta_content_values(html, key)
        if values:
            return values[0]
    return ""


def _json_ld_nodes(html: str) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    pattern = re.compile(
        r"""<script[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>""",
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(html):
        payload = unescape(match.group(1)).strip()
        if not payload:
            continue
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            continue
        nodes.extend(_flatten_json_ld(parsed))
    return nodes


def _flatten_json_ld(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        nodes: list[dict[str, Any]] = []
        for item in payload:
            nodes.extend(_flatten_json_ld(item))
        return nodes
    if isinstance(payload, dict):
        nodes = [payload]
        graph = payload.get("@graph")
        if isinstance(graph, list):
            for node in graph:
                if isinstance(node, dict):
                    nodes.extend(_flatten_json_ld(node))
        return nodes
    return []


def _node_value_text(value: Any) -> str:
    if isinstance(value, str):
        return _normalize_whitespace(value)
    if isinstance(value, dict):
        return _node_value_text(value.get("name") or value.get("@id") or "")
    if isinstance(value, list):
        for item in value:
            text = _node_value_text(item)
            if text:
                return text
    return ""


def _json_ld_author(nodes: list[dict[str, Any]]) -> str:
    for node in nodes:
        author = _node_value_text(node.get("author"))
        if author:
            return author
    return ""


def _json_ld_publisher(nodes: list[dict[str, Any]]) -> str:
    for node in nodes:
        publisher = _node_value_text(node.get("publisher"))
        if publisher:
            return publisher
    return ""


def _json_ld_description(nodes: list[dict[str, Any]]) -> str:
    for node in nodes:
        description = _node_value_text(node.get("description") or node.get("headline"))
        if description:
            return description
    return ""


def _json_ld_schema_type(nodes: list[dict[str, Any]]) -> str:
    types: list[str] = []
    for node in nodes:
        raw_type = node.get("@type")
        if isinstance(raw_type, str):
            normalized = _normalize_whitespace(raw_type)
            if normalized and normalized not in types:
                types.append(normalized)
        elif isinstance(raw_type, list):
            for item in raw_type:
                if not isinstance(item, str):
                    continue
                normalized = _normalize_whitespace(item)
                if normalized and normalized not in types:
                    types.append(normalized)
    return ", ".join(types[:3])


def _parse_datetime_candidate(raw: str) -> datetime | None:
    value = _normalize_whitespace(unescape(raw)).strip().rstrip(".,);]")
    if not value:
        return None
    for candidate in (value, value.replace("Z", "+00:00")):
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=UTC)
            return parsed.astimezone(UTC).replace(microsecond=0)
        except ValueError:
            continue
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).replace(microsecond=0)
