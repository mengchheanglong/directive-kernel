import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";

import type { DiscoveryHostStorageBridge } from "../../integration-kit/lib/discovery-submission-adapter.ts";
import type {
  StandaloneLiveMiniSweCallableBoundaryDescriptor,
  StandaloneScientifyToolDescriptor,
} from "./types.ts";

export const SCIENTIFY_PROMOTION_READINESS_RELATIVE_PATH =
  "runtime/05-promotion-readiness/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-promotion-readiness.md";
export const SCIENTIFY_PRE_PROMOTION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-standalone-host-pre-promotion-implementation-slice-01.md";
export const SCIENTIFY_IMPLEMENTATION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-03-27-dw-source-scientify-research-workflow-plugin-2026-03-27-standalone-host-runtime-implementation-slice-01.md";
export const STANDALONE_HOST_TARGET =
  "Directive Kernel standalone host (hosts/standalone-host/)";
export const SCIENTIFY_DESCRIPTOR_TOOLS: StandaloneScientifyToolDescriptor[] = [
  {
    tool: "arxiv-search",
    functionName: "arxivSearch",
    modulePath: "runtime/capabilities/literature-access/arxiv-search.ts",
  },
  {
    tool: "arxiv-download",
    functionName: "arxivDownload",
    modulePath: "runtime/capabilities/literature-access/arxiv-download.ts",
  },
  {
    tool: "openalex-search",
    functionName: "openalexSearch",
    modulePath: "runtime/capabilities/literature-access/openalex-search.ts",
  },
  {
    tool: "unpaywall-download",
    functionName: "unpaywallDownload",
    modulePath: "runtime/capabilities/literature-access/unpaywall-download.ts",
  },
];
export const LIVE_MINI_SWE_PROMOTION_READINESS_RELATIVE_PATH =
  "runtime/05-promotion-readiness/2026-03-24-dw-live-mini-swe-agent-engine-pressure-2026-03-24-promotion-readiness.md";
export const LIVE_MINI_SWE_PRE_PROMOTION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-04-02-dw-live-mini-swe-agent-engine-pressure-2026-03-24-standalone-host-pre-promotion-implementation-slice-01.md";
export const LIVE_MINI_SWE_IMPLEMENTATION_SLICE_RELATIVE_PATH =
  "runtime/00-follow-up/2026-04-02-dw-live-mini-swe-agent-engine-pressure-2026-03-24-standalone-host-runtime-implementation-slice-01.md";
export const RESEARCH_VAULT_PROMOTION_RECORD_RELATIVE_PATH =
  "runtime/07-promotion-records/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.-promotion-record.md";
export const BLISSPIXEL_DEEPR_PROMOTION_RECORD_RELATIVE_PATH =
  "runtime/07-promotion-records/2026-04-07-research-engine-repo-blisspixel-deepr-20260407t052643z-20260407t072402.-promotion-record.md";
export const LIVE_MINI_SWE_CALLABLE_BOUNDARY: StandaloneLiveMiniSweCallableBoundaryDescriptor = {
  inputShape: [
    "task",
    "repositoryContext",
    "constraints",
  ],
  outputShape: [
    "summary",
    "changedFiles",
    "proofNotes",
    "rollbackBoundary",
  ],
  description:
    "Bounded live mini-swe callable boundary descriptor retained for compatibility with the standalone host surface.",
  safetyRules: [
    "host descriptor only unless the consuming project provides the real promoted Runtime chain",
    "no imported-source execution claim",
    "no promotion or registry implication",
  ],
};

export function resolveDirectivePathLike(
  storage: DiscoveryHostStorageBridge,
  filePath: string,
) {
  const normalized = String(filePath).trim();
  if (!normalized) {
    return normalized;
  }

  if (path.isAbsolute(normalized)) {
    return normalizeAbsolutePath(normalized);
  }

  return storage.resolveWithinDirectiveRoot(normalized);
}

export function assertDirectivePathExists(filePath: string, fieldName: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${fieldName}_not_found`);
  }
}

export function listMarkdownFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => normalizeAbsolutePath(path.join(dirPath, entry.name)))
    .sort();
}

export function listJsonFiles(dirPath: string) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => normalizeAbsolutePath(path.join(dirPath, entry.name)))
    .sort();
}

export function readField(content: string, label: string) {
  const match = content.match(
    new RegExp(`^-\\s*${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}:\\s*(.*)$`, "im"),
  );
  return match ? match[1].trim().replace(/^`|`$/g, "") : null;
}

export function readHeading(content: string) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function resolveStandaloneHostReportPath(input: {
  category: "host-consumption" | "host-executions";
  candidateId: string;
  generatedAt: string;
  suffix: string;
}) {
  const date = input.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return path
    .join(
      "runtime",
      "standalone-host",
      input.category,
      `${date}-${input.candidateId}-${input.suffix}.json`,
    )
    .replace(/\\/g, "/");
}
