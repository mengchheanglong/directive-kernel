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

export type DirectiveRuntimeCallableBundleTool = {
  tool: ScientifyLiteratureAccessToolName;
  functionName: string;
  modulePath: string;
  inputType: string;
  resultType: string;
  invoke: (input: unknown) => Promise<unknown>;
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
    invoke: (input) => arxivSearch(input as ArxivSearchInput),
  },
  "arxiv-download": {
    tool: "arxiv-download",
    functionName: "arxivDownload",
    modulePath: "runtime/capabilities/literature-access/arxiv-download.ts",
    inputType: "ArxivDownloadInput",
    resultType: "Promise<ArxivDownloadResult>",
    invoke: (input) => arxivDownload(input as ArxivDownloadInput),
  },
  "openalex-search": {
    tool: "openalex-search",
    functionName: "openalexSearch",
    modulePath: "runtime/capabilities/literature-access/openalex-search.ts",
    inputType: "OpenAlexSearchInput",
    resultType: "Promise<OpenAlexSearchResult>",
    invoke: (input) => openalexSearch(input as OpenAlexSearchInput),
  },
  "unpaywall-download": {
    tool: "unpaywall-download",
    functionName: "unpaywallDownload",
    modulePath: "runtime/capabilities/literature-access/unpaywall-download.ts",
    inputType: "UnpaywallDownloadInput",
    resultType: "Promise<UnpaywallDownloadResult>",
    invoke: (input) => unpaywallDownload(input as UnpaywallDownloadInput),
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
