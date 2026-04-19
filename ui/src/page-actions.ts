import { getJson } from "./app-utils.ts";
import type {
  FrontendExecutablePlanAction,
  FrontendMissionFeedbackPreview,
} from "./types/index.ts";

function slugifyCandidateId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function submitDiscoveryFrontDoorAction(form: HTMLFormElement) {
  const data = new FormData(form);
  const candidateName = String(data.get("candidate_name") || "").trim();
  const sourceReference = String(data.get("source_reference") || "").trim();
  const candidateIdInput = String(data.get("candidate_id") || "").trim();
  const candidateId =
    candidateIdInput
    || slugifyCandidateId(candidateName)
    || slugifyCandidateId(sourceReference);

  if (!candidateName) {
    throw new Error("candidate_name_required");
  }
  if (!sourceReference) {
    throw new Error("source_reference_required");
  }
  if (!candidateId) {
    throw new Error("candidate_id_required");
  }

  const payload = {
    candidate_id: candidateId,
    candidate_name: candidateName,
    source_type: String(data.get("source_type") || "internal-signal").trim(),
    source_reference: sourceReference,
    mission_alignment: String(data.get("mission_alignment") || "").trim() || null,
    capability_gap_id: String(data.get("capability_gap_id") || "").trim() || null,
    notes: String(data.get("notes") || "").trim() || null,
    primary_adoption_target: String(data.get("primary_adoption_target") || "").trim() || null,
    workflow_boundary_shape: String(data.get("workflow_boundary_shape") || "").trim() || null,
    contains_executable_code: data.get("contains_executable_code") === "on",
    contains_workflow_pattern: data.get("contains_workflow_pattern") === "on",
    improves_directive_workspace: data.get("improves_directive_workspace") === "on",
  };
  const result: any = await getJson("/api/discovery/front-door", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    resetForm: true,
    navigateTo:
      result.downstream?.autoOpened && result.downstream?.stubRelativePath
        ? `/handoffs/view?path=${encodeURIComponent(result.downstream.stubRelativePath)}`
        : `/discovery-routing-records/view?path=${encodeURIComponent(result.createdPaths.routingRecordPath)}`,
  };
}

export async function approveDiscoveryRouteAction(routingPath: string) {
  const result: any = await getJson("/api/discovery/open-route", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      routingPath,
      approved: true,
    }),
  });
  return `/handoffs/view?path=${encodeURIComponent(result.stubRelativePath)}`;
}

export async function resolveDiscoveryRoutingReviewAction(
  form: HTMLFormElement,
  routingRecordPath: string,
) {
  const data = new FormData(form);
  const decision = String(data.get("decision") || "").trim();
  if (
    decision !== "confirm_architecture"
    && decision !== "confirm_runtime"
    && decision !== "redirect_to_architecture"
    && decision !== "redirect_to_runtime"
    && decision !== "reject"
    && decision !== "defer"
  ) {
    throw new Error("discovery_review_decision_invalid");
  }
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("discovery_review_rationale_required");
  }
  const resolvedConfidence = String(data.get("resolved_confidence") || "").trim();

  return getJson("/api/discovery/resolve-routing-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      routingRecordPath,
      decision,
      rationale,
      resolvedConfidence:
        resolvedConfidence === "high"
        || resolvedConfidence === "medium"
        || resolvedConfidence === "low"
          ? resolvedConfidence
          : undefined,
    }),
  });
}

export async function resolveRuntimeHostSelectionAction(
  form: HTMLFormElement,
  promotionReadinessPath: string,
) {
  const data = new FormData(form);
  const decision = String(data.get("decision") || "").trim();
  if (
    decision !== "select_standalone"
    && decision !== "select_web"
    && decision !== "confirm_inferred"
    && decision !== "override"
    && decision !== "defer"
  ) {
    throw new Error("runtime_host_selection_decision_invalid");
  }
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("runtime_host_selection_rationale_required");
  }
  const selectedHost = String(data.get("selected_host") || "").trim();
  if (decision === "override" && !selectedHost) {
    throw new Error("runtime_host_selection_selected_host_required");
  }
  const resolvedConfidence = String(data.get("resolved_confidence") || "").trim();

  return getJson("/api/runtime/host-selection-resolutions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      promotionReadinessPath,
      decision,
      selectedHost,
      rationale,
      resolvedConfidence:
        resolvedConfidence === "high"
        || resolvedConfidence === "medium"
        || resolvedConfidence === "low"
          ? resolvedConfidence
          : undefined,
    }),
  });
}

export async function resolveRuntimePromotionSeamDecisionAction(
  form: HTMLFormElement,
  promotionReadinessPath: string,
) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("runtime_promotion_seam_rationale_required");
  }

  return getJson("/api/runtime/promotion-seam-decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      promotionReadinessPath,
      rationale,
    }),
  });
}

export async function acceptRuntimeRegistryAcceptanceAction(
  form: HTMLFormElement,
  promotionRecordPath: string,
) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("runtime_registry_acceptance_rationale_required");
  }

  return getJson("/api/runtime/registry-acceptance-decisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      promotionRecordPath,
      rationale,
    }),
  });
}

export async function approveRuntimeFollowUpAction(followUpPath: string) {
  const result: any = await getJson("/api/runtime/open-follow-up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      followUpPath,
      approved: true,
    }),
  });
  return `/runtime-records/view?path=${encodeURIComponent(result.runtimeRecordRelativePath)}`;
}

export async function approveRuntimeRecordProofAction(runtimeRecordPath: string) {
  const result: any = await getJson("/api/runtime/open-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runtimeRecordPath,
      approved: true,
    }),
  });
  return `/runtime-proofs/view?path=${encodeURIComponent(result.runtimeProofRelativePath)}`;
}

export async function approveRuntimeProofRuntimeCapabilityBoundaryAction(runtimeProofPath: string) {
  const result: any = await getJson("/api/runtime/open-runtime-capability-boundary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runtimeProofPath,
      approved: true,
    }),
  });
  return `/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(result.runtimeCapabilityBoundaryRelativePath)}`;
}

export async function approveRuntimePromotionReadinessAction(capabilityBoundaryPath: string) {
  const result: any = await getJson("/api/runtime/open-promotion-readiness", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityBoundaryPath,
      approved: true,
    }),
  });
  return `/artifacts?path=${encodeURIComponent(result.promotionReadinessRelativePath)}`;
}

export async function previewMissionFeedbackAction(feedbackId: string) {
  return getJson<FrontendMissionFeedbackPreview>("/api/mission/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ feedbackId }),
  });
}

export async function approveMissionFeedbackAction(form: HTMLFormElement, feedbackId: string) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("mission_feedback_rationale_required");
  }
  const cascadeScope = String(data.get("cascade_scope") || "none").trim() as
    "none" | "low_confidence" | "conflicted" | "discovery_held";
  const approvedRunIds = cascadeScope === "none"
    ? []
    : [...data.entries()]
      .filter(([key, value]) =>
        key === `approved_run_id:${cascadeScope}` && String(value ?? "").trim().length > 0
      )
      .map(([, value]) => String(value).trim());

  return getJson("/api/mission/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      feedbackId,
      rationale,
      cascadeScope,
      approvedRunIds,
    }),
  });
}

export async function rejectMissionFeedbackAction(form: HTMLFormElement, feedbackId: string) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("mission_feedback_rationale_required");
  }

  return getJson("/api/mission/reject", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      feedbackId,
      rationale,
    }),
  });
}

export async function approveGapFormalizationAction(form: HTMLFormElement, formalizationId: string) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("gap_formalization_rationale_required");
  }
  const priority = String(data.get("priority") || "medium").trim();
  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    throw new Error("gap_formalization_priority_invalid");
  }

  return getJson("/api/gaps/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      formalizationId,
      rationale,
      priority,
    }),
  });
}

export async function rejectGapFormalizationAction(form: HTMLFormElement, formalizationId: string) {
  const data = new FormData(form);
  const rationale = String(data.get("rationale") || "").trim();
  if (!rationale) {
    throw new Error("gap_formalization_rationale_required");
  }

  return getJson("/api/gaps/reject", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      formalizationId,
      rationale,
    }),
  });
}

function parseStructuredAnswerValue(field: string, rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (
    field === "mission.usefulnessSignals"
    || field === "mission.constraints"
    || field === "mission.capabilityLanes"
  ) {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (
    field === "source.containsExecutableCode"
    || field === "source.improvesDirectiveWorkspace"
    || field === "source.containsWorkflowPattern"
  ) {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return null;
  }

  return value;
}

export async function rerouteEngineRunAction(form: HTMLFormElement, runId: string) {
  const data = new FormData(form);
  const answers: Record<string, unknown> = {};

  for (const [key, raw] of data.entries()) {
    if (!key.startsWith("answer:")) {
      continue;
    }
    const field = key.slice("answer:".length);
    const parsedValue = parseStructuredAnswerValue(field, String(raw ?? ""));
    if (parsedValue == null) {
      continue;
    }
    answers[field] = parsedValue;
  }

  if (Object.keys(answers).length === 0) {
    throw new Error("reroute_answers_required");
  }

  const result: any = await getJson(`/api/engine-runs/${encodeURIComponent(runId)}/reroute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  return `/engine-runs/${encodeURIComponent(result.result.record.runId)}`;
}

export async function updateEnginePlanProgressAction(input: {
  runId: string;
  action: FrontendExecutablePlanAction;
  status: FrontendExecutablePlanAction["status"];
}) {
  const update = input.action.itemIndex == null
    ? {
        plan: input.action.plan,
        itemType: input.action.itemType,
        status: input.status,
      }
    : {
        plan: input.action.plan,
        itemType: input.action.itemType,
        index: input.action.itemIndex,
        status: input.status,
      };

  const result: any = await getJson(`/api/engine-runs/${encodeURIComponent(input.runId)}/plan-progress`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      updates: [update],
    }),
  });
  return result.record;
}

export async function startArchitectureAction(handoffPath: string) {
  const result: any = await getJson("/api/architecture/handoff-start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handoffPath }),
  });
  return `/architecture-starts/view?path=${encodeURIComponent(result.startRelativePath)}`;
}

export async function closeArchitectureStartAction(form: HTMLFormElement, startPath: string) {
  const data = new FormData(form);
  const resultSummary = String(data.get("result_summary") || "").trim();
  const primaryEvidencePath = String(data.get("primary_evidence_path") || "").trim();
  const transformedArtifactsProduced = String(
    data.get("transformed_artifacts_produced") || "",
  )
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!resultSummary) {
    throw new Error("result_summary_required");
  }

  const result: any = await getJson("/api/architecture/bounded-closeout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startPath,
      resultSummary,
      primaryEvidencePath: primaryEvidencePath || undefined,
      transformedArtifactsProduced,
      nextDecision: String(data.get("next_decision") || "needs-more-evidence").trim(),
      valueShape: String(data.get("value_shape") || "working_document").trim(),
      adaptationQuality: String(data.get("adaptation_quality") || "adequate").trim(),
      improvementQuality: String(data.get("improvement_quality") || "skipped").trim(),
      proofExecuted: data.get("proof_executed") === "on",
      targetArtifactClarified: data.get("target_artifact_clarified") === "on",
      deltaEvidencePresent: data.get("delta_evidence_present") === "on",
      noUnresolvedBaggage: data.get("no_unresolved_baggage") === "on",
      productArtifactMaterialized: data.get("product_artifact_materialized") === "on",
    }),
  });
  return `/architecture-results/view?path=${encodeURIComponent(result.resultRelativePath)}`;
}

export async function continueArchitectureResultAction(resultPath: string) {
  const result: any = await getJson("/api/architecture/bounded-continuation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resultPath }),
  });
  return `/architecture-starts/view?path=${encodeURIComponent(result.continuationStartRelativePath)}`;
}

export async function adoptArchitectureResultAction(resultPath: string) {
  const result: any = await getJson("/api/architecture/adopt-result", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resultPath }),
  });
  return `/architecture-adoptions/view?path=${encodeURIComponent(result.adoptedRelativePath)}`;
}

export async function createArchitectureImplementationTargetAction(adoptionPath: string) {
  const result: any = await getJson("/api/architecture/create-implementation-target", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adoptionPath }),
  });
  return `/architecture-implementation-targets/view?path=${encodeURIComponent(result.targetRelativePath)}`;
}

export async function completeArchitectureImplementationAction(form: HTMLFormElement, targetPath: string) {
  const data = new FormData(form);
  const resultSummary = String(data.get("result_summary") || "").trim();
  if (!resultSummary) {
    throw new Error("result_summary_required");
  }

  const result: any = await getJson("/api/architecture/create-implementation-result", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetPath,
      resultSummary,
      outcome: String(data.get("outcome") || "success").trim(),
      deviations: String(data.get("deviations") || "").trim(),
      evidence: String(data.get("evidence") || "").trim(),
      validationResult: String(data.get("validation_result") || "").trim(),
      rollbackNote: String(data.get("rollback_note") || "").trim(),
    }),
  });
  return `/architecture-implementation-results/view?path=${encodeURIComponent(result.resultRelativePath)}`;
}

export async function confirmArchitectureRetentionAction(form: HTMLFormElement, resultPath: string) {
  const data = new FormData(form);
  const result: any = await getJson("/api/architecture/confirm-retention", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      resultPath,
      usefulnessAssessment: String(data.get("usefulness_assessment") || "").trim(),
      stabilityLevel: String(data.get("stability_level") || "bounded-stable").trim(),
      reuseScope: String(data.get("reuse_scope") || "").trim(),
      confirmationDecision: String(data.get("confirmation_decision") || "").trim(),
      rollbackBoundary: String(data.get("rollback_boundary") || "").trim(),
    }),
  });
  return `/architecture-retained/view?path=${encodeURIComponent(result.retainedRelativePath)}`;
}

export async function createArchitectureIntegrationRecordAction(form: HTMLFormElement, retainedPath: string) {
  const data = new FormData(form);
  const result: any = await getJson("/api/architecture/create-integration-record", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      retainedPath,
      integrationTargetSurface: String(data.get("integration_target_surface") || "").trim(),
      readinessSummary: String(data.get("readiness_summary") || "").trim(),
      expectedEffect: String(data.get("expected_effect") || "").trim(),
      validationBoundary: String(data.get("validation_boundary") || "").trim(),
      integrationDecision: String(data.get("integration_decision") || "").trim(),
      rollbackBoundary: String(data.get("rollback_boundary") || "").trim(),
    }),
  });
  return `/architecture-integration-records/view?path=${encodeURIComponent(result.integrationRelativePath)}`;
}

export async function recordArchitectureConsumptionAction(form: HTMLFormElement, integrationPath: string) {
  const data = new FormData(form);
  const result: any = await getJson("/api/architecture/record-consumption", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      integrationPath,
      appliedSurface: String(data.get("applied_surface") || "").trim(),
      applicationSummary: String(data.get("application_summary") || "").trim(),
      observedEffect: String(data.get("observed_effect") || "").trim(),
      validationResult: String(data.get("validation_result") || "").trim(),
      outcome: String(data.get("outcome") || "success").trim(),
      rollbackNote: String(data.get("rollback_note") || "").trim(),
    }),
  });
  return `/architecture-consumption-records/view?path=${encodeURIComponent(result.consumptionRelativePath)}`;
}

export async function evaluateArchitectureConsumptionAction(form: HTMLFormElement, consumptionPath: string) {
  const data = new FormData(form);
  const result: any = await getJson("/api/architecture/evaluate-consumption", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consumptionPath,
      decision: String(data.get("decision") || "keep").trim(),
      rationale: String(data.get("rationale") || "").trim(),
      observedStability: String(data.get("observed_stability") || "").trim(),
      retainedUsefulnessAssessment: String(data.get("retained_usefulness_assessment") || "").trim(),
      nextBoundedAction: String(data.get("next_bounded_action") || "").trim(),
      rollbackNote: String(data.get("rollback_note") || "").trim(),
    }),
  });
  return `/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(result.evaluationRelativePath)}`;
}

export async function reopenArchitectureFromEvaluationAction(evaluationPath: string) {
  const result: any = await getJson("/api/architecture/reopen-from-evaluation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ evaluationPath }),
  });
  return `/architecture-starts/view?path=${encodeURIComponent(result.reopenedStartRelativePath)}`;
}
