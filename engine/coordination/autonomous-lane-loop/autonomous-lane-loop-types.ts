import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/discovery-submission-router.ts";

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
