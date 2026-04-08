import fs from "node:fs";
import path from "node:path";

import { readJson, writeJson, writeUtf8 } from "../../shared/lib/file-io.ts";

import {
  normalizeDirectiveWorkspaceRoot,
  resolveDirectiveWorkspaceRelativePath,
} from "../approval-boundary.ts";
import { resolveDirectiveWorkspaceState } from "../state/index.ts";
import {
  submitDirectiveDiscoveryFrontDoor,
  type DirectiveDiscoveryFrontDoorResult,
} from "../../discovery/lib/discovery-front-door.ts";
import {
  openDirectiveDiscoveryRoute,
  readDirectiveDiscoveryRoutingArtifact,
} from "../../discovery/lib/discovery-route-opener.ts";
import type { DiscoverySubmissionRequest } from "../../discovery/lib/discovery-submission-router.ts";
import {
  readDiscoveryRoutingReviewResolution,
} from "../../discovery/lib/discovery-routing-review-resolution.ts";
import { startDirectiveArchitectureFromHandoff } from "../../architecture/lib/architecture-handoff-start.ts";
import {
  closeDirectiveArchitectureBoundedStart,
  readDirectiveArchitectureBoundedCloseoutAssist,
  readDirectiveArchitectureBoundedStartArtifact,
  type CloseDirectiveArchitectureBoundedStartInput,
} from "../../architecture/lib/architecture-bounded-closeout.ts";
import { adoptDirectiveArchitectureResult } from "../../architecture/lib/architecture-result-adoption.ts";
import {
  createDirectiveArchitectureImplementationTarget,
  readDirectiveArchitectureImplementationTargetDetail,
} from "../../architecture/lib/architecture-implementation-target.ts";
import {
  createDirectiveArchitectureImplementationResult,
} from "../../architecture/lib/architecture-implementation-result.ts";
import { confirmDirectiveArchitectureRetention } from "../../architecture/lib/architecture-retention.ts";
import { createDirectiveArchitectureIntegrationRecord } from "../../architecture/lib/architecture-integration-record.ts";
import { recordDirectiveArchitectureConsumption } from "../../architecture/lib/architecture-consumption-record.ts";
import { evaluateDirectiveArchitectureConsumption } from "../../architecture/lib/architecture-post-consumption-evaluation.ts";
import { openDirectiveRuntimeFollowUp } from "../../runtime/lib/runtime-follow-up-opener.ts";
import { openDirectiveRuntimeRecordProof } from "../../runtime/lib/runtime-record-proof-opener.ts";
import { openDirectiveRuntimeProofRuntimeCapabilityBoundary } from "../../runtime/lib/runtime-proof-runtime-capability-boundary-opener.ts";
import { openDirectiveRuntimePromotionReadiness } from "../../runtime/lib/runtime-runtime-capability-boundary-promotion-readiness-opener.ts";
import {
  buildDirectiveRuntimePromotionSpecification,
  resolveDirectiveRuntimePromotionSpecificationPath,
} from "../../runtime/lib/runtime-promotion-specification.ts";
import {
  evaluatePreHostRuntimePromotionRecordPrerequisites,
  renderRuntimePromotionRecord,
  resolveRuntimePromotionRecordPath,
} from "../../runtime/lib/runtime-promotion-record-writer.ts";
import {
  buildDirectiveRuntimePromotionAutomationDryRunReport,
  writeDirectiveRuntimeRegistryEntryFromAutomationReport,
} from "./runtime-promotion-automation.ts";

export type DirectiveAutonomousLaneLoopConfidence = "low" | "medium" | "high";

export type DirectiveAutonomousLaneLoopPolicy = {
  enabled: boolean;
  approvedBy: string;
  maxActionsPerRun: number;
  discovery: {
    autoOpenRoute: boolean;
    requireNoHumanReview: boolean;
    minimumConfidence: DirectiveAutonomousLaneLoopConfidence;
  };
  architecture: {
    autoStartFromHandoff: boolean;
    autoCloseBoundedStart: boolean;
    autoAdoptBoundedResult: boolean;
    autoCreateImplementationTargetForPlannedNext: boolean;
    autoCompleteMaterializationChain: boolean;
  };
  runtime: {
    autoAdvanceToPromotionReadiness: boolean;
    autoGeneratePromotionSpecification: boolean;
    autoCreatePromotionRecord: boolean;
    autoHostAdapterDescriptor: boolean;
    autoHostCallableExecution: boolean;
    autoWriteRegistryEntry: boolean;
    requireNoHumanReview: boolean;
  };
};

export type DirectiveAutonomousLaneLoopActionKind =
  | "discovery_front_door_submission"
  | "discovery_route_open"
  | "architecture_handoff_start"
  | "architecture_bounded_closeout"
  | "architecture_result_adoption"
  | "architecture_implementation_target_create"
  | "architecture_implementation_result_create"
  | "architecture_retention_confirm"
  | "architecture_integration_record_create"
  | "architecture_consumption_record"
  | "architecture_post_consumption_evaluation"
  | "runtime_follow_up_open"
  | "runtime_record_proof_open"
  | "runtime_proof_capability_boundary_open"
  | "runtime_promotion_readiness_open"
  | "runtime_promotion_specification_write"
  | "runtime_promotion_record_write"
  | "runtime_registry_entry_write";

export type DirectiveAutonomousLaneLoopAction = {
  index: number;
  lane: "discovery" | "architecture" | "runtime";
  actionKind: DirectiveAutonomousLaneLoopActionKind;
  sourcePath: string;
  targetPath: string;
  created: boolean;
  stageBefore: string;
  stageAfter: string | null;
};

export type DirectiveAutonomousLaneLoopResult = {
  ok: true;
  directiveRoot: string;
  policyPath: string;
  startedFrom:
    | {
      kind: "artifact";
      artifactPath: string;
    }
    | {
      kind: "discovery_submission";
      candidateId: string;
      routingRecordPath: string;
    };
  policy: DirectiveAutonomousLaneLoopPolicy;
  actions: DirectiveAutonomousLaneLoopAction[];
  finalFocusPath: string | null;
  finalCurrentStage: string | null;
  stopReason: string;
};

export type DirectiveAutonomousLaneLoopDisposition =
  | "continued"
  | "stopped"
  | "rejected_or_deferred"
  | "blocked";

export type DirectiveAutonomousLaneLoopPhaseReport = {
  index: number;
  actionKind: DirectiveAutonomousLaneLoopActionKind;
  lane: "discovery" | "architecture" | "runtime";
  sourcePath: string;
  targetPath: string;
  stageBefore: string;
  stageAfter: string | null;
  currentHeadPath: string | null;
  nextLegalStep: string | null;
  disposition: DirectiveAutonomousLaneLoopDisposition;
};

export type DirectiveAutonomousLaneLoopSupervisedResult =
  DirectiveAutonomousLaneLoopResult & {
    phaseReports: DirectiveAutonomousLaneLoopPhaseReport[];
    finalDisposition: DirectiveAutonomousLaneLoopDisposition;
  };

export type RunDirectiveAutonomousLaneLoopInput =
  | {
    directiveRoot?: string;
    artifactPath: string;
  }
  | {
    directiveRoot?: string;
    request: DiscoverySubmissionRequest;
    runtimeArtifactsRoot?: string;
    receivedAt?: string;
  };

const DEFAULT_POLICY: DirectiveAutonomousLaneLoopPolicy = {
  enabled: true,
  approvedBy: "directive-autonomous-loop",
  maxActionsPerRun: 8,
  discovery: {
    autoOpenRoute: true,
    requireNoHumanReview: true,
    minimumConfidence: "high",
  },
  architecture: {
    autoStartFromHandoff: true,
    autoCloseBoundedStart: true,
    autoAdoptBoundedResult: true,
    autoCreateImplementationTargetForPlannedNext: true,
    autoCompleteMaterializationChain: true,
  },
  runtime: {
    autoAdvanceToPromotionReadiness: true,
    autoGeneratePromotionSpecification: true,
    autoCreatePromotionRecord: true,
    autoHostAdapterDescriptor: false,
    autoHostCallableExecution: false,
    autoWriteRegistryEntry: false,
    requireNoHumanReview: true,
  },
};



function loadDirectiveAutonomousLaneLoopPolicy(directiveRoot: string) {
  const policyPath = path.join(directiveRoot, "control", "state", "autonomous-lane-loop-policy.json");
  if (!fs.existsSync(policyPath)) {
    return {
      policyPath: policyPath.replace(/\\/g, "/"),
      policy: DEFAULT_POLICY,
    };
  }

  const loaded = readJson<Partial<DirectiveAutonomousLaneLoopPolicy>>(policyPath);
  return {
    policyPath: policyPath.replace(/\\/g, "/"),
    policy: {
      enabled: loaded.enabled ?? DEFAULT_POLICY.enabled,
      approvedBy: String(loaded.approvedBy ?? DEFAULT_POLICY.approvedBy).trim() || DEFAULT_POLICY.approvedBy,
      maxActionsPerRun: Math.max(1, Number(loaded.maxActionsPerRun ?? DEFAULT_POLICY.maxActionsPerRun)),
      discovery: {
        autoOpenRoute: loaded.discovery?.autoOpenRoute ?? DEFAULT_POLICY.discovery.autoOpenRoute,
        requireNoHumanReview:
          loaded.discovery?.requireNoHumanReview ?? DEFAULT_POLICY.discovery.requireNoHumanReview,
        minimumConfidence:
          loaded.discovery?.minimumConfidence ?? DEFAULT_POLICY.discovery.minimumConfidence,
      },
      architecture: {
        autoStartFromHandoff:
          loaded.architecture?.autoStartFromHandoff ?? DEFAULT_POLICY.architecture.autoStartFromHandoff,
        autoCloseBoundedStart:
          loaded.architecture?.autoCloseBoundedStart ?? DEFAULT_POLICY.architecture.autoCloseBoundedStart,
        autoAdoptBoundedResult:
          loaded.architecture?.autoAdoptBoundedResult ?? DEFAULT_POLICY.architecture.autoAdoptBoundedResult,
        autoCreateImplementationTargetForPlannedNext:
          loaded.architecture?.autoCreateImplementationTargetForPlannedNext
          ?? DEFAULT_POLICY.architecture.autoCreateImplementationTargetForPlannedNext,
        autoCompleteMaterializationChain:
          loaded.architecture?.autoCompleteMaterializationChain
          ?? DEFAULT_POLICY.architecture.autoCompleteMaterializationChain,
      },
      runtime: {
        autoAdvanceToPromotionReadiness:
          loaded.runtime?.autoAdvanceToPromotionReadiness
          ?? DEFAULT_POLICY.runtime.autoAdvanceToPromotionReadiness,
        autoGeneratePromotionSpecification:
          loaded.runtime?.autoGeneratePromotionSpecification
          ?? DEFAULT_POLICY.runtime.autoGeneratePromotionSpecification,
        autoCreatePromotionRecord:
          loaded.runtime?.autoCreatePromotionRecord
          ?? DEFAULT_POLICY.runtime.autoCreatePromotionRecord,
        autoHostAdapterDescriptor:
          loaded.runtime?.autoHostAdapterDescriptor
          ?? DEFAULT_POLICY.runtime.autoHostAdapterDescriptor,
        autoHostCallableExecution:
          loaded.runtime?.autoHostCallableExecution
          ?? DEFAULT_POLICY.runtime.autoHostCallableExecution,
        autoWriteRegistryEntry:
          loaded.runtime?.autoWriteRegistryEntry
          ?? DEFAULT_POLICY.runtime.autoWriteRegistryEntry,
        requireNoHumanReview:
          loaded.runtime?.requireNoHumanReview ?? DEFAULT_POLICY.runtime.requireNoHumanReview,
      },
    } satisfies DirectiveAutonomousLaneLoopPolicy,
  };
}

function confidenceRank(value: string | null | undefined) {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function routingPassesAutonomyGate(input: {
  directiveRoot: string;
  routingPath: string;
  minimumConfidence: DirectiveAutonomousLaneLoopConfidence;
  requireNoHumanReview: boolean;
}) {
  const routing = readDirectiveDiscoveryRoutingArtifact({
    directiveRoot: input.directiveRoot,
    routingPath: input.routingPath,
  });

  // Check for an explicit review resolution artifact that supersedes the raw routing state
  const reviewResolution = readDiscoveryRoutingReviewResolution({
    directiveRoot: input.directiveRoot,
    routingRecordPath: input.routingPath,
  });

  const effectiveConfidence = reviewResolution?.resolvedConfidence ?? routing.routingConfidence;
  const effectiveNeedsHumanReview = reviewResolution?.resolvedNeedsHumanReview ?? routing.needsHumanReview;
  const effectiveRouteConflict = reviewResolution?.resolvedRouteConflict ?? routing.routeConflict;

  if (
    confidenceRank(effectiveConfidence)
    < confidenceRank(input.minimumConfidence)
  ) {
    return {
      ok: false as const,
      reason:
        `Routing confidence "${effectiveConfidence ?? "unknown"}" is below the autonomous minimum "${input.minimumConfidence}".`,
    };
  }

  if (
    input.requireNoHumanReview
    && (effectiveNeedsHumanReview === true || effectiveRouteConflict === true)
  ) {
    return {
      ok: false as const,
      reason: "Routing still requires human review or has a route conflict.",
    };
  }

  return {
    ok: true as const,
  };
}

function resolveFocusOrThrow(directiveRoot: string, artifactPath: string) {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath,
    includeAnchors: false,
  }).focus;

  if (!resolved) {
    throw new Error(`invalid_state: unable to resolve current focus for ${artifactPath}`);
  }

  return resolved;
}

function buildAction(input: {
  index: number;
  lane: "discovery" | "architecture" | "runtime";
  actionKind: DirectiveAutonomousLaneLoopActionKind;
  sourcePath: string;
  targetPath: string;
  created: boolean;
  stageBefore: string;
  directiveRoot: string;
}) {
  let after: ReturnType<typeof resolveDirectiveWorkspaceState>["focus"] = null;
  try {
    after = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: input.targetPath,
      includeAnchors: false,
    }).focus;
  } catch {
    after = null;
  }

  return {
    index: input.index,
    lane: input.lane,
    actionKind: input.actionKind,
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    created: input.created,
    stageBefore: input.stageBefore,
    stageAfter: after?.currentStage ?? null,
  } satisfies DirectiveAutonomousLaneLoopAction;
}

function classifyDirectiveAutonomousFocusDisposition(input: {
  currentStage: string | null;
  nextLegalStep: string | null;
  integrityState: string | null | undefined;
}) {
  if (input.integrityState === "broken") {
    return "blocked" as const;
  }

  const currentStage = String(input.currentStage ?? "").trim().toLowerCase();
  const nextLegalStep = String(input.nextLegalStep ?? "").trim().toLowerCase();

  if (currentStage.includes("rejected") || currentStage.includes("deferred")) {
    return "rejected_or_deferred" as const;
  }

  if (
    nextLegalStep.startsWith("no automatic ")
    || currentStage === "discovery.monitor.active"
    || currentStage === "architecture.post_consumption_evaluation.keep"
    || currentStage === "architecture.bounded_result.stay_experimental"
  ) {
    return "stopped" as const;
  }

  return "continued" as const;
}

function buildDirectiveAutonomousLaneLoopPhaseReports(input: {
  directiveRoot: string;
  actions: DirectiveAutonomousLaneLoopAction[];
}) {
  return input.actions.map((action) => {
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: action.targetPath,
      includeAnchors: false,
    }).focus;

    return {
      index: action.index,
      actionKind: action.actionKind,
      lane: action.lane,
      sourcePath: action.sourcePath,
      targetPath: action.targetPath,
      stageBefore: action.stageBefore,
      stageAfter: action.stageAfter,
      currentHeadPath: focus?.currentHead.artifactPath ?? null,
      nextLegalStep: focus?.nextLegalStep ?? null,
      disposition: classifyDirectiveAutonomousFocusDisposition({
        currentStage: focus?.currentStage ?? null,
        nextLegalStep: focus?.nextLegalStep ?? null,
        integrityState: focus?.integrityState,
      }),
    } satisfies DirectiveAutonomousLaneLoopPhaseReport;
  });
}

function isDirectiveWorkspaceHost(proposedHost: string | null | undefined) {
  const normalized = String(proposedHost ?? "").trim().toLowerCase();
  return normalized.startsWith("directive workspace");
}

function buildAutonomousArchitectureImplementationSummary(input: {
  targetPath: string;
  directiveRoot: string;
}) {
  const targetDetail = readDirectiveArchitectureImplementationTargetDetail({
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

function buildAutonomousArchitectureBoundedCloseoutRequest(input: {
  directiveRoot: string;
  startPath: string;
  approvedBy: string;
}): CloseDirectiveArchitectureBoundedStartInput {
  const startArtifact = readDirectiveArchitectureBoundedStartArtifact({
    directiveRoot: input.directiveRoot,
    startPath: input.startPath,
  });
  const assist = readDirectiveArchitectureBoundedCloseoutAssist({
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

function writeAutonomousRuntimePromotionSpecification(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
}) {
  const specification = buildDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const specificationRelativePath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const specificationAbsolutePath = path.join(input.directiveRoot, specificationRelativePath);
  const created = !fs.existsSync(specificationAbsolutePath);
  writeJson(specificationAbsolutePath, specification);
  return {
    created,
    specificationRelativePath: specificationRelativePath.replace(/\\/g, "/"),
  };
}

function writeAutonomousRuntimePromotionRecord(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
  approvedBy: string;
}) {
  const prerequisites = evaluatePreHostRuntimePromotionRecordPrerequisites({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });

  if (!prerequisites.readyForPreHostPromotionRecordPreparation) {
    return {
      ok: false as const,
      reason: `Runtime promotion record prerequisites are incomplete: ${prerequisites.missingPrerequisites.join(", ")}`,
    };
  }

  if (!isDirectiveWorkspaceHost(prerequisites.effectiveProposedHost)) {
    return {
      ok: false as const,
      reason: "Runtime promotion record auto-open remains limited to Directive Workspace host targets.",
    };
  }

  const promotionDate =
    path.posix.basename(input.promotionReadinessPath).slice(0, 10)
    || new Date().toISOString().slice(0, 10);
  const specificationPath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const promotionRecordRelativePath = resolveRuntimePromotionRecordPath({
    candidate_id: prerequisites.candidateId,
    promotion_date: promotionDate,
  });
  const promotionRecordAbsolutePath = path.join(input.directiveRoot, promotionRecordRelativePath);
  const created = !fs.existsSync(promotionRecordAbsolutePath);

  const request = {
    candidate_id: prerequisites.candidateId,
    candidate_name: prerequisites.candidateName,
    promotion_date: promotionDate,
    linked_runtime_record: prerequisites.linkedArtifacts.runtimeRecord.relativePath ?? "",
    target_host: prerequisites.effectiveProposedHost ?? prerequisites.proposedHost ?? "Directive Workspace host target",
    target_runtime_surface: prerequisites.targetRuntimeSurface ?? "bounded runtime capability review",
    integration_mode: prerequisites.integrationMode ?? "review_only",
    source_intent_artifact: prerequisites.linkedArtifacts.capabilityBoundary.relativePath ?? "",
    compile_contract_artifact: prerequisites.compileContractArtifact.relativePath ?? "shared/contracts/runtime-to-host.md",
    runtime_permissions_profile: "read-only promotion-record preparation only; no registry write, host integration, runtime execution, or automation side effects",
    safe_output_scope: "`runtime/07-promotion-records/` and `runtime/06-promotion-specifications/` only",
    sanitize_policy: "autonomous bounded pre-host promotion record only; no registry acceptance, host integration, runtime execution, or downstream automation",
    proposed_runtime_status: "autonomous_pre_host_promotion_record_opened",
    proof_path: prerequisites.linkedArtifacts.runtimeProof.relativePath ?? "",
    quality_gate_profile: "autonomous_pre_host_promotion_guard/v1",
    promotion_profile_family: "bounded_autonomous_pre_host_promotion",
    proof_shape: "autonomous_pre_host_promotion_snapshot/v1",
    primary_host_checker: "npm run check:pre-host-promotion-record-prerequisites",
    full_text_coverage_threshold: "n/a",
    evidence_binding_threshold: "n/a",
    citation_error_threshold: "n/a",
    observed_full_text_coverage: "n/a",
    observed_evidence_binding: "n/a",
    observed_citation_error_rate: "n/a",
    quality_gate_result: "pass",
    validation_state: "validated_locally",
    quality_gate_fail_reasons: [],
    required_gates: [
      ...prerequisites.requiredGates,
      "npm run check:pre-host-promotion-record-prerequisites",
    ],
    validation_result:
      `This promotion record was opened automatically from ${input.promotionReadinessPath} after repo-native pre-host prerequisites and promotion specification generation passed. Registry acceptance, host integration, runtime execution, and promotion automation remain closed.`,
    rollback_plan:
      `Remove ${promotionRecordRelativePath}, regenerate ${specificationPath} if needed, and return the case to ${input.promotionReadinessPath} before any further Runtime step.`,
    owner: "Directive Runtime",
    promotion_decision: "approved for one bounded autonomous pre-host promotion review",
  };

  writeUtf8(promotionRecordAbsolutePath, renderRuntimePromotionRecord(request));

  return {
    ok: true as const,
    created,
    promotionRecordRelativePath: promotionRecordRelativePath.replace(/\\/g, "/"),
  };
}

async function maybeAdvanceAutonomousLaneLoop(input: {
  directiveRoot: string;
  currentArtifactPath: string;
  currentStage: string;
  policy: DirectiveAutonomousLaneLoopPolicy;
  actionIndex: number;
}) {
  const sourcePath = input.currentArtifactPath;

  if (input.currentStage.startsWith("discovery.route.")) {
    if (!input.policy.discovery.autoOpenRoute) {
      return { advanced: false as const, stopReason: "Discovery route auto-open is disabled by policy." };
    }

    const routingGate = routingPassesAutonomyGate({
      directiveRoot: input.directiveRoot,
      routingPath: sourcePath,
      minimumConfidence: input.policy.discovery.minimumConfidence,
      requireNoHumanReview: input.policy.discovery.requireNoHumanReview,
    });
    if (!routingGate.ok) {
      return { advanced: false as const, stopReason: routingGate.reason };
    }

    const opened = openDirectiveDiscoveryRoute({
      directiveRoot: input.directiveRoot,
      routingPath: sourcePath,
      approved: true,
      approvedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: opened.stubRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "discovery",
        actionKind: "discovery_route_open",
        sourcePath,
        targetPath: opened.stubRelativePath,
        created: opened.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.handoff.pending_review") {
    if (!input.policy.architecture.autoStartFromHandoff) {
      return { advanced: false as const, stopReason: "Architecture handoff auto-start is disabled by policy." };
    }

    const started = startDirectiveArchitectureFromHandoff({
      directiveRoot: input.directiveRoot,
      handoffPath: sourcePath,
      startedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: started.startRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_handoff_start",
        sourcePath,
        targetPath: started.startRelativePath,
        created: started.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.bounded_start.opened") {
    if (!input.policy.architecture.autoCloseBoundedStart) {
      return {
        advanced: false as const,
        stopReason: "Architecture bounded-start auto-closeout is disabled by policy.",
      };
    }

    const closeout = closeDirectiveArchitectureBoundedStart(
      buildAutonomousArchitectureBoundedCloseoutRequest({
        directiveRoot: input.directiveRoot,
        startPath: sourcePath,
        approvedBy: input.policy.approvedBy,
      }),
    );

    return {
      advanced: true as const,
      nextArtifactPath: closeout.resultRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_bounded_closeout",
        sourcePath,
        targetPath: closeout.resultRelativePath,
        created: closeout.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.bounded_result.adopt") {
    if (!input.policy.architecture.autoAdoptBoundedResult) {
      return { advanced: false as const, stopReason: "Architecture bounded-result adoption is disabled by policy." };
    }

    const adopted = adoptDirectiveArchitectureResult({
      directiveRoot: input.directiveRoot,
      resultPath: sourcePath,
      adoptedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: adopted.adoptedRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_result_adoption",
        sourcePath,
        targetPath: adopted.adoptedRelativePath,
        created: adopted.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.adoption.adopt_planned_next") {
    if (!input.policy.architecture.autoCreateImplementationTargetForPlannedNext) {
      return {
        advanced: false as const,
        stopReason: "Architecture implementation-target auto-open is disabled by policy.",
      };
    }

    const target = createDirectiveArchitectureImplementationTarget({
      directiveRoot: input.directiveRoot,
      adoptionPath: sourcePath,
      createdBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: target.targetRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_implementation_target_create",
        sourcePath,
        targetPath: target.targetRelativePath,
        created: target.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.implementation_target.opened") {
    if (!input.policy.architecture.autoCompleteMaterializationChain) {
      return {
        advanced: false as const,
        stopReason: "Architecture materialization-chain auto-completion is disabled by policy.",
      };
    }

    const result = createDirectiveArchitectureImplementationResult({
      directiveRoot: input.directiveRoot,
      targetPath: sourcePath,
      completedBy: input.policy.approvedBy,
      resultSummary: buildAutonomousArchitectureImplementationSummary({
        directiveRoot: input.directiveRoot,
        targetPath: sourcePath,
      }),
    });

    return {
      advanced: true as const,
      nextArtifactPath: result.resultRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_implementation_result_create",
        sourcePath,
        targetPath: result.resultRelativePath,
        created: result.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.implementation_result.success") {
    if (!input.policy.architecture.autoCompleteMaterializationChain) {
      return {
        advanced: false as const,
        stopReason: "Architecture materialization-chain auto-completion is disabled by policy.",
      };
    }

    const retained = confirmDirectiveArchitectureRetention({
      directiveRoot: input.directiveRoot,
      resultPath: sourcePath,
      confirmedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: retained.retainedRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_retention_confirm",
        sourcePath,
        targetPath: retained.retainedRelativePath,
        created: retained.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.retained.confirmed") {
    if (!input.policy.architecture.autoCompleteMaterializationChain) {
      return {
        advanced: false as const,
        stopReason: "Architecture materialization-chain auto-completion is disabled by policy.",
      };
    }

    const integration = createDirectiveArchitectureIntegrationRecord({
      directiveRoot: input.directiveRoot,
      retainedPath: sourcePath,
      createdBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: integration.integrationRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_integration_record_create",
        sourcePath,
        targetPath: integration.integrationRelativePath,
        created: integration.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.integration_record.ready") {
    if (!input.policy.architecture.autoCompleteMaterializationChain) {
      return {
        advanced: false as const,
        stopReason: "Architecture materialization-chain auto-completion is disabled by policy.",
      };
    }

    const consumption = recordDirectiveArchitectureConsumption({
      directiveRoot: input.directiveRoot,
      integrationPath: sourcePath,
      recordedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: consumption.consumptionRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_consumption_record",
        sourcePath,
        targetPath: consumption.consumptionRelativePath,
        created: consumption.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "architecture.consumption.success") {
    if (!input.policy.architecture.autoCompleteMaterializationChain) {
      return {
        advanced: false as const,
        stopReason: "Architecture materialization-chain auto-completion is disabled by policy.",
      };
    }

    const evaluation = evaluateDirectiveArchitectureConsumption({
      directiveRoot: input.directiveRoot,
      consumptionPath: sourcePath,
      evaluatedBy: input.policy.approvedBy,
      decision: "keep",
    });

    return {
      advanced: true as const,
      nextArtifactPath: evaluation.evaluationRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "architecture",
        actionKind: "architecture_post_consumption_evaluation",
        sourcePath,
        targetPath: evaluation.evaluationRelativePath,
        created: evaluation.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.follow_up.pending_review") {
    if (!input.policy.runtime.autoAdvanceToPromotionReadiness) {
      return { advanced: false as const, stopReason: "Runtime autonomous follow-through is disabled by policy." };
    }

    const followUp = openDirectiveRuntimeFollowUp({
      directiveRoot: input.directiveRoot,
      followUpPath: sourcePath,
      approved: true,
      approvedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: followUp.runtimeRecordRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_follow_up_open",
        sourcePath,
        targetPath: followUp.runtimeRecordRelativePath,
        created: followUp.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.record.pending_proof_boundary") {
    const proof = openDirectiveRuntimeRecordProof({
      directiveRoot: input.directiveRoot,
      runtimeRecordPath: sourcePath,
      approved: true,
      approvedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: proof.runtimeProofRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_record_proof_open",
        sourcePath,
        targetPath: proof.runtimeProofRelativePath,
        created: proof.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.proof.opened") {
    const boundary = openDirectiveRuntimeProofRuntimeCapabilityBoundary({
      directiveRoot: input.directiveRoot,
      runtimeProofPath: sourcePath,
      approved: true,
      approvedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: boundary.runtimeCapabilityBoundaryRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_proof_capability_boundary_open",
        sourcePath,
        targetPath: boundary.runtimeCapabilityBoundaryRelativePath,
        created: boundary.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.runtime_capability_boundary.opened") {
    const readiness = openDirectiveRuntimePromotionReadiness({
      directiveRoot: input.directiveRoot,
      capabilityBoundaryPath: sourcePath,
      approved: true,
      approvedBy: input.policy.approvedBy,
    });

    return {
      advanced: true as const,
      nextArtifactPath: readiness.promotionReadinessRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_promotion_readiness_open",
        sourcePath,
        targetPath: readiness.promotionReadinessRelativePath,
        created: readiness.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.promotion_readiness.opened") {
    const specificationRelativePath = resolveDirectiveRuntimePromotionSpecificationPath({
      promotionReadinessPath: sourcePath,
    });
    const specificationAbsolutePath = path.join(input.directiveRoot, specificationRelativePath);

    if (
      input.policy.runtime.autoGeneratePromotionSpecification
      && !fs.existsSync(specificationAbsolutePath)
    ) {
      const specification = writeAutonomousRuntimePromotionSpecification({
        directiveRoot: input.directiveRoot,
        promotionReadinessPath: sourcePath,
      });

      return {
        advanced: true as const,
        nextArtifactPath: sourcePath,
        action: buildAction({
          index: input.actionIndex,
          lane: "runtime",
          actionKind: "runtime_promotion_specification_write",
          sourcePath,
          targetPath: sourcePath,
          created: specification.created,
          stageBefore: input.currentStage,
          directiveRoot: input.directiveRoot,
        }),
      };
    }

    if (!input.policy.runtime.autoCreatePromotionRecord) {
      return {
        advanced: false as const,
        stopReason: "Runtime promotion-record auto-open is disabled by policy.",
      };
    }

    const promotionRecord = writeAutonomousRuntimePromotionRecord({
      directiveRoot: input.directiveRoot,
      promotionReadinessPath: sourcePath,
      approvedBy: input.policy.approvedBy,
    });

    if (!promotionRecord.ok) {
      return {
        advanced: false as const,
        stopReason: promotionRecord.reason,
      };
    }

    return {
      advanced: true as const,
      nextArtifactPath: promotionRecord.promotionRecordRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_promotion_record_write",
        sourcePath,
        targetPath: promotionRecord.promotionRecordRelativePath,
        created: promotionRecord.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  if (input.currentStage === "runtime.promotion_record.opened") {
    const automationReport = buildDirectiveRuntimePromotionAutomationDryRunReport({
      directiveRoot: input.directiveRoot,
      promotionRecordPath: sourcePath,
      policy: input.policy.runtime,
      approvedBy: input.policy.approvedBy,
    });

    if (!automationReport.automationEligible) {
      return {
        advanced: false as const,
        stopReason: automationReport.stopReason,
      };
    }

    const registryEntry = writeDirectiveRuntimeRegistryEntryFromAutomationReport({
      directiveRoot: input.directiveRoot,
      report: automationReport,
    });

    return {
      advanced: true as const,
      nextArtifactPath: registryEntry.registryEntryRelativePath,
      action: buildAction({
        index: input.actionIndex,
        lane: "runtime",
        actionKind: "runtime_registry_entry_write",
        sourcePath,
        targetPath: registryEntry.registryEntryRelativePath,
        created: registryEntry.created,
        stageBefore: input.currentStage,
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  return {
    advanced: false as const,
    stopReason: `No autonomous transition is open from current stage "${input.currentStage}".`,
  };
}

async function startDirectiveAutonomousLaneLoop(input: {
  directiveRoot: string;
  policy: DirectiveAutonomousLaneLoopPolicy;
  artifactPath?: string;
  request?: DiscoverySubmissionRequest;
  runtimeArtifactsRoot?: string;
  receivedAt?: string;
}) {
  if (input.request) {
    const frontDoor = await submitDirectiveDiscoveryFrontDoor({
      directiveRoot: input.directiveRoot,
      request: input.request,
      runtimeArtifactsRoot: input.runtimeArtifactsRoot,
      receivedAt: input.receivedAt,
    });

    return {
      currentArtifactPath: frontDoor.createdPaths.routingRecordPath,
      startedFrom: {
        kind: "discovery_submission" as const,
        candidateId: frontDoor.candidateId,
        routingRecordPath: frontDoor.createdPaths.routingRecordPath,
      },
      initialAction: buildAction({
        index: 1,
        lane: "discovery",
        actionKind: "discovery_front_door_submission",
        sourcePath: frontDoor.queuePath,
        targetPath: frontDoor.createdPaths.routingRecordPath,
        created: true,
        stageBefore: "submission.pending",
        directiveRoot: input.directiveRoot,
      }),
    };
  }

  const artifactPath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.artifactPath!,
    "artifactPath",
  );
  return {
    currentArtifactPath: artifactPath,
    startedFrom: {
      kind: "artifact" as const,
      artifactPath,
    },
    initialAction: null,
  };
}

export async function runDirectiveAutonomousLaneLoop(
  input: RunDirectiveAutonomousLaneLoopInput,
): Promise<DirectiveAutonomousLaneLoopResult> {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const { policyPath, policy } = loadDirectiveAutonomousLaneLoopPolicy(directiveRoot);

  if (!policy.enabled) {
    throw new Error(`invalid_state: autonomous lane loop is disabled by policy at ${policyPath}`);
  }

  const actions: DirectiveAutonomousLaneLoopAction[] = [];
  const started = await startDirectiveAutonomousLaneLoop({
    directiveRoot,
    policy,
    artifactPath: "artifactPath" in input ? input.artifactPath : undefined,
    request: "request" in input ? input.request : undefined,
    runtimeArtifactsRoot: "runtimeArtifactsRoot" in input ? input.runtimeArtifactsRoot : undefined,
    receivedAt: "receivedAt" in input ? input.receivedAt : undefined,
  });

  if (started.initialAction) {
    actions.push(started.initialAction);
  }

  let currentArtifactPath = started.currentArtifactPath;
  let stopReason = "No autonomous transition was needed.";

  while (actions.length < policy.maxActionsPerRun) {
    const focus = resolveFocusOrThrow(directiveRoot, currentArtifactPath);
    const effectiveArtifactPath = focus.currentHead?.artifactPath ?? currentArtifactPath;
    const effectiveStage = focus.currentHead?.artifactStage ?? focus.currentStage;
    const next = await maybeAdvanceAutonomousLaneLoop({
      directiveRoot,
      currentArtifactPath: effectiveArtifactPath,
      currentStage: effectiveStage,
      policy,
      actionIndex: actions.length + 1,
    });

    if (!next.advanced) {
      stopReason = next.stopReason;
      break;
    }

    actions.push(next.action);
    currentArtifactPath = next.nextArtifactPath;
  }

  const finalFocus = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath: currentArtifactPath,
    includeAnchors: false,
  }).focus;

  return {
    ok: true,
    directiveRoot,
    policyPath,
    startedFrom: started.startedFrom,
    policy,
    actions,
    finalFocusPath: currentArtifactPath ?? null,
    finalCurrentStage: finalFocus?.currentStage ?? null,
    stopReason: actions.length >= policy.maxActionsPerRun
      ? `Reached the configured maxActionsPerRun (${policy.maxActionsPerRun}).`
      : stopReason,
  };
}

export async function runDirectiveAutonomousLaneLoopSupervised(
  input: RunDirectiveAutonomousLaneLoopInput,
): Promise<DirectiveAutonomousLaneLoopSupervisedResult> {
  const result = await runDirectiveAutonomousLaneLoop(input);
  const phaseReports = buildDirectiveAutonomousLaneLoopPhaseReports({
    directiveRoot: result.directiveRoot,
    actions: result.actions,
  });

  const finalFocus =
    result.finalFocusPath
      ? resolveDirectiveWorkspaceState({
          directiveRoot: result.directiveRoot,
          artifactPath: result.finalFocusPath,
          includeAnchors: false,
        }).focus
      : null;

  return {
    ...result,
    phaseReports,
    finalDisposition: classifyDirectiveAutonomousFocusDisposition({
      currentStage: finalFocus?.currentStage ?? result.finalCurrentStage,
      nextLegalStep: finalFocus?.nextLegalStep ?? null,
      integrityState: finalFocus?.integrityState,
    }),
  };
}
