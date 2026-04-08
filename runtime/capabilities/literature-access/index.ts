/**
 * Directive-owned literature-access tool bundle.
 *
 * Adapted from Scientify Research Workflow Plugin under the bounded
 * Runtime proof for candidate dw-source-scientify-research-workflow-plugin-2026-03-27.
 *
 * This bundle contains exactly 4 tools:
 * - arxivSearch: Search arXiv papers by query
 * - arxivDownload: Download arXiv papers (tex source with PDF fallback)
 * - openalexSearch: Search academic works across all disciplines via OpenAlex
 * - unpaywallDownload: Download open-access PDFs via Unpaywall
 *
 * Excluded from this bundle:
 * - Scientify orchestrator, skills, hooks, metabolism, knowledge-state system
 * - github-search, paper-browser, openreview-lookup tools
 * - OpenClaw plugin registration infrastructure
 */

export { arxivSearch } from "./arxiv-search.ts";
export type {
  ArxivSearchInput,
  ArxivSearchResult,
  ArxivPaperResult,
} from "./arxiv-search.ts";

export { arxivDownload } from "./arxiv-download.ts";
export type {
  ArxivDownloadInput,
  ArxivDownloadResult,
  ArxivDownloadItemResult,
} from "./arxiv-download.ts";

export { openalexSearch } from "./openalex-search.ts";
export type {
  OpenAlexSearchInput,
  OpenAlexSearchResult,
  OpenAlexWorkResult,
} from "./openalex-search.ts";

export { unpaywallDownload } from "./unpaywall-download.ts";
export type {
  UnpaywallDownloadInput,
  UnpaywallDownloadResult,
  UnpaywallDownloadItemResult,
} from "./unpaywall-download.ts";

export {
  DIRECTIVE_RUNTIME_SCIENTIFY_LITERATURE_ACCESS_BUNDLE,
  getDirectiveRuntimeScientifyLiteratureAccessTool,
  listDirectiveRuntimeScientifyLiteratureAccessTools,
} from "./bundle.ts";
export type {
  DirectiveRuntimeCallableBundleTool,
  ScientifyLiteratureAccessToolName,
} from "./bundle.ts";

export {
  executeLiteratureAccessTool,
  disableLiteratureAccessCapability,
  enableLiteratureAccessCapability,
  isLiteratureAccessCapabilityEnabled,
  listCallableTools,
  createLiteratureAccessCallableCapability,
  LITERATURE_ACCESS_CALLABLE_CAPABILITY,
} from "./executor.ts";
export type {
  CallableExecutionInput,
  CallableExecutionResult,
} from "./executor.ts";
