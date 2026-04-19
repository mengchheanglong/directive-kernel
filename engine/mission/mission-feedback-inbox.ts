import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createFilesystemDirectiveEngineStore } from "../storage.ts";
import { deriveDirectiveMissionHealth, type DirectiveMissionHealthAssessment } from "./mission-health.ts";
import {
  buildMissionEvolutionPreviewSnapshot,
  executeBoundedCascade,
  previewMissionEvolution,
  readCurrentMissionSnapshot,
  supersedeMissionEvolution,
  type MissionEvolutionCascadeScope,
} from "./mission-evolution.ts";
import { normalizeText } from "../engine-source-utils.ts";
import type {
  DirectiveEngineMissionContext,
  DirectiveEngineMissionPreviewChange,
  DirectiveEngineRunRecord,
} from "../types.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { resolveDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import { readJsonOptional, writeJsonAtomic } from "../../shared/lib/file-io.ts";
import type { DecisionPolicyEvent } from "../decision-policy-ledger.ts";
import type { RoutingCorrectionEntry } from "../routing/routing-correction-ledger.ts";

export type MissionFeedbackEntry = {
  feedbackId: string;
  kind: "objective_rewrite" | "constraint_addition" | "staleness_warning" | "tension_resolution";
  proposedAction: string;
  rationale: string;
  healthGradeAtGeneration: string;
  sourceSignals: string[];
  suggestedMissionDelta: DirectiveEngineMissionPreviewChange;
  eligibleForCascade: boolean;
};

export type MissionFeedbackDecisionRecord = {
  schemaVersion: 1;
  recordKind: "mission_feedback_decision";
  decisionId: string;
  feedbackId: string;
  decision: "approved" | "rejected";
  decidedAt: string;
  operatorRationale: string;
  evolutionId: string | null;
};

const MISSION_FEEDBACK_DECISION_ROOT = "engine/mission-feedback-decisions";

function resolveDirectiveRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(resolveDirectiveWorkspaceRoot(directiveRoot));
}

function resolveEngineRunsRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), "runtime", "standalone-host", "engine-runs"),
  );
}

function resolveMissionFeedbackDecisionRoot(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.join(resolveDirectiveRoot(directiveRoot), MISSION_FEEDBACK_DECISION_ROOT),
  );
}

function resolveMissionFeedbackDecisionPath(input: {
  directiveRoot?: string;
  record: MissionFeedbackDecisionRecord;
}) {
  const timestamp = input.record.decidedAt.replace(/[:.]/g, "-");
  return normalizeAbsolutePath(
    path.join(
      resolveMissionFeedbackDecisionRoot(input.directiveRoot),
      `${timestamp}-${input.record.feedbackId.slice(0, 32)}-${input.record.decisionId.slice(0, 8)}.json`,
    ),
  );
}

function listMissionFeedbackDecisionPaths(directiveRoot?: string) {
  const root = resolveMissionFeedbackDecisionRoot(directiveRoot);
  if (!fs.existsSync(root)) {
    return [] as string[];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => normalizeAbsolutePath(path.join(root, entry.name)))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
}

function buildFeedbackId(input: {
  mission: DirectiveEngineMissionContext;
  kind: MissionFeedbackEntry["kind"];
  key: string;
}) {
  return `mission-feedback-${crypto.createHash("sha1")
    .update([
      input.mission.missionId ?? "",
      input.mission.currentObjective,
      input.kind,
      input.key,
    ].join("\n"))
    .digest("hex")
    .slice(0, 16)}`;
}

function buildLatestDecisionIndex(decisions: MissionFeedbackDecisionRecord[]) {
  const latest = new Map<string, MissionFeedbackDecisionRecord>();
  for (const decision of [...decisions].sort((left, right) =>
    left.decidedAt.localeCompare(right.decidedAt)
  )) {
    latest.set(decision.feedbackId, decision);
  }
  return latest;
}

function maybeExtractLane(signal: string) {
  const match = signal.match(/\b(discovery|architecture|runtime)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function latestGoalCopilotForMission(input: {
  mission: DirectiveEngineMissionContext;
  existingRuns: DirectiveEngineRunRecord[];
}) {
  return [...input.existingRuns]
    .reverse()
    .find((run) =>
      Boolean(run.routingAssessment.goalCopilot)
      && (
        run.mission.missionId === input.mission.missionId
        || !input.mission.missionId
      )
    )?.routingAssessment.goalCopilot ?? null;
}

export function listMissionFeedbackDecisions(input?: {
  directiveRoot?: string;
}) {
  return listMissionFeedbackDecisionPaths(input?.directiveRoot)
    .map((filePath) => readJsonOptional<MissionFeedbackDecisionRecord>(filePath))
    .filter((entry): entry is MissionFeedbackDecisionRecord => Boolean(entry))
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt));
}

export function writeMissionFeedbackDecision(input: {
  directiveRoot?: string;
  record: MissionFeedbackDecisionRecord;
}) {
  const recordPath = resolveMissionFeedbackDecisionPath(input);
  writeJsonAtomic(recordPath, input.record);
  return recordPath;
}

export function generateMissionFeedbackEntries(input: {
  mission: DirectiveEngineMissionContext;
  existingRuns?: DirectiveEngineRunRecord[];
  healthAssessment: DirectiveMissionHealthAssessment;
  goalCopilot?: {
    suggestedObjective: string | null;
    suggestedConstraints: string[];
    suggestedUsefulnessSignals: string[];
    suggestedCapabilityLanes: string[];
  } | null;
  existingDecisions?: MissionFeedbackDecisionRecord[];
}) {
  if (!input.healthAssessment) {
    return [] as MissionFeedbackEntry[];
  }

  const entries: MissionFeedbackEntry[] = [];
  const health = input.healthAssessment;
  const latestDecisions = buildLatestDecisionIndex(input.existingDecisions ?? []);
  const goalCopilot = input.goalCopilot ?? null;

  const maybePush = (entry: MissionFeedbackEntry) => {
    if (latestDecisions.get(entry.feedbackId)?.decision === "rejected") {
      return;
    }
    entries.push(entry);
  };

  if (
    (health.healthGrade === "D" || health.healthGrade === "F")
    && (health.suggestedObjectiveRewrite || goalCopilot?.suggestedObjective)
  ) {
    const objective = normalizeText(goalCopilot?.suggestedObjective ?? health.suggestedObjectiveRewrite) || null;
    if (objective) {
      maybePush({
        feedbackId: buildFeedbackId({
          mission: input.mission,
          kind: "objective_rewrite",
          key: objective,
        }),
        kind: "objective_rewrite",
        proposedAction: `Replace the current objective with "${objective}".`,
        rationale:
          health.warnings[0]
          ?? "Mission health fell below the bounded threshold, so the objective needs a more specific rewrite.",
        healthGradeAtGeneration: health.healthGrade,
        sourceSignals: [...health.warnings].slice(0, 2),
        suggestedMissionDelta: {
          objective,
        },
        eligibleForCascade: true,
      });
    }
  }

  if (health.constraintQualityScore <= 2) {
    for (const constraint of health.suggestedConstraintAdditions.slice(0, 2)) {
      const normalizedConstraint = normalizeText(constraint);
      if (!normalizedConstraint) {
        continue;
      }
      maybePush({
        feedbackId: buildFeedbackId({
          mission: input.mission,
          kind: "constraint_addition",
          key: normalizedConstraint,
        }),
        kind: "constraint_addition",
        proposedAction: `Add the mission constraint "${normalizedConstraint}".`,
        rationale:
          "Constraint quality is weak, so future work needs a more explicit bounded-review rule.",
        healthGradeAtGeneration: health.healthGrade,
        sourceSignals: ["constraint_quality"],
        suggestedMissionDelta: {
          constraints: [...input.mission.constraints, normalizedConstraint],
        },
        eligibleForCascade: true,
      });
    }
  }

  if (health.stalenessRiskScore >= 4) {
    const rewrittenObjective =
      normalizeText(goalCopilot?.suggestedObjective)
      || normalizeText(health.suggestedObjectiveRewrite)
      || null;
    const usefulnessSignals = goalCopilot?.suggestedUsefulnessSignals?.length
      ? goalCopilot.suggestedUsefulnessSignals
      : input.mission.usefulnessSignals;
    maybePush({
      feedbackId: buildFeedbackId({
        mission: input.mission,
        kind: "staleness_warning",
        key: `${rewrittenObjective ?? input.mission.currentObjective}:${usefulnessSignals.join("|")}`,
      }),
      kind: "staleness_warning",
      proposedAction:
        rewrittenObjective
          ? `Refresh the mission objective to "${rewrittenObjective}" and keep the usefulness signals current.`
          : "Refresh the mission framing to match recent source pressure.",
      rationale:
        "Recent runs keep surfacing mission-specificity or confidence-recovery warnings, so the active mission looks stale.",
      healthGradeAtGeneration: health.healthGrade,
      sourceSignals: ["staleness_risk", ...health.tensionSignals.slice(0, 1)],
      suggestedMissionDelta: {
        objective: rewrittenObjective ?? undefined,
        usefulnessSignals,
      },
      eligibleForCascade: true,
    });
  }

  for (const signal of health.tensionSignals.slice(0, 2)) {
    const requestedLane = maybeExtractLane(signal);
    const capabilityLanes = requestedLane && !input.mission.capabilityLanes.some((lane) =>
      lane.toLowerCase() === requestedLane
    )
      ? [requestedLane, ...input.mission.capabilityLanes]
      : goalCopilot?.suggestedCapabilityLanes?.length
        ? goalCopilot.suggestedCapabilityLanes
        : input.mission.capabilityLanes;
    maybePush({
      feedbackId: buildFeedbackId({
        mission: input.mission,
        kind: "tension_resolution",
        key: signal,
      }),
      kind: "tension_resolution",
      proposedAction:
        requestedLane
          ? `Update lane priorities so ${requestedLane} is explicitly covered by the mission.`
          : "Rebalance lane priorities to match current source pressure.",
      rationale: signal,
      healthGradeAtGeneration: health.healthGrade,
      sourceSignals: [signal],
      suggestedMissionDelta: {
        capabilityLanes,
        adoptionTarget:
          requestedLane && normalizeText(input.mission.adoptionTarget).toLowerCase() !== requestedLane
            ? requestedLane
            : undefined,
      },
      eligibleForCascade: true,
    });
  }

  return entries.slice(0, 3);
}

export function listMissionFeedbackEntries(input?: {
  directiveRoot?: string;
}) {
  const store = createFilesystemDirectiveEngineStore({
    engineRunsRoot: resolveEngineRunsRoot(input?.directiveRoot),
  });
  const existingRuns = store.listRuns();
  const mission = readCurrentMissionSnapshot({
    directiveRoot: input?.directiveRoot,
    fallbackMission: existingRuns.at(-1)?.mission ?? null,
  });
  if (!mission) {
    return [] as MissionFeedbackEntry[];
  }

  return generateMissionFeedbackEntries({
    mission,
    existingRuns,
    healthAssessment: deriveDirectiveMissionHealth({
      mission,
      existingRuns,
    }),
    goalCopilot: latestGoalCopilotForMission({
      mission,
      existingRuns,
    }),
    existingDecisions: listMissionFeedbackDecisions(input),
  });
}

function resolveMissionFeedbackEntry(input: {
  directiveRoot?: string;
  feedbackId: string;
}) {
  const feedbackId = normalizeText(input.feedbackId);
  return listMissionFeedbackEntries({
    directiveRoot: input.directiveRoot,
  }).find((entry) => entry.feedbackId === feedbackId) ?? null;
}

function resolveCurrentMissionAndRuns(directiveRoot?: string) {
  const store = createFilesystemDirectiveEngineStore({
    engineRunsRoot: resolveEngineRunsRoot(directiveRoot),
  });
  const existingRuns = store.listRuns();
  const mission = readCurrentMissionSnapshot({
    directiveRoot,
    fallbackMission: existingRuns.at(-1)?.mission ?? null,
  });
  return {
    existingRuns,
    mission,
  };
}

function inferTriggerKind(entry: MissionFeedbackEntry) {
  if (entry.kind === "constraint_addition" || entry.kind === "objective_rewrite") {
    return "health_degradation" as const;
  }
  return "operator_initiated" as const;
}

export function previewMissionFeedbackEntry(input: {
  directiveRoot?: string;
  feedbackId: string;
  corrections?: RoutingCorrectionEntry[] | null;
  policyEvents?: DecisionPolicyEvent[] | null;
  receivedAt?: string | null;
}) {
  const feedback = resolveMissionFeedbackEntry(input);
  if (!feedback) {
    throw new Error(`not_found: mission feedback ${input.feedbackId} does not exist`);
  }
  const { existingRuns, mission } = resolveCurrentMissionAndRuns(input.directiveRoot);
  if (!mission) {
    throw new Error("not_found: current mission is unavailable");
  }

  const proposedMission = {
    ...mission,
    currentObjective:
      feedback.suggestedMissionDelta.objective !== undefined
        ? feedback.suggestedMissionDelta.objective
        : mission.currentObjective,
    usefulnessSignals:
      feedback.suggestedMissionDelta.usefulnessSignals !== undefined
        ? feedback.suggestedMissionDelta.usefulnessSignals
        : mission.usefulnessSignals,
    capabilityLanes:
      feedback.suggestedMissionDelta.capabilityLanes !== undefined
        ? feedback.suggestedMissionDelta.capabilityLanes
        : mission.capabilityLanes,
    constraints:
      feedback.suggestedMissionDelta.constraints !== undefined
        ? feedback.suggestedMissionDelta.constraints
        : mission.constraints,
    successSignal:
      feedback.suggestedMissionDelta.successSignal !== undefined
        ? feedback.suggestedMissionDelta.successSignal
        : mission.successSignal,
    adoptionTarget:
      feedback.suggestedMissionDelta.adoptionTarget !== undefined
        ? feedback.suggestedMissionDelta.adoptionTarget
        : mission.adoptionTarget,
  };

  return {
    feedback,
    preview: previewMissionEvolution({
      directiveRoot: input.directiveRoot,
      currentMission: mission,
      proposedMission,
      existingRuns,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      receivedAt: input.receivedAt ?? null,
    }),
  };
}

export function approveMissionFeedbackEntry(input: {
  directiveRoot?: string;
  feedbackId: string;
  operatorRationale: string;
  approvedRunIds?: string[];
  cascadeScope?: MissionEvolutionCascadeScope;
  corrections?: RoutingCorrectionEntry[] | null;
  policyEvents?: DecisionPolicyEvent[] | null;
  receivedAt?: string | null;
}) {
  const receivedAt = normalizeText(input.receivedAt) || new Date().toISOString();
  const { feedback, preview } = previewMissionFeedbackEntry({
    directiveRoot: input.directiveRoot,
    feedbackId: input.feedbackId,
    corrections: input.corrections ?? null,
    policyEvents: input.policyEvents ?? null,
    receivedAt,
  });
  const cascadeScope = input.cascadeScope ?? "none";
  const cascadeResults = executeBoundedCascade({
    preview,
    scope: cascadeScope,
    approvedRunIds: input.approvedRunIds ?? [],
  });
  const evolution = supersedeMissionEvolution({
    directiveRoot: input.directiveRoot,
    newMissionSnapshot: preview.proposedMission,
    operatorRationale: input.operatorRationale,
    trigger: {
      kind: inferTriggerKind(feedback),
      healthGradeAtTrigger: feedback.healthGradeAtGeneration,
      sourceRunIds: cascadeResults.results.map((entry) => entry.runId),
    },
    previewSnapshot: buildMissionEvolutionPreviewSnapshot(preview),
    cascade: {
      approved: cascadeResults.cascadedCount > 0,
      scope: cascadeScope,
      affectedRunIds: cascadeResults.results.map((entry) => entry.runId),
    },
    appliedDelta: feedback.suggestedMissionDelta,
    createdAt: receivedAt,
  });
  const decision = {
    schemaVersion: 1,
    recordKind: "mission_feedback_decision",
    decisionId: crypto.randomUUID(),
    feedbackId: feedback.feedbackId,
    decision: "approved",
    decidedAt: receivedAt,
    operatorRationale: normalizeText(input.operatorRationale) || "Mission feedback approved.",
    evolutionId: evolution.evolutionId,
  } satisfies MissionFeedbackDecisionRecord;
  writeMissionFeedbackDecision({
    directiveRoot: input.directiveRoot,
    record: decision,
  });

  return {
    feedback,
    preview,
    cascadeResults,
    evolution,
    decision,
  };
}

export function rejectMissionFeedbackEntry(input: {
  directiveRoot?: string;
  feedbackId: string;
  operatorRationale: string;
  decidedAt?: string | null;
}) {
  const feedback = resolveMissionFeedbackEntry(input);
  if (!feedback) {
    throw new Error(`not_found: mission feedback ${input.feedbackId} does not exist`);
  }
  const decision = {
    schemaVersion: 1,
    recordKind: "mission_feedback_decision",
    decisionId: crypto.randomUUID(),
    feedbackId: feedback.feedbackId,
    decision: "rejected",
    decidedAt: normalizeText(input.decidedAt) || new Date().toISOString(),
    operatorRationale: normalizeText(input.operatorRationale) || "Mission feedback rejected.",
    evolutionId: null,
  } satisfies MissionFeedbackDecisionRecord;
  writeMissionFeedbackDecision({
    directiveRoot: input.directiveRoot,
    record: decision,
  });
  return {
    feedback,
    decision,
  };
}
