import type { ArxivDownloadInput, ArxivDownloadResult } from "./arxiv-download.ts";
import { arxivDownload } from "./arxiv-download.ts";
import type { ArxivSearchInput, ArxivSearchResult } from "./arxiv-search.ts";
import { arxivSearch } from "./arxiv-search.ts";
import type { OpenAlexSearchInput, OpenAlexSearchResult } from "./openalex-search.ts";
import { openalexSearch } from "./openalex-search.ts";
import type {
  UnpaywallDownloadInput,
  UnpaywallDownloadResult,
} from "./unpaywall-download.ts";
import { unpaywallDownload } from "./unpaywall-download.ts";

export type ScientifyLiteratureAccessToolName =
  | "arxiv-search"
  | "arxiv-download"
  | "openalex-search"
  | "unpaywall-download";

export type LiteratureAccessExecutionOptions = {
  allowExternalFetches?: boolean;
};

export type DirectiveRuntimeCallableBundleTool = {
  tool: ScientifyLiteratureAccessToolName;
  functionName: string;
  modulePath: string;
  inputType: string;
  resultType: string;
  invoke: (
    input: unknown,
    options?: LiteratureAccessExecutionOptions,
  ) => Promise<unknown>;
};

type ScientifyBundleToolRecord = Record<
  ScientifyLiteratureAccessToolName,
  DirectiveRuntimeCallableBundleTool
>;

const SCIENTIFY_LITERATURE_ACCESS_TOOL_RECORD: ScientifyBundleToolRecord = {
  "arxiv-search": {
    tool: "arxiv-search",
    functionName: "arxivSearch",
    modulePath: "runtime/capabilities/literature-access/arxiv-search.ts",
    inputType: "ArxivSearchInput",
    resultType: "Promise<ArxivSearchResult>",
    invoke: (input, options) => arxivSearch(input as ArxivSearchInput, options),
  },
  "arxiv-download": {
    tool: "arxiv-download",
    functionName: "arxivDownload",
    modulePath: "runtime/capabilities/literature-access/arxiv-download.ts",
    inputType: "ArxivDownloadInput",
    resultType: "Promise<ArxivDownloadResult>",
    invoke: (input, options) => arxivDownload(input as ArxivDownloadInput, options),
  },
  "openalex-search": {
    tool: "openalex-search",
    functionName: "openalexSearch",
    modulePath: "runtime/capabilities/literature-access/openalex-search.ts",
    inputType: "OpenAlexSearchInput",
    resultType: "Promise<OpenAlexSearchResult>",
    invoke: (input, options) => openalexSearch(input as OpenAlexSearchInput, options),
  },
  "unpaywall-download": {
    tool: "unpaywall-download",
    functionName: "unpaywallDownload",
    modulePath: "runtime/capabilities/literature-access/unpaywall-download.ts",
    inputType: "UnpaywallDownloadInput",
    resultType: "Promise<UnpaywallDownloadResult>",
    invoke: (input, options) =>
      unpaywallDownload(input as UnpaywallDownloadInput, options),
  },
};

export const DIRECTIVE_RUNTIME_SCIENTIFY_LITERATURE_ACCESS_BUNDLE = {
  bundleId: "dw-source-scientify-research-workflow-plugin-2026-03-27",
  bundleTitle: "Scientify Literature-Access Tool Bundle",
  capabilityForm: "runtime_owned_callable_bundle",
  runtimeBoundary:
    "Directive-owned callable literature-access bundle that remains non-promoted and host-unintegrated until a later explicit Runtime decision.",
  tools: Object.values(SCIENTIFY_LITERATURE_ACCESS_TOOL_RECORD).map((tool) => ({
    tool: tool.tool,
    functionName: tool.functionName,
    modulePath: tool.modulePath,
    inputType: tool.inputType,
    resultType: tool.resultType,
  })),
} as const;

export function listDirectiveRuntimeScientifyLiteratureAccessTools() {
  return Object.values(SCIENTIFY_LITERATURE_ACCESS_TOOL_RECORD);
}

export function getDirectiveRuntimeScientifyLiteratureAccessTool(
  tool: ScientifyLiteratureAccessToolName,
) {
  return SCIENTIFY_LITERATURE_ACCESS_TOOL_RECORD[tool];
}
