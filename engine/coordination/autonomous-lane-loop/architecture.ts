import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../../shared/lib/file-io.ts";
import {
  readArchitectureBoundedCloseoutAssist,
  readArchitectureBoundedStartArtifact,
  type CloseArchitectureBoundedStartInput,
} from "../../../architecture/lib/experiments/closeout.ts";
import {
  readArchitectureImplementationTargetDetail,
} from "../../../architecture/lib/materialization/implementation-target.ts";

function buildAutonomousArchitectureImplementationSummary(input: {
  targetPath: string;
  directiveRoot: string;
}) {
  const targetDetail = readArchitectureImplementationTargetDetail({
    directiveRoot: input.directiveRoot,
    targetPath: input.targetPath,
  });
  const expectedOutcome = targetDetail.expectedOutcome
    || "One explicit bounded Architecture implementation slice is now completed.";

  return `${expectedOutcome} This completion was auto-materialized from the retained implementation target without reopening the prior adoption chain.`;
}

function readAutonomousArchitectureEngineRun(input: {
  directiveRoot: string;
  engineRunRecordPath: string;
}) {
  const engineRunAbsolutePath = path.join(input.directiveRoot, input.engineRunRecordPath);
  if (!fs.existsSync(engineRunAbsolutePath)) {
    return null;
  }

  try {
    return readJson<Record<string, unknown>>(engineRunAbsolutePath);
  } catch {
    return null;
  }
}

function inferAutonomousArchitectureValueShape(text: string) {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("logic")
    || normalized.includes("code")
    || normalized.includes("executable")
  ) {
    return "executable_logic" as const;
  }
  if (
    normalized.includes("workflow")
    || normalized.includes("protocol")
    || normalized.includes("operating model")
  ) {
    return "operating_model_change" as const;
  }
  if (normalized.includes("schema") || normalized.includes("data shape")) {
    return "data_shape" as const;
  }
  if (
    normalized.includes("contract")
    || normalized.includes("interface")
    || normalized.includes("handoff")
  ) {
    return "interface_or_handoff" as const;
  }
  if (normalized.includes("policy") || normalized.includes("rule")) {
    return "behavior_rule" as const;
  }
  if (normalized.includes("template") || normalized.includes("document")) {
    return "working_document" as const;
  }
  return "design_pattern" as const;
}

export function buildAutonomousArchitectureImplementationResultSummary(input: {
  targetPath: string;
  directiveRoot: string;
}) {
  return buildAutonomousArchitectureImplementationSummary(input);
}

export function buildAutonomousArchitectureBoundedCloseoutRequest(input: {
  directiveRoot: string;
  startPath: string;
  approvedBy: string;
}): CloseArchitectureBoundedStartInput {
  const startArtifact = readArchitectureBoundedStartArtifact({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });
  const assist = readArchitectureBoundedCloseoutAssist({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });
  const engineRun = readAutonomousArchitectureEngineRun({
    directiveRoot: input.directiveRoot,
    engineRunRecordPath: startArtifact.engineRunRecordPath,
  });

  const recommendedLaneId =
    typeof engineRun?.selectedLane === "object" && engineRun?.selectedLane
      ? String((engineRun.selectedLane as { laneId?: unknown }).laneId ?? "").trim()
      : "";
  const routingAssessment =
    typeof engineRun?.routingAssessment === "object" && engineRun?.routingAssessment
      ? engineRun.routingAssessment as {
          confidence?: unknown;
          needsHumanReview?: unknown;
          routeConflict?: unknown;
        }
      : null;
  const decision =
    typeof engineRun?.decision === "object" && engineRun?.decision
      ? engineRun.decision as { decisionState?: unknown }
      : null;
  const integrationProposal =
    typeof engineRun?.integrationProposal === "object" && engineRun?.integrationProposal
      ? engineRun.integrationProposal as { requiresHumanReview?: unknown; nextAction?: unknown }
      : null;
  const extractionPlan =
    typeof engineRun?.extractionPlan === "object" && engineRun?.extractionPlan
      ? engineRun.extractionPlan as { excludedBaggage?: unknown }
      : null;
  const adaptationPlan =
    typeof engineRun?.adaptationPlan === "object" && engineRun?.adaptationPlan
      ? engineRun.adaptationPlan as { directiveOwnedForm?: unknown; adaptedValue?: unknown }
      : null;
  const improvementPlan =
    typeof engineRun?.improvementPlan === "object" && engineRun?.improvementPlan
      ? engineRun.improvementPlan as { improvementGoals?: unknown; intendedDelta?: unknown }
      : null;
  const proofPlan =
    typeof engineRun?.proofPlan === "object" && engineRun?.proofPlan
      ? engineRun.proofPlan as { requiredGates?: unknown }
      : null;

  const routingConfidence = String(routingAssessment?.confidence ?? "").trim().toLowerCase();
  const needsHumanReview = routingAssessment?.needsHumanReview === true;
  const routeConflict = routingAssessment?.routeConflict === true;
  const decisionState = String(decision?.decisionState ?? "").trim().toLowerCase();
  const requiresHumanReview = integrationProposal?.requiresHumanReview === true;
  const adoptReady =
    recommendedLaneId === "architecture"
    && routingConfidence === "high"
    && !needsHumanReview
    && !routeConflict
    && !requiresHumanReview
    && decisionState === "accept_for_architecture";

  const continuationText = [
    startArtifact.objective,
    assist.directiveOwnedForm,
    assist.intendedDelta,
    String(integrationProposal?.nextAction ?? ""),
    ...startArtifact.expectedOutput,
  ].join(" ").toLowerCase();
  const keepMaterializationOpen =
    adoptReady
    && /(materialize|implementation|engine-owned product logic|engine logic|operating-code|code delta)/u.test(
      continuationText,
    );

  const hasExcludedBaggage =
    Array.isArray(extractionPlan?.excludedBaggage)
    && extractionPlan.excludedBaggage.some((entry) => String(entry ?? "").trim().length > 0);
  const adaptedValueCount =
    Array.isArray(adaptationPlan?.adaptedValue)
      ? adaptationPlan.adaptedValue.filter((entry) => String(entry ?? "").trim().length > 0).length
      : 0;
  const improvementGoalCount =
    Array.isArray(improvementPlan?.improvementGoals)
      ? improvementPlan.improvementGoals.filter((entry) => String(entry ?? "").trim().length > 0).length
      : 0;
  const proofGateCount =
    Array.isArray(proofPlan?.requiredGates)
      ? proofPlan.requiredGates.filter((entry) => String(entry ?? "").trim().length > 0).length
      : 0;

  const valueShape = inferAutonomousArchitectureValueShape(
    [
      startArtifact.objective,
      assist.directiveOwnedForm,
      String(integrationProposal?.nextAction ?? ""),
    ].join(" "),
  );
  const resultSummary = adoptReady
    ? [
        assist.suggestedResultSummary,
        keepMaterializationOpen
          ? "This autonomous closeout keeps one bounded Architecture materialization continuation open because the approved objective explicitly targets engine-owned product logic rather than a reference-only retained result."
          : "This autonomous closeout treats the bounded slice as fully adoptable within the shortened Architecture path because the Engine-owned delta is explicit and no further deep continuation is required.",
        "The linked Engine run, routing record, and bounded handoff remain the explicit evidence chain for this Architecture result.",
      ].join(" ")
    : [
        assist.suggestedResultSummary,
        "Autonomous closeout stops at bounded result because the linked Engine run does not yet clear the Architecture adoption gate strongly enough to continue without more bounded evidence or artifact clarification.",
      ].join(" ");

  return {
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
    closedBy: input.approvedBy,
    resultSummary,
    primaryEvidencePath: startArtifact.engineRunRecordPath,
    nextDecision: adoptReady && !keepMaterializationOpen ? "adopt" : "needs-more-evidence",
    valueShape,
    adaptationQuality: adoptReady && adaptedValueCount > 0 ? "strong" : "adequate",
    improvementQuality: adoptReady && improvementGoalCount > 0 ? "strong" : "adequate",
    proofExecuted: adoptReady && proofGateCount > 0,
    targetArtifactClarified: adoptReady,
    deltaEvidencePresent: adoptReady,
    noUnresolvedBaggage: adoptReady && hasExcludedBaggage,
    productArtifactMaterialized: false,
  };
}
