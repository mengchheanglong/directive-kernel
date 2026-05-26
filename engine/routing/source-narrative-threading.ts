import { extractSourceSignalTokens } from "./correction-ledger.ts";
import {
  flattenSourceText,
  countTokenOverlap,
  isSuccessfulRun,
  isStalledRun,
} from "../source-utils.ts";
import type {
  EngineCapabilityGap,
  EngineLaneId,
  EngineMissionContext,
  EngineRunRecord,
  EngineSourceItem,
} from "../types.ts";

type NarrativeLaneCounts = Record<"discovery" | "architecture" | "runtime", number>;
type NarrativeKnownLaneId = keyof NarrativeLaneCounts;

export type NarrativeThreadState =
  | "nascent"
  | "developing"
  | "mature"
  | "stalled"
  | "completed";

export type NarrativeDemandSignal = {
  kind: "lane_validation" | "proof_follow_through" | "gap_closure" | "fresh_evidence";
  priority: "low" | "medium" | "high";
  summary: string;
  requestedLaneId: EngineLaneId | null;
};

export type SourceNarrativeThread = {
  threadId: string;
  name: string;
  state: NarrativeThreadState;
  summary: string;
  sourceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  activeSpanDays: number;
  currentSourceOverlap: number;
  topTokens: string[];
  laneTendency: {
    dominantLaneId: EngineLaneId;
    dominancePercent: number;
    laneCounts: NarrativeLaneCounts;
    biasAdjustment: number;
  };
  gapCoverage: {
    dominantGapId: string | null;
    matchedGapIds: string[];
    status: "none" | "emerging" | "partially_addressed" | "closed";
  };
  followThrough: {
    completedProofCount: number;
    stalledProofCount: number;
    followThroughRate: number;
  };
  demandSignals: NarrativeDemandSignal[];
  relatedRunIds: string[];
};

export type SourceNarrativeContext = {
  summary: string;
  primaryThread: SourceNarrativeThread | null;
  relatedThreads: SourceNarrativeThread[];
  biasAdjustments: NarrativeLaneCounts;
  demandSignals: NarrativeDemandSignal[];
  rationale: string[];
} | null;

export type NarrativeActionKind =
  | "re_engagement_prompt"
  | "gap_creation_request"
  | "proof_follow_up_request"
  | "lane_validation_request";

export type NarrativeAction = {
  actionKind: NarrativeActionKind;
  threadId: string;
  threadName: string;
  priority: "low" | "medium" | "high";
  summary: string;
  suggestedNextStep: string;
  targetLaneId: EngineLaneId | null;
  relatedGapId: string | null;
};

type InternalThread = {
  threadId: string;
  threadOrder: number;
  runs: EngineRunRecord[];
  tokenCounts: Map<string, number>;
  laneCounts: NarrativeLaneCounts;
  firstSeenAt: string;
  lastSeenAt: string;
};

type ThreadTokenIndex = Map<string, Set<InternalThread>>;
type NarrativeGapCoverage = SourceNarrativeThread["gapCoverage"];

export type SourceNarrativeThreadBuild = {
  threads: InternalThread[];
};

const THREAD_GENERIC_TOKENS = new Set([
  "active",
  "bounded",
  "candidate",
  "current",
  "directive",
  "engine",
  "evidence",
  "improve",
  "improvement",
  "kernel",
  "mission",
  "product",
  "review",
  "signal",
  "source",
  "system",
  "useful",
  "workspace",
]);

const MISSION_COMPARISON_GENERIC_TOKENS = new Set([
  ...THREAD_GENERIC_TOKENS,
  "architecture",
  "discovery",
  "runtime",
]);

function zeroLaneCounts(): NarrativeLaneCounts {
  return {
    discovery: 0,
    architecture: 0,
    runtime: 0,
  };
}

function flattenRunNarrativeText(run: EngineRunRecord) {
  return [
    flattenSourceText(run.source),
    run.analysis.missionFitSummary,
    run.analysis.usefulnessRationale,
    run.integrationProposal.nextAction,
    run.proofPlan.objective,
    ...run.improvementPlan.improvementGoals,
    run.improvementPlan.intendedDelta,
  ]
    .filter(Boolean)
    .join(" ");
}

function parseTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daySpan(startAt: string, endAt: string) {
  const span = Math.max(0, parseTimestamp(endAt) - parseTimestamp(startAt));
  return Math.max(0, Math.round(span / (24 * 60 * 60 * 1000)));
}

function hoursBetween(leftAt: string, rightAt: string) {
  const diff = parseTimestamp(rightAt) - parseTimestamp(leftAt);
  return diff / (60 * 60 * 1000);
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens));
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function missionTopicTokens(mission: EngineMissionContext) {
  return uniqueTokens(
    extractSourceSignalTokens([
      mission.currentObjective,
      ...mission.usefulnessSignals,
      mission.adoptionTarget ?? "",
    ].join(" "))
      .filter((token) => !MISSION_COMPARISON_GENERIC_TOKENS.has(token)),
  );
}

function dominantLane(counts: NarrativeLaneCounts) {
  const ranked = (Object.entries(counts) as Array<[NarrativeKnownLaneId, number]>)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    });
  const total = ranked.reduce((sum, [, value]) => sum + value, 0) || 1;
  const [laneId, count] = ranked[0] ?? ["discovery", 0];
  return {
    dominantLaneId: laneId,
    count,
    dominancePercent: Math.round((count / total) * 100),
  };
}

function preservesLaneTendency(
  counts: NarrativeLaneCounts,
  laneId: EngineLaneId,
) {
  const next = {
    discovery: counts.discovery,
    architecture: counts.architecture,
    runtime: counts.runtime,
  };
  if (laneId === "discovery" || laneId === "architecture" || laneId === "runtime") {
    next[laneId] += 1;
  }
  return dominantLane(next).count / Math.max(1, next.discovery + next.architecture + next.runtime) >= 0.6;
}

function isSameMission(run: EngineRunRecord, mission: EngineMissionContext) {
  if (mission.missionId && run.mission.missionId) {
    return mission.missionId === run.mission.missionId;
  }
  if (mission.missionId || run.mission.missionId) {
    return false;
  }

  const normalizedObjective = normalizeComparableText(mission.currentObjective);
  const normalizedRunObjective = normalizeComparableText(run.mission.currentObjective);
  if (normalizedObjective && normalizedRunObjective && normalizedObjective === normalizedRunObjective) {
    return true;
  }

  const normalizedMissionMarkdown = normalizeComparableText(mission.activeMissionMarkdown);
  const normalizedRunMissionMarkdown = normalizeComparableText(run.mission.activeMissionMarkdown);
  if (
    normalizedMissionMarkdown
    && normalizedRunMissionMarkdown
    && normalizedMissionMarkdown === normalizedRunMissionMarkdown
  ) {
    return true;
  }

  const missionTokens = missionTopicTokens(mission);
  const runTokens = missionTopicTokens(run.mission);
  const sharedTopics = countTokenOverlap(missionTokens, runTokens);
  const smallerSet = Math.min(missionTokens.length, runTokens.length);
  return sharedTopics >= 4 && sharedTopics >= Math.ceil(smallerSet * 0.6);
}

function topThreadTokens(tokenCounts: Map<string, number>) {
  return [...tokenCounts.entries()]
    .filter(([token]) => !THREAD_GENERIC_TOKENS.has(token))
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([token]) => token)
    .slice(0, 5);
}

function titleCase(input: string) {
  return input
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferThreadName(thread: InternalThread) {
  const topTokens = topThreadTokens(thread.tokenCounts).slice(0, 3);
  if (topTokens.length > 0) {
    return topTokens.map(titleCase).join(" ");
  }
  const latestTitle = thread.runs[thread.runs.length - 1]?.candidate.candidateName ?? thread.threadId;
  return latestTitle;
}

function inferGapCoverage(
  thread: InternalThread,
  _mission: EngineMissionContext,
): NarrativeGapCoverage {
  const matchedGapIds = thread.runs
    .map((run) => run.routingAssessment.matchedGapId)
    .filter((gapId): gapId is string => Boolean(gapId));
  const dominantGapId =
    [...new Set(matchedGapIds)]
      .sort((left, right) =>
        matchedGapIds.filter((entry) => entry === right).length
        - matchedGapIds.filter((entry) => entry === left).length
      )[0]
    ?? null;
  if (!dominantGapId) {
    return {
      dominantGapId: null,
      matchedGapIds: [],
      status: "none",
    };
  }

  const latestRun = thread.runs[thread.runs.length - 1];
  const gapStillOpen = latestRun.openGaps.some((gap) => gap.gapId === dominantGapId);
  const successfulCount = thread.runs.filter(isSuccessfulRun).length;

  return {
    dominantGapId,
    matchedGapIds: [...new Set(matchedGapIds)].slice(0, 4),
    status:
      !gapStillOpen && successfulCount > 0
        ? "closed"
        : successfulCount > 0
          ? "partially_addressed"
          : "emerging",
  };
}

function inferThreadState(input: {
  thread: InternalThread;
  mission: EngineMissionContext;
  generatedAt: string;
  projectedSourceCount?: number;
  projectedGapCoverage?: ReturnType<typeof inferGapCoverage>;
}) {
  const successfulCount = input.thread.runs.filter(isSuccessfulRun).length;
  const gapCoverage = input.projectedGapCoverage ?? inferGapCoverage(input.thread, input.mission);
  const daysSinceLastSeen = daySpan(input.thread.lastSeenAt, input.generatedAt);
  const sourceCount = input.projectedSourceCount ?? input.thread.runs.length;

  if (gapCoverage.status === "closed") {
    return "completed" as const;
  }
  if (daysSinceLastSeen >= 14 && sourceCount >= 2) {
    return "stalled" as const;
  }
  if (sourceCount >= 4 && successfulCount >= 2) {
    return "mature" as const;
  }
  if (sourceCount >= 3) {
    return "developing" as const;
  }
  return "nascent" as const;
}

function inferDemandSignals(input: {
  thread: InternalThread;
  mission: EngineMissionContext;
  state: NarrativeThreadState;
  gapCoverage: ReturnType<typeof inferGapCoverage>;
  generatedAt: string;
  projectedSourceCount?: number;
  projectedLaneCounts?: NarrativeLaneCounts;
}) {
  const signals: NarrativeDemandSignal[] = [];
  const laneCounts = input.projectedLaneCounts ?? input.thread.laneCounts;
  const laneTendency = dominantLane(laneCounts);
  const sourceCount = input.projectedSourceCount ?? input.thread.runs.length;
  const successfulCount = input.thread.runs.filter(isSuccessfulRun).length;
  const stalledCount = input.thread.runs.filter(isStalledRun).length;
  const daysSinceLastSeen = daySpan(input.thread.lastSeenAt, input.generatedAt);

  if (sourceCount >= 3) {
    if (laneTendency.dominantLaneId === "architecture" && laneCounts.runtime === 0) {
      signals.push({
        kind: "lane_validation",
        priority: "high",
        requestedLaneId: "runtime",
        summary:
          `Thread still lacks runtime validation: ${sourceCount} related sources lean Architecture, but none prove repeated runtime value yet.`,
      });
    } else if (laneTendency.dominantLaneId === "runtime" && laneCounts.architecture === 0) {
      signals.push({
        kind: "lane_validation",
        priority: "medium",
        requestedLaneId: "architecture",
        summary:
          `Thread still lacks architecture boundary evidence: ${sourceCount} related sources lean Runtime, but none clarify the reusable workflow boundary yet.`,
      });
    }
  }

  if (sourceCount >= 2 && successfulCount === 0) {
    signals.push({
      kind: "proof_follow_through",
      priority: "high",
      requestedLaneId: laneTendency.dominantLaneId,
      summary:
        "Thread keeps attracting sources but has no successful bounded follow-through yet.",
    });
  } else if (stalledCount > successfulCount && sourceCount >= 3) {
    signals.push({
      kind: "proof_follow_through",
      priority: "medium",
      requestedLaneId: laneTendency.dominantLaneId,
      summary:
        `Thread follow-through is uneven: ${successfulCount} successful runs versus ${stalledCount} stalled/pending runs.`,
    });
  }

  if (input.gapCoverage.status === "partially_addressed" && input.gapCoverage.dominantGapId) {
    signals.push({
      kind: "gap_closure",
      priority: "medium",
      requestedLaneId: laneTendency.dominantLaneId,
      summary:
        `Thread keeps touching ${input.gapCoverage.dominantGapId}, but the gap still appears open in recent runs.`,
    });
  }

  if (input.state !== "completed" && daysSinceLastSeen >= 10) {
    signals.push({
      kind: "fresh_evidence",
      priority: daysSinceLastSeen >= 14 ? "high" : "low",
      requestedLaneId: laneTendency.dominantLaneId,
      summary:
        `Thread is cooling off: no new source has landed in ${daysSinceLastSeen} days.`,
    });
  }

  return signals.slice(0, 4);
}

function deriveBiasAdjustment(input: {
  thread: InternalThread;
  state: NarrativeThreadState;
  provisionalLaneId: EngineLaneId;
  currentSourceOverlap: number;
}) {
  const laneTendency = dominantLane(input.thread.laneCounts);
  if (input.thread.runs.length < 2 || laneTendency.dominancePercent < 60) {
    return 0;
  }

  let adjustment =
    laneTendency.dominancePercent >= 80
      ? 3
      : laneTendency.dominancePercent >= 70
        ? 2
        : 1;

  if (input.currentSourceOverlap >= 5) {
    adjustment += 1;
  }
  if (input.state === "stalled") {
    adjustment -= 1;
  }
  if (input.state === "completed") {
    adjustment += 1;
  }
  if (laneTendency.dominantLaneId !== input.provisionalLaneId) {
    adjustment = Math.min(adjustment, 1);
  }

  return Math.max(0, Math.min(4, adjustment));
}

function projectGapCoverage(input: {
  thread: InternalThread;
  mission: EngineMissionContext;
  currentMatchedGapId: string | null;
}): NarrativeGapCoverage {
  const base = inferGapCoverage(input.thread, input.mission);
  if (!input.currentMatchedGapId) {
    return base;
  }

  const matchedGapIds = uniqueTokens([
    ...base.matchedGapIds,
    input.currentMatchedGapId,
  ]);
  const successfulCount = input.thread.runs.filter(isSuccessfulRun).length;

  return {
    dominantGapId: base.dominantGapId ?? input.currentMatchedGapId,
    matchedGapIds: matchedGapIds.slice(0, 4),
    status:
      base.status === "none"
        ? successfulCount > 0
          ? "partially_addressed"
          : "emerging"
        : base.status,
  };
}

function addThreadTokensToIndex(input: {
  thread: InternalThread;
  tokens: string[];
  tokenIndex: ThreadTokenIndex;
}) {
  for (const token of input.tokens) {
    const bucket = input.tokenIndex.get(token) ?? new Set<InternalThread>();
    bucket.add(input.thread);
    input.tokenIndex.set(token, bucket);
  }
}

function collectThreadCandidates(input: {
  tokenIndex: ThreadTokenIndex;
  runTokens: string[];
}) {
  const candidates = new Set<InternalThread>();
  for (const token of input.runTokens) {
    const bucket = input.tokenIndex.get(token);
    if (!bucket) {
      continue;
    }
    for (const thread of bucket) {
      candidates.add(thread);
    }
  }
  return [...candidates];
}

export function buildSourceNarrativeThreads(input: {
  runs: EngineRunRecord[];
  mission: EngineMissionContext;
}) {
  const threads: InternalThread[] = [];
  const tokenIndex: ThreadTokenIndex = new Map();
  const relevantRuns = [...input.runs]
    .filter((run) => isSameMission(run, input.mission))
    .sort((left, right) => parseTimestamp(left.receivedAt) - parseTimestamp(right.receivedAt));

  for (const run of relevantRuns) {
    const laneId = run.selectedLane.laneId;
    const runTokens = uniqueTokens(extractSourceSignalTokens(flattenRunNarrativeText(run)));
    const candidateThreads = collectThreadCandidates({
      tokenIndex,
      runTokens,
    });
    const candidate = candidateThreads
      .map((thread) => ({
        thread,
        overlap: countTokenOverlap(runTokens, thread.tokenCounts.keys()),
        hoursGap: hoursBetween(thread.lastSeenAt, run.receivedAt),
      }))
      .filter((entry) => entry.overlap >= 3)
      .filter((entry) => entry.hoursGap <= 14 * 24)
      .filter((entry) => preservesLaneTendency(entry.thread.laneCounts, laneId))
      .sort((left, right) => {
        if (right.overlap !== left.overlap) {
          return right.overlap - left.overlap;
        }
        if (left.hoursGap !== right.hoursGap) {
          return left.hoursGap - right.hoursGap;
        }
        return left.thread.threadOrder - right.thread.threadOrder;
      })[0];

    if (!candidate) {
      const laneCounts = zeroLaneCounts();
      if (laneId === "discovery" || laneId === "architecture" || laneId === "runtime") {
        laneCounts[laneId] = 1;
      }
      const thread: InternalThread = {
        threadId: `thread-${threads.length + 1}`,
        threadOrder: threads.length,
        runs: [run],
        tokenCounts: new Map(runTokens.map((token) => [token, 1])),
        laneCounts,
        firstSeenAt: run.receivedAt,
        lastSeenAt: run.receivedAt,
      };
      threads.push(thread);
      addThreadTokensToIndex({
        thread,
        tokens: runTokens,
        tokenIndex,
      });
      continue;
    }

    candidate.thread.runs.push(run);
    if (laneId === "discovery" || laneId === "architecture" || laneId === "runtime") {
      candidate.thread.laneCounts[laneId] += 1;
    }
    for (const token of runTokens) {
      const nextCount = (candidate.thread.tokenCounts.get(token) ?? 0) + 1;
      candidate.thread.tokenCounts.set(token, nextCount);
      if (nextCount === 1) {
        addThreadTokensToIndex({
          thread: candidate.thread,
          tokens: [token],
          tokenIndex,
        });
      }
    }
    candidate.thread.lastSeenAt = run.receivedAt;
  }

  return {
    threads,
  } satisfies SourceNarrativeThreadBuild;
}

function summarizeThread(input: {
  thread: InternalThread;
  name: string;
  state: NarrativeThreadState;
  laneTendency: ReturnType<typeof dominantLane>;
  gapCoverage: ReturnType<typeof inferGapCoverage>;
  followThroughRate: number;
  projectedSourceCount?: number;
  projectedLastSeenAt?: string;
}) {
  const gapLine = input.gapCoverage.dominantGapId
    ? `gap ${input.gapCoverage.dominantGapId} is ${input.gapCoverage.status.replace(/_/g, " ")}`
    : "no stable gap anchor yet";
  const sourceCount = input.projectedSourceCount ?? input.thread.runs.length;
  const lastSeenAt = input.projectedLastSeenAt ?? input.thread.lastSeenAt;
  return `${input.name} is ${input.state} with ${sourceCount} sources over ${daySpan(input.thread.firstSeenAt, lastSeenAt)} days; ${input.laneTendency.dominantLaneId} leads ${input.laneTendency.dominancePercent}% of the thread and follow-through is ${input.followThroughRate}%. ${gapLine}.`;
}

export function deriveSourceNarrativeContext(input: {
  source: EngineSourceItem;
  sourceText: string;
  mission: EngineMissionContext;
  existingRuns: EngineRunRecord[];
  provisionalLaneId: EngineLaneId;
  currentMatchedGapId?: string | null;
  receivedAt?: string | null;
  prebuiltThreads?: SourceNarrativeThreadBuild | null;
}) {
  if ((input.existingRuns ?? []).length === 0) {
    return null;
  }

  const generatedAt = String(input.receivedAt ?? new Date().toISOString());
  const threads = input.prebuiltThreads ?? buildSourceNarrativeThreads({
    runs: input.existingRuns,
    mission: input.mission,
  });
  if (threads.threads.length === 0) {
    return null;
  }

  const sourceTokens = uniqueTokens(extractSourceSignalTokens(input.sourceText));
  const relatedThreads = threads.threads
    .flatMap((thread) => {
      const currentSourceOverlap = countTokenOverlap(
        sourceTokens,
        thread.tokenCounts.keys(),
      );
      const hoursGap = hoursBetween(thread.lastSeenAt, generatedAt);
      if (currentSourceOverlap < 3 || hoursGap < 0 || hoursGap > 14 * 24) {
        return [];
      }

      const projectedLaneCounts = {
        discovery: thread.laneCounts.discovery,
        architecture: thread.laneCounts.architecture,
        runtime: thread.laneCounts.runtime,
      };
      if (
        input.provisionalLaneId === "discovery"
        || input.provisionalLaneId === "architecture"
        || input.provisionalLaneId === "runtime"
      ) {
        projectedLaneCounts[input.provisionalLaneId] += 1;
      }
      const projectedSourceCount = thread.runs.length + 1;
      const projectedLastSeenAt =
        parseTimestamp(generatedAt) > parseTimestamp(thread.lastSeenAt)
          ? generatedAt
          : thread.lastSeenAt;
      const laneTendency = dominantLane(projectedLaneCounts);
      const gapCoverage = projectGapCoverage({
        thread,
        mission: input.mission,
        currentMatchedGapId: input.currentMatchedGapId ?? input.source.capabilityGapId ?? null,
      });
      const state = inferThreadState({
        thread,
        mission: input.mission,
        generatedAt,
        projectedSourceCount,
        projectedGapCoverage: gapCoverage,
      });
      const completedProofCount = thread.runs.filter(isSuccessfulRun).length;
      const stalledProofCount = thread.runs.filter(isStalledRun).length;
      const followThroughRate = Math.round(
        (completedProofCount / Math.max(1, projectedSourceCount)) * 100,
      );
      const biasAdjustment = deriveBiasAdjustment({
        thread,
        state,
        provisionalLaneId: input.provisionalLaneId,
        currentSourceOverlap,
      });
      const name = inferThreadName(thread);
      const demandSignals = inferDemandSignals({
        thread,
        mission: input.mission,
        state,
        gapCoverage,
        generatedAt,
        projectedSourceCount,
        projectedLaneCounts,
      });

      return [{
        threadId: thread.threadId,
        name,
        state,
        summary: summarizeThread({
          thread,
          name,
          state,
          laneTendency,
          gapCoverage,
          followThroughRate,
          projectedSourceCount,
          projectedLastSeenAt,
        }),
        sourceCount: projectedSourceCount,
        firstSeenAt: thread.firstSeenAt,
        lastSeenAt: projectedLastSeenAt,
        activeSpanDays: daySpan(thread.firstSeenAt, projectedLastSeenAt),
        currentSourceOverlap,
        topTokens: topThreadTokens(thread.tokenCounts),
        laneTendency: {
          dominantLaneId: laneTendency.dominantLaneId,
          dominancePercent: laneTendency.dominancePercent,
          laneCounts: projectedLaneCounts,
          biasAdjustment,
        },
        gapCoverage,
        followThrough: {
          completedProofCount,
          stalledProofCount,
          followThroughRate,
        },
        demandSignals,
        relatedRunIds: thread.runs.map((run) => run.runId).slice(-5),
      } satisfies SourceNarrativeThread];
    })
    .sort((left, right) => {
      if (right.currentSourceOverlap !== left.currentSourceOverlap) {
        return right.currentSourceOverlap - left.currentSourceOverlap;
      }
      return right.lastSeenAt.localeCompare(left.lastSeenAt);
    })
    .slice(0, 3);

  if (relatedThreads.length === 0) {
    return null;
  }

  const biasAdjustments = zeroLaneCounts();
  for (const thread of relatedThreads.slice(0, 2)) {
    const laneId = thread.laneTendency.dominantLaneId;
    if (laneId === "discovery" || laneId === "architecture" || laneId === "runtime") {
      biasAdjustments[laneId] = Math.min(
        4,
        biasAdjustments[laneId] + thread.laneTendency.biasAdjustment,
      );
    }
  }

  const demandSignals = Array.from(
    new Map(
      relatedThreads
        .flatMap((thread) => thread.demandSignals)
        .map((signal) => [`${signal.kind}:${signal.summary}`, signal] as const),
    ).values(),
  ).slice(0, 4);
  const primaryThread = relatedThreads[0] ?? null;

  return {
    summary:
      primaryThread === null
        ? "Narrative Threading found no active thread for this source."
        : `Narrative Threading links this source to "${primaryThread.name}" (${primaryThread.state}, ${primaryThread.sourceCount} related sources).`,
    primaryThread,
    relatedThreads,
    biasAdjustments,
    demandSignals,
    rationale: [
      primaryThread
        ? `Primary thread "${primaryThread.name}" contributes a ${primaryThread.laneTendency.dominantLaneId} bias of +${primaryThread.laneTendency.biasAdjustment} with ${primaryThread.currentSourceOverlap} shared thread tokens.`
        : "Narrative Threading found no primary thread.",
      ...demandSignals.map((signal) => `Thread demand (${signal.priority}): ${signal.summary}`),
    ],
  } satisfies SourceNarrativeContext;
}

export function deriveNarrativeActions(input: {
  narrativeContext: SourceNarrativeContext;
  openGaps: EngineCapabilityGap[];
  currentRecord?: EngineRunRecord | null;
}) {
  if (!input.narrativeContext) {
    return null;
  }

  const nextPendingProofItem = [
    input.currentRecord?.structuredProofPlan?.objective,
    ...(input.currentRecord?.structuredProofPlan?.requiredEvidence ?? []),
    ...(input.currentRecord?.structuredProofPlan?.requiredGates ?? []),
    input.currentRecord?.structuredProofPlan?.rollbackPrompt,
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .find((item) => item.status !== "completed" && item.status !== "skipped");

  const actions = input.narrativeContext.relatedThreads
    .flatMap((thread) =>
      thread.demandSignals.map((signal) => {
        switch (signal.kind) {
          case "fresh_evidence":
            return {
              actionKind: "re_engagement_prompt",
              threadId: thread.threadId,
              threadName: thread.name,
              priority: signal.priority,
              summary: signal.summary,
              suggestedNextStep:
                `Bring one new ${signal.requestedLaneId ?? thread.laneTendency.dominantLaneId} source into "${thread.name}" so the thread does not stall without fresh evidence.`,
              targetLaneId: signal.requestedLaneId ?? thread.laneTendency.dominantLaneId,
              relatedGapId: thread.gapCoverage.dominantGapId,
            } satisfies NarrativeAction;
          case "gap_closure": {
            const gapStillOpen = thread.gapCoverage.dominantGapId
              ? input.openGaps.some((gap) => gap.gapId === thread.gapCoverage.dominantGapId)
              : false;
            return {
              actionKind: gapStillOpen
                ? "proof_follow_up_request"
                : "gap_creation_request",
              threadId: thread.threadId,
              threadName: thread.name,
              priority: signal.priority,
              summary: signal.summary,
              suggestedNextStep: gapStillOpen
                ? nextPendingProofItem
                  ? `Complete proof item "${nextPendingProofItem.value}" to move ${thread.gapCoverage.dominantGapId} out of partially-addressed status.`
                  : `Collect the missing proof or closure evidence needed to move ${thread.gapCoverage.dominantGapId} out of partially-addressed status.`
                : `Open a capability gap for "${thread.name}" so repeated thread pressure stops depending on operator memory.`,
              targetLaneId: signal.requestedLaneId ?? thread.laneTendency.dominantLaneId,
              relatedGapId: thread.gapCoverage.dominantGapId,
            } satisfies NarrativeAction;
          }
          case "proof_follow_through":
            return {
              actionKind: "proof_follow_up_request",
              threadId: thread.threadId,
              threadName: thread.name,
              priority: signal.priority,
              summary: signal.summary,
              suggestedNextStep:
                nextPendingProofItem
                  ? `Advance proof item "${nextPendingProofItem.value}" so "${thread.name}" gains real follow-through instead of collecting more similar sources.`
                  : `Push one bounded proof step through "${thread.name}" so the thread gains real follow-through instead of collecting more similar sources.`,
              targetLaneId: signal.requestedLaneId ?? thread.laneTendency.dominantLaneId,
              relatedGapId: thread.gapCoverage.dominantGapId,
            } satisfies NarrativeAction;
          case "lane_validation":
            return {
              actionKind: "lane_validation_request",
              threadId: thread.threadId,
              threadName: thread.name,
              priority: signal.priority,
              summary: signal.summary,
              suggestedNextStep:
                `Find one bounded ${signal.requestedLaneId ?? "cross-lane"} source that validates the missing ownership evidence for "${thread.name}".`,
              targetLaneId: signal.requestedLaneId,
              relatedGapId: thread.gapCoverage.dominantGapId,
            } satisfies NarrativeAction;
        }
      })
    )
    .sort((left, right) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
      if (priorityOrder[left.priority] !== priorityOrder[right.priority]) {
        return priorityOrder[left.priority] - priorityOrder[right.priority];
      }
      return left.threadName.localeCompare(right.threadName);
    });

  if (actions.length === 0) {
    return null;
  }

  return Array.from(
    new Map(
      actions.map((action) => [`${action.threadId}:${action.actionKind}:${action.summary}`, action] as const),
    ).values(),
  ).slice(0, 4);
}
