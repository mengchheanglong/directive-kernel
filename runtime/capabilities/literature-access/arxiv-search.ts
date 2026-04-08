/**
 * Directive-owned arXiv search tool.
 *
 * Adapted from Scientify arxiv-search.ts under the bounded
 * Scientify literature-access tool bundle Runtime proof.
 *
 * Behavior-preserving claims honored:
 * - Same arXiv API query construction
 * - Same Atom XML parsing
 * - Same paper object shape
 * - Same abstract truncation at 300 chars
 * - Same sort fallback to "relevance"
 */

const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 50;
const ABSTRACT_MAX_CHARS = 300;

// --- Input / Output types ---

export interface ArxivSearchInput {
  query: string;
  max_results?: number;
  sort_by?: string;
  date_from?: string;
}

export interface ArxivPaperResult {
  title: string;
  authors: string[];
  abstract: string;
  arxiv_id: string;
  pdf_url: string;
  published: string;
  categories: string[];
}

export type ArxivSearchResult =
  | { ok: true; query: string; total: number; papers: ArxivPaperResult[] }
  | { ok: false; error: string; message: string };

// --- Internal types ---

interface ParsedPaper {
  title: string;
  authors: string[];
  abstract: string;
  arxivId: string;
  pdfUrl: string;
  published: string;
  updated: string;
  categories: string[];
}

// --- Sort mapping ---

const SORT_MAP: Record<string, string> = {
  relevance: "relevance",
  lastupdateddate: "lastUpdatedDate",
  submitteddate: "submittedDate",
};

// --- URL construction ---

function buildSearchUrl(
  query: string,
  maxResults: number,
  sortBy: string,
  dateFrom?: string,
): string {
  let searchQuery = query;
  if (dateFrom) {
    const dateFormatted = dateFrom.replace(/-/g, "");
    searchQuery = `${query} AND submittedDate:[${dateFormatted}0000 TO 99991231]`;
  }
  const params = new URLSearchParams({
    search_query: searchQuery,
    start: "0",
    max_results: String(maxResults),
    sortBy,
    sortOrder: "descending",
  });
  return `${ARXIV_API_URL}?${params.toString()}`;
}

// --- Atom XML parsing ---

function parseAtomXml(xml: string): ParsedPaper[] {
  const papers: ParsedPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const getTag = (tag: string) => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : "";
    };

    const title = getTag("title").replace(/\s+/g, " ");
    const abstract = getTag("summary").replace(/\s+/g, " ");
    const published = getTag("published");
    const updated = getTag("updated");

    const idUrl = getTag("id");
    const arxivId = idUrl
      .replace("http://arxiv.org/abs/", "")
      .replace(/v\d+$/, "");

    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>([^<]+)<\/name>/g;
    let authorMatch: RegExpExecArray | null;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    const pdfMatch = entry.match(
      /<link[^>]+title="pdf"[^>]+href="([^"]+)"/,
    );
    const pdfUrl = pdfMatch
      ? pdfMatch[1]
      : `https://arxiv.org/pdf/${arxivId}`;

    const categories: string[] = [];
    const catRegex = /<category[^>]+term="([^"]+)"/g;
    let catMatch: RegExpExecArray | null;
    while ((catMatch = catRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    if (title && arxivId) {
      papers.push({
        title,
        authors,
        abstract,
        arxivId,
        pdfUrl,
        published,
        updated,
        categories,
      });
    }
  }
  return papers;
}

// --- Public API ---

export async function arxivSearch(
  input: ArxivSearchInput,
): Promise<ArxivSearchResult> {
  const { query, date_from } = input;
  const maxResults = Math.min(
    input.max_results ?? DEFAULT_MAX_RESULTS,
    MAX_RESULTS_LIMIT,
  );
  const rawSort = input.sort_by ?? "relevance";
  const sortBy = SORT_MAP[rawSort.toLowerCase()] ?? "relevance";

  const url = buildSearchUrl(query, maxResults, sortBy, date_from);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return {
      ok: false,
      error: "network_error",
      message: `Failed to reach arXiv API: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "api_error",
      message: `arXiv API returned ${response.status}: ${response.statusText}`,
    };
  }

  const xml = await response.text();
  const papers = parseAtomXml(xml);

  return {
    ok: true,
    query,
    total: papers.length,
    papers: papers.map((p) => ({
      title: p.title,
      authors: p.authors,
      abstract:
        p.abstract.length > ABSTRACT_MAX_CHARS
          ? p.abstract.slice(0, ABSTRACT_MAX_CHARS) + "\u2026"
          : p.abstract,
      arxiv_id: p.arxivId,
      pdf_url: p.pdfUrl,
      published: p.published,
      categories: p.categories,
    })),
  };
}
