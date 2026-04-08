import fs from "node:fs";
import path from "node:path";

import type { DiscoveryIntakeQueueEntry } from "../../discovery/lib/discovery-intake-queue-writer.ts";
import {
  type DirectiveEngineRunArtifact,
  type StoredDirectiveEngineRunRecord,
} from "./engine-run-artifacts.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

export type RunEvidenceDistribution = {
  label: string;
  count: number;
  percentage: number;
};

export type RunEvidenceTemporalBucket = {
  period: string;
  runCount: number;
  laneBreakdown: Record<string, number>;
};

export type RunEvidenceLifecycleSummary = {
  totalQueueEntries: number;
  withReceivedAt: number;
  withRoutedAt: number;
  withCompletedAt: number;
  medianDaysReceivedToRouted: number | null;
  medianDaysRoutedToCompleted: number | null;
};

export type RunEvidencePriorityStats = {
  min: number;
  max: number;
  mean: number;
  median: number;
  count: number;
};

export type ManualRuntimePromotionCycle = {
  candidateId: string;
  promotionDate: string | null;
  targetHost: string | null;
  promotionRecordPath: string;
  qualityGateResult: string | null;
  validationState: string | null;
  promotionProfileFamily: string | null;
  proposedRuntimeStatus: string | null;
};

export type RunEvidenceManualRuntimePromotionSummary = {
  totalPromotionRecords: number;
  totalManualPromotionRecords: number;
  validatedLocallyCount: number;
  latestPromotionRecordPath: string | null;
  latestCandidateId: string | null;
  cycles: ManualRuntimePromotionCycle[];
};

export type RunEvidenceAggregation = {
  ok: boolean;
  checkerId: string;
  snapshotAt: string;
  totalRuns: number;
  laneDistribution: RunEvidenceDistribution[];
  usefulnessDistribution: RunEvidenceDistribution[];
  sourceTypeDistribution: RunEvidenceDistribution[];
  confidenceDistribution: RunEvidenceDistribution[];
  decisionDistribution: RunEvidenceDistribution[];
  integrationModeDistribution: RunEvidenceDistribution[];
  temporalTrend: RunEvidenceTemporalBucket[];
  lifecycleSummary: RunEvidenceLifecycleSummary;
  priorityScoreStats: RunEvidencePriorityStats | null;
  manualRuntimePromotionCycles: RunEvidenceManualRuntimePromotionSummary;
};

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function isRecordLike(value: unknown): value is StoredDirectiveEngineRunRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const candidate = record.candidate as Record<string, unknown> | undefined;
  const analysis = record.analysis as Record<string, unknown> | undefined;
  const decision = record.decision as Record<string, unknown> | undefined;
  const reportPlan = record.reportPlan as Record<string, unknown> | undefined;
  return (
    typeof record.runId === "string"
    && typeof record.receivedAt === "string"
    && typeof candidate?.candidateId === "string"
    && typeof candidate?.usefulnessLevel === "string"
    && typeof analysis?.usefulnessRationale === "string"
    && typeof decision?.decisionState === "string"
    && typeof reportPlan?.summary === "string"
  );
}

function toDistribution(
  counts: Map<string, number>,
  total: number,
): RunEvidenceDistribution[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  }
  return sorted[mid]!;
}

function daysBetween(from: string, to: string): number | null {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return null;
  return (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
}

function toPeriod(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "unknown";
  return dateStr.slice(0, 10);
}

function readAllRunRecords(engineRunsRoot: string): DirectiveEngineRunArtifact[] {
  if (!fs.existsSync(engineRunsRoot)) return [];

  return fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce<DirectiveEngineRunArtifact[]>((acc, entry) => {
      const recordPath = normalizeAbsolutePath(path.join(engineRunsRoot, entry.name));
      const parsed = readJson(recordPath);
      if (isRecordLike(parsed)) {
        acc.push({
          recordPath,
          reportPath: null,
          reportExcerpt: null,
          record: parsed,
        });
      }
      return acc;
    }, []);
}

function readQueueEntries(directiveRoot: string): DiscoveryIntakeQueueEntry[] {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  const parsed = readJson(queuePath);
  if (!parsed || typeof parsed !== "object") return [];
  const data = parsed as Record<string, unknown>;
  if (!Array.isArray(data.entries)) return [];
  return data.entries as DiscoveryIntakeQueueEntry[];
}

function readMarkdownBullet(content: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^-\\s+${escaped}\\s*:\\s*(.+)$`, "im"));
  return match?.[1]?.replace(/^`|`$/g, "").trim() ?? null;
}

function isManualPromotionRecord(input: {
  sanitizePolicy: string | null;
  promotionDecision: string | null;
  promotionProfileFamily: string | null;
}) {
  const combined = [
    input.sanitizePolicy,
    input.promotionDecision,
    input.promotionProfileFamily,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  return combined.includes("manual");
}

function comparePromotionCycles(
  left: ManualRuntimePromotionCycle,
  right: ManualRuntimePromotionCycle,
) {
  const leftDate = left.promotionDate || "";
  const rightDate = right.promotionDate || "";
  if (leftDate !== rightDate) {
    return rightDate.localeCompare(leftDate);
  }
  return left.promotionRecordPath.localeCompare(right.promotionRecordPath);
}

function readManualRuntimePromotionCycles(
  directiveRoot: string,
): RunEvidenceManualRuntimePromotionSummary {
  const promotionsRoot = path.join(directiveRoot, "runtime", "07-promotion-records");
  if (!fs.existsSync(promotionsRoot)) {
    return {
      totalPromotionRecords: 0,
      totalManualPromotionRecords: 0,
      validatedLocallyCount: 0,
      latestPromotionRecordPath: null,
      latestCandidateId: null,
      cycles: [],
    };
  }

  const files = fs
    .readdirSync(promotionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cycles: ManualRuntimePromotionCycle[] = [];

  for (const file of files) {
    const absolutePath = path.join(promotionsRoot, file.name);
    const relativePath = path.relative(directiveRoot, absolutePath).replace(/\\/g, "/");
    const content = fs.readFileSync(absolutePath, "utf8");
    const sanitizePolicy = readMarkdownBullet(content, "Sanitize policy");
    const promotionDecision = readMarkdownBullet(content, "Promotion decision");
    const promotionProfileFamily = readMarkdownBullet(content, "Promotion profile family");
    if (
      !isManualPromotionRecord({
        sanitizePolicy,
        promotionDecision,
        promotionProfileFamily,
      })
    ) {
      continue;
    }

    const candidateId = readMarkdownBullet(content, "Candidate id");
    if (!candidateId) {
      continue;
    }

    cycles.push({
      candidateId,
      promotionDate: readMarkdownBullet(content, "Promotion date"),
      targetHost: readMarkdownBullet(content, "Target host"),
      promotionRecordPath: relativePath,
      qualityGateResult: readMarkdownBullet(content, "Quality gate result"),
      validationState: readMarkdownBullet(content, "Validation state"),
      promotionProfileFamily,
      proposedRuntimeStatus: readMarkdownBullet(content, "Proposed runtime status"),
    });
  }

  cycles.sort(comparePromotionCycles);

  return {
    totalPromotionRecords: files.length,
    totalManualPromotionRecords: cycles.length,
    validatedLocallyCount: cycles.filter((cycle) => cycle.validationState === "validated_locally")
      .length,
    latestPromotionRecordPath: cycles[0]?.promotionRecordPath ?? null,
    latestCandidateId: cycles[0]?.candidateId ?? null,
    cycles,
  };
}

export function aggregateRunEvidence(options: {
  directiveRoot?: string;
}): RunEvidenceAggregation {
  const directiveRoot = normalizeAbsolutePath(
    options.directiveRoot || getDefaultDirectiveWorkspaceRoot(),
  );
  const engineRunsRoot = normalizeAbsolutePath(
    path.join(directiveRoot, "runtime", "standalone-host", "engine-runs"),
  );

  const artifacts = readAllRunRecords(engineRunsRoot);
  const queueEntries = readQueueEntries(directiveRoot);
  const total = artifacts.length;

  const laneCounts = new Map<string, number>();
  const usefulnessCounts = new Map<string, number>();
  const sourceTypeCounts = new Map<string, number>();
  const confidenceCounts = new Map<string, number>();
  const decisionCounts = new Map<string, number>();
  const integrationModeCounts = new Map<string, number>();
  const periodBuckets = new Map<string, { runCount: number; laneBreakdown: Map<string, number> }>();
  const priorityScores: number[] = [];

  for (const artifact of artifacts) {
    const record = artifact.record;
    const laneId = record.selectedLane?.laneId || record.candidate.recommendedLaneId || "unknown";
    const usefulness = record.candidate.usefulnessLevel || "unknown";
    const sourceType = record.source?.sourceType || "unknown";
    const confidence = record.candidate.confidence || "unknown";
    const decisionState = record.decision.decisionState || "unknown";
    const integrationMode = (record.integrationProposal as Record<string, unknown>)?.integrationMode as string || "unknown";
    const period = toPeriod(record.receivedAt);

    laneCounts.set(laneId, (laneCounts.get(laneId) || 0) + 1);
    usefulnessCounts.set(usefulness, (usefulnessCounts.get(usefulness) || 0) + 1);
    sourceTypeCounts.set(sourceType, (sourceTypeCounts.get(sourceType) || 0) + 1);
    confidenceCounts.set(confidence, (confidenceCounts.get(confidence) || 0) + 1);
    decisionCounts.set(decisionState, (decisionCounts.get(decisionState) || 0) + 1);
    integrationModeCounts.set(integrationMode, (integrationModeCounts.get(integrationMode) || 0) + 1);

    if (!periodBuckets.has(period)) {
      periodBuckets.set(period, { runCount: 0, laneBreakdown: new Map() });
    }
    const bucket = periodBuckets.get(period)!;
    bucket.runCount += 1;
    bucket.laneBreakdown.set(laneId, (bucket.laneBreakdown.get(laneId) || 0) + 1);

    const candidateRecord = record.candidate as Record<string, unknown>;
    if (typeof candidateRecord.missionPriorityScore === "number") {
      priorityScores.push(candidateRecord.missionPriorityScore);
    }
  }

  const temporalTrend: RunEvidenceTemporalBucket[] = [...periodBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, bucket]) => ({
      period,
      runCount: bucket.runCount,
      laneBreakdown: Object.fromEntries(bucket.laneBreakdown),
    }));

  const receivedToRouted: number[] = [];
  const routedToCompleted: number[] = [];
  let withReceivedAt = 0;
  let withRoutedAt = 0;
  let withCompletedAt = 0;

  for (const entry of queueEntries) {
    if (entry.received_at) withReceivedAt += 1;
    if (entry.routed_at) withRoutedAt += 1;
    if (entry.completed_at) withCompletedAt += 1;

    if (entry.received_at && entry.routed_at) {
      const days = daysBetween(entry.received_at, entry.routed_at);
      if (days !== null) receivedToRouted.push(days);
    }
    if (entry.routed_at && entry.completed_at) {
      const days = daysBetween(entry.routed_at, entry.completed_at);
      if (days !== null) routedToCompleted.push(days);
    }
  }

  const lifecycleSummary: RunEvidenceLifecycleSummary = {
    totalQueueEntries: queueEntries.length,
    withReceivedAt,
    withRoutedAt,
    withCompletedAt,
    medianDaysReceivedToRouted: median(receivedToRouted),
    medianDaysRoutedToCompleted: median(routedToCompleted),
  };

  let priorityScoreStats: RunEvidencePriorityStats | null = null;
  if (priorityScores.length > 0) {
    const sorted = [...priorityScores].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    priorityScoreStats = {
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      mean: Math.round((sum / sorted.length) * 10) / 10,
      median: median(sorted)!,
      count: sorted.length,
    };
  }

  const manualRuntimePromotionCycles = readManualRuntimePromotionCycles(directiveRoot);

  return {
    ok: true,
    checkerId: "run-evidence-aggregation",
    snapshotAt: new Date().toISOString(),
    totalRuns: total,
    laneDistribution: toDistribution(laneCounts, total),
    usefulnessDistribution: toDistribution(usefulnessCounts, total),
    sourceTypeDistribution: toDistribution(sourceTypeCounts, total),
    confidenceDistribution: toDistribution(confidenceCounts, total),
    decisionDistribution: toDistribution(decisionCounts, total),
    integrationModeDistribution: toDistribution(integrationModeCounts, total),
    temporalTrend,
    lifecycleSummary,
    priorityScoreStats,
    manualRuntimePromotionCycles,
  };
}
