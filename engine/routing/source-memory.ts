/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { extractSourceSignalTokens } from "./routing-correction-ledger.ts";
import { deriveDirectiveEngineRouteClass } from "./earned-autonomy.ts";
import { flattenSourceText } from "../engine-source-utils.ts";
import type {
  DirectiveEngineLaneId,
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "../types.ts";

export type DirectiveSourceMemoryLaneCounts = Record<"discovery" | "architecture" | "runtime", number>;

export type DirectiveSourceMemoryTopicTrend = {
  token: string;
  recentCount: number;
  totalCount: number;
  recentLaneCounts: DirectiveSourceMemoryLaneCounts;
};

export type DirectiveSourceMemoryRouteClassTrend = {
  routeClass: string;
  laneId: DirectiveEngineLaneId;
  sourceType: string;
  recentCount: number;
  totalCount: number;
  lastSeenAt: string;
};

export type DirectiveSourceMemorySnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  recentWindowDays: number;
  totalRuns: number;
  recentRuns: number;
  laneVolume: DirectiveSourceMemoryLaneCounts;
  topics: DirectiveSourceMemoryTopicTrend[];
  routeClasses: DirectiveSourceMemoryRouteClassTrend[];
};

export type DirectiveSourceMemoryAssessment = {
  summary: string;
  biasAdjustments: DirectiveSourceMemoryLaneCounts;
  matchingTopics: Array<{
    token: string;
    recentCount: number;
    totalCount: number;
    dominantLaneId: DirectiveEngineLaneId;
  }>;
  matchingRouteClass: DirectiveSourceMemoryRouteClassTrend | null;
  rationale: string[];
} | null;

const SOURCE_MEMORY_RELATIVE_PATH = "engine/source-memory.json";

function zeroLaneCounts(): DirectiveSourceMemoryLaneCounts {
  return {
    discovery: 0,
    architecture: 0,
    runtime: 0,
  };
}

function normalizeAbsolute(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function daysAgo(now: Date, days: number) {
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function isRecent(receivedAt: string, now: Date, recentWindowDays: number) {
  const parsed = Date.parse(receivedAt);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return parsed >= daysAgo(now, recentWindowDays);
}

function dominantLaneId(counts: DirectiveSourceMemoryLaneCounts): DirectiveEngineLaneId {
  return (Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as DirectiveEngineLaneId;
}

export function createDirectiveSourceMemorySnapshot(input: {
  runs: DirectiveEngineRunRecord[];
  generatedAt?: string;
  recentWindowDays?: number;
  /** Pre-computed source signal tokens keyed by runId, avoids redundant tokenization. */
  precomputedSourceTokens?: Map<string, string[]> | null;
}) {
  const recentWindowDays = Math.max(7, input.recentWindowDays ?? 30);
  const now = input.generatedAt ? new Date(input.generatedAt) : new Date();
  const laneVolume = zeroLaneCounts();
  const topicMap = new Map<string, DirectiveSourceMemoryTopicTrend>();
  const routeClassMap = new Map<string, DirectiveSourceMemoryRouteClassTrend>();
  let recentRuns = 0;

  for (const run of input.runs) {
    const laneId = (
      run.selectedLane?.laneId
      || run.candidate?.recommendedLaneId
      || "discovery"
    ) as "discovery" | "architecture" | "runtime";
    const recent = isRecent(run.receivedAt, now, recentWindowDays);
    if (recent) {
      laneVolume[laneId] += 1;
      recentRuns += 1;
    }

    const routeClass = deriveDirectiveEngineRouteClass({
      recommendedLaneId: laneId,
      source: run.source,
    });
    const routeTrend = routeClassMap.get(routeClass) ?? {
      routeClass,
      laneId,
      sourceType: run.source.sourceType,
      recentCount: 0,
      totalCount: 0,
      lastSeenAt: run.receivedAt,
    };
    routeTrend.totalCount += 1;
    if (recent) {
      routeTrend.recentCount += 1;
    }
    if (run.receivedAt > routeTrend.lastSeenAt) {
      routeTrend.lastSeenAt = run.receivedAt;
    }
    routeClassMap.set(routeClass, routeTrend);

    const tokens = (input.precomputedSourceTokens?.get(run.runId)
      ?? extractSourceSignalTokens(flattenSourceText(run.source))).slice(0, 12);
    for (const token of tokens) {
      const entry = topicMap.get(token) ?? {
        token,
        recentCount: 0,
        totalCount: 0,
        recentLaneCounts: zeroLaneCounts(),
      };
      entry.totalCount += 1;
      if (recent) {
        entry.recentCount += 1;
        entry.recentLaneCounts[laneId] += 1;
      }
      topicMap.set(token, entry);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? now.toISOString(),
    recentWindowDays,
    totalRuns: input.runs.length,
    recentRuns,
    laneVolume,
    topics: [...topicMap.values()]
      .sort((left, right) => {
        if (right.recentCount !== left.recentCount) {
          return right.recentCount - left.recentCount;
        }
        if (right.totalCount !== left.totalCount) {
          return right.totalCount - left.totalCount;
        }
        return left.token.localeCompare(right.token);
      })
      .slice(0, 20),
    routeClasses: [...routeClassMap.values()]
      .sort((left, right) => {
        if (right.recentCount !== left.recentCount) {
          return right.recentCount - left.recentCount;
        }
        if (right.totalCount !== left.totalCount) {
          return right.totalCount - left.totalCount;
        }
        return left.routeClass.localeCompare(right.routeClass);
      })
      .slice(0, 20),
  } satisfies DirectiveSourceMemorySnapshot;
}

export function resolveDirectiveSourceMemoryPath(directiveRoot: string) {
  return normalizeAbsolute(path.join(directiveRoot, SOURCE_MEMORY_RELATIVE_PATH));
}

export function writeDirectiveSourceMemorySnapshot(input: {
  directiveRoot: string;
  runs: DirectiveEngineRunRecord[];
  generatedAt?: string;
  recentWindowDays?: number;
}) {
  const snapshot = createDirectiveSourceMemorySnapshot(input);
  const snapshotPath = resolveDirectiveSourceMemoryPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return {
    snapshot,
    snapshotPath,
  };
}

export function deriveDirectiveSourceMemoryAssessment(input: {
  snapshot: DirectiveSourceMemorySnapshot;
  sourceText: string;
  recommendedLaneId: DirectiveEngineLaneId;
  source: DirectiveEngineSourceItem;
}) {
  if (input.snapshot.totalRuns === 0) {
    return null;
  }

  const sourceTokens = extractSourceSignalTokens(input.sourceText);
  const matchingTopics = input.snapshot.topics
    .filter((entry) => sourceTokens.includes(entry.token) && entry.recentCount > 0)
    .map((entry) => ({
      token: entry.token,
      recentCount: entry.recentCount,
      totalCount: entry.totalCount,
      dominantLaneId: dominantLaneId(entry.recentLaneCounts),
    }))
    .slice(0, 4);

  const biasAdjustments = zeroLaneCounts();
  for (const topic of matchingTopics) {
    const lane = topic.dominantLaneId;
    if (topic.recentCount >= 2) {
      const next = Math.min(3, biasAdjustments[lane] + 1);
      biasAdjustments[lane as "discovery" | "architecture" | "runtime"] = next;
    }
  }

  const routeClass = deriveDirectiveEngineRouteClass({
    recommendedLaneId: input.recommendedLaneId,
    source: input.source,
  });
  const matchingRouteClass =
    input.snapshot.routeClasses.find((entry) => entry.routeClass === routeClass)
    ?? null;

  const rationale = [
    matchingTopics.length > 0
      ? `Source Memory found recurring recent tokens: ${matchingTopics.map((entry) => `${entry.token} (${entry.dominantLaneId}, ${entry.recentCount} recent)`).join("; ")}.`
      : "Source Memory did not find recurring recent topic overlap for this source.",
    matchingRouteClass
      ? `Route class ${matchingRouteClass.routeClass} appeared ${matchingRouteClass.recentCount} times in the recent window (${matchingRouteClass.totalCount} total).`
      : `Route class ${routeClass} has no prior history yet.`,
  ];

  if (matchingTopics.length === 0 && !matchingRouteClass) {
    return {
      summary: "Source Memory has no meaningful prior trend for this source yet.",
      biasAdjustments,
      matchingTopics,
      matchingRouteClass,
      rationale,
    };
  }

  return {
    summary:
      matchingTopics.length > 0
        ? `Source Memory sees recurring topic pressure for ${matchingTopics.map((entry) => entry.token).join(", ")}.`
        : `Source Memory recognizes this route class from prior runs.`,
    biasAdjustments,
    matchingTopics,
    matchingRouteClass,
    rationale,
  };
}
