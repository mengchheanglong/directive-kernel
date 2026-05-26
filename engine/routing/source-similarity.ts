import { extractSourceSignalTokens } from "./correction-ledger.ts";
import { flattenSourceText, findSharedTokens } from "../source-utils.ts";
import type {
  EngineLaneId,
  EngineRunRecord,
  EngineSourceItem,
} from "../types.ts";

export type SourceSimilarityMatch = {
  runId: string;
  candidateId: string;
  candidateName: string;
  laneId: EngineLaneId;
  decisionState: string;
  receivedAt: string;
  similarityScore: number;
  sharedTokens: string[];
  summary: string;
};

export type SourceSimilarityAssessment = {
  summary: string;
  relatedSources: SourceSimilarityMatch[];
} | null;

export function deriveSourceSimilarityAssessment(input: {
  source: EngineSourceItem;
  sourceText: string;
  existingRuns: EngineRunRecord[];
  recommendedLaneId?: EngineLaneId | null;
  /** Pre-computed source signal tokens keyed by runId, avoids redundant tokenization. */
  precomputedSourceTokens?: Map<string, string[]> | null;
}) {
  const sourceTokens = extractSourceSignalTokens(input.sourceText);
  const relatedSources = input.existingRuns
    .map((run) => {
      const runTokens = input.precomputedSourceTokens?.get(run.runId)
        ?? extractSourceSignalTokens(flattenSourceText(run.source));
      const sharedTokens = findSharedTokens(sourceTokens, runTokens);
      const unionSize = new Set([...sourceTokens, ...runTokens]).size || 1;
      const similarityScore = Math.round((sharedTokens.length / unionSize) * 100);
      return {
        runId: run.runId,
        candidateId: run.candidate.candidateId,
        candidateName: run.candidate.candidateName,
        laneId: run.selectedLane.laneId,
        decisionState: run.decision.decisionState,
        receivedAt: run.receivedAt,
        similarityScore,
        sharedTokens: sharedTokens.slice(0, 6),
        summary:
          `${run.candidate.candidateName} routed to ${run.selectedLane.laneId} (${run.decision.decisionState}) with ${sharedTokens.length} shared signal tokens.`,
      } satisfies SourceSimilarityMatch;
    })
    .filter((entry) => entry.sharedTokens.length >= 2)
    .sort((left, right) => {
      if (right.similarityScore !== left.similarityScore) {
        return right.similarityScore - left.similarityScore;
      }
      return right.receivedAt.localeCompare(left.receivedAt);
    })
    .slice(0, 3);

  if (relatedSources.length === 0) {
    return null;
  }

  const matchingLaneCount = input.recommendedLaneId
    ? relatedSources.filter((entry) => entry.laneId === input.recommendedLaneId).length
    : 0;

  return {
    summary: input.recommendedLaneId
      ? `${matchingLaneCount}/${relatedSources.length} related sources previously landed in ${input.recommendedLaneId}.`
      : `Found ${relatedSources.length} related prior sources.`,
    relatedSources,
  };
}
