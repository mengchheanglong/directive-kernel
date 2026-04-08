import {
  DIRECTIVE_ENGINE_SUPPORTED_SOURCE_TYPES,
  type DirectiveEngineSourceType,
} from "./types.ts";

export type DirectiveEngineSourceTypeNormalization = {
  submittedSourceType: string;
  canonicalSourceType: DirectiveEngineSourceType;
  normalizedFrom: string | null;
  normalizationKind: "none" | "format" | "alias";
};

const DIRECTIVE_ENGINE_SOURCE_TYPE_ALIASES = new Map<string, DirectiveEngineSourceType>([
  ["repo", "github-repo"],
  ["repository", "github-repo"],
  ["githubrepo", "github-repo"],
  ["research-paper", "paper"],
]);

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

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

export function normalizeDirectiveEngineSourceTypeInput(
  value: unknown,
): DirectiveEngineSourceTypeNormalization {
  const submittedSourceType = normalizeText(value);
  const normalizedKey = normalizeSourceTypeKey(submittedSourceType);
  const canonicalMatch = DIRECTIVE_ENGINE_SUPPORTED_SOURCE_TYPES.find(
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

  const aliasMatch = DIRECTIVE_ENGINE_SOURCE_TYPE_ALIASES.get(normalizedKey);
  if (aliasMatch) {
    return {
      submittedSourceType,
      canonicalSourceType: aliasMatch,
      normalizedFrom: submittedSourceType || normalizedKey,
      normalizationKind: "alias",
    };
  }

  throw new Error(
    `directive_engine_invalid_source_type: ${String(value ?? "")}; supported canonical types: ${DIRECTIVE_ENGINE_SUPPORTED_SOURCE_TYPES.join(", ")}; accepted equivalents: ${renderAcceptedEquivalentTerms()}`,
  );
}

export function normalizeDirectiveEngineSourceType(value: unknown): DirectiveEngineSourceType {
  return normalizeDirectiveEngineSourceTypeInput(value).canonicalSourceType;
}
