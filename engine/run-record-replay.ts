import { normalizeText } from "./engine-source-utils.ts";
import { resolveMissionContext } from "./mission/mission-context.ts";
import { assessDirectiveEngineRouting } from "./routing/routing-assessment.ts";
import { deriveDirectiveRoutingDiff } from "./routing/routing-diff.ts";
import {
  applyStructuredAnswersToRecordInput,
  buildProcessSourceInputFromRecord,
} from "./planning/run-action-api.ts";
import type {
  DirectiveEngineMissionContext,
  DirectiveEngineMissionPreviewChange,
  DirectiveEngineProcessSourceInput,
  DirectiveEngineRoutingDigestPreview,
  DirectiveEngineRunRecord,
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
  record: DirectiveEngineRunRecord;
  answers: Record<string, unknown>;
  receivedAt?: string | null;
  corrections?: DirectiveEngineProcessSourceInput["corrections"];
  policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
}): DirectiveEngineProcessSourceInput {
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
  mission: DirectiveEngineMissionContext;
  change: DirectiveEngineMissionPreviewChange;
}): DirectiveEngineMissionContext {
  return {
    ...input.mission,
    currentObjective:
      input.change.objective !== undefined
        ? normalizeText(input.change.objective) || null
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

export function buildMissionPreviewDigest(input: {
  record: DirectiveEngineRunRecord;
  change: DirectiveEngineMissionPreviewChange;
  existingRuns: DirectiveEngineRunRecord[];
  corrections?: DirectiveEngineProcessSourceInput["corrections"];
  policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
  receivedAt?: string | null;
}): DirectiveEngineRoutingDigestPreview {
  const recordInput = buildProcessSourceInputFromRecord(input.record);
  const mission = applyMissionPreviewChange({
    mission: recordInput.mission,
    change: input.change,
  });
  const assessment = assessDirectiveEngineRouting({
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
