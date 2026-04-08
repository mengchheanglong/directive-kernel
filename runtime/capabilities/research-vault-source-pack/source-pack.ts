export type ResearchVaultSourcePackSectionId =
  | "phase_model"
  | "discovery_phase"
  | "acquisition_phase"
  | "runtime_boundary"
  | "host_boundary";

export type ResearchVaultSourcePackQueryInput = {
  query: string;
  includeEvidence?: boolean;
  maxItems?: number;
};

export type ResearchVaultSourcePackEvidence = {
  source: string;
  claim: string;
};

export type ResearchVaultSourcePackSection = {
  id: ResearchVaultSourcePackSectionId;
  title: string;
  keywords: string[];
  summary: string;
  evidence: ResearchVaultSourcePackEvidence[];
};

export type ResearchVaultSourcePackQueryResult = {
  ok: true;
  query: string;
  sourcePackId: string;
  candidateId: string;
  sourceDerivedBehavior: "static_source_pack_query";
  sourceRuntimeExecutionClaimed: false;
  matchedSections: Array<{
    id: ResearchVaultSourcePackSectionId;
    title: string;
    score: number;
    summary: string;
    evidence?: ResearchVaultSourcePackEvidence[];
  }>;
  stopLine: string;
};

export type ResearchVaultSourcePackOutput =
  | ResearchVaultSourcePackQueryResult
  | { ok: false; error: string; message: string };

export const RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID =
  "research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.";

export const RESEARCH_VAULT_SOURCE_PACK_SECTIONS: ResearchVaultSourcePackSection[] = [
  {
    id: "phase_model",
    title: "Discovery and acquisition phase model",
    keywords: ["phase", "model", "workflow", "discovery", "acquisition"],
    summary:
      "Research Vault is treated as source pressure for a bounded discovery/acquisition phase model that can help shape Runtime-facing research workflows.",
    evidence: [
      {
        source:
          "discovery/03-routing-log/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702--routing-record.md",
        claim:
          "Research Engine recommended extracting the explicit phase model as a Directive-owned workflow contract.",
      },
    ],
  },
  {
    id: "discovery_phase",
    title: "Discovery phase",
    keywords: ["discovery", "intake", "triage", "routing", "source"],
    summary:
      "The imported candidate is useful as a reusable Runtime source only after Discovery has preserved intake, triage, routing, and authority boundaries.",
    evidence: [
      {
        source:
          "discovery/03-routing-log/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702--routing-record.md",
        claim:
          "Discovery kept final route and adoption authority while importing Research Engine source intelligence.",
      },
    ],
  },
  {
    id: "acquisition_phase",
    title: "Acquisition phase",
    keywords: ["acquisition", "evidence", "source", "extract", "packet"],
    summary:
      "The source-pack keeps acquisition bounded to captured Research Engine evidence and does not treat a source-intelligence packet as an adoption decision.",
    evidence: [
      {
        source: "discovery/intake-queue.json",
        claim:
          "The candidate notes keep the Research Engine bundle boundary explicit: source intelligence is review input, not route or adoption authority.",
      },
    ],
  },
  {
    id: "runtime_boundary",
    title: "Runtime execution boundary",
    keywords: ["runtime", "execution", "callable", "boundary", "proof"],
    summary:
      "The Runtime lane may execute a Directive-owned derived source-pack query, but this does not execute the external Research Vault app.",
    evidence: [
      {
        source:
          "runtime/07-promotion-records/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.-promotion-record.md",
        claim:
          "Registry acceptance, host integration, runtime execution of the source app, and promotion automation remain closed.",
      },
    ],
  },
  {
    id: "host_boundary",
    title: "Standalone host boundary",
    keywords: ["host", "standalone", "adapter", "integration", "registry"],
    summary:
      "The standalone host may call the Runtime-owned source-pack query through the host adapter, while registry acceptance and generic host integration stay unopened.",
    evidence: [
      {
        source:
          "runtime/standalone-host/host-executions/2026-04-07-research-engine-web-aakashsharan-com-research-va-20260407t052643z-20260407t052702.-host-callable-execution-report.json",
        claim:
          "The prior host report was descriptor-only and explicitly avoided imported-source execution and registry acceptance claims.",
      },
    ],
  },
];

function normalizeQueryTerms(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
}

export function queryResearchVaultSourcePack(
  input: ResearchVaultSourcePackQueryInput,
): ResearchVaultSourcePackOutput {
  if (typeof input.query !== "string" || !input.query.trim()) {
    return {
      ok: false,
      error: "invalid_input",
      message: "query must be a non-empty string",
    };
  }

  if (
    input.maxItems !== undefined
    && (!Number.isInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 5)
  ) {
    return {
      ok: false,
      error: "invalid_input",
      message: "maxItems must be an integer from 1 to 5",
    };
  }

  const terms = normalizeQueryTerms(input.query);
  const maxItems = input.maxItems ?? 3;
  const includeEvidence = input.includeEvidence === true;
  const ranked = RESEARCH_VAULT_SOURCE_PACK_SECTIONS
    .map((section) => {
      const searchable = [
        section.id,
        section.title,
        section.summary,
        ...section.keywords,
      ].join(" ").toLowerCase();
      const score = terms.reduce(
        (total, term) => total + (searchable.includes(term) ? 1 : 0),
        0,
      );
      return { section, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || left.section.id.localeCompare(right.section.id)
    );
  const matches = (ranked.length > 0
    ? ranked
    : RESEARCH_VAULT_SOURCE_PACK_SECTIONS.map((section) => ({ section, score: 0 }))
  )
    .slice(0, maxItems)
    .map(({ section, score }) => ({
      id: section.id,
      title: section.title,
      score,
      summary: section.summary,
      ...(includeEvidence ? { evidence: section.evidence.map((entry) => ({ ...entry })) } : {}),
    }));

  return {
    ok: true,
    query: input.query.trim(),
    sourcePackId: "research_vault_phase_model_source_pack.v1",
    candidateId: RESEARCH_VAULT_SOURCE_PACK_CAPABILITY_ID,
    sourceDerivedBehavior: "static_source_pack_query",
    sourceRuntimeExecutionClaimed: false,
    matchedSections: matches,
    stopLine:
      "This executes a Directive-owned static source-pack query derived from Research Vault evidence; it does not run the external Research Vault app, write registry acceptance, or automate promotion.",
  };
}
