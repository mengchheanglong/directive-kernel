/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { extractSourceSignalTokens } from "./correction-ledger.ts";
import { deriveEngineRouteClass } from "./earned-autonomy.ts";
import { flattenSourceText } from "../source-utils.ts";
import type {
  EngineLaneId,
  EngineRunRecord,
  EngineSourceItem,
} from "../types.ts";

export type SourceMemoryLaneCounts = Record<"discovery" | "architecture" | "runtime", number>;

export type SourceMemoryTopicTrend = {
  token: string;
  recentCount: number;
  totalCount: number;
  recentLaneCounts: SourceMemoryLaneCounts;
};

export type SourceMemoryRouteClassTrend = {
  routeClass: string;
  laneId: EngineLaneId;
  sourceType: string;
  recentCount: number;
  totalCount: number;
  lastSeenAt: string;
};

export type SourceMemorySnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  recentWindowDays: number;
  totalRuns: number;
  recentRuns: number;
  laneVolume: SourceMemoryLaneCounts;
  topics: SourceMemoryTopicTrend[];
  routeClasses: SourceMemoryRouteClassTrend[];
};

export type SourceMemoryAssessment = {
  summary: string;
  biasAdjustments: SourceMemoryLaneCounts;
  matchingTopics: Array<{
    token: string;
    recentCount: number;
    totalCount: number;
    dominantLaneId: EngineLaneId;
  }>;
  matchingRouteClass: SourceMemoryRouteClassTrend | null;
  rationale: string[];
} | null;

const SOURCE_MEMORY_RELATIVE_PATH = "engine/source-memory.json";

function zeroLaneCounts(): SourceMemoryLaneCounts {
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

function dominantLaneId(counts: SourceMemoryLaneCounts): EngineLaneId {
  return (Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as EngineLaneId;
}

export function createSourceMemorySnapshot(input: {
  runs: EngineRunRecord[];
  generatedAt?: string;
  recentWindowDays?: number;
  /** Pre-computed source signal tokens keyed by runId, avoids redundant tokenization. */
  precomputedSourceTokens?: Map<string, string[]> | null;
}) {
  const recentWindowDays = Math.max(7, input.recentWindowDays ?? 30);
  const now = input.generatedAt ? new Date(input.generatedAt) : new Date();
  const laneVolume = zeroLaneCounts();
  const topicMap = new Map<string, SourceMemoryTopicTrend>();
  const routeClassMap = new Map<string, SourceMemoryRouteClassTrend>();
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

    const routeClass = deriveEngineRouteClass({
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
  } satisfies SourceMemorySnapshot;
}

export function resolveDirectiveSourceMemoryPath(directiveRoot: string) {
  return normalizeAbsolute(path.join(directiveRoot, SOURCE_MEMORY_RELATIVE_PATH));
}

export function writeSourceMemorySnapshot(input: {
  directiveRoot: string;
  runs: EngineRunRecord[];
  generatedAt?: string;
  recentWindowDays?: number;
}) {
  const snapshot = createSourceMemorySnapshot(input);
  const snapshotPath = resolveDirectiveSourceMemoryPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return {
    snapshot,
    snapshotPath,
  };
}

export function deriveSourceMemoryAssessment(input: {
  snapshot: SourceMemorySnapshot;
  sourceText: string;
  recommendedLaneId: EngineLaneId;
  source: EngineSourceItem;
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
    if (
      topic.recentCount >= 2
      && (lane === "discovery" || lane === "architecture" || lane === "runtime")
    ) {
      const next = Math.min(3, biasAdjustments[lane] + 1);
      biasAdjustments[lane] = next;
    }
  }

  const routeClass = deriveEngineRouteClass({
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
