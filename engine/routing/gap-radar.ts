/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type {
  DirectiveEngineCapabilityGap,
  DirectiveEngineCapabilityGapPriority,
  DirectiveEngineLaneId,
} from "../types.ts";
import { countTokenOverlap, uniqueStrings } from "../engine-source-utils.ts";
import { extractSourceSignalTokens } from "./routing-correction-ledger.ts";

export type DirectiveGapRadarSuggestion = {
  radarId: string;
  targetLaneId: DirectiveEngineLaneId;
  confidence: "low" | "medium" | "high";
  evidenceCount: number;
  summary: string;
  recommendedChange: string;
  signalTokens: string[];
  relatedOpenGapId: string | null;
  suggestedPriority: DirectiveEngineCapabilityGapPriority;
  candidateExamples: string[];
};

export type DirectiveGapRadarAssessment = {
  summary: string;
  suggestions: DirectiveGapRadarSuggestion[];
} | null;

export type DirectiveGapRadarReport = {
  schemaVersion: 1;
  generatedAt: string;
  suggestions: DirectiveGapRadarSuggestion[];
};

const GAP_RADAR_RELATIVE_PATH = "engine/gap-radar.json";

function toConfidence(count: number): "low" | "medium" | "high" {
  if (count >= 4) {
    return "high";
  }
  if (count >= 3) {
    return "medium";
  }
  return "low";
}

function toPriority(count: number): DirectiveEngineCapabilityGapPriority {
  if (count >= 4) {
    return "high";
  }
  if (count >= 3) {
    return "medium";
  }
  return "low";
}

function tokenizeGap(gap: DirectiveEngineCapabilityGap) {
  return extractSourceSignalTokens([
    gap.gapId,
    gap.description,
    gap.relatedMissionObjective,
    gap.currentState,
    gap.desiredState,
    gap.resolutionNotes ?? "",
  ].join(" "));
}

type Cluster = {
  laneId: DirectiveEngineLaneId;
  events: DecisionPolicyEvent[];
  tokenCounts: Map<string, number>;
};

function buildRadarId(input: {
  laneId: string;
  signalTokens: string[];
}) {
  return [
    "gap-radar",
    input.laneId,
    ...input.signalTokens.slice(0, 3),
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

export function compileDirectiveGapRadarSuggestions(input: {
  events: DecisionPolicyEvent[];
  openGaps: DirectiveEngineCapabilityGap[];
}) {
  const relevantEvents = input.events.filter((event) =>
    (event.resolvedLaneId === "architecture" || event.resolvedLaneId === "runtime")
    && (
      !event.matchedGapId
      || event.followUpRequestedFields.includes("source.capabilityGapId")
      || event.originalLaneId !== event.resolvedLaneId
    )
  );
  const clusters: Cluster[] = [];

  for (const event of relevantEvents) {
    const eventTokens = uniqueStrings(
      event.sourceSignalTokens,
      (value) => value.trim().toLowerCase(),
    ).slice(0, 8);
    if (eventTokens.length === 0) {
      continue;
    }
    const matchingCluster = clusters.find((cluster) =>
      cluster.laneId === event.resolvedLaneId
      && countTokenOverlap(
        eventTokens,
        [...cluster.tokenCounts.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([token]) => token)
          .slice(0, 6),
      ) >= 2
    );
    if (matchingCluster) {
      matchingCluster.events.push(event);
      for (const token of eventTokens) {
        matchingCluster.tokenCounts.set(
          token,
          (matchingCluster.tokenCounts.get(token) ?? 0) + 1,
        );
      }
      continue;
    }
    const tokenCounts = new Map<string, number>();
    for (const token of eventTokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
    clusters.push({
      laneId: event.resolvedLaneId,
      events: [event],
      tokenCounts,
    });
  }

  return clusters
    .filter((cluster) => cluster.events.length >= 2)
    .map((cluster) => {
      const signalTokens = [...cluster.tokenCounts.entries()]
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1];
          }
          return left[0].localeCompare(right[0]);
        })
        .map(([token]) => token)
        .slice(0, 4);
      const relatedOpenGap =
        [...input.openGaps]
          .map((gap) => ({
            gap,
            overlap: countTokenOverlap(signalTokens, tokenizeGap(gap)),
          }))
          .filter((entry) => entry.overlap >= 2)
          .sort((left, right) => right.overlap - left.overlap)[0]?.gap
        ?? null;
      const evidenceCount = cluster.events.length;
      const suggestedPriority = toPriority(evidenceCount);
      const confidence = toConfidence(evidenceCount);
      const summary = relatedOpenGap
        ? `Reviewed ${cluster.laneId} cases keep hitting ${signalTokens.join(", ")} while existing gap ${relatedOpenGap.gapId} appears adjacent but under-specified.`
        : `Reviewed ${cluster.laneId} cases keep hitting ${signalTokens.join(", ")} without a matching open capability gap.`;
      const recommendedChange = relatedOpenGap
        ? `Reprioritize or extend ${relatedOpenGap.gapId} so cases mentioning ${signalTokens.join(", ")} stop depending on ad hoc routing memory.`
        : `Open a ${suggestedPriority}-priority ${cluster.laneId} capability gap around ${signalTokens.join(", ")} and use it as the default match for similar cases.`;
      return {
        radarId: buildRadarId({
          laneId: cluster.laneId,
          signalTokens,
        }),
        targetLaneId: cluster.laneId,
        confidence,
        evidenceCount,
        summary,
        recommendedChange,
        signalTokens,
        relatedOpenGapId: relatedOpenGap?.gapId ?? null,
        suggestedPriority,
        candidateExamples: uniqueStrings(
          cluster.events.map((event) => event.candidateId),
          (value) => value.trim().toLowerCase(),
        ).slice(0, 5),
      } satisfies DirectiveGapRadarSuggestion;
    })
    .sort((left, right) => {
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.summary.localeCompare(right.summary);
    });
}

export function deriveDirectiveGapRadarAssessment(input: {
  sourceText: string;
  recommendedLaneId: DirectiveEngineLaneId;
  matchedGapId: string | null;
  suggestions: DirectiveGapRadarSuggestion[];
}): DirectiveGapRadarAssessment {
  const sourceTokens = extractSourceSignalTokens(input.sourceText);
  const matches = input.suggestions
    .map((suggestion) => ({
      suggestion,
      overlap: countTokenOverlap(sourceTokens, suggestion.signalTokens),
    }))
    .filter((entry) =>
      entry.suggestion.targetLaneId === input.recommendedLaneId
      && entry.overlap >= 2
    )
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap;
      }
      if (right.suggestion.evidenceCount !== left.suggestion.evidenceCount) {
        return right.suggestion.evidenceCount - left.suggestion.evidenceCount;
      }
      return left.suggestion.summary.localeCompare(right.suggestion.summary);
    })
    .map((entry) => entry.suggestion)
    .slice(0, 3);

  if (matches.length === 0) {
    return null;
  }

  return {
    summary: input.matchedGapId
      ? `Gap Radar sees adjacent repeated pressure for this route class, but the current case already matched open gap ${input.matchedGapId}.`
      : `Gap Radar sees repeated ${input.recommendedLaneId} pressure for this route class without a clean open-gap match.`,
    suggestions: matches,
  };
}

export function createDirectiveGapRadarReport(input: {
  generatedAt?: string;
  events: DecisionPolicyEvent[];
  openGaps: DirectiveEngineCapabilityGap[];
}) {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    suggestions: compileDirectiveGapRadarSuggestions({
      events: input.events,
      openGaps: input.openGaps,
    }),
  } satisfies DirectiveGapRadarReport;
}

export function resolveDirectiveGapRadarPath(directiveRoot: string) {
  return path.resolve(directiveRoot, GAP_RADAR_RELATIVE_PATH).replace(/\\/g, "/");
}

export function writeDirectiveGapRadarReport(input: {
  directiveRoot: string;
  generatedAt?: string;
  events: DecisionPolicyEvent[];
  openGaps: DirectiveEngineCapabilityGap[];
}) {
  const report = createDirectiveGapRadarReport(input);
  const reportPath = resolveDirectiveGapRadarPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return {
    reportPath,
    report,
  };
}
