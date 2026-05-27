import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveWorkspaceRoot,
  resolveDirectiveWorkspaceRelativePath,
} from "../../approval-boundary.ts";
import { resolveDirectiveWorkspaceState } from "../../state/index.ts";
import {
  submitDirectiveDiscoveryFrontDoor,
} from "../../../discovery/lib/front-door/front-door.ts";
import { openDirectiveDiscoveryRoute } from "../../../discovery/lib/routing/route-opener.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/submission-router.ts";
import { startDirectiveArchitectureFromHandoff } from "../../../architecture/lib/experiments/handoff-start.ts";
import {
  closeArchitectureBoundedStart,
} from "../../../architecture/lib/experiments/closeout.ts";
import { adoptDirectiveArchitectureResult } from "../../../architecture/lib/adoption/result-adoption.ts";
import {
  createDirectiveArchitectureImplementationTarget,
} from "../../../architecture/lib/materialization/implementation-target.ts";
import {
  createDirectiveArchitectureImplementationResult,
} from "../../../architecture/lib/materialization/implementation-result.ts";
import { confirmDirectiveArchitectureRetention } from "../../../architecture/lib/materialization/retention.ts";
import { createDirectiveArchitectureIntegrationRecord } from "../../../architecture/lib/materialization/integration-record.ts";
import { recordDirectiveArchitectureConsumption } from "../../../architecture/lib/materialization/consumption-record.ts";
import { evaluateDirectiveArchitectureConsumption } from "../../../architecture/lib/materialization/post-consumption-evaluation.ts";
import { openDirectiveRuntimeFollowUp } from "../../../runtime/lib/operations/follow-up.ts";
import { openDirectiveRuntimeRecordProof } from "../../../runtime/lib/operations/record-proof-opener.ts";
import { openDirectiveRuntimeProofRuntimeCapabilityBoundary } from "../../../runtime/lib/operations/proof-runtime-capability-boundary-opener.ts";
import { openDirectiveRuntimePromotionReadiness } from "../../../runtime/lib/operations/promotion-readiness.ts";
import {
  resolveDirectiveRuntimePromotionSpecificationPath,
} from "../../../runtime/lib/host/promotion-specification.ts";
import {
  buildRuntimePromotionAutomationDryRunReport,
  writeDirectiveRuntimeRegistryEntryFromAutomationReport,
} from "../runtime-promotion-automation.ts";
import {
  buildAutonomousArchitectureBoundedCloseoutRequest,
  buildAutonomousArchitectureImplementationResultSummary,
} from "./architecture.ts";
import {
  buildAction,
  buildAutonomousLaneLoopPhaseReports,
  classifyDirectiveAutonomousFocusDisposition,
  resolveFocusOrThrow,
} from "./phase.ts";
import {
  loadAutonomousLaneLoopPolicy,
  routingPassesAutonomyGate,
} from "./policy.ts";
import {
  writeAutonomousRuntimePromotionRecord,
  writeAutonomousRuntimePromotionSpecification,
} from "./runtime.ts";

export type {
  AutonomousLaneLoopAction,
  AutonomousLaneLoopActionKind,
  AutonomousLaneLoopConfidence,
  AutonomousLaneLoopDisposition,
  AutonomousLaneLoopPhaseReport,
  AutonomousLaneLoopPolicy,
  AutonomousLaneLoopResult,
  AutonomousLaneLoopSupervisedResult,
  RunDirectiveAutonomousLaneLoopInput,
} from "./types.ts";
import type {
  AutonomousLaneLoopPolicy,
  AutonomousLaneLoopResult,
  AutonomousLaneLoopSupervisedResult,
  RunDirectiveAutonomousLaneLoopInput,
} from "./types.ts";

async function maybeAdvanceAutonomousLaneLoop(input: {
  directiveRoot: string;
  currentArtifactPath: string;
  currentStage: string;
  policy: AutonomousLaneLoopPolicy;
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

    const closeout = closeArchitectureBoundedStart(
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
      resultSummary: buildAutonomousArchitectureImplementationResultSummary({
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

    const followUp = await openDirectiveRuntimeFollowUp({
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
    const proof = await openDirectiveRuntimeRecordProof({
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
    const boundary = await openDirectiveRuntimeProofRuntimeCapabilityBoundary({
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
    const readiness = await openDirectiveRuntimePromotionReadiness({
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
    const automationReport = buildRuntimePromotionAutomationDryRunReport({
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
): Promise<AutonomousLaneLoopResult> {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const { policyPath, policy } = loadAutonomousLaneLoopPolicy(directiveRoot);

  if (!policy.enabled) {
    throw new Error(`invalid_state: autonomous lane loop is disabled by policy at ${policyPath}`);
  }

  const actions: AutonomousLaneLoopResult["actions"] = [];
  const started = await startDirectiveAutonomousLaneLoop({
    directiveRoot,
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
): Promise<AutonomousLaneLoopSupervisedResult> {
  const result = await runDirectiveAutonomousLaneLoop(input);
  const phaseReports = buildAutonomousLaneLoopPhaseReports({
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
