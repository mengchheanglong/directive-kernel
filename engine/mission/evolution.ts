import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { assessEngineRouting } from "../routing/assessment.ts";
import {
  createDefaultDirectiveMission,
} from "./default-mission.ts";
import {
  normalizeText,
} from "../source-utils.ts";
import {
  readDirectiveGoalEnvelope,
  renderDirectiveGoalTemplate,
} from "../../shared/lib/goal.ts";
import {
  readUtf8,
  readJsonOptional,
  writeJsonAtomic,
  writeUtf8,
} from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { resolveDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "../routing/correction-ledger.ts";
import type {
  EngineMissionContext,
  EngineMissionInput,
  EngineMissionPreviewChange,
  EngineRoutingConfidence,
  EngineRunRecord,
} from "../types.ts";

export const MISSION_EVOLUTION_RECORD_SCHEMA_REF =
  "shared/schemas/mission-evolution-record.schema.json" as const;
export const MISSION_EVOLUTION_RECORD_KIND = "mission_evolution" as const;
export const MISSION_EVOLUTION_RECORD_SCHEMA_VERSION = 1 as const;

export type MissionEvolutionTriggerKind =
  | "health_degradation"
  | "gap_pressure"
  | "operator_initiated"
  | "revert";

export type MissionEvolutionCascadeScope =
  | "none"
  | "low_confidence"
  | "conflicted"
  | "discovery_held";

export type MissionEvolutionRecord = {
  $schema?: typeof MISSION_EVOLUTION_RECORD_SCHEMA_REF;
  schemaVersion: typeof MISSION_EVOLUTION_RECORD_SCHEMA_VERSION;
  recordKind: typeof MISSION_EVOLUTION_RECORD_KIND;
  evolutionId: string;
  version: number;
  status: "active" | "superseded" | "reverted";
  createdAt: string;
  operatorRationale: string;
  previousEvolutionId: string | null;
  revertedFromEvolutionId?: string | null;
  missionSnapshot: EngineMissionContext;
  appliedDelta: EngineMissionPreviewChange;
  trigger: {
    kind: MissionEvolutionTriggerKind;
    healthGradeAtTrigger?: string;
    radarSuggestionIds?: string[];
    sourceRunIds?: string[];
  };
  previewSnapshot: {
    affectedRunCount: number;
    rerouteCandidateCount: number;
    confidenceDeltaSummary: string;
  } | null;
  cascade: {
    approved: boolean;
    scope: MissionEvolutionCascadeScope;
    affectedRunIds: string[];
  };
};

export type MissionChangePreview = {
  previewId: string;
  generatedAt: string;
  currentMission: EngineMissionContext;
  proposedMission: EngineMissionContext;
  affectedRuns: Array<{
    runId: string;
    currentLane: string;
    currentConfidence: EngineRoutingConfidence;
    projectedLane: string;
    projectedConfidence: EngineRoutingConfidence;
    confidenceDelta: "improved" | "unchanged" | "degraded";
    eligibilityKind: Exclude<MissionEvolutionCascadeScope, "none"> | null;
    eligible: boolean;
    reason: string;
  }>;
  summary: {
    totalRunsAnalyzed: number;
    totalAffected: number;
    eligibleForCascade: number;
    improvedCount: number;
    degradedCount: number;
    unchangedCount: number;
  };
};

const ACTIVE_MISSION_RELATIVE_PATH = "knowledge/active-mission.md";
const MISSION_EVOLUTION_RELATIVE_ROOT = "engine/mission-evolution";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSectionBody(markdown: string, heading: string) {
  const pattern = new RegExp(
    `^## ${escapeRegex(heading)}\\r?\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`,
    "m",
  );
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function parseMissionMarkdown(markdown: string) {
  const currentObjective = (
    getSectionBody(markdown, "Current Objective")
    || getSectionBody(markdown, "Goal Statement")
  )
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const usefulnessSignals = getSectionBody(
    markdown,
    "What Usefulness Means Under This Objective",
  )
    .split(/\r?\n/u)
    .map((line) => line.replace(/^- /u, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const capabilityLanes = getSectionBody(markdown, "Capability Lanes That Matter Most")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/u.test(line))
    .map((line) => line.replace(/^\d+\.\s+/u, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const constraints = getSectionBody(markdown, "Constraints")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^- /u, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const successSignal = getSectionBody(markdown, "Success Signal")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line))
    .join(" ");
  const adoptionTarget = getSectionBody(markdown, "Adoption Target")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line))
    .join(" ");

  return {
    currentObjective,
    usefulnessSignals,
    capabilityLanes,
    constraints,
    successSignal,
    adoptionTarget,
  };
}

function buildMissionMarkdown(input: EngineMissionInput) {
  const objective =
    normalizeText(input.currentObjective) || "Mission objective not provided.";
  const usefulnessSignals = (input.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean);
  const capabilityLanes = (input.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean);
  const constraints = (input.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean);
  const successSignal = normalizeText(input.successSignal);
  const adoptionTarget = normalizeText(input.adoptionTarget);

  return [
    "# Active Mission",
    "",
    "## Current Objective",
    "",
    objective,
    "",
    "## Adoption Target",
    "",
    adoptionTarget || "Adoption target not provided.",
    "",
    "## What Usefulness Means Under This Objective",
    "",
    ...(usefulnessSignals.length > 0
      ? usefulnessSignals.map((signal) => `- ${signal}`)
      : ["- Mission usefulness signals not provided."]),
    "",
    "## Capability Lanes That Matter Most",
    "",
    ...(capabilityLanes.length > 0
      ? capabilityLanes.map((lane, index) => `${index + 1}. ${lane}`)
      : ["1. Capability lanes not provided."]),
    "",
    "## Constraints",
    "",
    ...(constraints.length > 0
      ? constraints.map((constraint) => `- ${constraint}`)
      : ["- Constraints not provided."]),
    "",
    "## Success Signal",
    "",
    successSignal || "Success signal not provided.",
  ].join("\n");
}

function normalizeMissionContext(
  mission: EngineMissionInput | EngineMissionContext,
): EngineMissionContext {
  const activeMissionMarkdown =
    normalizeText(mission.activeMissionMarkdown) || buildMissionMarkdown(mission);
  const parsed = parseMissionMarkdown(activeMissionMarkdown);
  const defaultMission = createDefaultDirectiveMission();

  return {
    missionId: normalizeText(mission.missionId) || null,
    currentObjective:
      normalizeText(mission.currentObjective)
      || parsed.currentObjective
      || normalizeText(defaultMission.currentObjective)
      || "Mission objective not provided.",
    usefulnessSignals:
      (mission.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean).length > 0
        ? (mission.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.usefulnessSignals,
    capabilityLanes:
      (mission.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean).length > 0
        ? (mission.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.capabilityLanes,
    constraints:
      (mission.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean).length > 0
        ? (mission.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.constraints,
    successSignal: normalizeText(mission.successSignal) || parsed.successSignal || null,
    adoptionTarget: normalizeText(mission.adoptionTarget) || parsed.adoptionTarget || null,
    activeMissionMarkdown,
  };
}

function normalizeMissionPreviewChange(
  input: EngineMissionPreviewChange,
): EngineMissionPreviewChange {
  return {
    objective:
      input.objective !== undefined
        ? normalizeText(input.objective) || null
        : undefined,
    usefulnessSignals:
      input.usefulnessSignals !== undefined
        ? (input.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : undefined,
    capabilityLanes:
      input.capabilityLanes !== undefined
        ? (input.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : undefined,
    constraints:
      input.constraints !== undefined
        ? (input.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : undefined,
    successSignal:
      input.successSignal !== undefined
        ? normalizeText(input.successSignal) || null
        : undefined,
    adoptionTarget:
      input.adoptionTarget !== undefined
        ? normalizeText(input.adoptionTarget) || null
        : undefined,
  };
}

function confidenceRank(value: EngineRoutingConfidence) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function resolveDirectiveRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(resolveDirectiveWorkspaceRoot(directiveRoot));
}

function resolveActiveMissionPath(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), ACTIVE_MISSION_RELATIVE_PATH),
  );
}

export function resolveMissionEvolutionRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), MISSION_EVOLUTION_RELATIVE_ROOT),
  );
}

function resolveMissionEvolutionPaths(directiveRoot?: string) {
  const root = resolveMissionEvolutionRoot(directiveRoot);
  if (!fs.existsSync(root)) {
    return [] as string[];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => normalizeAbsolutePath(path.join(root, entry.name)))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

export function resolveMissionEvolutionRecordPath(input: {
  directiveRoot?: string;
  record: MissionEvolutionRecord;
}) {
  const timestamp = input.record.createdAt.replace(/[:.]/g, "-");
  const version = String(input.record.version).padStart(4, "0");
  const stem = `${timestamp}-v${version}-${input.record.evolutionId.slice(0, 8).toLowerCase()}`;
  return normalizeAbsolutePath(
    path.join(resolveMissionEvolutionRoot(input.directiveRoot), `${stem}.json`),
  );
}

function readMissionEvolutionRecord(filePath: string) {
  return readJsonOptional<MissionEvolutionRecord>(filePath);
}

function writeMissionArtifacts(input: {
  directiveRoot?: string;
  missionSnapshot: EngineMissionContext;
  operatorRationale: string;
}) {
  const directiveRoot = resolveDirectiveRoot(input.directiveRoot);
  const activeMissionPath = resolveActiveMissionPath(directiveRoot);
  writeUtf8(activeMissionPath, `${input.missionSnapshot.activeMissionMarkdown.trim()}\n`);

  const currentGoal = readDirectiveGoalEnvelope(directiveRoot);
  const whyNow = currentGoal.ok
    ? currentGoal.goal.whyNow
    : `Mission evolution approved: ${normalizeText(input.operatorRationale) || "operator-approved update"}.`;
  const goalId =
    normalizeText(input.missionSnapshot.missionId)
    || (currentGoal.ok ? currentGoal.goal.goalId : "active-mission");
  const directiveGoalMarkdown = renderDirectiveGoalTemplate({
    goalId,
    goalStatement: input.missionSnapshot.currentObjective,
    whyNow,
    adoptionTarget:
      normalizeText(input.missionSnapshot.adoptionTarget)
      || (currentGoal.ok ? currentGoal.goal.adoptionTarget : "architecture"),
    constraints: input.missionSnapshot.constraints,
    successSignal:
      normalizeText(input.missionSnapshot.successSignal)
      || (currentGoal.ok ? currentGoal.goal.successSignal : "Mission outcome is clearer than before."),
  });
  writeUtf8(path.join(directiveRoot, "DIRECTIVE_GOAL.md"), `${directiveGoalMarkdown.trim()}\n`);
}

function updateMissionEvolutionRecordStatus(input: {
  directiveRoot?: string;
  record: MissionEvolutionRecord;
  status: MissionEvolutionRecord["status"];
}) {
  const recordPath = resolveMissionEvolutionRecordPath({
    directiveRoot: input.directiveRoot,
    record: input.record,
  });
  writeJsonAtomic(recordPath, {
    ...input.record,
    status: input.status,
  } satisfies MissionEvolutionRecord);
}

function buildMissionContextFromGoal(directiveRoot?: string) {
  const envelope = readDirectiveGoalEnvelope(directiveRoot);
  if (!envelope.ok) {
    return null;
  }
  const normalizedAdoptionTarget = normalizeText(envelope.goal.adoptionTarget).toLowerCase();
  const capabilityLanes =
    normalizedAdoptionTarget === "architecture"
    || normalizedAdoptionTarget === "runtime"
    || normalizedAdoptionTarget === "discovery"
      ? [normalizedAdoptionTarget]
      : ["architecture"];
  return normalizeMissionContext({
    missionId: envelope.goal.goalId,
    currentObjective: envelope.goal.goalStatement,
    usefulnessSignals: [
      `Prefer work that advances ${envelope.goal.goalStatement}.`,
    ],
    capabilityLanes,
    constraints: envelope.goal.constraints,
    successSignal: envelope.goal.successSignal,
    adoptionTarget: envelope.goal.adoptionTarget,
  });
}

export function readCurrentMissionSnapshot(input?: {
  directiveRoot?: string;
  fallbackMission?: EngineMissionInput | EngineMissionContext | null;
}) {
  const activeEvolution = readActiveMissionEvolution({
    directiveRoot: input?.directiveRoot,
  });
  if (activeEvolution) {
    return activeEvolution.missionSnapshot;
  }

  const activeMissionPath = resolveActiveMissionPath(input?.directiveRoot);
  if (fs.existsSync(activeMissionPath)) {
    return normalizeMissionContext({
      activeMissionMarkdown: readUtf8(activeMissionPath),
    });
  }

  const goalMission = buildMissionContextFromGoal(input?.directiveRoot);
  if (goalMission) {
    return goalMission;
  }

  if (input?.fallbackMission) {
    return normalizeMissionContext(input.fallbackMission);
  }

  return null;
}

export function writeMissionEvolutionRecord(input: {
  directiveRoot?: string;
  record: MissionEvolutionRecord;
}) {
  const recordPath = resolveMissionEvolutionRecordPath(input);
  writeJsonAtomic(recordPath, input.record);
  return recordPath;
}

export function listMissionEvolutionHistory(input?: {
  directiveRoot?: string;
}) {
  return resolveMissionEvolutionPaths(input?.directiveRoot)
    .map((filePath) => readMissionEvolutionRecord(filePath))
    .filter((entry): entry is MissionEvolutionRecord => Boolean(entry))
    .sort((left, right) => {
      if (right.version !== left.version) {
        return right.version - left.version;
      }
      return right.createdAt.localeCompare(left.createdAt);
    });
}

export function readActiveMissionEvolution(input?: {
  directiveRoot?: string;
}) {
  return listMissionEvolutionHistory(input).find((record) => record.status === "active") ?? null;
}

function buildConfidenceDeltaSummary(preview: MissionChangePreview) {
  return [
    `${preview.summary.improvedCount} improved`,
    `${preview.summary.unchangedCount} unchanged`,
    `${preview.summary.degradedCount} degraded`,
  ].join(", ");
}

function deriveCascadeEligibilityKind(run: EngineRunRecord) {
  if (run.decision.decisionState === "hold_in_discovery") {
    return "discovery_held" as const;
  }
  if (run.routingAssessment.routeConflict === true) {
    return "conflicted" as const;
  }
  if (run.routingAssessment.confidence !== "high") {
    return "low_confidence" as const;
  }
  return null;
}

export function previewMissionEvolution(input: {
  directiveRoot?: string;
  proposedMission: EngineMissionInput | EngineMissionContext;
  currentMission?: EngineMissionInput | EngineMissionContext | null;
  existingRuns: EngineRunRecord[];
  corrections?: RoutingCorrectionEntry[] | null;
  policyEvents?: DecisionPolicyEvent[] | null;
  receivedAt?: string | null;
}) {
  const currentMission = input.currentMission
    ? normalizeMissionContext(input.currentMission)
    : readCurrentMissionSnapshot({ directiveRoot: input.directiveRoot })
      ?? normalizeMissionContext(createDefaultDirectiveMission());
  const proposedMission = normalizeMissionContext(input.proposedMission);
  const generatedAt = normalizeText(input.receivedAt) || new Date().toISOString();
  const affectedRuns = input.existingRuns
    .map((run) => {
      const projectedAssessment = assessEngineRouting({
        source: run.source,
        mission: proposedMission,
        openGaps: [...run.openGaps],
        corrections: [...(input.corrections ?? [])],
        policyEvents: [...(input.policyEvents ?? [])],
        existingRuns: input.existingRuns.filter((entry) => entry.runId !== run.runId),
        receivedAt: generatedAt,
      });
      const currentRank = confidenceRank(run.routingAssessment.confidence);
      const projectedRank = confidenceRank(projectedAssessment.confidence);
      const confidenceDelta =
        projectedRank > currentRank
          ? "improved"
          : projectedRank < currentRank
            ? "degraded"
            : "unchanged";
      const eligibilityKind = deriveCascadeEligibilityKind(run);
      const eligible = eligibilityKind !== null;
      const routeChanged =
        projectedAssessment.recommendedLaneId !== run.routingAssessment.recommendedLaneId;
      const confidenceChanged =
        projectedAssessment.confidence !== run.routingAssessment.confidence;
      if (!routeChanged && !confidenceChanged && !eligible) {
        return null;
      }

      const reason = routeChanged
        ? `Projected lane changes from ${run.routingAssessment.recommendedLaneId} to ${projectedAssessment.recommendedLaneId}.`
        : confidenceChanged
          ? `Projected confidence shifts from ${run.routingAssessment.confidence} to ${projectedAssessment.confidence}.`
          : "Run stays eligible because it is low-confidence, conflicted, or still held in Discovery.";

      return {
        runId: run.runId,
        currentLane: run.routingAssessment.recommendedLaneId,
        currentConfidence: run.routingAssessment.confidence,
        projectedLane: projectedAssessment.recommendedLaneId,
        projectedConfidence: projectedAssessment.confidence,
        confidenceDelta,
        eligibilityKind,
        eligible,
        reason,
      };
    })
    .filter((entry): entry is MissionChangePreview["affectedRuns"][number] => Boolean(entry));

  const summary = {
    totalRunsAnalyzed: input.existingRuns.length,
    totalAffected: affectedRuns.length,
    eligibleForCascade: affectedRuns.filter((entry) => entry.eligible).length,
    improvedCount: affectedRuns.filter((entry) => entry.confidenceDelta === "improved").length,
    degradedCount: affectedRuns.filter((entry) => entry.confidenceDelta === "degraded").length,
    unchangedCount: affectedRuns.filter((entry) => entry.confidenceDelta === "unchanged").length,
  };

  return {
    previewId: crypto.randomUUID(),
    generatedAt,
    currentMission,
    proposedMission,
    affectedRuns,
    summary,
  } satisfies MissionChangePreview;
}

export function executeBoundedCascade(input: {
  preview: MissionChangePreview;
  scope: MissionEvolutionCascadeScope;
  approvedRunIds: string[];
}) {
  if (input.scope === "none") {
    if (input.approvedRunIds.length > 0) {
      throw new Error("invalid_input: cascade run ids are not allowed when cascade scope is none");
    }
    return {
      cascadedCount: 0,
      results: [],
    };
  }
  const approvedRunIds = [...new Set(input.approvedRunIds.map((value) => normalizeText(value)).filter(Boolean))];
  if (approvedRunIds.length > 10) {
    throw new Error("invalid_input: bounded cascade accepts at most 10 runs per operation");
  }

  const eligibleById = new Map(
    input.preview.affectedRuns
      .filter((entry) => entry.eligible && entry.eligibilityKind === input.scope)
      .map((entry) => [entry.runId, entry]),
  );
  const results = approvedRunIds.map((runId) => {
    const previewEntry = eligibleById.get(runId);
    if (!previewEntry) {
      throw new Error(`invalid_input: run ${runId} is not eligible for bounded cascade`);
    }
    return {
      runId,
      newLane: previewEntry.projectedLane,
      newConfidence: previewEntry.projectedConfidence,
      reason: previewEntry.reason,
    };
  });

  return {
    cascadedCount: results.length,
    results,
  };
}

export function supersedeMissionEvolution(input: {
  directiveRoot?: string;
  newMissionSnapshot: EngineMissionInput | EngineMissionContext;
  operatorRationale: string;
  trigger: MissionEvolutionRecord["trigger"];
  previewSnapshot: MissionEvolutionRecord["previewSnapshot"];
  cascade: MissionEvolutionRecord["cascade"];
  appliedDelta?: EngineMissionPreviewChange;
  createdAt?: string | null;
}) {
  const currentActive = readActiveMissionEvolution({
    directiveRoot: input.directiveRoot,
  });
  if (currentActive) {
    updateMissionEvolutionRecordStatus({
      directiveRoot: input.directiveRoot,
      record: currentActive,
      status: "superseded",
    });
  }

  const createdAt = normalizeText(input.createdAt) || new Date().toISOString();
  const record = {
    $schema: MISSION_EVOLUTION_RECORD_SCHEMA_REF,
    schemaVersion: MISSION_EVOLUTION_RECORD_SCHEMA_VERSION,
    recordKind: MISSION_EVOLUTION_RECORD_KIND,
    evolutionId: crypto.randomUUID(),
    version: (currentActive?.version ?? 0) + 1,
    status: "active",
    createdAt,
    operatorRationale: normalizeText(input.operatorRationale) || "Mission evolution approved.",
    previousEvolutionId: currentActive?.evolutionId ?? null,
    revertedFromEvolutionId: null,
    missionSnapshot: normalizeMissionContext(input.newMissionSnapshot),
    appliedDelta: normalizeMissionPreviewChange(input.appliedDelta ?? {}),
    trigger: {
      ...input.trigger,
      radarSuggestionIds: [...new Set((input.trigger.radarSuggestionIds ?? []).map((value) => normalizeText(value)).filter(Boolean))],
      sourceRunIds: [...new Set((input.trigger.sourceRunIds ?? []).map((value) => normalizeText(value)).filter(Boolean))],
    },
    previewSnapshot: input.previewSnapshot,
    cascade: {
      approved: input.cascade.approved,
      scope: input.cascade.scope,
      affectedRunIds: [...new Set(input.cascade.affectedRunIds.map((value) => normalizeText(value)).filter(Boolean))],
    },
  } satisfies MissionEvolutionRecord;

  writeMissionEvolutionRecord({
    directiveRoot: input.directiveRoot,
    record,
  });
  writeMissionArtifacts({
    directiveRoot: input.directiveRoot,
    missionSnapshot: record.missionSnapshot,
    operatorRationale: record.operatorRationale,
  });
  return record;
}

export function revertMissionEvolution(input: {
  directiveRoot?: string;
  operatorRationale: string;
  createdAt?: string | null;
}) {
  const currentActive = readActiveMissionEvolution({
    directiveRoot: input.directiveRoot,
  });
  if (!currentActive?.previousEvolutionId) {
    return null;
  }
  const previous = listMissionEvolutionHistory({
    directiveRoot: input.directiveRoot,
  }).find((record) => record.evolutionId === currentActive.previousEvolutionId);
  if (!previous) {
    return null;
  }

  updateMissionEvolutionRecordStatus({
    directiveRoot: input.directiveRoot,
    record: currentActive,
    status: "reverted",
  });

  const createdAt = normalizeText(input.createdAt) || new Date().toISOString();
  const record = {
    $schema: MISSION_EVOLUTION_RECORD_SCHEMA_REF,
    schemaVersion: MISSION_EVOLUTION_RECORD_SCHEMA_VERSION,
    recordKind: MISSION_EVOLUTION_RECORD_KIND,
    evolutionId: crypto.randomUUID(),
    version: currentActive.version + 1,
    status: "active",
    createdAt,
    operatorRationale: normalizeText(input.operatorRationale) || "Mission evolution reverted.",
    previousEvolutionId: currentActive.evolutionId,
    revertedFromEvolutionId: currentActive.evolutionId,
    missionSnapshot: previous.missionSnapshot,
    appliedDelta: {},
    trigger: {
      kind: "revert",
      sourceRunIds: [],
    },
    previewSnapshot: null,
    cascade: {
      approved: false,
      scope: "none",
      affectedRunIds: [],
    },
  } satisfies MissionEvolutionRecord;

  writeMissionEvolutionRecord({
    directiveRoot: input.directiveRoot,
    record,
  });
  writeMissionArtifacts({
    directiveRoot: input.directiveRoot,
    missionSnapshot: record.missionSnapshot,
    operatorRationale: record.operatorRationale,
  });
  return record;
}

export function buildMissionEvolutionPreviewSnapshot(preview: MissionChangePreview) {
  return {
    affectedRunCount: preview.summary.totalAffected,
    rerouteCandidateCount: preview.summary.eligibleForCascade,
    confidenceDeltaSummary: buildConfidenceDeltaSummary(preview),
  };
}
