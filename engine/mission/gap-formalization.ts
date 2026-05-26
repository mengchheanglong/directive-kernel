import fs from "node:fs";
import path from "node:path";

import { normalizeText } from "../source-utils.ts";
import type { GapRadarReport, GapRadarSuggestion } from "../routing/gap-radar.ts";
import { readJsonOptional, writeJsonAtomic } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { resolveDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

export type FormalizedCapabilityGapRecord = {
  gap_id: string;
  description: string;
  priority: "high" | "medium" | "low";
  related_mission_objective: string;
  current_state: string;
  desired_state: string;
  detected_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  candidate_ids?: string[];
};

export type GapFormalizationRecord = {
  $schema?: string;
  schemaVersion: 1;
  recordKind: "gap_formalization";
  formalizationId: string;
  status: "pending_approval" | "approved" | "written" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  radarSuggestionId: string;
  radarConfidence: "low" | "medium" | "high";
  radarSummary: string;
  radarRecommendedChange: string;
  radarSignalTokens: string[];
  radarEvidenceCount: number;
  operatorRationale: string | null;
  operatorApprovedPriority: "high" | "medium" | "low" | null;
  writtenGapId: string | null;
};

const GAP_FORMALIZATION_ROOT = "engine/gap-formalization";
const GAP_RADAR_PATH = "engine/gap-radar.json";
const CAPABILITY_GAPS_PATH = "discovery/capability-gaps.json";

function resolveDirectiveRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(resolveDirectiveWorkspaceRoot(directiveRoot));
}

function resolveGapFormalizationRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), GAP_FORMALIZATION_ROOT),
  );
}

function resolveGapRadarPath(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), GAP_RADAR_PATH),
  );
}

function resolveCapabilityGapsPath(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), CAPABILITY_GAPS_PATH),
  );
}

function listGapFormalizationPaths(directiveRoot?: string) {
  const root = resolveGapFormalizationRoot(directiveRoot);
  if (!fs.existsSync(root)) {
    return [] as string[];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => normalizeAbsolutePath(path.join(root, entry.name)))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

function sanitizeGapSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildFormalizationId(suggestion: GapRadarSuggestion) {
  return `gap-formalization-${sanitizeGapSegment(suggestion.radarId || suggestion.summary)}`;
}

function buildGapId(record: GapFormalizationRecord) {
  const base =
    sanitizeGapSegment(record.radarSuggestionId.replace(/^gap-radar-/u, ""))
    || sanitizeGapSegment(record.radarSummary)
    || "formalized-gap";
  return `gap-${base}`.slice(0, 96);
}

function resolveGapFormalizationPath(input: {
  directiveRoot?: string;
  record: GapFormalizationRecord;
}) {
  const timestamp = input.record.createdAt.replace(/[:.]/g, "-");
  return normalizeAbsolutePath(
    path.join(
      resolveGapFormalizationRoot(input.directiveRoot),
      `${timestamp}-${input.record.formalizationId}.json`,
    ),
  );
}

function readCapabilityGaps(directiveRoot?: string) {
  return readJsonOptional<{ gaps?: FormalizedCapabilityGapRecord[] }>(
    resolveCapabilityGapsPath(directiveRoot),
  )?.gaps ?? [];
}

function writeCapabilityGaps(input: {
  directiveRoot?: string;
  gaps: FormalizedCapabilityGapRecord[];
}) {
  writeJsonAtomic(resolveCapabilityGapsPath(input.directiveRoot), {
    gaps: input.gaps,
  });
}

function readGapRadarReport(directiveRoot?: string) {
  return readJsonOptional<GapRadarReport>(resolveGapRadarPath(directiveRoot));
}

function writeGapFormalizationRecordInternal(input: {
  directiveRoot?: string;
  record: GapFormalizationRecord;
}) {
  const recordPath = resolveGapFormalizationPath(input);
  writeJsonAtomic(recordPath, input.record);
  return recordPath;
}

export function listGapFormalizationRecords(input?: {
  directiveRoot?: string;
}) {
  return listGapFormalizationPaths(input?.directiveRoot)
    .map((filePath) => readJsonOptional<GapFormalizationRecord>(filePath))
    .filter((entry): entry is GapFormalizationRecord => Boolean(entry))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function writeGapFormalizationRecord(input: {
  directiveRoot?: string;
  record: GapFormalizationRecord;
}) {
  return writeGapFormalizationRecordInternal(input);
}

export function generateGapFormalizationCandidates(input: {
  directiveRoot?: string;
  radarReport?: GapRadarReport | null;
  existingGaps?: FormalizedCapabilityGapRecord[];
}) {
  const radarReport = input.radarReport ?? readGapRadarReport(input.directiveRoot);
  if (!radarReport) {
    return [] as GapFormalizationRecord[];
  }

  const existingGaps = input.existingGaps ?? readCapabilityGaps(input.directiveRoot);
  const existingRecords = listGapFormalizationRecords({
    directiveRoot: input.directiveRoot,
  });
  const coveredSuggestionIds = new Set(existingRecords.map((record) => record.radarSuggestionId));
  const unresolvedGapIds = new Set(
    existingGaps.filter((gap) => !gap.resolved_at).map((gap) => gap.gap_id),
  );

  return radarReport.suggestions
    .filter((suggestion) => suggestion.confidence === "high" || suggestion.confidence === "medium")
    .filter((suggestion) => !suggestion.relatedOpenGapId || !unresolvedGapIds.has(suggestion.relatedOpenGapId))
    .filter((suggestion) => !coveredSuggestionIds.has(suggestion.radarId))
    .map((suggestion) => ({
      schemaVersion: 1,
      recordKind: "gap_formalization",
      formalizationId: buildFormalizationId(suggestion),
      status: "pending_approval",
      createdAt: radarReport.generatedAt,
      resolvedAt: null,
      radarSuggestionId: suggestion.radarId,
      radarConfidence: suggestion.confidence,
      radarSummary: suggestion.summary,
      radarRecommendedChange: suggestion.recommendedChange,
      radarSignalTokens: [...suggestion.signalTokens],
      radarEvidenceCount: suggestion.evidenceCount,
      operatorRationale: null,
      operatorApprovedPriority: null,
      writtenGapId: null,
    } satisfies GapFormalizationRecord))
    .sort((left, right) => {
      if (right.radarEvidenceCount !== left.radarEvidenceCount) {
        return right.radarEvidenceCount - left.radarEvidenceCount;
      }
      return left.radarSummary.localeCompare(right.radarSummary);
    });
}

export function listPendingGapFormalizationCandidates(input?: {
  directiveRoot?: string;
}) {
  return generateGapFormalizationCandidates({
    directiveRoot: input?.directiveRoot,
  });
}

function resolveFormalizationRecord(input: {
  directiveRoot?: string;
  formalizationId: string;
}) {
  const formalizationId = normalizeText(input.formalizationId);
  const existingRecord = listGapFormalizationRecords({
    directiveRoot: input.directiveRoot,
  }).find((record) => record.formalizationId === formalizationId);
  if (existingRecord) {
    return existingRecord;
  }
  return listPendingGapFormalizationCandidates({
    directiveRoot: input.directiveRoot,
  }).find((record) => record.formalizationId === formalizationId) ?? null;
}

function buildCapabilityGapFromFormalization(input: {
  record: GapFormalizationRecord;
  priority: "high" | "medium" | "low";
}) {
  const tokenSummary = input.record.radarSignalTokens.slice(0, 3).join(", ");
  return {
    gap_id: buildGapId(input.record),
    description: input.record.radarSummary,
    priority: input.priority,
    related_mission_objective:
      tokenSummary
        ? `Formalized from repeated signal pressure around ${tokenSummary}.`
        : "Formalized from repeated gap-radar pressure.",
    current_state:
      `Similar reviewed cases keep depending on ad hoc routing judgment around ${tokenSummary || "this cluster"}.`,
    desired_state:
      "A formal capability gap exists so similar cases can route against an explicit tracked objective.",
    detected_at: input.record.createdAt,
    resolved_at: null,
    resolution_notes:
      normalizeText(input.record.radarRecommendedChange)
      || "Formalized from gap radar.",
  } satisfies FormalizedCapabilityGapRecord;
}

export function approveGapFormalization(input: {
  directiveRoot?: string;
  formalizationId: string;
  operatorRationale: string;
  operatorApprovedPriority: "high" | "medium" | "low";
}) {
  const currentRecord = resolveFormalizationRecord(input);
  if (!currentRecord) {
    throw new Error(`not_found: gap formalization ${input.formalizationId} does not exist`);
  }
  if (currentRecord.status === "written") {
    const writtenGap = readCapabilityGaps(input.directiveRoot).find((gap) =>
      gap.gap_id === currentRecord.writtenGapId
    );
    return {
      formalizationRecord: currentRecord,
      newGap: writtenGap ?? null,
    };
  }

  const newGap = buildCapabilityGapFromFormalization({
    record: currentRecord,
    priority: input.operatorApprovedPriority,
  });
  const gaps = readCapabilityGaps(input.directiveRoot);
  if (!gaps.some((gap) => gap.gap_id === newGap.gap_id)) {
    gaps.push(newGap);
    writeCapabilityGaps({
      directiveRoot: input.directiveRoot,
      gaps,
    });
  }

  const updatedRecord = {
    ...currentRecord,
    status: "written",
    resolvedAt: new Date().toISOString(),
    operatorRationale: normalizeText(input.operatorRationale) || "Gap formalization approved.",
    operatorApprovedPriority: input.operatorApprovedPriority,
    writtenGapId: newGap.gap_id,
  } satisfies GapFormalizationRecord;
  writeGapFormalizationRecordInternal({
    directiveRoot: input.directiveRoot,
    record: updatedRecord,
  });

  return {
    formalizationRecord: updatedRecord,
    newGap,
  };
}

export function rejectGapFormalization(input: {
  directiveRoot?: string;
  formalizationId: string;
  operatorRationale: string;
}) {
  const currentRecord = resolveFormalizationRecord(input);
  if (!currentRecord) {
    throw new Error(`not_found: gap formalization ${input.formalizationId} does not exist`);
  }
  const updatedRecord = {
    ...currentRecord,
    status: "rejected",
    resolvedAt: new Date().toISOString(),
    operatorRationale: normalizeText(input.operatorRationale) || "Gap formalization rejected.",
    operatorApprovedPriority: null,
    writtenGapId: null,
  } satisfies GapFormalizationRecord;
  writeGapFormalizationRecordInternal({
    directiveRoot: input.directiveRoot,
    record: updatedRecord,
  });
  return updatedRecord;
}
