import { normalizeText } from "./source-utils.ts";
import { resolveMissionContext } from "./mission/context.ts";
import { assessEngineRouting } from "./routing/assessment.ts";
import { deriveDirectiveRoutingDiff } from "./routing/diff.ts";
import { buildDirectiveRunRecord, deriveCandidateId, prepareProcessSourceInput } from "./process-source-record.ts";
import type { EngineLaneSet } from "./lane.ts";
import {
  applyStructuredAnswersToRecordInput,
  buildProcessSourceInputFromRecord,
} from "./planning/run-action-api.ts";
import type {
  EngineMissionContext,
  EngineMissionPreviewChange,
  EngineProcessSourceInput,
  EngineRunReplayDrift,
  EngineRunReplayInput,
  EngineRunReplayResult,
  EngineRoutingDigestPreview,
  EngineRunRecord,
} from "./types.ts";

function normalizeOptionalMissionList(
  value: string[] | null | undefined,
  fallback: string[],
) {
  if (value === undefined) {
    return fallback;
  }
  return (value ?? []).map((entry) => normalizeText(entry)).filter(Boolean);
}

export function buildReRouteProcessSourceInput(input: {
  record: EngineRunRecord;
  answers: Record<string, unknown>;
  receivedAt?: string | null;
  corrections?: EngineProcessSourceInput["corrections"];
  policyEvents?: EngineProcessSourceInput["policyEvents"];
}): EngineProcessSourceInput {
  const rerouteInput = applyStructuredAnswersToRecordInput({
    recordInput: buildProcessSourceInputFromRecord(input.record),
    answers: input.answers,
  });

  return {
    ...rerouteInput,
    corrections: input.corrections ?? null,
    policyEvents: input.policyEvents ?? null,
    receivedAt: normalizeText(input.receivedAt) || new Date().toISOString(),
  };
}

function applyMissionPreviewChange(input: {
  mission: EngineMissionContext;
  change: EngineMissionPreviewChange;
}): EngineMissionContext {
  return {
    ...input.mission,
    currentObjective:
      input.change.objective !== undefined
        ? normalizeText(input.change.objective) || input.mission.currentObjective
        : input.mission.currentObjective,
    usefulnessSignals: normalizeOptionalMissionList(
      input.change.usefulnessSignals,
      input.mission.usefulnessSignals,
    ),
    capabilityLanes: normalizeOptionalMissionList(
      input.change.capabilityLanes,
      input.mission.capabilityLanes,
    ),
    constraints: normalizeOptionalMissionList(
      input.change.constraints,
      input.mission.constraints,
    ),
    successSignal:
      input.change.successSignal !== undefined
        ? normalizeText(input.change.successSignal) || null
        : input.mission.successSignal,
    adoptionTarget:
      input.change.adoptionTarget !== undefined
        ? normalizeText(input.change.adoptionTarget) || null
        : input.mission.adoptionTarget,
  };
}

function listChangedMissionFields(change: EngineMissionPreviewChange | null | undefined) {
  if (!change) {
    return [];
  }
  return Object.entries(change)
    .filter(([, value]) => value !== undefined)
    .map(([field]) => field)
    .sort();
}

function deriveReplayDrift(input: {
  record: EngineRunRecord;
  existingRuns: EngineRunRecord[];
  replayInput: EngineRunReplayInput;
  replayReceivedAt: string;
}): EngineRunReplayDrift[] {
  const driftedInputs: EngineRunReplayDrift[] = [];
  const answerFields = Object.keys(input.replayInput.answers ?? {}).sort();
  if (answerFields.length > 0) {
    driftedInputs.push({
      kind: "answers_override",
      detail: `Replay applied answer overrides for: ${answerFields.join(", ")}.`,
    });
  }

  const missionFieldsChanged = listChangedMissionFields(input.replayInput.missionChange);
  if (missionFieldsChanged.length > 0) {
    driftedInputs.push({
      kind: "mission_change",
      detail: `Replay applied mission changes for: ${missionFieldsChanged.join(", ")}.`,
    });
  }

  if (input.replayReceivedAt !== input.record.receivedAt) {
    driftedInputs.push({
      kind: "received_at_override",
      detail: `Replay receivedAt changed from ${input.record.receivedAt} to ${input.replayReceivedAt}.`,
    });
  }

  const newerRuns = input.existingRuns
    .filter((entry) => entry.receivedAt > input.record.receivedAt)
    .map((entry) => entry.runId)
    .sort();
  if (newerRuns.length > 0) {
    driftedInputs.push({
      kind: "workspace_newer_runs",
      detail: `Workspace contains ${newerRuns.length} newer run(s): ${newerRuns.join(", ")}.`,
    });
  }

  return driftedInputs;
}

export function buildRunReplay(input: {
  laneSet: EngineLaneSet;
  record: EngineRunRecord;
  existingRuns: EngineRunRecord[];
  replayInput?: EngineRunReplayInput;
}): EngineRunReplayResult {
  const replayInput = input.replayInput ?? {};
  const baseInput = buildProcessSourceInputFromRecord(input.record);
  const answeredInput = replayInput.answers
    ? applyStructuredAnswersToRecordInput({
      recordInput: baseInput,
      answers: replayInput.answers,
    })
    : baseInput;
  const mission = replayInput.missionChange
    ? applyMissionPreviewChange({
      mission: resolveMissionContext(answeredInput.mission),
      change: replayInput.missionChange,
    })
    : resolveMissionContext(answeredInput.mission);
  const preparedSource = prepareProcessSourceInput({
    ...answeredInput,
    mission,
    receivedAt: replayInput.receivedAt ?? answeredInput.receivedAt,
  });
  const replayReceivedAt = preparedSource.receivedAt;
  const routingAssessment = assessEngineRouting({
    source: preparedSource.source,
    mission: preparedSource.mission,
    openGaps: [...input.record.openGaps],
    corrections: [...(replayInput.corrections ?? [])],
    policyEvents: [...(replayInput.policyEvents ?? [])],
    existingRuns: input.existingRuns,
    receivedAt: replayReceivedAt,
  });
  const replayedRecord = buildDirectiveRunRecord({
    laneSet: input.laneSet,
    source: preparedSource.source,
    mission: preparedSource.mission,
    openGaps: [...input.record.openGaps],
    corrections: [...(replayInput.corrections ?? [])],
    policyEvents: [...(replayInput.policyEvents ?? [])],
    existingRuns: input.existingRuns,
    receivedAt: replayReceivedAt,
    candidateId: deriveCandidateId(preparedSource.source),
    routingAssessment,
  });
  const driftedInputs = deriveReplayDrift({
    record: input.record,
    existingRuns: input.existingRuns,
    replayInput,
    replayReceivedAt,
  });

  return {
    runId: input.record.runId,
    replayedAt: new Date().toISOString(),
    nonPersistent: true,
    determinism: {
      mode: driftedInputs.length === 0 ? "exact" : "approximate",
      driftedInputs,
      rationale: driftedInputs.length === 0
        ? [
          "Replay used the recorded source, mission, and receivedAt without overrides.",
          "No newer runs were detected in the current workspace state.",
        ]
        : [
          "Replay stayed non-persistent but current inputs or workspace state differ from the original run.",
          "Treat this replay as approximate wherever drifted inputs are reported.",
        ],
    },
    overrides: {
      answerFields: Object.keys(replayInput.answers ?? {}).sort(),
      missionFieldsChanged: listChangedMissionFields(replayInput.missionChange),
      receivedAtOverridden: replayReceivedAt !== input.record.receivedAt,
    },
    baseline: {
      receivedAt: input.record.receivedAt,
      recommendedLaneId: input.record.routingAssessment.recommendedLaneId,
      confidence: input.record.routingAssessment.confidence,
      needsHumanReview: input.record.routingAssessment.needsHumanReview,
      decisionState: input.record.decision.decisionState,
      routingHeadline: input.record.routingAssessment.digest.headline,
      decisionSummary: input.record.decision.summary,
    },
    replay: {
      receivedAt: replayReceivedAt,
      recommendedLaneId: replayedRecord.routingAssessment.recommendedLaneId,
      confidence: replayedRecord.routingAssessment.confidence,
      needsHumanReview: replayedRecord.routingAssessment.needsHumanReview,
      decisionState: replayedRecord.decision.decisionState,
      routingHeadline: replayedRecord.routingAssessment.digest.headline,
      decisionSummary: replayedRecord.decision.summary,
    },
    diff: deriveDirectiveRoutingDiff({
      before: input.record.routingAssessment,
      after: replayedRecord.routingAssessment,
    }),
  };
}

export function buildMissionPreviewDigest(input: {
  record: EngineRunRecord;
  change: EngineMissionPreviewChange;
  existingRuns: EngineRunRecord[];
  corrections?: EngineProcessSourceInput["corrections"];
  policyEvents?: EngineProcessSourceInput["policyEvents"];
  receivedAt?: string | null;
}): EngineRoutingDigestPreview {
  const recordInput = buildProcessSourceInputFromRecord(input.record);
  const mission = applyMissionPreviewChange({
    mission: recordInput.mission,
    change: input.change,
  });
  const assessment = assessEngineRouting({
    source: input.record.source,
    mission: resolveMissionContext(mission),
    openGaps: [...input.record.openGaps],
    corrections: [...(input.corrections ?? [])],
    policyEvents: [...(input.policyEvents ?? [])],
    existingRuns: input.existingRuns,
    receivedAt: normalizeText(input.receivedAt) || new Date().toISOString(),
  });

  return {
    before: input.record.routingAssessment.digest,
    after: assessment.digest,
    diff: deriveDirectiveRoutingDiff({
      before: input.record.routingAssessment,
      after: assessment,
    }),
    assessment,
  };
}
