import { normalizeText } from "./source-utils.ts";
import { resolveMissionContext } from "./mission/context.ts";
import { assessEngineRouting } from "./routing/assessment.ts";
import { deriveDirectiveRoutingDiff } from "./routing/diff.ts";
import {
  applyStructuredAnswersToRecordInput,
  buildProcessSourceInputFromRecord,
} from "./planning/run-action-api.ts";
import type {
  EngineMissionContext,
  EngineMissionPreviewChange,
  EngineProcessSourceInput,
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
