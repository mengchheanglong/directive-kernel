import type {
  DirectiveEngineAdaptationPlan,
  DirectiveEngineExtractionPlan,
  DirectiveEngineSourceItem,
} from "./types.ts";

export function flattenSourceSignals(source: DirectiveEngineSourceItem) {
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

export function resolveStructuralProcessStages(source: DirectiveEngineSourceItem) {
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

export function resolveControlSignalProfile(source: DirectiveEngineSourceItem) {
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

export function formatStructuralProcessStages(stages: string[]) {
  return stages.join(" -> ");
}

export function formatIterativeControlSignals(signals: string[]) {
  return signals.join(", ");
}

export function readExtractionPlanSummary(
  extractionPlan: DirectiveEngineExtractionPlan,
  prefix: string,
) {
  return extractionPlan.extractedValue
    .find((value) => value.startsWith(prefix))
    ?.replace(prefix, "")
    .trim()
    ?? null;
}

export function adaptationPlanIncludes(
  adaptationPlan: DirectiveEngineAdaptationPlan,
  pattern: string,
) {
  const loweredPattern = pattern.toLowerCase();
  return adaptationPlan.directiveOwnedForm.toLowerCase().includes(loweredPattern)
    || adaptationPlan.adaptedValue.some((value) =>
      value.toLowerCase().includes(loweredPattern)
    );
}
