/// <reference types="node" />

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMemoryDirectiveEngineStore, type DirectiveEngineStore } from "./storage.ts";
import { assessDirectiveEngineRouting } from "./routing.ts";
import {
  classifyDirectiveEngineUsefulness,
  explainDirectiveEngineUsefulness,
} from "./usefulness.ts";
import {
  type DirectiveEngineLaneIntegrationPlanningInput,
  resolveDirectiveEngineLane,
  type DirectiveEngineLanePlanningInput,
  type DirectiveEngineLaneProofPlanningInput,
  type DirectiveEngineLaneUsefulnessPlanningInput,
  type DirectiveEngineLaneSet,
} from "./lane.ts";
import { normalizeDirectiveEngineSourceType } from "./source-type-normalization.ts";
import {
  DIRECTIVE_ENGINE_RUN_RECORD_KIND,
  DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF,
  DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION,
  type DirectiveEngineAdaptationPlan,
  type DirectiveEngineAnalysis,
  type DirectiveEngineCandidate,
  type DirectiveEngineDecision,
  type DirectiveEngineEvent,
  type DirectiveEngineExtractionPlan,
  type DirectiveEngineHostAdapter,
  type DirectiveEngineIntegrationMode,
  type DirectiveEngineIntegrationProposal,
  type DirectiveEngineImprovementPlan,
  type DirectiveEngineMissionContext,
  type DirectiveEngineMissionInput,
  type DirectiveEngineProcessSourceInput,
  type DirectiveEngineProcessSourceResult,
  type DirectiveEngineProofPlan,
  type DirectiveEnginePrimaryAdoptionTarget,
  type DirectiveEngineReportPlan,
  type DirectiveEngineRunRecord,
  type DirectiveEngineSelectedLane,
  type DirectiveEngineSourceItem,
  type DirectiveEngineWorkflowBoundaryShape,
} from "./types.ts";
import { buildRuntimeCallableExecutionEvidenceReport } from "../runtime/lib/runtime-callable-execution-evidence.ts";
import { buildDirectiveRuntimePromotionAssistanceReport } from "../runtime/lib/runtime-promotion-assistance.ts";

const DIRECTIVE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNotes(notes: string[] | null | undefined) {
  return (notes ?? []).map((note) => normalizeText(note)).filter(Boolean);
}

function normalizeOptionalBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  return null;
}

function normalizePrimaryAdoptionTarget(
  value: unknown,
): DirectiveEnginePrimaryAdoptionTarget | null {
  if (value === "discovery" || value === "architecture" || value === "runtime") {
    return value;
  }
  return null;
}

function normalizeWorkflowBoundaryShape(
  value: unknown,
): DirectiveEngineWorkflowBoundaryShape | null {
  if (value === "bounded_protocol" || value === "iterative_loop") {
    return value;
  }
  return null;
}

function sanitizeIdSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSectionBody(markdown: string, heading: string) {
  const pattern = new RegExp(
    `^## ${escapeRegex(heading)}\\r?\\n([\\s\\S]*?)(?=^##\\s|\\Z)`,
    "m",
  );
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function parseMissionMarkdown(markdown: string) {
  const currentObjective = getSectionBody(markdown, "Current Objective")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const usefulnessSignals = getSectionBody(
    markdown,
    "What Usefulness Means Under This Objective",
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
  const capabilityLanes = getSectionBody(markdown, "Capability Lanes That Matter Most")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim());

  return {
    currentObjective,
    usefulnessSignals,
    capabilityLanes,
  };
}

function buildMissionMarkdown(input: DirectiveEngineMissionInput) {
  const objective =
    normalizeText(input.currentObjective) || "Mission objective not provided.";
  const usefulnessSignals = (input.usefulnessSignals ?? []).filter(Boolean);
  const capabilityLanes = (input.capabilityLanes ?? []).filter(Boolean);

  return [
    "# Active Mission",
    "",
    "## Current Objective",
    "",
    objective,
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
  ].join("\n");
}

function resolveMissionContext(
  input: DirectiveEngineMissionInput,
): DirectiveEngineMissionContext {
  const activeMissionMarkdown =
    normalizeText(input.activeMissionMarkdown) || buildMissionMarkdown(input);
  const parsed = parseMissionMarkdown(activeMissionMarkdown);

  return {
    missionId: normalizeText(input.missionId) || null,
    currentObjective:
      normalizeText(input.currentObjective) || parsed.currentObjective,
    usefulnessSignals:
      (input.usefulnessSignals ?? []).filter(Boolean).length > 0
        ? (input.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.usefulnessSignals,
    capabilityLanes:
      (input.capabilityLanes ?? []).filter(Boolean).length > 0
        ? (input.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.capabilityLanes,
    activeMissionMarkdown,
  };
}

function deriveCandidateId(source: DirectiveEngineSourceItem) {
  return (
    sanitizeIdSegment(normalizeText(source.sourceId))
    || sanitizeIdSegment(normalizeText(source.title))
    || sanitizeIdSegment(normalizeText(source.sourceRef))
    || `directive-source-${crypto.randomUUID().slice(0, 8)}`
  );
}

function deriveIntegrationMode(input: {
  source: DirectiveEngineSourceItem;
  defaultIntegrationMode: DirectiveEngineIntegrationMode;
  valuableWithoutHostRuntime: boolean;
}): DirectiveEngineIntegrationMode {
  if (input.defaultIntegrationMode === "none") {
    return "none";
  }

  if (!input.valuableWithoutHostRuntime) {
    if (
      input.source.sourceType === "github-repo"
      || input.source.sourceType === "external-system"
    ) {
      return "reimplement";
    }
  }

  return input.defaultIntegrationMode;
}

function buildDefaultProofPlan(
  input: DirectiveEngineLaneProofPlanningInput,
): DirectiveEngineProofPlan {
  const primaryImprovementGoal =
    input.improvementPlan.improvementGoals[0]
    ?? "bounded improvement delta recorded";
  return {
    proofKind: `${input.planningInput.lane.laneId}_proof`,
    objective:
      `Prove the ${input.planningInput.lane.label} path is safe, bounded, and useful under the current mission, `
      + `while keeping the proof boundary grounded in the staged improvement goal "${primaryImprovementGoal}".`,
    requiredEvidence: [
      "lane rationale recorded",
      "bounded next action recorded",
      "proof owner identified",
      "improvement delta stays anchored to prior stage output",
    ],
    requiredGates: [
      "scope_review",
      "boundary_review",
      "rollback_review",
    ],
    rollbackPrompt:
      "Keep the candidate at its current state and avoid downstream integration until the proof boundary is clearer.",
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  );
}

function flattenSourceSignals(source: DirectiveEngineSourceItem) {
  return [
    source.title,
    source.summary ?? "",
    source.missionAlignmentHint ?? "",
    source.primaryAdoptionTarget ? `primary-adoption-target:${source.primaryAdoptionTarget}` : "",
    source.containsExecutableCode ? "contains executable code" : "",
    source.containsWorkflowPattern ? "contains workflow pattern" : "",
    source.improvesDirectiveWorkspace ? "improves directive workspace itself" : "",
    source.workflowBoundaryShape ? `workflow-boundary-shape:${source.workflowBoundaryShape}` : "",
    ...(source.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function resolveStructuralProcessStages(source: DirectiveEngineSourceItem) {
  if (
    source.sourceType !== "paper"
    && source.sourceType !== "product-doc"
    && source.sourceType !== "technical-essay"
    && source.sourceType !== "workflow-writeup"
    && source.sourceType !== "theory"
  ) {
    return [] as string[];
  }

  const lowered = flattenSourceSignals(source).toLowerCase();
  const stages: string[] = [];

  if (/\bplanning\b/.test(lowered)) {
    stages.push("planning");
  }
  if (/\banalysis\b/.test(lowered)) {
    stages.push("analysis");
  }
  if (/\bmutation\b/.test(lowered)) {
    stages.push("mutation");
  }
  if (/\bevaluation\b/.test(lowered)) {
    stages.push("evaluation");
  }
  if (/\bselection\b/.test(lowered)) {
    stages.push("selection");
  }
  if (/\bcode generation\b/.test(lowered)) {
    stages.push("code generation");
  } else if (/\bgeneration\b/.test(lowered)) {
    stages.push("generation");
  }

  return stages;
}

function resolveControlSignalProfile(source: DirectiveEngineSourceItem) {
  if (
    source.sourceType !== "paper"
    && source.sourceType !== "product-doc"
    && source.sourceType !== "technical-essay"
    && source.sourceType !== "workflow-writeup"
    && source.sourceType !== "theory"
  ) {
    return null;
  }

  const lowered = flattenSourceSignals(source).toLowerCase();
  const signals: string[] = [];

  if (/\bprecondition\b|\bprerequisite\b|\bchecklist\b|\bfail fast\b/.test(lowered)) {
    signals.push("preconditions");
  }
  if (/\bdry-run\b|\bverify\b|\bverification\b|\bguard\b|\bhealth check\b/.test(lowered)) {
    signals.push("verification");
  }
  if (/\brollback\b|\brevert\b|\bundo\b|\bunpublish\b/.test(lowered)) {
    signals.push("rollback");
  }
  if (/\bkeep\b|\bdiscard\b|\bdecision\b|\bapprove\b|\bgate\b|\bready to ship\b/.test(lowered)) {
    signals.push("decision");
  }
  if (/\bresults log\b|\bsummary\b|\blog\b|\brecord\b|\breport\b|\bmemory\b/.test(lowered)) {
    signals.push("results logging");
  }

  const hasControlGate =
    signals.includes("preconditions") || signals.includes("verification");
  const hasDecisionOrRollback =
    signals.includes("decision") || signals.includes("rollback");
  const hasEvidenceBoundary = signals.includes("results logging");

  if (
    signals.length < 3
    || !hasControlGate
    || (!hasDecisionOrRollback && !hasEvidenceBoundary)
  ) {
    return null;
  }

  const mentionsLoop = /\b(loop|iteration|iterative)\b/.test(lowered);
  const prefersBoundedProtocolFraming =
    /\b(workflow|protocol)\b/.test(lowered)
    && /\b(checklist|dry-run|inventory|ship|verify|log)\b/.test(lowered);

  return {
    signals,
    framing: mentionsLoop && !prefersBoundedProtocolFraming
      ? "iterative_loop"
      : "bounded_protocol",
  } as const;
}

function formatStructuralProcessStages(stages: string[]) {
  return stages.join(" -> ");
}

function formatIterativeControlSignals(signals: string[]) {
  return signals.join(", ");
}

function buildSourceAnalysis(
  input: {
    planningInput: DirectiveEngineLanePlanningInput;
    usefulnessRationale: string;
  },
): DirectiveEngineAnalysis {
  const structuralProcessStages = resolveStructuralProcessStages(
    input.planningInput.source,
  );
  const controlSignalProfile = resolveControlSignalProfile(
    input.planningInput.source,
  );
  const structuralStageSummary = structuralProcessStages.length >= 2
    ? `Structural stages detected: ${formatStructuralProcessStages(structuralProcessStages)}.`
    : null;
  const controlSignalSummary = controlSignalProfile
    ? controlSignalProfile.framing === "iterative_loop"
      ? `Loop-control signals detected: ${formatIterativeControlSignals(controlSignalProfile.signals)}.`
      : `Bounded control/evidence signals detected: ${formatIterativeControlSignals(controlSignalProfile.signals)}.`
    : null;
  const derivedSummaries = [structuralStageSummary, controlSignalSummary].filter(Boolean);

  return {
    missionFitSummary:
      derivedSummaries.length > 0
        ? `${normalizeText(input.planningInput.source.summary) || `Assess ${input.planningInput.source.title || input.planningInput.candidateId} against mission "${input.planningInput.mission.currentObjective}".`} ${derivedSummaries.join(" ")}`
        : normalizeText(input.planningInput.source.summary)
          || `Assess ${input.planningInput.source.title || input.planningInput.candidateId} against mission "${input.planningInput.mission.currentObjective}".`,
    primaryAdoptionQuestion:
      structuralProcessStages.length >= 2
        ? `Which parts of the ${formatStructuralProcessStages(structuralProcessStages)} stage pattern belong to Engine-owned workflow structure, and which parts should stay out of Architecture until a different adoption target is proven?`
        : controlSignalProfile?.framing === "iterative_loop"
          ? `Which explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries belong to Engine-owned loop discipline, and which parts should stay out of Architecture until a different adoption target is proven?`
          : controlSignalProfile
            ? `Which explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries belong to Engine-owned control and evidence discipline, and which parts should stay out of Architecture until a different adoption target is proven?`
        : "What is the primary adoption target of the extracted value?",
    matchedCapabilityGapId: input.planningInput.routingAssessment.matchedGapId,
    usefulnessRationale: input.usefulnessRationale,
    rationale: [
      ...input.planningInput.routingAssessment.rationale,
      ...(structuralStageSummary
        ? [
            `${structuralStageSummary} Preserve those stage boundaries during Architecture adaptation instead of flattening them into one generic mechanism.`,
          ]
        : []),
      ...(controlSignalSummary
        ? [
            controlSignalProfile?.framing === "iterative_loop"
              ? `${controlSignalSummary} Preserve those bounded loop-control boundaries during Architecture adaptation instead of flattening them into one generic workflow heuristic.`
              : `${controlSignalSummary} Preserve those bounded control and evidence boundaries during Architecture adaptation instead of flattening them into one generic workflow heuristic.`,
          ]
        : []),
    ],
  };
}

function buildExtractionPlan(
  input: DirectiveEngineLanePlanningInput,
): DirectiveEngineExtractionPlan {
  const structuralProcessStages = resolveStructuralProcessStages(input.source);
  const controlSignalProfile = resolveControlSignalProfile(input.source);
  const extractedValue = uniqueStrings([
    structuralProcessStages.length >= 2
      ? `Stage-aware structural pattern: ${formatStructuralProcessStages(structuralProcessStages)} with explicit handoff boundaries.`
      : null,
    controlSignalProfile?.framing === "iterative_loop"
      ? `Bounded loop-control pattern: explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries for repeated iteration.`
      : controlSignalProfile
        ? `Bounded control/evidence pattern: explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries for approval, validation, rollback, and reporting.`
      : null,
    input.source.summary,
    ...(input.source.notes ?? []).slice(0, 3),
  ]);
  const excludedBaggage = uniqueStrings([
    structuralProcessStages.length >= 2
      ? "paper-specific benchmark and repository-generation detail that does not need to become Engine workflow logic"
      : null,
    controlSignalProfile?.framing === "iterative_loop"
      ? "repo-local command sequences and autonomous execution policy that should not become Directive Workspace automation"
      : controlSignalProfile
        ? "domain-specific shipping or delivery actions that should not become Directive Workspace automation"
      : null,
    input.source.sourceType === "github-repo" || input.source.sourceType === "external-system"
      ? "source-specific implementation baggage"
      : "non-mission-relevant source detail",
    input.lane.hostDependence === "host_adapter_required"
      ? "host-local assumptions from the original source"
      : "unadapted source terminology",
  ]);

  return {
    extractedValue:
      extractedValue.length > 0
        ? extractedValue
        : [`Potential ${input.lane.label} value from ${input.source.title || input.candidateId}.`],
    excludedBaggage,
  };
}

type DirectiveEngineAdaptationStageInput = {
  planningInput: DirectiveEngineLanePlanningInput;
  extractionPlan: DirectiveEngineExtractionPlan;
};

type DirectiveEngineImprovementStageInput = {
  planningInput: DirectiveEngineLanePlanningInput;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  runtimePromotionFeedbackSignal?: DirectiveEngineRuntimePromotionFeedbackSignal | null;
  runtimeExecutionEvidenceSignal?: DirectiveEngineRuntimeExecutionEvidenceSignal | null;
};

type DirectiveEngineRuntimePromotionFeedbackSignal = {
  summary: string;
  integrationHint: string;
  improvementHint: string;
};

type DirectiveEngineRuntimeExecutionEvidenceSignal = {
  summary: string;
  integrationHint: string;
  improvementHint: string;
};

function readExtractionPlanSummary(
  extractionPlan: DirectiveEngineExtractionPlan,
  prefix: string,
) {
  return extractionPlan.extractedValue
    .find((value) => value.startsWith(prefix))
    ?.replace(prefix, "")
    .trim()
    ?? null;
}

function adaptationPlanIncludes(
  adaptationPlan: DirectiveEngineAdaptationPlan,
  pattern: string,
) {
  const loweredPattern = pattern.toLowerCase();
  return adaptationPlan.directiveOwnedForm.toLowerCase().includes(loweredPattern)
    || adaptationPlan.adaptedValue.some((value) =>
      value.toLowerCase().includes(loweredPattern)
    );
}

function buildAdaptationPlan(
  input: DirectiveEngineAdaptationStageInput,
): DirectiveEngineAdaptationPlan {
  const { planningInput, extractionPlan } = input;
  const extractedStagePattern = readExtractionPlanSummary(
    extractionPlan,
    "Stage-aware structural pattern:",
  )?.replace(/\.$/u, "");
  const extractedLoopControlPattern = readExtractionPlanSummary(
    extractionPlan,
    "Bounded loop-control pattern:",
  )?.replace(/\.$/u, "");
  const extractedControlEvidencePattern = readExtractionPlanSummary(
    extractionPlan,
    "Bounded control/evidence pattern:",
  )?.replace(/\.$/u, "");
  const primaryExcludedBaggage = extractionPlan.excludedBaggage[0]
    ?? "source baggage that does not belong in the Engine";
  const hasStageAwareStructuralPattern = planningInput.lane.laneId === "architecture"
    && Boolean(extractedStagePattern);
  const hasLoopControlPattern = planningInput.lane.laneId === "architecture"
    && Boolean(extractedLoopControlPattern);
  const hasControlEvidencePattern = planningInput.lane.laneId === "architecture"
    && Boolean(extractedControlEvidencePattern);

  switch (planningInput.lane.laneId) {
    case "discovery":
      return {
        directiveOwnedForm:
          "Mission-aware Discovery intake case with explicit routing, boundary, and usefulness notes.",
        adaptedValue: [
          "Normalize the source into a Discovery-owned intake and routing case.",
          "Preserve ambiguity without forcing downstream adoption too early.",
        ],
      };
    case "architecture":
      if (hasStageAwareStructuralPattern) {
        return {
          directiveOwnedForm:
            "Directive-owned Engine logic that preserves explicit stage boundaries for structural source adaptation instead of collapsing them into one generic Architecture mechanism.",
          adaptedValue: [
            `Keep ${extractedStagePattern} as separate Engine-owned reasoning stages.`,
            `Carry forward the extraction boundary by excluding ${primaryExcludedBaggage} before any broader Architecture or Runtime claim is made.`,
          ],
        };
      }
      if (hasLoopControlPattern) {
        return {
          directiveOwnedForm:
            "Directive-owned Engine logic that preserves explicit bounded loop-control boundaries for iterative structural sources instead of collapsing them into one generic Architecture heuristic.",
          adaptedValue: [
            `Keep ${extractedLoopControlPattern} as separate Engine-owned control boundaries for repeated improvement loops.`,
            `Carry forward the extraction boundary by excluding ${primaryExcludedBaggage} before any repeated-loop implementation claim is made.`,
          ],
        };
      }
      if (hasControlEvidencePattern) {
        return {
          directiveOwnedForm:
            "Directive-owned Engine logic that preserves explicit bounded control and evidence boundaries for structural protocols instead of collapsing them into one generic Architecture heuristic.",
          adaptedValue: [
            `Keep ${extractedControlEvidencePattern} as separate Engine-owned control and evidence boundaries.`,
            `Carry forward the extraction boundary by excluding ${primaryExcludedBaggage} before any protocol-level shipping or execution claim is made.`,
          ],
        };
      }
      return {
        directiveOwnedForm:
          "Directive-owned Engine logic or operating-code asset such as a contract, schema, template, policy, or shared lib.",
        adaptedValue: [
          "Convert extracted mechanisms into Engine-owned logic or operating assets.",
          "Strip source baggage before adoption into the Engine.",
        ],
      };
    default:
      return {
        directiveOwnedForm:
          "Directive-owned runtime capability or transformation artifact behind a host adapter boundary.",
        adaptedValue: [
          "Convert the extracted mechanism into a bounded reusable runtime surface.",
          "Keep host-specific behavior behind the adapter boundary.",
        ],
      };
  }
}

function readRuntimePromotionFeedbackSignal():
  | DirectiveEngineRuntimePromotionFeedbackSignal
  | null {
  try {
    const assistance = buildDirectiveRuntimePromotionAssistanceReport();
    const validatedManualPromotionCycles =
      assistance.manualRuntimePromotionCycles.validatedLocallyCount;
    if (
      validatedManualPromotionCycles < 2
      || !assistance.topRecommendation
    ) {
      return null;
    }

    const externalHostPressure =
      assistance.topRecommendation.recommendedActionKind
      === "keep_parked_external_host_candidate";
    const repoNativeHostPressure =
      assistance.topRecommendation.hostScope === "directive_workspace_host"
      && (
        assistance.topRecommendation.recommendedActionKind
          === "request_manual_promotion_seam_decision"
        || assistance.topRecommendation.recommendedActionKind
          === "clarify_repo_native_host_target"
      );
    const callableBoundaryPressure =
      assistance.topRecommendation.recommendedActionKind
        === "clarify_callable_boundary";
    const hostTargetClarityPressure =
      repoNativeHostPressure
      || assistance.topRecommendation.recommendedActionKind
        === "clarify_repo_native_host_target";
    const summary = externalHostPressure
      ? `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the strongest remaining pre-host-ready candidate still stays parked because its proposed host is external.`
      : repoNativeHostPressure
        ? `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the current top recommendation is "${assistance.topRecommendation.recommendedActionKind}" for ${assistance.topRecommendation.candidateId} with a repo-native host target.`
        : `Runtime promotion evidence signal: ${validatedManualPromotionCycles} validated manual promotion cycles exist, and the current top recommendation is "${assistance.topRecommendation.recommendedActionKind}" for ${assistance.topRecommendation.candidateId}.`;

    return {
      summary,
      integrationHint: externalHostPressure
        ? "Use promotion assistance only as a reviewable soft signal; prefer explicit repo-native host targeting before any later promotion follow-through."
        : hostTargetClarityPressure
        ? "Use promotion assistance only as a reviewable soft signal; keep explicit host-target clarity before any later promotion follow-through."
        : callableBoundaryPressure
        ? "Use promotion assistance only as a reviewable soft signal; keep explicit callable-boundary clarity before any later promotion follow-through."
        : "Use promotion assistance only as a reviewable soft signal before any later promotion follow-through.",
      improvementHint: externalHostPressure || hostTargetClarityPressure
        ? "Improve host-target clarity before suggesting promotion follow-through for new Runtime candidates."
        : callableBoundaryPressure
        ? "Improve callable-boundary clarity before suggesting promotion follow-through for new Runtime candidates."
        : "Reuse promotion assistance as a soft planning signal instead of manual reinspection.",
    };
  } catch {
    return null;
  }
}

function readRuntimeExecutionEvidenceSignal():
  | DirectiveEngineRuntimeExecutionEvidenceSignal
  | null {
  try {
    const evidence = buildRuntimeCallableExecutionEvidenceReport({
      directiveRoot: DIRECTIVE_ROOT,
    });
    if (evidence.totalExecutionRecords < 2) {
      return null;
    }

    const latestFailure = evidence.failurePatterns[evidence.failurePatterns.length - 1] ?? null;
    const nonSuccessLabel = evidence.nonSuccessCount === 1
      ? "non-success result"
      : "non-success results";
    const summary = latestFailure
      ? `Runtime callable execution evidence signal: ${evidence.totalExecutionRecords} bounded execution records exist across ${evidence.capabilityCount} capabilities, and ${evidence.nonSuccessCount} ${nonSuccessLabel} ${evidence.nonSuccessCount === 1 ? "is" : "are"} already captured as ${latestFailure.status} for ${latestFailure.capabilityId}.`
      : `Runtime callable execution evidence signal: ${evidence.totalExecutionRecords} bounded execution records exist across ${evidence.capabilityCount} capabilities, all currently successful.`;

    return {
      summary,
      integrationHint: latestFailure
        ? "Use callable execution evidence only as a reviewable soft signal; keep explicit failure-pattern review before widening host consumption or broader Runtime surface claims."
        : "Use callable execution evidence only as a reviewable soft signal before widening host consumption or broader Runtime surface claims.",
      improvementHint: latestFailure
        ? `Improve callable input-boundary clarity where bounded execution evidence already shows ${latestFailure.status} patterns.`
        : "Reuse bounded callable execution evidence as a soft planning signal instead of re-arguing runtime viability from scratch.",
    };
  } catch {
    return null;
  }
}

function buildImprovementPlan(
  input: DirectiveEngineImprovementStageInput,
): DirectiveEngineImprovementPlan {
  const { planningInput, extractionPlan, adaptationPlan } = input;
  const structuralProcessStages = resolveStructuralProcessStages(planningInput.source);
  const controlSignalProfile = resolveControlSignalProfile(planningInput.source);
  const extractedStagePattern = readExtractionPlanSummary(
    extractionPlan,
    "Stage-aware structural pattern:",
  )?.replace(/\.$/u, "");
  const extractedLoopControlPattern = readExtractionPlanSummary(
    extractionPlan,
    "Bounded loop-control pattern:",
  )?.replace(/\.$/u, "");
  const extractedControlEvidencePattern = readExtractionPlanSummary(
    extractionPlan,
    "Bounded control/evidence pattern:",
  )?.replace(/\.$/u, "");
  const stageAwareAdaptationReady = Boolean(extractedStagePattern)
    && (
      adaptationPlanIncludes(adaptationPlan, "stage boundaries")
      || adaptationPlanIncludes(adaptationPlan, "engine-owned reasoning stages")
    );
  const loopControlAdaptationReady = Boolean(extractedLoopControlPattern)
    && (
      adaptationPlanIncludes(adaptationPlan, "loop-control")
      || adaptationPlanIncludes(adaptationPlan, "control boundaries")
    );
  const controlEvidenceAdaptationReady = Boolean(extractedControlEvidencePattern)
    && (
      adaptationPlanIncludes(adaptationPlan, "control and evidence boundaries")
      || adaptationPlanIncludes(adaptationPlan, "control and evidence")
      || adaptationPlanIncludes(adaptationPlan, "control boundaries")
    );
  const primaryAdaptedValue =
    adaptationPlan.adaptedValue[0] ?? adaptationPlan.directiveOwnedForm;

  switch (planningInput.lane.laneId) {
    case "discovery":
      return {
        improvementGoals: [
          "improve intake efficiency",
          "improve routing clarity",
        ],
        intendedDelta:
          "Make source selection and routing clearer and more reusable than the original source context.",
      };
    case "architecture":
      if (stageAwareAdaptationReady) {
        return {
          improvementGoals: [
            "improve stage-aware engine analysis for structural sources",
            "improve future source adaptation quality for ambiguous multi-stage candidates",
          ],
          intendedDelta:
            `Turn the preserved ${extractedStagePattern} stage pattern into explicit Engine-owned improvement plans so later planning stages can build on the adaptation boundary (${primaryAdaptedValue}) instead of recomputing everything from the same flat input.`,
        };
      }
      if (loopControlAdaptationReady) {
        return {
          improvementGoals: [
            "improve bounded iteration-control analysis for structural workflow sources",
            "improve future Architecture adaptation quality for loop protocols with explicit safety boundaries",
          ],
          intendedDelta:
            `Turn the preserved ${extractedLoopControlPattern} loop-control boundary into explicit Engine-owned improvement plans so later planning stages can compound the adaptation boundary (${primaryAdaptedValue}) instead of recomputing loop discipline from raw source text.`,
        };
      }
      if (controlEvidenceAdaptationReady) {
        return {
          improvementGoals: [
            "improve bounded control and evidence analysis for structural protocols",
            "improve future Architecture adaptation quality for approval, verification, rollback, and reporting structures",
          ],
          intendedDelta:
            `Turn the preserved ${extractedControlEvidencePattern} control/evidence boundary into Engine-owned improvement plans so later planning stages can build on the adaptation boundary (${primaryAdaptedValue}) without inventing runtime shipping behavior.`,
        };
      }
      if (structuralProcessStages.length >= 2) {
        return {
          improvementGoals: [
            "improve stage-aware engine analysis for structural sources",
            "improve future source adaptation quality for ambiguous multi-stage candidates",
          ],
          intendedDelta:
            `Turn multi-stage structural sources into explicit Engine-owned stage plans (${formatStructuralProcessStages(structuralProcessStages)}) so Architecture can preserve stage boundaries instead of flattening them into one generic adaptation step.`,
        };
      }
      if (controlSignalProfile?.framing === "iterative_loop") {
        return {
          improvementGoals: [
            "improve bounded iteration-control analysis for structural workflow sources",
            "improve future Architecture adaptation quality for loop protocols with explicit safety boundaries",
          ],
          intendedDelta:
            `Turn iterative structural sources into explicit Engine-owned loop-control plans (${formatIterativeControlSignals(controlSignalProfile.signals)}) so Architecture can preserve precondition, proof, rollback, decision, and results-memory boundaries instead of flattening them into one generic workflow note.`,
        };
      }
      if (controlSignalProfile?.framing === "bounded_protocol") {
        return {
          improvementGoals: [
            "improve bounded control and evidence analysis for structural protocols",
            "improve future Architecture adaptation quality for approval, verification, rollback, and reporting structures",
          ],
          intendedDelta:
            `Turn structural protocols with explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries into Engine-owned control/evidence plans so Architecture can preserve those gates without inventing loop semantics or runtime shipping behavior.`,
        };
      }
      return {
        improvementGoals: [
          "improve engine self-improvement quality",
          "improve future source adaptation quality",
        ],
        intendedDelta:
          "Turn extracted mechanisms into Directive-owned improvements that compound future source consumption.",
      };
    default:
      return {
        improvementGoals: [
          "improve runtime reuse",
          "improve speed, cost, reliability, or structure while preserving behavior",
          ...(input.runtimePromotionFeedbackSignal
            ? [input.runtimePromotionFeedbackSignal.improvementHint]
            : []),
          ...(input.runtimeExecutionEvidenceSignal
            ? [input.runtimeExecutionEvidenceSignal.improvementHint]
            : []),
        ],
        intendedDelta:
          `Operationalize the value in a reusable runtime shape with stronger boundaries than the source.${input.runtimePromotionFeedbackSignal ? ` ${input.runtimePromotionFeedbackSignal.summary}` : ""}${input.runtimeExecutionEvidenceSignal ? ` ${input.runtimeExecutionEvidenceSignal.summary}` : ""}`,
      };
  }
}

function buildIntegrationProposal(
  input: DirectiveEngineLaneIntegrationPlanningInput,
  runtimePromotionFeedbackSignal?: DirectiveEngineRuntimePromotionFeedbackSignal | null,
  runtimeExecutionEvidenceSignal?: DirectiveEngineRuntimeExecutionEvidenceSignal | null,
): DirectiveEngineIntegrationProposal {
  const integrationMode = deriveIntegrationMode({
    source: input.planningInput.source,
    defaultIntegrationMode: input.planningInput.lane.defaultIntegrationMode,
    valuableWithoutHostRuntime: input.planningInput.lane.valuableWithoutHostRuntime,
  });

  const base: DirectiveEngineIntegrationProposal = {
    targetLaneId: input.planningInput.lane.laneId,
    targetLaneLabel: input.planningInput.lane.label,
    integrationMode,
    hostDependence: input.planningInput.lane.hostDependence,
    valuableWithoutHostRuntime: input.planningInput.lane.valuableWithoutHostRuntime,
    handoffArtifactFamily: input.planningInput.lane.handoffArtifactFamily,
    nextAction:
      input.planningInput.lane.laneId === "runtime"
        ? [
            input.planningInput.lane.nextAction,
            runtimePromotionFeedbackSignal?.integrationHint,
            runtimeExecutionEvidenceSignal?.integrationHint,
          ]
            .filter(Boolean)
            .join(" ")
        : input.planningInput.lane.nextAction,
    requiresHumanReview: input.planningInput.routingAssessment.needsHumanReview,
  };

  const overrides = input.planningInput.lane.planIntegration?.(input) ?? {};
  return {
    ...base,
    ...overrides,
  };
}

function buildDecision(input: {
  lane: DirectiveEngineSelectedLane;
  candidate: DirectiveEngineCandidate;
  integrationProposal: DirectiveEngineIntegrationProposal;
}): DirectiveEngineDecision {
  let decisionState: DirectiveEngineDecision["decisionState"];
  if (input.lane.laneId === "discovery") {
    decisionState = "hold_in_discovery";
  } else if (input.candidate.requiresHumanReview) {
    decisionState = "needs_human_review";
  } else if (input.lane.laneId === "architecture") {
    decisionState = "accept_for_architecture";
  } else {
    decisionState = "route_to_runtime_follow_up";
  }

  return {
    decisionState,
    adoptionTargetLaneId: input.lane.laneId,
    adoptionTargetLaneLabel: input.lane.label,
    requiresHumanApproval: true,
    summary:
      decisionState === "needs_human_review"
        ? `Preliminary engine decision: needs_human_review for ${input.lane.label}; the route is bounded but must be reviewed explicitly before downstream adoption.`
        : `Preliminary engine decision: ${decisionState} for ${input.lane.label}${input.candidate.requiresHumanReview ? " with additional human review required" : ""}, pending human approval before final adoption.`,
    rationale: [
      ...input.candidate.rationale,
      input.integrationProposal.nextAction,
    ],
  };
}

function buildReportPlan(input: {
  lane: DirectiveEngineSelectedLane;
  decision: DirectiveEngineDecision;
  integrationProposal: DirectiveEngineIntegrationProposal;
  usefulnessRationale: string;
}): DirectiveEngineReportPlan {
  const reportKind =
    input.lane.laneId === "discovery"
      ? "discovery_routing_report"
      : input.lane.laneId === "architecture"
        ? "architecture_adaptation_report"
        : "runtime_follow_up_report";

  const requiredDestinations = [
    "directive_workspace_record",
    "directive_workspace_report_sync",
  ];

  if (input.integrationProposal.hostDependence === "host_adapter_required") {
    requiredDestinations.push("host_adapter_report");
  }

  return {
    reportKind,
    summary:
      `Sync the ${input.decision.decisionState} decision and ${input.integrationProposal.integrationMode} integration plan into Directive Workspace reporting surfaces. Usefulness rationale: ${input.usefulnessRationale}`,
    usefulnessRationale: input.usefulnessRationale,
    requiredDestinations,
    syncRequired: true,
  };
}

function buildEvents(input: {
  receivedAt: string;
  analysis: DirectiveEngineAnalysis;
  candidate: DirectiveEngineCandidate;
  extractionPlan: DirectiveEngineExtractionPlan;
  adaptationPlan: DirectiveEngineAdaptationPlan;
  improvementPlan: DirectiveEngineImprovementPlan;
  proofPlan: DirectiveEngineProofPlan;
  decision: DirectiveEngineDecision;
  integrationProposal: DirectiveEngineIntegrationProposal;
  reportPlan: DirectiveEngineReportPlan;
}): DirectiveEngineEvent[] {
  return [
    {
      type: "source_ingested",
      at: input.receivedAt,
      summary: `Source captured for candidate ${input.candidate.candidateId}.`,
    },
    {
      type: "source_analyzed",
      at: input.receivedAt,
      summary: `${input.analysis.missionFitSummary} Usefulness rationale: ${input.analysis.usefulnessRationale}`,
    },
    {
      type: "candidate_routed",
      at: input.receivedAt,
      summary:
        `Candidate routed to ${input.candidate.recommendedLaneId} with usefulness level ${input.candidate.usefulnessLevel}. ${input.analysis.usefulnessRationale}`,
    },
    {
      type: "value_extracted",
      at: input.receivedAt,
      summary: `Extracted ${input.extractionPlan.extractedValue.length} value signals and excluded ${input.extractionPlan.excludedBaggage.length} baggage signals.`,
    },
    {
      type: "value_adapted",
      at: input.receivedAt,
      summary: input.adaptationPlan.directiveOwnedForm,
    },
    {
      type: "value_improved",
      at: input.receivedAt,
      summary: input.improvementPlan.intendedDelta,
    },
    {
      type: "proof_planned",
      at: input.receivedAt,
      summary: `Proof plan ${input.proofPlan.proofKind} prepared.`,
    },
    {
      type: "decision_recorded",
      at: input.receivedAt,
      summary: input.decision.summary,
    },
    {
      type: "integration_proposed",
      at: input.receivedAt,
      summary: `Integration proposal targets ${input.integrationProposal.targetLaneId} via ${input.integrationProposal.handoffArtifactFamily}.`,
    },
    {
      type: "report_planned",
      at: input.receivedAt,
      summary: input.reportPlan.summary,
    },
  ];
}

export class DirectiveEngine {
  readonly store: DirectiveEngineStore;
  readonly laneSet: DirectiveEngineLaneSet;
  readonly hostAdapters: DirectiveEngineHostAdapter[];

  constructor(input: {
    laneSet: DirectiveEngineLaneSet;
    store?: DirectiveEngineStore;
    hostAdapters?: DirectiveEngineHostAdapter[];
  }) {
    if (!input.laneSet) {
      throw new Error(
        "directive_engine_lane_set_required: construct DirectiveEngine with an explicit lane set",
      );
    }

    this.laneSet = input.laneSet;
    this.store = input.store ?? createMemoryDirectiveEngineStore();
    this.hostAdapters = [...(input.hostAdapters ?? [])];
  }

  async processSource(
    input: DirectiveEngineProcessSourceInput,
  ): Promise<DirectiveEngineProcessSourceResult> {
    const receivedAt =
      normalizeText(input.receivedAt) || new Date().toISOString();
    const mission = resolveMissionContext(input.mission);
    const source: DirectiveEngineSourceItem = {
      ...input.source,
      sourceType: normalizeDirectiveEngineSourceType(input.source.sourceType),
      sourceRef: normalizeText(input.source.sourceRef),
      title: normalizeText(input.source.title),
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
    const candidateId = deriveCandidateId(source);
    const openGaps = [...(input.gaps ?? [])];
    const routingAssessment = assessDirectiveEngineRouting({
      source,
      mission,
      openGaps,
    });
    const lane = resolveDirectiveEngineLane({
      laneSet: this.laneSet,
      laneId: routingAssessment.recommendedLaneId,
    });
    const planningInput: DirectiveEngineLanePlanningInput = {
      source,
      mission,
      openGaps,
      candidateId,
      receivedAt,
      routingAssessment,
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
    // First bounded chaining slice: adaptation now consumes extraction output.
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
    const usefulnessLevel = this.laneSet.refineUsefulness
      ? this.laneSet.refineUsefulness(usefulnessPlanningInput)
      : classifyDirectiveEngineUsefulness(usefulnessPlanningInput);
    const usefulnessRationale = explainDirectiveEngineUsefulness(
      usefulnessPlanningInput,
      usefulnessLevel,
    );
    const candidate: DirectiveEngineCandidate = {
      candidateId,
      candidateName: source.title || candidateId,
      recommendedLaneId: routingAssessment.recommendedLaneId,
      recommendedLaneLabel: lane.label,
      recommendedRecordShape: routingAssessment.recommendedRecordShape,
      usefulnessLevel,
      missionPriorityScore: routingAssessment.missionPriorityScore,
      confidence: routingAssessment.confidence,
      matchedGapId: routingAssessment.matchedGapId,
      matchedGapRank: routingAssessment.matchedGapRank,
      requiresHumanReview: routingAssessment.needsHumanReview,
      rationale: [...routingAssessment.rationale],
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
    const integrationProposal = buildIntegrationProposal({
      planningInput,
      extractionPlan,
      adaptationPlan,
      improvementPlan,
      proofPlan,
    }, runtimePromotionFeedbackSignal, runtimeExecutionEvidenceSignal);
    const decision = buildDecision({
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
    const runRecord: DirectiveEngineRunRecord = {
      $schema: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_REF,
      schemaVersion: DIRECTIVE_ENGINE_RUN_RECORD_SCHEMA_VERSION,
      recordKind: DIRECTIVE_ENGINE_RUN_RECORD_KIND,
      runId: crypto.randomUUID(),
      receivedAt,
      source,
      mission,
      openGaps,
      selectedLane,
      candidate,
      analysis,
      routingAssessment,
      extractionPlan,
      adaptationPlan,
      improvementPlan,
      proofPlan,
      decision,
      integrationProposal,
      reportPlan,
      events: buildEvents({
        receivedAt,
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

    await this.store.writeRun(runRecord);

    const adapterResults = [];
    for (const adapter of this.hostAdapters) {
      const adapterResult = adapter.onRunRecorded
        ? await adapter.onRunRecorded(runRecord)
        : undefined;
      adapterResults.push({
        adapterId: adapter.id,
        accepted: adapterResult?.accepted ?? true,
        note: normalizeText(adapterResult?.note) || null,
      });
    }

    return {
      ok: true,
      record: runRecord,
      adapterResults,
    };
  }

  async getRun(runId: string) {
    return this.store.readRun(runId);
  }

  async listRuns() {
    return this.store.listRuns();
  }
}
