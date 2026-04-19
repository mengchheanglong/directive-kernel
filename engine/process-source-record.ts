import crypto from "node:crypto";

import {
  buildDirectiveRunSourceTokenMap,
  normalizeText,
} from "./engine-source-utils.ts";
import { resolveMissionContext } from "./mission/mission-context.ts";
import {
  classifyDirectiveEngineUsefulness,
  explainDirectiveEngineUsefulness,
} from "./usefulness.ts";
import {
  resolveDirectiveEngineLane,
  type DirectiveEngineLanePlanningInput,
  type DirectiveEngineLaneSet,
  type DirectiveEngineLaneUsefulnessPlanningInput,
} from "./lane.ts";
import { normalizeDirectiveEngineSourceType } from "./source-type-normalization.ts";
import {
  normalizeOptionalBoolean,
  normalizePrimaryAdoptionTarget,
  normalizeWorkflowBoundaryShape,
  validateDirectiveEngineSource,
} from "./source-input-normalization.ts";
import {
  DIRECTIVE_ENGINE_RUN_RECORD_KIND,
  DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF,
  DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION,
  type DirectiveEngineMissionContext,
  type DirectiveEngineProcessSourceInput,
  type DirectiveEngineRunRecord,
  type DirectiveEngineSelectedLane,
  type DirectiveEngineSourceItem,
} from "./types.ts";
import { deriveDirectivePriorPlanContext } from "./planning/plan-consumption.ts";
import { deriveDirectivePlanQualitySignal } from "./planning/plan-quality.ts";
import { deriveDirectiveNarrativeActions } from "./routing/source-narrative-threading.ts";
import {
  buildExecutablePlanState,
  buildStructuredAdaptationPlan,
  buildStructuredExtractionPlan,
  buildStructuredImprovementPlan,
  buildStructuredProofPlan,
} from "./planning/run-action-api.ts";
import { buildDecision } from "./planning/run-decision-builders.ts";
import {
  buildAdaptationPlan,
  buildDefaultProofPlan,
  buildExtractionPlan,
  buildImprovementPlan,
  buildIntegrationProposal,
  buildReportPlan,
  readRuntimeExecutionEvidenceSignal,
  readRuntimePromotionFeedbackSignal,
} from "./planning/run-plan-builders.ts";
import { buildEvents, buildSourceAnalysis } from "./planning/run-record-builders.ts";

function normalizeNotes(notes: string[] | null | undefined) {
  return (notes ?? []).map((note) => normalizeText(note)).filter(Boolean);
}

export function sanitizeIdSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function deriveMinimalSourceRef(input: {
  title: string;
  summary: string | null;
}) {
  const stableSlug =
    sanitizeIdSegment(input.title)
    || sanitizeIdSegment(input.summary ?? "")
    || crypto.createHash("sha1").update(`${input.title}\n${input.summary ?? ""}`).digest("hex").slice(0, 12);
  return `inline://minimal/${stableSlug}`;
}

export function deriveCandidateId(source: DirectiveEngineSourceItem) {
  return (
    sanitizeIdSegment(normalizeText(source.sourceId))
    || sanitizeIdSegment(normalizeText(source.title))
    || sanitizeIdSegment(normalizeText(source.sourceRef))
    || `directive-source-${crypto.randomUUID().slice(0, 8)}`
  );
}

export function prepareProcessSourceInput(
  input: DirectiveEngineProcessSourceInput,
): {
  receivedAt: string;
  mission: DirectiveEngineMissionContext;
  source: DirectiveEngineSourceItem;
} {
  const receivedAt =
    normalizeText(input.receivedAt) || new Date().toISOString();
  const mission = resolveMissionContext(input.mission);
  const source: DirectiveEngineSourceItem = {
    ...input.source,
    sourceId: normalizeText(input.source.sourceId) || null,
    sourceType: normalizeDirectiveEngineSourceType(input.source.sourceType),
    sourceRef: normalizeText(input.source.sourceRef),
    title:
      normalizeText(input.source.title)
      || normalizeText(input.source.sourceId)
      || normalizeText(input.source.sourceRef),
    summary: normalizeText(input.source.summary) || null,
    missionAlignmentHint: normalizeText(input.source.missionAlignmentHint) || null,
    capabilityGapId: normalizeText(input.source.capabilityGapId) || null,
    primaryAdoptionTarget: normalizePrimaryAdoptionTarget(input.source.primaryAdoptionTarget),
    containsExecutableCode: normalizeOptionalBoolean(input.source.containsExecutableCode),
    containsWorkflowPattern: normalizeOptionalBoolean(input.source.containsWorkflowPattern),
    improvesDirectiveWorkspace: normalizeOptionalBoolean(input.source.improvesDirectiveWorkspace),
    workflowBoundaryShape: normalizeWorkflowBoundaryShape(input.source.workflowBoundaryShape),
    notes: normalizeNotes(input.source.notes),
  };
  validateDirectiveEngineSource(source);
  return {
    receivedAt,
    mission,
    source,
  };
}

export function buildDirectiveRunRecord(input: {
  laneSet: DirectiveEngineLaneSet;
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
  openGaps: NonNullable<DirectiveEngineProcessSourceInput["gaps"]>;
  corrections: NonNullable<DirectiveEngineProcessSourceInput["corrections"]>;
  policyEvents: NonNullable<DirectiveEngineProcessSourceInput["policyEvents"]>;
  existingRuns: DirectiveEngineRunRecord[];
  receivedAt: string;
  candidateId: string;
  routingAssessment: DirectiveEngineRunRecord["routingAssessment"];
}): DirectiveEngineRunRecord {
  const lane = resolveDirectiveEngineLane({
    laneSet: input.laneSet,
    laneId: input.routingAssessment.recommendedLaneId,
  });
  const planningInput: DirectiveEngineLanePlanningInput = {
    source: input.source,
    mission: input.mission,
    openGaps: input.openGaps,
    candidateId: input.candidateId,
    receivedAt: input.receivedAt,
    routingAssessment: input.routingAssessment,
    lane,
  };
  const extractionPlan = buildExtractionPlan(planningInput);
  const selectedLane: DirectiveEngineSelectedLane = {
    laneId: lane.laneId,
    label: lane.label,
    hostDependence: lane.hostDependence,
    valuableWithoutHostRuntime: lane.valuableWithoutHostRuntime,
  };
  const runtimePromotionFeedbackSignal =
    selectedLane.laneId === "runtime"
      ? readRuntimePromotionFeedbackSignal()
      : null;
  const runtimeExecutionEvidenceSignal =
    selectedLane.laneId === "runtime"
      ? readRuntimeExecutionEvidenceSignal()
      : null;
  const adaptationPlan = buildAdaptationPlan({
    planningInput,
    extractionPlan,
  });
  const improvementPlan = buildImprovementPlan({
    planningInput,
    extractionPlan,
    adaptationPlan,
    runtimePromotionFeedbackSignal,
    runtimeExecutionEvidenceSignal,
  });
  const usefulnessPlanningInput: DirectiveEngineLaneUsefulnessPlanningInput = {
    planningInput,
    extractionPlan,
    adaptationPlan,
    improvementPlan,
  };
  const usefulnessLevel = input.laneSet.refineUsefulness
    ? input.laneSet.refineUsefulness(usefulnessPlanningInput)
    : classifyDirectiveEngineUsefulness(usefulnessPlanningInput);
  const usefulnessRationale = explainDirectiveEngineUsefulness(
    usefulnessPlanningInput,
    usefulnessLevel,
  );
  const candidate = {
    candidateId: input.candidateId,
    candidateName: input.source.title || input.candidateId,
    recommendedLaneId: input.routingAssessment.recommendedLaneId,
    recommendedLaneLabel: lane.label,
    recommendedRecordShape: input.routingAssessment.recommendedRecordShape,
    usefulnessLevel,
    missionPriorityScore: input.routingAssessment.missionPriorityScore,
    confidence: input.routingAssessment.confidence,
    matchedGapId: input.routingAssessment.matchedGapId,
    matchedGapRank: input.routingAssessment.matchedGapRank,
    requiresHumanReview: input.routingAssessment.needsHumanReview,
    rationale: [...input.routingAssessment.rationale],
  };
  const analysis = buildSourceAnalysis({
    planningInput,
    usefulnessRationale,
  });
  const proofPlan = lane.planProof
    ? lane.planProof({
      planningInput,
      extractionPlan,
      adaptationPlan,
      improvementPlan,
    })
    : buildDefaultProofPlan({
      planningInput,
      extractionPlan,
      adaptationPlan,
      improvementPlan,
    });
  const structuredExtractionPlan = buildStructuredExtractionPlan(extractionPlan);
  const structuredAdaptationPlan = buildStructuredAdaptationPlan(adaptationPlan);
  const structuredImprovementPlan = buildStructuredImprovementPlan(improvementPlan);
  const structuredProofPlan = buildStructuredProofPlan(proofPlan);
  const executablePlanState = buildExecutablePlanState({
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
  });
  const precomputedSourceTokens = buildDirectiveRunSourceTokenMap(input.existingRuns);
  const priorPlanContext = deriveDirectivePriorPlanContext({
    source: input.source,
    recommendedLaneId: selectedLane.laneId,
    existingRuns: input.existingRuns,
    precomputedSourceTokens,
  });
  const integrationProposal = buildIntegrationProposal({
    planningInput,
    extractionPlan,
    adaptationPlan,
    improvementPlan,
    proofPlan,
  }, runtimePromotionFeedbackSignal, runtimeExecutionEvidenceSignal);
  const decision = buildDecision({
    laneDefinition: lane,
    lane: selectedLane,
    candidate,
    integrationProposal,
  });
  const reportPlan = buildReportPlan({
    lane: selectedLane,
    decision,
    integrationProposal,
    usefulnessRationale,
  });
  const preliminaryRunRecord: DirectiveEngineRunRecord = {
    $schema: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF,
    schemaVersion: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION,
    recordKind: DIRECTIVE_ENGINE_RUN_RECORD_KIND,
    runId: crypto.randomUUID(),
    receivedAt: input.receivedAt,
    source: input.source,
    mission: input.mission,
    openGaps: input.openGaps,
    selectedLane,
    candidate,
    analysis,
    routingAssessment: input.routingAssessment,
    extractionPlan,
    structuredExtractionPlan,
    adaptationPlan,
    structuredAdaptationPlan,
    improvementPlan,
    structuredImprovementPlan,
    proofPlan,
    structuredProofPlan,
    executablePlanState,
    planQualitySignal: null,
    narrativeActions: null,
    priorPlanContext,
    decision,
    integrationProposal,
    reportPlan,
    events: buildEvents({
      receivedAt: input.receivedAt,
      analysis,
      candidate,
      extractionPlan,
      adaptationPlan,
      improvementPlan,
      proofPlan,
      decision,
      integrationProposal,
      reportPlan,
    }),
  };

  return {
    ...preliminaryRunRecord,
    planQualitySignal: deriveDirectivePlanQualitySignal({
      record: preliminaryRunRecord,
      existingRuns: input.existingRuns,
      policyEvents: input.policyEvents,
      corrections: input.corrections,
    }),
    narrativeActions: deriveDirectiveNarrativeActions({
      narrativeContext: preliminaryRunRecord.routingAssessment.narrativeContext,
      openGaps: input.openGaps,
      currentRecord: preliminaryRunRecord,
    }),
  };
}
