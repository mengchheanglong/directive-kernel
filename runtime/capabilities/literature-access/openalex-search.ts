/**
 * Directive-owned OpenAlex search tool.
 *
 * Adapted from Scientify openalex-search.ts under the bounded
 * Scientify literature-access tool bundle Runtime proof.
 *
 * Behavior-preserving claims honored:
 * - Same OpenAlex API query construction
 * - Same polite-pool email registration
 * - Same abstract reconstruction from inverted index
 * - Same 429 rate-limit handling
 * - Same sort fallback to relevance_score
 */

const OPENALEX_API = "https://api.openalex.org/works";
const DEFAULT_MAX_RESULTS = 15;
const MAX_RESULTS_LIMIT = 50;
const ABSTRACT_MAX_CHARS = 500;
const POLITE_POOL_EMAIL = "research@openclaw.ai";
const USER_AGENT = `directive-workspace/1.0 (mailto:${POLITE_POOL_EMAIL})`;

// --- Input / Output types ---

export interface OpenAlexSearchInput {
  query: string;
  max_results?: number;
  filter?: string;
  sort?: string;
}

export interface OpenAlexWorkResult {
  id: string;
  title: string;
  doi: string | null;
  year: number | null;
  date: string | null;
  type: string;
  authors: string[];
  venue: string;
  cited_by: number;
  is_open_access: boolean;
  oa_url: string | null;
  abstract_preview: string;
}

export type OpenAlexSearchResult =
  | {
      ok: true;
      query: string;
      total_count: number;
      returned: number;
      works: OpenAlexWorkResult[];
    }
  | { ok: false; error: string; message: string };

// --- Internal types ---

interface OpenAlexApiWork {
  id: string;
  doi: string | null;
  title: string;
  publication_year: number | null;
  publication_date: string | null;
  type: string;
  cited_by_count: number;
  authorships: Array<{ author: { display_name: string } }>;
  primary_location: {
    source: { display_name: string | null } | null;
  } | null;
  abstract_inverted_index: Record<string, number[]> | null;
  open_access: { is_oa: boolean; oa_url: string | null };
}

// --- Abstract reconstruction ---

function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null,
): string {
  if (!invertedIndex) return "";

  const words: Array<[string, number]> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }

  words.sort((a, b) => a[1] - b[1]);
  return words
    .map(([word]) => word)
    .join(" ")
    .substring(0, ABSTRACT_MAX_CHARS);
}

// --- Sort mapping ---

const SORT_MAP: Record<string, string> = {
  cited_by_count: "cited_by_count:desc",
  publication_date: "publication_date:desc",
  relevance_score: "relevance_score:desc",
};

// --- Public API ---

export async function openalexSearch(
  input: OpenAlexSearchInput,
): Promise<OpenAlexSearchResult> {
  const { query, filter } = input;
  const maxResults = Math.min(
    input.max_results ?? DEFAULT_MAX_RESULTS,
    MAX_RESULTS_LIMIT,
  );
  const sortStr = input.sort ?? "relevance_score";

  const urlParams = new URLSearchParams({
    search: query,
    per_page: String(maxResults),
    mailto: POLITE_POOL_EMAIL,
  });

  if (filter) {
    urlParams.set("filter", filter);
  }

  urlParams.set("sort", SORT_MAP[sortStr] || SORT_MAP.relevance_score);

  const url = `${OPENALEX_API}?${urlParams.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (error) {
    return {
      ok: false,
      error: "network_error",
      message: `Failed to reach OpenAlex API: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      error: "rate_limited",
      message:
        "OpenAlex API rate limit exceeded. Please wait a moment and retry.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "api_error",
      message: `OpenAlex API returned ${response.status}: ${response.statusText}`,
    };
  }

  const data = (await response.json()) as {
    results?: OpenAlexApiWork[];
    meta?: { count: number };
  };

  const works: OpenAlexWorkResult[] = (data.results ?? []).map((work) => ({
    id: work.id.replace("https://openalex.org/", ""),
    title: work.title || "Untitled",
    doi: work.doi?.replace("https://doi.org/", "") || null,
    year: work.publication_year,
    date: work.publication_date,
    type: work.type,
    authors: work.authorships
      .slice(0, 5)
      .map((a) => a.author.display_name),
    venue: work.primary_location?.source?.display_name || "Unknown",
    cited_by: work.cited_by_count,
    is_open_access: work.open_access.is_oa,
    oa_url: work.open_access.oa_url,
    abstract_preview: reconstructAbstract(work.abstract_inverted_index),
  }));

  return {
    ok: true,
    query,
    total_count: data.meta?.count ?? 0,
    returned: works.length,
    works,
  };
}
