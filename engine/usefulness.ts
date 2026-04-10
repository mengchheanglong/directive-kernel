import type { DirectiveEngineLaneUsefulnessPlanningInput } from "./lane.ts";
import type { DirectiveEngineUsefulnessLevel } from "./types.ts";

function collectPlanText(input: DirectiveEngineLaneUsefulnessPlanningInput) {
  const values = [
    input.adaptationPlan.directiveOwnedForm,
    input.improvementPlan.intendedDelta,
    ...input.adaptationPlan.adaptedValue,
    ...input.improvementPlan.improvementGoals,
  ];
  return values.join(" ").toLowerCase();
}

function hasRuntimeUsefulnessSignal(input: DirectiveEngineLaneUsefulnessPlanningInput) {
  const planText = collectPlanText(input);
  return (
    input.planningInput.source.primaryAdoptionTarget === "runtime"
    || input.planningInput.source.containsExecutableCode === true
    || input.planningInput.lane.laneId === "runtime"
    || /reusable runtime|runtime capability|callable capability|callable runtime|behavior-preserving|runtime reuse|host can call|host can run/.test(planText)
  );
}

function hasMetaUsefulnessSignal(input: DirectiveEngineLaneUsefulnessPlanningInput) {
  const planText = collectPlanText(input);
  return (
    input.planningInput.source.improvesDirectiveWorkspace === true
    || (
      input.planningInput.source.primaryAdoptionTarget === "architecture"
      && input.planningInput.source.containsWorkflowPattern === true
    )
    || /engine-owned|engine self-improvement|future source adaptation quality|stage-aware engine analysis|control and evidence analysis|control\/evidence plans|loop-control plans|improve .*architecture adaptation quality|improve engine/.test(planText)
  );
}

export function classifyDirectiveEngineUsefulness(
  input: DirectiveEngineLaneUsefulnessPlanningInput,
): DirectiveEngineUsefulnessLevel {
  const hasRuntimeSignal = hasRuntimeUsefulnessSignal(input);
  const hasMetaSignal = hasMetaUsefulnessSignal(input)
    || input.planningInput.routingAssessment.scoreBreakdown.metaUsefulnessSignal > 0;

  if (hasRuntimeSignal && hasMetaSignal) {
    return "hybrid";
  }

  if (hasRuntimeSignal) {
    return "direct";
  }

  if (hasMetaSignal) {
    return "meta";
  }

  return "structural";
}

export function explainDirectiveEngineUsefulness(
  input: DirectiveEngineLaneUsefulnessPlanningInput,
  usefulnessLevel: DirectiveEngineUsefulnessLevel,
) {
  if (usefulnessLevel === "hybrid") {
    return "Hybrid usefulness: the source carries reusable runtime value and meaningful Directive Workspace improvement value at the same time, so the system should preserve both signals instead of flattening it into only direct or only meta usefulness.";
  }

  if (usefulnessLevel === "direct") {
    if (hasRuntimeUsefulnessSignal(input)) {
      return "Direct usefulness: the generated Runtime adaptation and improvement plans target reusable callable runtime value with bounded behavior-preserving improvement, so the value is primarily useful as something the host can call or run again.";
    }

    if (input.planningInput.routingAssessment.scoreBreakdown.transformationSignal > 0) {
      return "Direct usefulness: the candidate targets reusable runtime capability and shows transformation signals, so the value looks useful in repeated runtime use while preserving or improving implementation quality.";
    }

    return "Direct usefulness: the candidate targets reusable runtime capability, so the value is primarily useful as something the host can call or run again.";
  }

  if (usefulnessLevel === "meta") {
    if (hasMetaUsefulnessSignal(input)) {
      return "Meta-usefulness: the generated adaptation and improvement plans are Engine-self-improvement oriented, so the value is primarily about improving how Directive Workspace discovers, judges, adapts, proves, or integrates future sources rather than exposing repeated host-call value.";
    }
    if (
      input.planningInput.source.primaryAdoptionTarget === "architecture"
      && input.planningInput.source.containsWorkflowPattern
    ) {
      return "Meta-usefulness: structured source metadata marks the candidate as an Architecture-targeted workflow pattern, so the value is primarily about improving how Directive Workspace works rather than exposing repeated host-call value.";
    }
    return "Meta-usefulness: shared Engine analysis detected engine-improvement signals, so the value appears to improve how Directive Workspace discovers, judges, adapts, proves, or integrates future sources.";
  }

  return `Structural usefulness: the generated plans improve how Directive Workspace works in the ${input.planningInput.lane.label} lane without reading as repeated runtime capability or deep Engine self-improvement.`;
}
