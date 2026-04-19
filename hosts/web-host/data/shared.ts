import { isDirectiveCurrentStageEligibleForOpening } from "../../../engine/approval-boundary.ts";

export type FrontendCurrentHead = {
  artifact_path: string;
  artifact_kind: string;
  artifact_stage: string;
  artifact_lane: string;
  view_path: string;
};

function buildDirectiveFrontendArtifactViewPath(input: {
  relativePath: string;
  artifactKind: string;
}) {
  const encoded = encodeURIComponent(input.relativePath);
  switch (input.artifactKind) {
    case "discovery_routing_record":
      return `/discovery-routing-records/view?path=${encoded}`;
    case "architecture_handoff":
      return `/handoffs/view?path=${encoded}`;
    case "architecture_bounded_start":
      return `/architecture-starts/view?path=${encoded}`;
    case "architecture_bounded_result":
      return `/architecture-results/view?path=${encoded}`;
    case "architecture_adoption":
      return `/architecture-adoptions/view?path=${encoded}`;
    case "architecture_implementation_target":
      return `/architecture-implementation-targets/view?path=${encoded}`;
    case "architecture_implementation_result":
      return `/architecture-implementation-results/view?path=${encoded}`;
    case "architecture_retained":
      return `/architecture-retained/view?path=${encoded}`;
    case "architecture_integration_record":
      return `/architecture-integration-records/view?path=${encoded}`;
    case "architecture_consumption_record":
      return `/architecture-consumption-records/view?path=${encoded}`;
    case "architecture_post_consumption_evaluation":
      return `/architecture-post-consumption-evaluations/view?path=${encoded}`;
    case "runtime_follow_up":
      return `/handoffs/view?path=${encoded}`;
    case "runtime_record_follow_up_review":
    case "runtime_record_callable_integration":
      return `/runtime-records/view?path=${encoded}`;
    case "runtime_proof_follow_up_review":
    case "runtime_proof_callable_integration":
      return `/runtime-proofs/view?path=${encoded}`;
    case "runtime_runtime_capability_boundary":
      return `/runtime-runtime-capability-boundaries/view?path=${encoded}`;
    case "runtime_promotion_readiness":
      return `/runtime-promotion-readiness/view?path=${encoded}`;
    default:
      return `/artifacts?path=${encoded}`;
  }
}

function readRuntimeApprovalAllowedFromCurrentHead(input: {
  directiveRoot: string;
  relativePath: string;
  allowedCurrentStages: string[];
}) {
  return isDirectiveCurrentStageEligibleForOpening({
    directiveRoot: input.directiveRoot,
    artifactPath: input.relativePath,
    allowedCurrentStages: input.allowedCurrentStages,
  });
}

function buildDirectiveFrontendCurrentHead(input: {
  artifactPath: string;
  artifactKind: string;
  artifactStage: string;
  lane: string;
}): FrontendCurrentHead {
  return {
    artifact_path: input.artifactPath,
    artifact_kind: input.artifactKind,
    artifact_stage: input.artifactStage,
    artifact_lane: input.lane,
    view_path: buildDirectiveFrontendArtifactViewPath({
      relativePath: input.artifactPath,
      artifactKind: input.artifactKind,
    }),
  };
}

export {
  buildDirectiveFrontendArtifactViewPath,
  buildDirectiveFrontendCurrentHead,
  readRuntimeApprovalAllowedFromCurrentHead,
};
