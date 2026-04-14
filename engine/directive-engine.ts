/// <reference types="node" />

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createFilesystemDirectiveEngineStore,
  type DirectiveEngineStore,
} from "./storage.ts";
import { assessDirectiveEngineRouting } from "./routing.ts";
import { deriveDirectiveRoutingDiff } from "./routing-diff.ts";
import { createDefaultDirectiveMission } from "./default-mission.ts";
import { normalizeText } from "./engine-source-utils.ts";
import {
  classifyDirectiveEngineUsefulness,
  explainDirectiveEngineUsefulness,
} from "./usefulness.ts";
import {
  type DirectiveEngineLaneDefinition,
  type DirectiveEngineLaneAdaptationPlanningInput,
  type DirectiveEngineLaneExtractionPlanningInput,
  type DirectiveEngineLaneIntegrationPlanningInput,
  type DirectiveEngineLaneImprovementPlanningInput,
  resolveDirectiveEngineLane,
  type DirectiveEngineLanePlanningInput,
  type DirectiveEngineLaneProofPlanningInput,
  type DirectiveEngineLaneUsefulnessPlanningInput,
  type DirectiveEngineLaneSet,
} from "./lane.ts";
import {
  buildDefaultAdaptationPlan,
  buildDefaultExtractionPlan,
  buildDefaultImprovementPlan,
} from "./lane-planning-defaults.ts";
import {
  formatIterativeControlSignals,
  formatStructuralProcessStages,
  resolveControlSignalProfile,
  resolveStructuralProcessStages,
} from "./lane-planning-helpers.ts";
import { normalizeDirectiveEngineSourceType } from "./source-type-normalization.ts";
import { inferDirectiveEngineSourceType } from "./source-type-inference.ts";
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
  type DirectiveEngineMinimalSourceInput,
  type DirectiveEngineMissionContext,
  type DirectiveEngineMissionInput,
  type DirectiveEngineMissionPreviewChange,
  type DirectiveEngineProcessSourceInput,
  type DirectiveEngineProcessSourceResult,
  type DirectiveEngineProofPlan,
  type DirectiveEnginePrimaryAdoptionTarget,
  type DirectiveEnginePlanItem,
  type DirectiveEnginePlanProgressUpdate,
  type DirectiveEngineReportPlan,
  type DirectiveEngineRunRecord,
  type DirectiveEngineRoutingDigestPreview,
  type DirectiveEngineSelectedLane,
  type DirectiveEngineSourceItem,
  type DirectiveEngineStructuredAdaptationPlan,
  type DirectiveEngineStructuredExtractionPlan,
  type DirectiveEngineStructuredImprovementPlan,
  type DirectiveEngineStructuredProofPlan,
  type DirectiveEngineWorkflowBoundaryShape,
} from "./types.ts";
import { deriveDirectivePriorPlanContext } from "./plan-consumption.ts";
import { deriveDirectivePlanQualitySignal } from "./plan-quality.ts";
import { deriveDirectiveNarrativeActions } from "./source-narrative-threading.ts";
import { buildRuntimeCallableExecutionEvidenceReport } from "../runtime/lib/runtime-callable-execution-evidence.ts";
import { buildDirectiveRuntimePromotionAssistanceReport } from "../runtime/lib/runtime-promotion-assistance.ts";

const DIRECTIVE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function normalizeFingerprintText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const capabilityLanes = getSectionBody(markdown, "Capability Lanes That Matter Most")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const constraints = getSectionBody(markdown, "Constraints")
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const successSignal = getSectionBody(markdown, "Success Signal")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line))
    .join(" ");
  const adoptionTarget = getSectionBody(markdown, "Adoption Target")
    .split(/\r?\n/)
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

function buildMissionMarkdown(input: DirectiveEngineMissionInput) {
  const objective =
    normalizeText(input.currentObjective) || "Mission objective not provided.";
  const usefulnessSignals = (input.usefulnessSignals ?? []).filter(Boolean);
  const capabilityLanes = (input.capabilityLanes ?? []).filter(Boolean);
  const constraints = (input.constraints ?? []).filter(Boolean);
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
    constraints:
      (input.constraints ?? []).filter(Boolean).length > 0
        ? (input.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.constraints,
    successSignal:
      normalizeText(input.successSignal) || parsed.successSignal || null,
    adoptionTarget:
      normalizeText(input.adoptionTarget) || parsed.adoptionTarget || null,
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

function deriveMinimalSourceRef(input: {
  title: string;
  summary: string | null;
}) {
  const stableSlug =
    sanitizeIdSegment(input.title)
    || sanitizeIdSegment(input.summary ?? "")
    || crypto.createHash("sha1").update(`${input.title}\n${input.summary ?? ""}`).digest("hex").slice(0, 12);
  return `inline://minimal/${stableSlug}`;
}

function validateDirectiveEngineSource(source: DirectiveEngineSourceItem) {
  const sourceId = normalizeText(source.sourceId);
  const sourceRef = normalizeText(source.sourceRef);
  const title = normalizeText(source.title);
  const summary = normalizeText(source.summary);

  if (!sourceRef) {
    throw new Error("invalid_input: source.sourceRef is required");
  }

  if (!title && !summary && !sourceId) {
    throw new Error(
      "invalid_input: source must include at least one non-empty title, summary, or sourceId field",
    );
  }
}

function deriveProcessFingerprint(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    sourceType: input.source.sourceType,
    sourceRef: normalizeFingerprintText(input.source.sourceRef),
    summary: normalizeFingerprintText(input.source.summary),
    missionAlignmentHint: normalizeFingerprintText(input.source.missionAlignmentHint),
    capabilityGapId: normalizeFingerprintText(input.source.capabilityGapId),
    primaryAdoptionTarget: input.source.primaryAdoptionTarget ?? null,
    containsExecutableCode: input.source.containsExecutableCode ?? null,
    containsWorkflowPattern: input.source.containsWorkflowPattern ?? null,
    improvesDirectiveWorkspace: input.source.improvesDirectiveWorkspace ?? null,
    workflowBoundaryShape: input.source.workflowBoundaryShape ?? null,
    missionId: normalizeFingerprintText(input.mission.missionId),
    currentObjective: normalizeFingerprintText(input.mission.currentObjective),
    usefulnessSignals: input.mission.usefulnessSignals.map((value) => normalizeFingerprintText(value)),
    capabilityLanes: input.mission.capabilityLanes.map((value) => normalizeFingerprintText(value)),
    constraints: input.mission.constraints.map((value) => normalizeFingerprintText(value)),
    successSignal: normalizeFingerprintText(input.mission.successSignal),
    adoptionTarget: normalizeFingerprintText(input.mission.adoptionTarget),
  })).digest("hex");
}

function recordMatchesProcessFingerprint(input: {
  record: DirectiveEngineRunRecord;
  fingerprint: string;
}) {
  return deriveProcessFingerprint({
    source: input.record.source,
    mission: input.record.mission,
  }) === input.fingerprint;
}

function withTimeout<T>(
  operation: Promise<T> | T,
  timeoutMs: number,
  label: string,
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.resolve(operation);
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`timeout:${label}:${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
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

function toPlanItem(value: string): DirectiveEnginePlanItem {
  return {
    value,
    status: "pending",
    completedAt: null,
  };
}

function completionRate(items: DirectiveEnginePlanItem[]) {
  if (items.length === 0) {
    return 0;
  }
  const completedCount = items.filter((item) => item.status === "completed").length;
  return Math.round((completedCount / items.length) * 100);
}

function buildStructuredExtractionPlan(
  extractionPlan: DirectiveEngineExtractionPlan,
): DirectiveEngineStructuredExtractionPlan {
  const extractedValue = extractionPlan.extractedValue.map(toPlanItem);
  const excludedBaggage = extractionPlan.excludedBaggage.map(toPlanItem);
  return {
    extractedValue,
    excludedBaggage,
    completionRate: completionRate([...extractedValue, ...excludedBaggage]),
  };
}

function buildStructuredAdaptationPlan(
  adaptationPlan: DirectiveEngineAdaptationPlan,
): DirectiveEngineStructuredAdaptationPlan {
  const directiveOwnedForm = toPlanItem(adaptationPlan.directiveOwnedForm);
  const adaptedValue = adaptationPlan.adaptedValue.map(toPlanItem);
  return {
    directiveOwnedForm,
    adaptedValue,
    completionRate: completionRate([directiveOwnedForm, ...adaptedValue]),
  };
}

function buildStructuredImprovementPlan(
  improvementPlan: DirectiveEngineImprovementPlan,
): DirectiveEngineStructuredImprovementPlan {
  const intendedDelta = toPlanItem(improvementPlan.intendedDelta);
  const improvementGoals = improvementPlan.improvementGoals.map(toPlanItem);
  return {
    improvementGoals,
    intendedDelta,
    completionRate: completionRate([intendedDelta, ...improvementGoals]),
  };
}

function buildStructuredProofPlan(
  proofPlan: DirectiveEngineProofPlan,
): DirectiveEngineStructuredProofPlan {
  const objective = toPlanItem(proofPlan.objective);
  const requiredEvidence = proofPlan.requiredEvidence.map(toPlanItem);
  const requiredGates = proofPlan.requiredGates.map(toPlanItem);
  const rollbackPrompt = toPlanItem(proofPlan.rollbackPrompt);
  return {
    proofKind: proofPlan.proofKind,
    objective,
    requiredEvidence,
    requiredGates,
    rollbackPrompt,
    completionRate: completionRate([
      objective,
      rollbackPrompt,
      ...requiredEvidence,
      ...requiredGates,
    ]),
  };
}

function normalizeCompletedAtForStatus(input: {
  status: DirectiveEnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
}) {
  if (input.status === "completed") {
    return normalizeText(input.completedAt) || input.fallbackAt;
  }
  return null;
}

function applyPlanItemStatusUpdate(input: {
  item: DirectiveEnginePlanItem;
  status: DirectiveEnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
}) {
  return {
    ...input.item,
    status: input.status,
    completedAt: normalizeCompletedAtForStatus({
      status: input.status,
      completedAt: input.completedAt,
      fallbackAt: input.fallbackAt,
    }),
  } satisfies DirectiveEnginePlanItem;
}

function updateIndexedPlanItems(input: {
  items: DirectiveEnginePlanItem[];
  index: number;
  status: DirectiveEnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
  label: string;
}) {
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= input.items.length) {
    throw new Error(`invalid_input: ${input.label} index ${input.index} is out of range`);
  }
  return input.items.map((item, index) =>
    index === input.index
      ? applyPlanItemStatusUpdate({
        item,
        status: input.status,
        completedAt: input.completedAt,
        fallbackAt: input.fallbackAt,
      })
      : item
  );
}

function normalizeStructuredPlans(record: DirectiveEngineRunRecord) {
  return {
    structuredExtractionPlan:
      record.structuredExtractionPlan ?? buildStructuredExtractionPlan(record.extractionPlan),
    structuredAdaptationPlan:
      record.structuredAdaptationPlan ?? buildStructuredAdaptationPlan(record.adaptationPlan),
    structuredImprovementPlan:
      record.structuredImprovementPlan ?? buildStructuredImprovementPlan(record.improvementPlan),
    structuredProofPlan:
      record.structuredProofPlan ?? buildStructuredProofPlan(record.proofPlan),
  };
}

function applyPlanProgressUpdates(input: {
  record: DirectiveEngineRunRecord;
  updates: DirectiveEnginePlanProgressUpdate[];
  at: string;
}) {
  let {
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
  } = normalizeStructuredPlans(input.record);

  for (const update of input.updates) {
    switch (update.plan) {
      case "extraction":
        structuredExtractionPlan = {
          ...structuredExtractionPlan,
          [update.itemType]: updateIndexedPlanItems({
            items: structuredExtractionPlan[update.itemType],
            index: update.index,
            status: update.status,
            completedAt: update.completedAt,
            fallbackAt: input.at,
            label: `structuredExtractionPlan.${update.itemType}`,
          }),
        };
        structuredExtractionPlan = {
          ...structuredExtractionPlan,
          completionRate: completionRate([
            ...structuredExtractionPlan.extractedValue,
            ...structuredExtractionPlan.excludedBaggage,
          ]),
        };
        break;
      case "adaptation":
        if (update.itemType === "directiveOwnedForm") {
          structuredAdaptationPlan = {
            ...structuredAdaptationPlan,
            directiveOwnedForm: applyPlanItemStatusUpdate({
              item: structuredAdaptationPlan.directiveOwnedForm,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else {
          structuredAdaptationPlan = {
            ...structuredAdaptationPlan,
            adaptedValue: updateIndexedPlanItems({
              items: structuredAdaptationPlan.adaptedValue,
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: "structuredAdaptationPlan.adaptedValue",
            }),
          };
        }
        structuredAdaptationPlan = {
          ...structuredAdaptationPlan,
          completionRate: completionRate([
            structuredAdaptationPlan.directiveOwnedForm,
            ...structuredAdaptationPlan.adaptedValue,
          ]),
        };
        break;
      case "improvement":
        if (update.itemType === "intendedDelta") {
          structuredImprovementPlan = {
            ...structuredImprovementPlan,
            intendedDelta: applyPlanItemStatusUpdate({
              item: structuredImprovementPlan.intendedDelta,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else {
          structuredImprovementPlan = {
            ...structuredImprovementPlan,
            improvementGoals: updateIndexedPlanItems({
              items: structuredImprovementPlan.improvementGoals,
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: "structuredImprovementPlan.improvementGoals",
            }),
          };
        }
        structuredImprovementPlan = {
          ...structuredImprovementPlan,
          completionRate: completionRate([
            structuredImprovementPlan.intendedDelta,
            ...structuredImprovementPlan.improvementGoals,
          ]),
        };
        break;
      case "proof":
        if (update.itemType === "objective" || update.itemType === "rollbackPrompt") {
          structuredProofPlan = {
            ...structuredProofPlan,
            [update.itemType]: applyPlanItemStatusUpdate({
              item: structuredProofPlan[update.itemType],
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else {
          structuredProofPlan = {
            ...structuredProofPlan,
            [update.itemType]: updateIndexedPlanItems({
              items: structuredProofPlan[update.itemType],
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: `structuredProofPlan.${update.itemType}`,
            }),
          };
        }
        structuredProofPlan = {
          ...structuredProofPlan,
          completionRate: completionRate([
            structuredProofPlan.objective,
            structuredProofPlan.rollbackPrompt,
            ...structuredProofPlan.requiredEvidence,
            ...structuredProofPlan.requiredGates,
          ]),
        };
        break;
    }
  }

  return {
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
  };
}

function buildProcessSourceInputFromRecord(record: DirectiveEngineRunRecord) {
  return {
    source: { ...record.source },
    mission: {
      missionId: record.mission.missionId,
      currentObjective: record.mission.currentObjective,
      usefulnessSignals: [...record.mission.usefulnessSignals],
      capabilityLanes: [...record.mission.capabilityLanes],
      constraints: [...record.mission.constraints],
      successSignal: record.mission.successSignal,
      adoptionTarget: record.mission.adoptionTarget,
      activeMissionMarkdown: record.mission.activeMissionMarkdown,
    },
    gaps: [...record.openGaps],
    receivedAt: record.receivedAt,
  };
}

function applyStructuredAnswersToRecordInput(input: {
  recordInput: ReturnType<typeof buildProcessSourceInputFromRecord>;
  answers: Record<string, unknown>;
}) {
  const next = {
    ...input.recordInput,
    source: { ...input.recordInput.source },
    mission: { ...input.recordInput.mission },
  };

  for (const [field, value] of Object.entries(input.answers)) {
    switch (field) {
      case "source.primaryAdoptionTarget":
        next.source.primaryAdoptionTarget = normalizePrimaryAdoptionTarget(value);
        break;
      case "source.containsExecutableCode":
        next.source.containsExecutableCode = normalizeOptionalBoolean(value);
        break;
      case "source.containsWorkflowPattern":
        next.source.containsWorkflowPattern = normalizeOptionalBoolean(value);
        break;
      case "source.improvesDirectiveWorkspace":
        next.source.improvesDirectiveWorkspace = normalizeOptionalBoolean(value);
        break;
      case "source.workflowBoundaryShape":
        next.source.workflowBoundaryShape = normalizeWorkflowBoundaryShape(value);
        break;
      case "source.capabilityGapId":
        next.source.capabilityGapId = normalizeText(value) || null;
        break;
      case "source.missionAlignmentHint":
        next.source.missionAlignmentHint = normalizeText(value) || null;
        break;
      case "mission.currentObjective":
        next.mission.currentObjective = normalizeText(value) || null;
        break;
      case "mission.usefulnessSignals":
        next.mission.usefulnessSignals = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.usefulnessSignals;
        break;
      case "mission.capabilityLanes":
        next.mission.capabilityLanes = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.capabilityLanes;
        break;
      case "mission.constraints":
        next.mission.constraints = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.constraints;
        break;
      case "mission.successSignal":
        next.mission.successSignal = normalizeText(value) || null;
        break;
      case "mission.adoptionTarget":
        next.mission.adoptionTarget = normalizeText(value) || null;
        break;
    }
  }

  return next;
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
  return input.lane.planExtraction?.({ planningInput: input })
    ?? buildDefaultExtractionPlan({ planningInput: input });
}

type DirectiveEngineRuntimePromotionFeedbackSignal =
  NonNullable<DirectiveEngineLaneImprovementPlanningInput["runtimePromotionFeedbackSignal"]>;

type DirectiveEngineRuntimeExecutionEvidenceSignal =
  NonNullable<DirectiveEngineLaneImprovementPlanningInput["runtimeExecutionEvidenceSignal"]>;

function buildAdaptationPlan(
  input: DirectiveEngineLaneAdaptationPlanningInput,
): DirectiveEngineAdaptationPlan {
  return input.planningInput.lane.planAdaptation?.(input)
    ?? buildDefaultAdaptationPlan(input);
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
  input: DirectiveEngineLaneImprovementPlanningInput,
): DirectiveEngineImprovementPlan {
  return input.planningInput.lane.planImprovement?.(input)
    ?? buildDefaultImprovementPlan(input);
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
  laneDefinition: DirectiveEngineLaneDefinition;
  lane: DirectiveEngineSelectedLane;
  candidate: DirectiveEngineCandidate;
  integrationProposal: DirectiveEngineIntegrationProposal;
}): DirectiveEngineDecision {
  let decisionState: DirectiveEngineDecision["decisionState"];
  if (input.candidate.requiresHumanReview) {
    decisionState = "needs_human_review";
  } else {
    decisionState =
      input.laneDefinition.defaultDecisionState
      ?? (input.lane.laneId === "discovery"
        ? "hold_in_discovery"
        : input.lane.laneId === "architecture"
          ? "accept_for_architecture"
          : "route_to_runtime_follow_up");
  }

  const requiresHumanApproval =
    input.candidate.requiresHumanReview
    || input.integrationProposal.requiresHumanReview;

  return {
    decisionState,
    adoptionTargetLaneId: input.lane.laneId,
    adoptionTargetLaneLabel: input.lane.label,
    requiresHumanApproval,
    summary:
      decisionState === "needs_human_review"
        ? `Preliminary engine decision: needs_human_review for ${input.lane.label}; the route is bounded but must be reviewed explicitly before downstream adoption.`
        : requiresHumanApproval
          ? `Preliminary engine decision: ${decisionState} for ${input.lane.label}${input.candidate.requiresHumanReview ? " with additional human review required" : ""}, pending human approval before final adoption.`
          : input.lane.laneId === "discovery"
            ? `Preliminary engine decision: ${decisionState} for ${input.lane.label}; the source is held in Discovery without opening a separate manual approval step.`
            : `Preliminary engine decision: ${decisionState} for ${input.lane.label}; the route is bounded strongly enough to proceed without an additional manual approval gate.`,
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
  readonly storeTimeoutMs: number;
  readonly hostAdapterTimeoutMs: number;

  constructor(input: {
    laneSet: DirectiveEngineLaneSet;
    store?: DirectiveEngineStore;
    hostAdapters?: DirectiveEngineHostAdapter[];
    storeTimeoutMs?: number;
    hostAdapterTimeoutMs?: number;
  }) {
    if (!input.laneSet) {
      throw new Error(
        "directive_engine_lane_set_required: construct DirectiveEngine with an explicit lane set",
      );
    }

    this.laneSet = input.laneSet;
    this.store = input.store ?? createFilesystemDirectiveEngineStore();
    this.hostAdapters = [...(input.hostAdapters ?? [])];
    this.storeTimeoutMs = input.storeTimeoutMs ?? 5_000;
    this.hostAdapterTimeoutMs = input.hostAdapterTimeoutMs ?? 5_000;
  }

  async processMinimalSource(
    input: DirectiveEngineMinimalSourceInput,
  ): Promise<DirectiveEngineProcessSourceResult> {
    const title = normalizeText(input.title);
    if (!title) {
      throw new Error("invalid_input: minimal source title is required");
    }

    const summary = normalizeText(input.summary) || null;
    const sourceRef = normalizeText(input.url) || deriveMinimalSourceRef({
      title,
      summary,
    });

    return this.processSource({
      receivedAt: input.receivedAt,
      mission: input.mission ?? createDefaultDirectiveMission(),
      gaps: input.gaps ?? null,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      source: {
        sourceId: sanitizeIdSegment(title) || null,
        sourceType: inferDirectiveEngineSourceType({
          title,
          url: input.url,
          summary,
        }),
        sourceRef,
        title,
        summary,
      },
    });
  }

  async processSource(
    input: DirectiveEngineProcessSourceInput,
  ): Promise<DirectiveEngineProcessSourceResult> {
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
    const candidateId = deriveCandidateId(source);
    const processFingerprint = deriveProcessFingerprint({
      source,
      mission,
    });
    const existingRuns = await withTimeout(
      this.store.listRuns(),
      this.storeTimeoutMs,
      "store.listRuns",
    );
    const duplicateRecord = [...existingRuns]
      .reverse()
      .find((record) => recordMatchesProcessFingerprint({
        record,
        fingerprint: processFingerprint,
      }));
    if (duplicateRecord) {
      return {
        ok: true,
        record: duplicateRecord,
        adapterResults: [],
        deduplicated: true,
        duplicateOfRunId: duplicateRecord.runId,
        duplicateReason: "matching source and mission fingerprint",
      };
    }
    const openGaps = [...(input.gaps ?? [])];
    const corrections = [...(input.corrections ?? [])];
    const routingAssessment = assessDirectiveEngineRouting({
      source,
      mission,
      openGaps,
      corrections,
      policyEvents: [...(input.policyEvents ?? [])],
      existingRuns,
      receivedAt,
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
    const structuredExtractionPlan = buildStructuredExtractionPlan(extractionPlan);
    const structuredAdaptationPlan = buildStructuredAdaptationPlan(adaptationPlan);
    const structuredImprovementPlan = buildStructuredImprovementPlan(improvementPlan);
    const structuredProofPlan = buildStructuredProofPlan(proofPlan);
    const priorPlanContext = deriveDirectivePriorPlanContext({
      source,
      recommendedLaneId: selectedLane.laneId,
      existingRuns,
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
      receivedAt,
      source,
      mission,
      openGaps,
      selectedLane,
      candidate,
      analysis,
      routingAssessment,
      extractionPlan,
      structuredExtractionPlan,
      adaptationPlan,
      structuredAdaptationPlan,
      improvementPlan,
      structuredImprovementPlan,
      proofPlan,
      structuredProofPlan,
      planQualitySignal: null,
      narrativeActions: null,
      priorPlanContext,
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
    const runRecord: DirectiveEngineRunRecord = {
      ...preliminaryRunRecord,
      planQualitySignal: deriveDirectivePlanQualitySignal({
        record: preliminaryRunRecord,
        existingRuns,
        policyEvents: [...(input.policyEvents ?? [])],
        corrections,
      }),
      narrativeActions: deriveDirectiveNarrativeActions({
        narrativeContext: preliminaryRunRecord.routingAssessment.narrativeContext,
        openGaps,
        currentRecord: preliminaryRunRecord,
      }),
    };

    await withTimeout(this.store.writeRun(runRecord), this.storeTimeoutMs, "store.writeRun");

    const adapterResults = [];
    for (const adapter of this.hostAdapters) {
      try {
        const adapterResult = adapter.onRunRecorded
          ? await withTimeout(
            adapter.onRunRecorded(runRecord),
            this.hostAdapterTimeoutMs,
            `hostAdapter:${adapter.id}:onRunRecorded`,
          )
          : undefined;
        adapterResults.push({
          adapterId: adapter.id,
          accepted: adapterResult?.accepted ?? true,
          note: normalizeText(adapterResult?.note) || null,
        });
      } catch (adapterError) {
        adapterResults.push({
          adapterId: adapter.id,
          accepted: false,
          note: `adapter error: ${adapterError instanceof Error ? adapterError.message : String(adapterError)}`,
        });
      }
    }

    return {
      ok: true,
      record: runRecord,
      adapterResults,
    };
  }

  async updatePlanProgress(input: {
    runId: string;
    updates: DirectiveEnginePlanProgressUpdate[];
    at?: string | null;
  }) {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }
    if ((input.updates ?? []).length === 0) {
      throw new Error("invalid_input: at least one plan progress update is required");
    }

    const at = normalizeText(input.at) || new Date().toISOString();
    const structuredPlans = applyPlanProgressUpdates({
      record,
      updates: input.updates,
      at,
    });
    const existingRuns = (await this.listRuns()).filter((entry) => entry.runId !== record.runId);
    const updatedRecord: DirectiveEngineRunRecord = {
      ...record,
      ...structuredPlans,
    };
    updatedRecord.planQualitySignal = deriveDirectivePlanQualitySignal({
      record: updatedRecord,
      existingRuns,
    });
    updatedRecord.narrativeActions = deriveDirectiveNarrativeActions({
      narrativeContext: updatedRecord.routingAssessment.narrativeContext,
      openGaps: updatedRecord.openGaps,
      currentRecord: updatedRecord,
    });

    await withTimeout(this.store.updateRun(updatedRecord), this.storeTimeoutMs, "store.updateRun");
    return updatedRecord;
  }

  async reRouteWithAnswers(input: {
    runId: string;
    answers: Record<string, unknown>;
    corrections?: DirectiveEngineProcessSourceInput["corrections"];
    policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
    receivedAt?: string | null;
  }) {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }

    const rerouteInput = applyStructuredAnswersToRecordInput({
      recordInput: buildProcessSourceInputFromRecord(record),
      answers: input.answers,
    });

    return this.processSource({
      ...rerouteInput,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      receivedAt: normalizeText(input.receivedAt) || new Date().toISOString(),
    });
  }

  async previewMissionChange(input: {
    runId: string;
    change: DirectiveEngineMissionPreviewChange;
    corrections?: DirectiveEngineProcessSourceInput["corrections"];
    policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
    receivedAt?: string | null;
  }): Promise<DirectiveEngineRoutingDigestPreview> {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }

    const recordInput = buildProcessSourceInputFromRecord(record);
    const mission = {
      ...recordInput.mission,
      currentObjective:
        input.change.objective !== undefined
          ? normalizeText(input.change.objective) || null
          : recordInput.mission.currentObjective,
      usefulnessSignals:
        input.change.usefulnessSignals !== undefined
          ? (input.change.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean)
          : recordInput.mission.usefulnessSignals,
      capabilityLanes:
        input.change.capabilityLanes !== undefined
          ? (input.change.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean)
          : recordInput.mission.capabilityLanes,
      constraints:
        input.change.constraints !== undefined
          ? (input.change.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean)
          : recordInput.mission.constraints,
      successSignal:
        input.change.successSignal !== undefined
          ? normalizeText(input.change.successSignal) || null
          : recordInput.mission.successSignal,
      adoptionTarget:
        input.change.adoptionTarget !== undefined
          ? normalizeText(input.change.adoptionTarget) || null
          : recordInput.mission.adoptionTarget,
    };
    const existingRuns = (await this.listRuns()).filter((entry) => entry.runId !== record.runId);
    const assessment = assessDirectiveEngineRouting({
      source: record.source,
      mission: resolveMissionContext(mission),
      openGaps: [...record.openGaps],
      corrections: [...(input.corrections ?? [])],
      policyEvents: [...(input.policyEvents ?? [])],
      existingRuns,
      receivedAt: normalizeText(input.receivedAt) || new Date().toISOString(),
    });

    return {
      before: record.routingAssessment.digest,
      after: assessment.digest,
      diff: deriveDirectiveRoutingDiff({
        before: record.routingAssessment,
        after: assessment,
      }),
      assessment,
    };
  }

  async getRun(runId: string) {
    return withTimeout(this.store.readRun(runId), this.storeTimeoutMs, "store.readRun");
  }

  async listRuns() {
    return withTimeout(this.store.listRuns(), this.storeTimeoutMs, "store.listRuns");
  }
}
