import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../../shared/lib/file-io.ts";
import {
  readDiscoveryRoutingReviewResolution,
} from "../../../discovery/lib/routing/review-resolution.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
} from "../../../discovery/lib/routing/route-opener.ts";
import type {
  AutonomousLaneLoopConfidence,
  AutonomousLaneLoopPolicy,
} from "./types.ts";

const DEFAULT_POLICY: AutonomousLaneLoopPolicy = {
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

export function loadAutonomousLaneLoopPolicy(directiveRoot: string) {
  const policyPath = path.join(directiveRoot, "control", "state", "autonomous-lane-loop-policy.json");
  if (!fs.existsSync(policyPath)) {
    return {
      policyPath: policyPath.replace(/\\/g, "/"),
      policy: DEFAULT_POLICY,
    };
  }

  const loaded = readJson<Partial<AutonomousLaneLoopPolicy>>(policyPath);
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
    } satisfies AutonomousLaneLoopPolicy,
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

export function routingPassesAutonomyGate(input: {
  directiveRoot: string;
  routingPath: string;
  minimumConfidence: AutonomousLaneLoopConfidence;
  requireNoHumanReview: boolean;
}) {
  const routing = readDirectiveDiscoveryRoutingArtifact({
    directiveRoot: input.directiveRoot,
    routingPath: input.routingPath,
  });

  const reviewResolution = readDiscoveryRoutingReviewResolution({
    directiveRoot: input.directiveRoot,
    routingRecordPath: input.routingPath,
  });

  const effectiveConfidence = reviewResolution?.resolvedConfidence ?? routing.routingConfidence;
  const effectiveNeedsHumanReview = reviewResolution?.resolvedNeedsHumanReview ?? routing.needsHumanReview;
  const effectiveRouteConflict = reviewResolution?.resolvedRouteConflict ?? routing.routeConflict;

  if (confidenceRank(effectiveConfidence) < confidenceRank(input.minimumConfidence)) {
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

export function isDirectiveWorkspaceHost(proposedHost: string | null | undefined) {
  const normalized = String(proposedHost ?? "").trim().toLowerCase();
  return normalized.startsWith("directive workspace")
    || normalized.startsWith("directive kernel standalone host")
    || normalized.startsWith("directive kernel web host");
}
