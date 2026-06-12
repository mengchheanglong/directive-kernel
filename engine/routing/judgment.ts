import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { flattenSourceText } from "./scores.ts";

export interface RoutingJudgment {
  schemaVersion: 1;
  judgmentId: string;
  judgedAt: string;
  judge: { kind: "llm_operator" | "human_operator"; identifier: string; model?: string };
  laneId: "discovery" | "architecture" | "runtime";
  confidence: "low" | "medium" | "high";
  recordShape?: "fast_path" | "standard";
  needsHumanReview?: boolean;
  rationale: string;
  citedEvidence: Array<{ field: string; excerpt: string }>;
  rejectedLanes?: Array<{ laneId: "discovery" | "architecture" | "runtime"; reason: string }>;
}

export interface Disagreement {
  kind: "lane" | "confidence" | "review" | "none";
  priorLaneId: string;
  judgmentLaneId: string;
  priorConfidence: string;
  judgmentConfidence: string;
  priorLaneScores: Record<string, number>;
  resolution: "judgment_wins";
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Validate a routing judgment against the JSON schema AND perform an
 * anti-hallucination check that every citedEvidence excerpt appears
 * verbatim in the source text.
 */
export function validateRoutingJudgment(
  judgment: unknown,
  source: { title?: string | null; sourceRef?: string | null; summary?: string | null; metadataHints?: string[] },
): { ok: true } | { ok: false; errors: string[] } {
  // 1. JSON schema validation
  const schemaPath = path.resolve(
    import.meta.dirname ?? __dirname,
    "../../shared/schemas/routing-judgment.schema.json",
  );
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  } catch {
    return { ok: false, errors: ["Failed to load routing-judgment.schema.json"] };
  }

  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(judgment);

  if (!valid) {
    const errors = (validate.errors ?? []).map(
      (e: { instancePath: string; message?: string }) =>
        `schema:${e.instancePath} ${e.message ?? "unknown error"}`,
    );
    return { ok: false, errors };
  }

  const typed = judgment as RoutingJudgment;

  // 2. Anti-hallucination check
  const sourceParts: string[] = [];
  if (source.title) sourceParts.push(source.title);
  if (source.sourceRef) sourceParts.push(source.sourceRef);
  if (source.summary) sourceParts.push(source.summary);
  if (Array.isArray(source.metadataHints)) {
    sourceParts.push(...source.metadataHints);
  }
  const combinedSourceText = normalizeWhitespace(sourceParts.join(" "));

  for (const evidence of typed.citedEvidence) {
    const normalizedExcerpt = normalizeWhitespace(evidence.excerpt);
    if (!combinedSourceText.includes(normalizedExcerpt)) {
      return {
        ok: false,
        errors: [
          `judgment_evidence_not_found: excerpt "${evidence.excerpt}" not found in source text`,
        ],
      };
    }
  }

  return { ok: true };
}

/**
 * Apply a routing judgment on top of a keyword-engine prior assessment.
 * Returns the overridden assessment and a disagreement record.
 */
export function applyRoutingJudgment(
  priorAssessment: {
    recommendedLaneId: string;
    confidence: string;
    needsHumanReview: boolean;
    laneScores: Record<string, number>;
  },
  judgment: RoutingJudgment,
): {
  assessment: {
    recommendedLaneId: string;
    recommendedRecordShape: string;
    confidence: string;
    needsHumanReview: boolean;
  };
  disagreement: Disagreement;
} {
  // Compute disagreement kind
  const laneMatch = priorAssessment.recommendedLaneId === judgment.laneId;
  const confidenceMatch = priorAssessment.confidence === judgment.confidence;
  const reviewMatch = priorAssessment.needsHumanReview === (judgment.needsHumanReview ?? false);

  let kind: "lane" | "confidence" | "review" | "none";
  if (!laneMatch) {
    kind = "lane";
  } else if (!confidenceMatch || !reviewMatch) {
    kind = "confidence";
  } else {
    kind = "none";
  }

  const disagreement: Disagreement = {
    kind,
    priorLaneId: priorAssessment.recommendedLaneId,
    judgmentLaneId: judgment.laneId,
    priorConfidence: priorAssessment.confidence,
    judgmentConfidence: judgment.confidence,
    priorLaneScores: { ...priorAssessment.laneScores },
    resolution: "judgment_wins",
  };

  const needsHumanReview =
    judgment.needsHumanReview ?? (judgment.confidence === "low" && judgment.laneId !== "discovery");

  const assessment = {
    recommendedLaneId: judgment.laneId,
    confidence: judgment.confidence,
    needsHumanReview,
    recommendedRecordShape: judgment.recordShape ?? "standard",
  };

  return { assessment, disagreement };
}
