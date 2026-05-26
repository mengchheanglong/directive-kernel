import {
  ENGINE_SUPPORTED_SOURCE_TYPES,
  type EngineSourceType,
} from "./types.ts";
import { normalizeText } from "./source-utils.ts";

export type EngineSourceTypeNormalization = {
  submittedSourceType: string;
  canonicalSourceType: EngineSourceType;
  normalizedFrom: string | null;
  normalizationKind: "none" | "format" | "alias";
};

const ENGINE_SOURCE_TYPE_ALIASES = new Map<string, EngineSourceType>([
  ["repo", "github-repo"],
  ["repository", "github-repo"],
  ["githubrepo", "github-repo"],
  ["research-paper", "paper"],
]);

function normalizeSourceTypeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderAcceptedEquivalentTerms() {
  return [
    "`repo` -> `github-repo`",
    "`repository` -> `github-repo`",
    "`github repo` -> `github-repo`",
    "`github repository` -> `github-repo`",
    "`research paper` -> `paper`",
  ].join(", ");
}

export function normalizeEngineSourceTypeInput(
  value: unknown,
): EngineSourceTypeNormalization {
  const submittedSourceType = normalizeText(value);
  const normalizedKey = normalizeSourceTypeKey(submittedSourceType);
  const canonicalMatch = ENGINE_SUPPORTED_SOURCE_TYPES.find(
    (candidate) => candidate === normalizedKey,
  );

  if (canonicalMatch) {
    return {
      submittedSourceType,
      canonicalSourceType: canonicalMatch,
      normalizedFrom:
        submittedSourceType && submittedSourceType !== canonicalMatch
          ? submittedSourceType
          : null,
      normalizationKind:
        submittedSourceType && submittedSourceType !== canonicalMatch
          ? "format"
          : "none",
    };
  }

  const aliasMatch = ENGINE_SOURCE_TYPE_ALIASES.get(normalizedKey);
  if (aliasMatch) {
    return {
      submittedSourceType,
      canonicalSourceType: aliasMatch,
      normalizedFrom: submittedSourceType || normalizedKey,
      normalizationKind: "alias",
    };
  }

  throw new Error(
    `directive_engine_invalid_source_type: ${String(value ?? "")}; supported canonical types: ${ENGINE_SUPPORTED_SOURCE_TYPES.join(", ")}; accepted equivalents: ${renderAcceptedEquivalentTerms()}`,
  );
}

export function normalizeEngineSourceType(value: unknown): EngineSourceType {
  return normalizeEngineSourceTypeInput(value).canonicalSourceType;
}
