import fs from "node:fs";
import path from "node:path";

import {
  buildDirectiveArchitectureAdoptionDecisionFile,
} from "./architecture-adoption-decision-writer.ts";
import {
  loadDirectiveArchitectureAdoptionDecisionArtifact,
  upsertDirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-decision-store.ts";
import type {
  ArchitectureAdoptionResolution,
  ArchitectureCompletionStatus,
  ArchitectureSelfImprovementCategory,
  ArchitectureArtifactType,
  ArchitectureUsefulnessLevel,
  ArchitectureValueShape,
} from "./architecture-adoption-resolution.ts";
import type {
  ArchitectureReviewResolution,
} from "./architecture-review-resolution.ts";
import {
  readDirectiveArchitectureBoundedResultArtifact,
  type DirectiveArchitectureBoundedResultArtifact,
} from "./architecture-bounded-closeout.ts";
import {
  assertDirectiveLifecycleTransitionAllowed,
  resolveDirectiveReviewFeedback,
} from "./lifecycle-review-feedback.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  normalizePath,
  optionalString,
  requiredString,
  resolveDirectiveRelativePath,
} from "./architecture-deep-tail-artifact-helpers.ts";

export type DirectiveArchitectureAdoptionDetail = {
  directiveRoot: string;
  adoptedRelativePath: string;
  adoptedAbsolutePath: string;
  decisionRelativePath: string;
  decisionAbsolutePath: string;
  decisionExists: boolean;
  sourceResultRelativePath: string;
  sourceDecisionRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  title: string;
  finalStatus: string;
  deepContinuationRequired: boolean;
  content: string;
};

export type AdoptDirectiveArchitectureResultInput = {
  resultPath: string;
  directiveRoot?: string;
  adoptedBy?: string | null;
};

export type DirectiveArchitectureResultAdoptionResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  resultRelativePath: string;
  resultAbsolutePath: string;
  adoptedRelativePath: string;
  adoptedAbsolutePath: string;
  decisionRelativePath: string;
  decisionAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  finalStatus: "adopt_planned_next" | "adopted";
};

export type DirectiveArchitectureAdoptionFinalStatus =
  DirectiveArchitectureResultAdoptionResult["finalStatus"];

function resolveAdoptedRelativePath(input: {
  resultRelativePath: string;
  finalStatus: "adopt_planned_next" | "adopted";
}) {
  const fileName = path.posix.basename(input.resultRelativePath);
  if (!fileName.endsWith("-bounded-result.md")) {
    throw new Error("invalid_input: resultPath must point to an Architecture bounded-result artifact");
  }
  const suffix = input.finalStatus === "adopt_planned_next"
    ? "-adopted-planned-next.md"
    : "-adopted.md";
  const adoptedFileName = fileName.replace(/-bounded-result\.md$/u, suffix);
  return path.posix.join("architecture/02-adopted", adoptedFileName);
}

function inferValueShape(resultArtifact: DirectiveArchitectureBoundedResultArtifact): ArchitectureValueShape {
  const objective = resultArtifact.objective.toLowerCase();
  const summary = resultArtifact.resultSummary.toLowerCase();
  if (objective.includes("logic") || summary.includes("logic")) {
    return "executable_logic";
  }
  if (objective.includes("workflow") || summary.includes("workflow")) {
    return "operating_model_change";
  }
  if (objective.includes("contract") || objective.includes("schema")) {
    return "data_shape";
  }
  if (objective.includes("policy") || summary.includes("policy")) {
    return "behavior_rule";
  }
  return "design_pattern";
}

function resolveValueShapeFromArtifactType(
  artifactType: ArchitectureArtifactType,
): ArchitectureValueShape {
  switch (artifactType) {
    case "contract":
      return "interface_or_handoff";
    case "schema":
      return "data_shape";
    case "template":
      return "working_document";
    case "policy":
      return "behavior_rule";
    case "engine-code":
    case "shared-lib":
      return "executable_logic";
    case "doctrine-update":
      return "operating_model_change";
    default:
      return "design_pattern";
  }
}

function inferSelfImprovementCategory(
  resultArtifact: DirectiveArchitectureBoundedResultArtifact,
): ArchitectureSelfImprovementCategory {
  const text = `${resultArtifact.objective} ${resultArtifact.resultSummary}`.toLowerCase();
  if (text.includes("routing")) return "routing_quality";
  if (text.includes("handoff")) return "handoff_quality";
  if (text.includes("evaluate") || text.includes("proof")) return "evaluation_quality";
  if (text.includes("extract")) return "extraction_quality";
  if (text.includes("improve")) return "improvement_quality";
  return "adaptation_quality";
}

function resolveDirectiveArchitectureAdoptionReviewScore(input: {
  finalStatus: DirectiveArchitectureAdoptionFinalStatus;
  completionStatus: ArchitectureCompletionStatus | undefined;
}): 3 | 4 {
  return input.finalStatus === "adopted"
    && input.completionStatus === "product_materialized"
    ? 4
    : 3;
}

export function resolveDirectiveArchitectureAdoptionReviewResolution(input: {
  candidateId: string;
  finalStatus: DirectiveArchitectureAdoptionFinalStatus;
  completionStatus?: ArchitectureCompletionStatus;
}): ArchitectureReviewResolution {
  const reviewScore = resolveDirectiveArchitectureAdoptionReviewScore({
    finalStatus: input.finalStatus,
    completionStatus: input.completionStatus,
  });
  const lifecycleFeedback = resolveDirectiveReviewFeedback({
    reviewResult: "approved",
    reviewScore,
  });
  const transitionRequest = {
    from: "evaluated" as const,
    to: lifecycleFeedback.recommendedNextState,
    role: lifecycleFeedback.requiredRole,
  };

  assertDirectiveLifecycleTransitionAllowed(transitionRequest);

  const requiresFollowUp = lifecycleFeedback.outcome === "accept_with_follow_up";

  return {
    candidateId: input.candidateId,
    reviewScore,
    reviewResult: "approved",
    failingChecks: [],
    warningChecks: requiresFollowUp ? ["validation_link_check"] : [],
    missingChecks: [],
    triggeredAntiPatterns: [],
    requiredChanges: requiresFollowUp
      ? [
          "Carry the adopted Architecture value through one bounded implementation target and recorded implementation result before treating it as fully materialized.",
        ]
      : [],
    lifecycleFeedback,
    transitionRequest,
  };
}

function renderAdoptedArtifactMarkdown(input: {
  resultArtifact: DirectiveArchitectureBoundedResultArtifact;
  sourceDecisionRelativePath: string;
  adoptedRelativePath: string;
  decisionRelativePath: string;
  adoptedBy: string;
  snapshotAt: string;
  finalStatus: "adopt_planned_next" | "adopted";
  adoptionResolution: ArchitectureAdoptionResolution;
}) {
  const artifact = input.resultArtifact;
  const isPlannedNext = input.finalStatus === "adopt_planned_next";
  const deepContinuationRequired = isPlannedNext;
  const headingPrefix = isPlannedNext ? "Adopted / Planned-Next" : "Adopted";
  const boundedScope = artifact.boundedScope.length > 0
    ? artifact.boundedScope.map((item) => `- ${item}`).join("\n")
    : "- Continue from the retained bounded result only.";

  return [
    `# ${headingPrefix}: ${artifact.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## decision",
    `- Final status: \`${input.finalStatus}\`.`,
    "- Lane: `Directive Architecture` only.",
    `- Source bounded result: \`${artifact.resultRelativePath}\`.`,
    `- Adoption approval: \`${input.adoptedBy}\`.`,
    `- Usefulness level: \`${artifact.usefulnessLevel}\`.`,
    `- Completion status: \`${input.adoptionResolution.completionStatus}\`.`,
    "",
    "## evidence basis",
    `- Bounded result artifact: \`${artifact.resultRelativePath}\``,
    `- Source closeout decision artifact: \`${input.sourceDecisionRelativePath}\``,
    `- Bounded start artifact: \`${artifact.startRelativePath}\``,
    `- Handoff stub: \`${artifact.handoffStubPath}\``,
    `- Engine run record: \`${artifact.engineRunRecordPath}\``,
    `- Engine run report: \`${artifact.engineRunReportPath}\``,
    `- Discovery routing record: \`${artifact.discoveryRoutingRecordPath}\``,
    "",
    "## adopted value",
    `- Objective retained: ${artifact.objective}`,
    `- Result summary retained: ${artifact.resultSummary}`,
    `- Closeout rationale retained: ${artifact.rationale}`,
    `- Next bounded decision: \`${artifact.nextDecision}\``,
    "",
    "## adopted boundary",
    `- This artifact retains the bounded result in product-owned Architecture form so the next slice can start without reconstructing the prior Engine/handoff/start/result chain by hand.`,
    `- Materialization state: ${isPlannedNext ? "adopted as planned-next, with further Architecture materialization still required" : "adopted as current-scope Architecture output"}`,
    `- Deep continuation required: \`${deepContinuationRequired ? "yes" : "no"}\`.`,
    "",
    "## smallest next bounded slice",
    boundedScope,
    "",
    "## risk + rollback",
    `- Rollback: ${artifact.rollback}`,
    "- If this adoption boundary proves unhelpful, delete this adopted artifact and its paired decision artifact, then continue from the source bounded result instead.",
    "",
    "## decision close state",
    `- ${artifact.candidateId} is now retained under \`${input.adoptedRelativePath}\` with paired decision artifact \`${input.decisionRelativePath}\`.`,
    "",
    "## Lifecycle classification",
    `- Usefulness level: \`${artifact.usefulnessLevel}\``,
    `- Artifact type: \`${input.adoptionResolution.artifactType}\``,
    `- Status class: \`${input.adoptionResolution.completionStatus}\``,
    `- Runtime threshold check: ${input.adoptionResolution.runtimeThresholdCheck}`,
    "",
  ].join("\n");
}

export function adoptDirectiveArchitectureResult(
  input: AdoptDirectiveArchitectureResultInput,
): DirectiveArchitectureResultAdoptionResult {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const resultRelativePath = resolveDirectiveRelativePath(directiveRoot, input.resultPath);
  const resultArtifact = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot,
    resultPath: resultRelativePath,
  });
  const sourceDecision = loadDirectiveArchitectureAdoptionDecisionArtifact({
    directiveRoot,
    recordRelativePath: resultRelativePath,
  });

  const finalStatus: "adopt_planned_next" | "adopted" =
    resultArtifact.nextDecision === "needs-more-evidence" || resultArtifact.verdict === "stay_experimental"
      ? "adopt_planned_next"
      : "adopted";
  const adoptedRelativePath = resolveAdoptedRelativePath({
    resultRelativePath,
    finalStatus,
  });
  const adoptedAbsolutePath = normalizePath(path.join(directiveRoot, adoptedRelativePath));
  const adoptedBy = String(input.adoptedBy || "directive-frontend-operator").trim()
    || "directive-frontend-operator";
  const snapshotAt = new Date().toISOString();
  const created = !fs.existsSync(adoptedAbsolutePath);

  const usefulnessLevel = resultArtifact.usefulnessLevel;
  const sourceArtifactType = sourceDecision.artifact.artifact_type;
  const sourceCompletionStatus =
    sourceDecision.artifact.decision.completion_status;
  const sourceSelfImprovement = sourceDecision.artifact.self_improvement;
  const selfImprovementCategory = usefulnessLevel === "meta"
    ? sourceSelfImprovement?.category ?? inferSelfImprovementCategory(resultArtifact)
    : undefined;
  const reviewResolution = resolveDirectiveArchitectureAdoptionReviewResolution({
    candidateId: resultArtifact.candidateId,
    finalStatus,
    completionStatus: sourceCompletionStatus,
  });
  const adoptionResolution: ArchitectureAdoptionResolution = {
    sourceId: resultArtifact.candidateId,
    artifactType: sourceArtifactType,
    readinessPassed: true,
    reviewPassed: true,
    runtimeThresholdCheck: sourceDecision.artifact.decision.runtime_threshold_check
      || resultArtifact.runtimeThresholdCheck,
    verdict: "adopt",
    completionStatus:
      sourceCompletionStatus
      || (finalStatus === "adopted" ? "product_materialized" : "product_partial"),
    requiredGaps: [],
    rationale:
      finalStatus === "adopted"
        ? "The bounded result is explicitly adopted as current-scope Directive-owned Architecture output."
        : "The bounded result is explicitly adopted as the next product-owned Architecture materialization boundary, while further bounded implementation still remains.",
    runtimeHandoff: {
      required: false,
      rationale: null,
    },
    reviewTrace: {
      score: reviewResolution.reviewScore,
      result: reviewResolution.reviewResult,
      outcome: reviewResolution.lifecycleFeedback.outcome,
    },
  };

  const decisionFile = buildDirectiveArchitectureAdoptionDecisionFile({
    adoptedRecordRelativePath: adoptedRelativePath,
    sourceId: resultArtifact.candidateId,
    usefulnessLevel,
    valueShape: resolveValueShapeFromArtifactType(sourceArtifactType),
    readinessCheck: {
      source_analysis_complete: true,
      adaptation_decision_complete: true,
      adaptation_quality_acceptable: true,
      delta_evidence_present: true,
      no_unresolved_baggage: true,
    },
    adaptationQuality: sourceDecision.artifact.adaptation_quality,
    improvementQuality: sourceDecision.artifact.improvement_quality ?? "adequate",
    productArtifactMaterialized: adoptionResolution.completionStatus === "product_materialized",
    proofExecuted: true,
    targetArtifactClarified: true,
    valuableWithoutRuntimeSurface:
      (sourceDecision.artifact.decision.runtime_threshold_check || "").toLowerCase().includes("yes")
      || resultArtifact.runtimeThresholdCheck.toLowerCase().includes("yes"),
    sourceAnalysisRef: resultArtifact.handoffStubPath,
    adaptationDecisionRef: resultArtifact.decisionRelativePath,
    artifactPath: adoptedRelativePath,
    reviewResolution,
    selfImprovement: usefulnessLevel === "meta"
      ? {
          category: selfImprovementCategory!,
          claim:
            sourceSelfImprovement?.claim
            || "Directive Workspace can retain this bounded Architecture result as a product-owned adoption boundary instead of forcing the next slice to reconstruct prior evidence by hand.",
          mechanism:
            sourceSelfImprovement?.mechanism
            || "The adopted planned-next artifact and paired decision JSON materialize the bounded result into Directive-owned Architecture form.",
          baselineObservation:
            sourceSelfImprovement?.baseline_observation
            || "The bounded result existed, but the operator still had to decide and restate how to carry it forward into the next Architecture materialization step.",
          expectedEffect:
            sourceSelfImprovement?.expected_effect
            || "Future Architecture continuation can start from an explicit adopted artifact and decision envelope rather than re-reading the full result chain.",
          verificationMethod:
            sourceSelfImprovement?.verification_method || "structural_inspection",
          verificationResult: sourceSelfImprovement?.verification_result,
          verificationDate: sourceSelfImprovement?.verification_date,
          verificationNotes: sourceSelfImprovement?.verification_notes,
        }
      : undefined,
    adoptionResolution,
  });

  const markdown = renderAdoptedArtifactMarkdown({
    resultArtifact,
    sourceDecisionRelativePath: sourceDecision.decisionRelativePath,
    adoptedRelativePath,
    decisionRelativePath: decisionFile.relativePath,
    adoptedBy,
    snapshotAt,
    finalStatus,
    adoptionResolution,
  });

  fs.mkdirSync(path.dirname(adoptedAbsolutePath), { recursive: true });
  fs.writeFileSync(adoptedAbsolutePath, markdown, "utf8");
  const storedDecision = upsertDirectiveArchitectureAdoptionDecisionArtifact({
    directiveRoot,
    recordRelativePath: adoptedRelativePath,
    outputRelativePath: decisionFile.relativePath,
    artifact: decisionFile.artifact,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    resultRelativePath,
    resultAbsolutePath: resultArtifact.resultAbsolutePath,
    adoptedRelativePath,
    adoptedAbsolutePath,
    decisionRelativePath: storedDecision.decisionRelativePath,
    decisionAbsolutePath: storedDecision.decisionAbsolutePath,
    candidateId: resultArtifact.candidateId,
    candidateName: resultArtifact.candidateName,
    usefulnessLevel,
    finalStatus,
  };
}

export function readDirectiveArchitectureAdoptionDetail(input: {
  adoptionPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureAdoptionDetail {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const adoptedRelativePath = resolveDirectiveRelativePath(directiveRoot, input.adoptionPath);
  if (!adoptedRelativePath.startsWith("architecture/02-adopted/")) {
    throw new Error("invalid_input: adoptionPath must point to architecture/02-adopted/");
  }

  const adoptedAbsolutePath = normalizePath(path.join(directiveRoot, adoptedRelativePath));
  if (!fs.existsSync(adoptedAbsolutePath)) {
    throw new Error(`invalid_input: adoptionPath not found: ${adoptedRelativePath}`);
  }

  const content = fs.readFileSync(adoptedAbsolutePath, "utf8");
  const title = content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^# /, "").trim()
    || path.posix.basename(adoptedRelativePath);
  const sourceResultRelativePath =
    content.match(/- Source bounded result(?: artifact)?: `([^`]+)`\.?/u)?.[1]
    || "";
  const deepContinuationRequired =
    optionalString(content.match(/- Deep continuation required: `([^`]+)`\./u)?.[1]) === "yes";
  const candidateNameFromTitle = title
    .replace(/^Adopted(?:\s*\/\s*Planned-Next|\s+Planned\s+Next)?:\s*/u, "")
    .replace(/\s+Adopted$/u, "")
    .replace(/\s+\(\d{4}-\d{2}-\d{2}\)$/u, "")
    .trim();
  const candidateId =
    optionalString(content.match(/- Candidate id: `([^`]+)`/u)?.[1])
    ?? optionalString(content.match(/Candidate id: `([^`]+)`/u)?.[1])
    ?? optionalString(content.match(/Candidate: `([^`]+)`/u)?.[1]);

  try {
    const decision = loadDirectiveArchitectureAdoptionDecisionArtifact({
      directiveRoot,
      recordRelativePath: adoptedRelativePath,
    });
    const finalStatus =
      optionalString(content.match(/- Final status: `([^`]+)`\./u)?.[1])
      ?? optionalString(content.match(/- Final adoption status: `([^`]+)`/u)?.[1])
      ?? optionalString(content.match(/- Status: `([^`]+)`/u)?.[1])
      ?? (decision.artifact.decision.verdict === "adopt" ? "adopted" : "");

    return {
      directiveRoot,
      adoptedRelativePath,
      adoptedAbsolutePath,
      decisionRelativePath: decision.decisionRelativePath,
      decisionAbsolutePath: decision.decisionAbsolutePath,
      decisionExists: true,
      sourceResultRelativePath,
      sourceDecisionRelativePath: sourceResultRelativePath
        ? sourceResultRelativePath.replace(/\.md$/u, "-adoption-decision.json")
        : "",
      candidateId: decision.artifact.source_id,
      candidateName: candidateNameFromTitle || decision.artifact.source_id,
      usefulnessLevel: decision.artifact.usefulness_level,
      title,
      finalStatus,
      deepContinuationRequired,
      content,
    };
  } catch (error) {
    const finalStatus = optionalString(content.match(/- Final status: `([^`]+)`\./u)?.[1])
      ?? optionalString(content.match(/- Final adoption status: `([^`]+)`/u)?.[1])
      ?? (() => {
        const statusLine =
          optionalString(content.match(/- Status: `([^`]+)`/u)?.[1])
          ?? optionalString(content.match(/Status: `([^`]+)`/u)?.[1]);
        return statusLine === "product_partial" ? "adopt_planned_next" : "adopted";
      })();

    return {
      directiveRoot,
      adoptedRelativePath,
      adoptedAbsolutePath,
      decisionRelativePath: "",
      decisionAbsolutePath: "",
      decisionExists: false,
      sourceResultRelativePath,
      sourceDecisionRelativePath: "",
      candidateId: requiredString(candidateId, "legacy adoption candidate id"),
      candidateName: candidateNameFromTitle || requiredString(candidateId, "legacy adoption candidate id"),
      usefulnessLevel: "meta",
      title,
      finalStatus,
      deepContinuationRequired: deepContinuationRequired || finalStatus === "adopt_planned_next",
      content,
    };
  }
}

