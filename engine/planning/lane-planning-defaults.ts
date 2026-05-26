import { uniqueStrings } from "../source-utils.ts";
import type {
  EngineLaneAdaptationPlanningInput,
  EngineLaneExtractionPlanningInput,
  EngineLaneImprovementPlanningInput,
} from "../lane.ts";
import type {
  EngineAdaptationPlan,
  EngineExtractionPlan,
  EngineImprovementPlan,
} from "../types.ts";
import {
  adaptationPlanIncludes,
  formatIterativeControlSignals,
  formatStructuralProcessStages,
  readExtractionPlanSummary,
  resolveControlSignalProfile,
  resolveStructuralProcessStages,
} from "./lane-planning-helpers.ts";

export function buildDefaultExtractionPlan(
  input: EngineLaneExtractionPlanningInput,
): EngineExtractionPlan {
  const { planningInput } = input;
  const structuralProcessStages = resolveStructuralProcessStages(planningInput.source);
  const controlSignalProfile = resolveControlSignalProfile(planningInput.source);
  const extractedValue = uniqueStrings([
    structuralProcessStages.length >= 2
      ? `Stage-aware structural pattern: ${formatStructuralProcessStages(structuralProcessStages)} with explicit handoff boundaries.`
      : null,
    controlSignalProfile?.framing === "iterative_loop"
      ? `Bounded loop-control pattern: explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries for repeated iteration.`
      : controlSignalProfile
        ? `Bounded control/evidence pattern: explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries for approval, validation, rollback, and reporting.`
        : null,
    planningInput.source.summary,
    ...(planningInput.source.notes ?? []).slice(0, 3),
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
    planningInput.source.sourceType === "github-repo"
      || planningInput.source.sourceType === "external-system"
      ? "source-specific implementation baggage"
      : "non-mission-relevant source detail",
    planningInput.lane.hostDependence === "host_adapter_required"
      ? "host-local assumptions from the original source"
      : "unadapted source terminology",
  ]);

  return {
    extractedValue:
      extractedValue.length > 0
        ? extractedValue
        : [`Potential ${planningInput.lane.label} value from ${planningInput.source.title || planningInput.candidateId}.`],
    excludedBaggage,
  };
}

export function buildDefaultAdaptationPlan(
  input: EngineLaneAdaptationPlanningInput,
): EngineAdaptationPlan {
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

export function buildDefaultImprovementPlan(
  input: EngineLaneImprovementPlanningInput,
): EngineImprovementPlan {
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
