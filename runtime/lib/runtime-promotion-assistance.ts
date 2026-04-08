import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import { resolveDirectiveWorkspaceState } from "../../engine/state/index.ts";
import { aggregateRunEvidence } from "../../engine/execution/run-evidence-aggregation.ts";
import { buildRuntimeCallableExecutionEvidenceReport } from "./runtime-callable-execution-evidence.ts";
import {
  evaluatePreHostRuntimePromotionRecordPrerequisites,
  type PreHostRuntimePromotionRecordPrerequisites,
} from "./runtime-promotion-record-writer.ts";
import { resolveDirectiveRuntimePromotionSpecificationPath } from "./runtime-promotion-specification.ts";

export type DirectiveRuntimePromotionAssistanceState =
  | "already_promoted_manual_cycle"
  | "ready_for_manual_promotion_seam_decision"
  | "ready_but_external_host_candidate"
  | "blocked_pending_host_selection"
  | "blocked_missing_callable_boundary"
  | "blocked_other";

export type DirectiveRuntimePromotionAssistanceActionKind =
  | "none"
  | "request_manual_promotion_seam_decision"
  | "keep_parked_external_host_candidate"
  | "clarify_repo_native_host_target"
  | "clarify_callable_boundary"
  | "repair_missing_prerequisites";

export type DirectiveRuntimePromotionAssistanceHostScope =
  | "directive_workspace_host"
  | "external_host"
  | "pending_host_selection";

export type DirectiveRuntimePromotionAssistanceRecommendation = {
  candidateId: string;
  candidateName: string;
  currentStage: string | null;
  currentHeadPath: string | null;
  sourcePromotionReadinessPath: string;
  promotionSpecificationPath: string;
  proposedHost: string | null;
  hostScope: DirectiveRuntimePromotionAssistanceHostScope;
  assistanceState: DirectiveRuntimePromotionAssistanceState;
  recommendedActionKind: DirectiveRuntimePromotionAssistanceActionKind;
  recommendedActionSummary: string;
  approvalRequired: boolean;
  readOnly: true;
  mutatesWorkflowState: false;
  bypassesApproval: false;
  supportingArtifacts: {
    compileContractArtifact: string;
    promotionSpecificationArtifact: string;
    existingPromotionRecordPaths: string[];
    parkDecisionArtifact: string | null;
  };
  missingPrerequisites: string[];
  callableExecutionEvidence: {
    matchedCapabilityId: string | null;
    executionCount: number;
    successCount: number;
    nonSuccessCount: number;
    latestExecutionAt: string | null;
    tools: string[];
  };
};

export type DirectiveRuntimePromotionAssistanceReport = {
  ok: boolean;
  checkerId: string;
  snapshotAt: string;
  mode: "recommendation_first_read_only";
  guardrails: {
    mutatesQueueOrStateTruth: false;
    autoAdvancesWorkflow: false;
    bypassesApproval: false;
    impliesHostIntegration: false;
    impliesRuntimeExecution: false;
    impliesPromotionAutomation: false;
  };
  manualRuntimePromotionCycles: {
    totalManualPromotionRecords: number;
    validatedLocallyCount: number;
    latestCandidateId: string | null;
    latestPromotionRecordPath: string | null;
  };
  summary: {
    totalPromotionReadinessCases: number;
    alreadyPromotedManualCycleCount: number;
    readyForManualPromotionSeamDecisionCount: number;
    readyButExternalHostCandidateCount: number;
    blockedPendingHostSelectionCount: number;
    blockedMissingCallableBoundaryCount: number;
    blockedOtherCount: number;
  };
  callableExecutionEvidence: {
    totalExecutionRecords: number;
    capabilityCount: number;
    successCount: number;
    nonSuccessCount: number;
    latestExecutionAt: string | null;
    matchedPromotionReadinessCaseCount: number;
  };
  topRecommendation: DirectiveRuntimePromotionAssistanceRecommendation | null;
  recommendations: DirectiveRuntimePromotionAssistanceRecommendation[];
};

const DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH = "shared/contracts/runtime-to-host.md";

function classifyHostScope(
  proposedHost: string | null,
): DirectiveRuntimePromotionAssistanceHostScope {
  const normalized = String(proposedHost ?? "").trim().toLowerCase();
  if (!normalized || normalized === "pending_host_selection") {
    return "pending_host_selection";
  }
  if (normalized.startsWith("directive workspace")) {
    return "directive_workspace_host";
  }
  return "external_host";
}

function hasExactMissingPrerequisites(
  prerequisites: PreHostRuntimePromotionRecordPrerequisites,
  expected: string[],
) {
  if (prerequisites.missingPrerequisites.length !== expected.length) {
    return false;
  }
  return expected.every((value) => prerequisites.missingPrerequisites.includes(value));
}

function walkMarkdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function readRuntimePromotionParkDecisionPaths(directiveRoot: string) {
  const logsRoot = path.join(directiveRoot, "control", "logs");
  const parkDecisionPaths = new Map<string, string>();

  for (const filePath of walkMarkdownFiles(logsRoot)) {
    const content = fs.readFileSync(filePath, "utf8");
    if (
      !content.includes("Keep the manual promotion seam closed")
      || !content.includes("Do not continue this case again without new repo truth.")
      || !content.includes("Owning lane: `Runtime`")
    ) {
      continue;
    }

    const candidateId = content.match(/^Candidate id:\s*`([^`]+)`/m)?.[1]?.trim();
    if (!candidateId) {
      continue;
    }

    parkDecisionPaths.set(
      candidateId,
      normalizeDirectiveRelativePath(path.relative(directiveRoot, filePath)),
    );
  }

  return parkDecisionPaths;
}

function determineRecommendation(input: {
  prerequisites: PreHostRuntimePromotionRecordPrerequisites;
  currentStage: string | null;
  currentHeadPath: string | null;
  promotionSpecificationPath: string;
  parkDecisionArtifactPath: string | null;
  callableExecutionEvidence: {
    matchedCapabilityId: string | null;
    executionCount: number;
    successCount: number;
    nonSuccessCount: number;
    latestExecutionAt: string | null;
    tools: string[];
  };
}): DirectiveRuntimePromotionAssistanceRecommendation {
  const hostScope = classifyHostScope(input.prerequisites.effectiveProposedHost);
  const promotedAlready =
    input.currentStage === "runtime.promotion_record.opened"
    || input.prerequisites.promotionRecordState.existingPaths.length > 0;

  let assistanceState: DirectiveRuntimePromotionAssistanceState;
  let recommendedActionKind: DirectiveRuntimePromotionAssistanceActionKind;
  let recommendedActionSummary: string;

  if (promotedAlready) {
    assistanceState = "already_promoted_manual_cycle";
    recommendedActionKind = "none";
    recommendedActionSummary =
      "This case already has a bounded manual promotion record. Keep registry acceptance, host integration, runtime execution, and automation closed.";
  } else if (input.parkDecisionArtifactPath) {
    assistanceState = "blocked_other";
    recommendedActionKind = "none";
    recommendedActionSummary =
      `This case is explicitly parked by repo truth at ${input.parkDecisionArtifactPath}. Keep it parked until new repo truth justifies reopening.`;
  } else if (
    input.prerequisites.readyForPreHostPromotionRecordPreparation
    && hostScope === "directive_workspace_host"
  ) {
    assistanceState = "ready_for_manual_promotion_seam_decision";
    recommendedActionKind = "request_manual_promotion_seam_decision";
    recommendedActionSummary =
      "This case is fully prepared for one explicit manual promotion-seam decision. Do not open the promotion record automatically.";
  } else if (
    input.prerequisites.readyForPreHostPromotionRecordPreparation
    && hostScope === "external_host"
  ) {
    assistanceState = "ready_but_external_host_candidate";
    recommendedActionKind = "keep_parked_external_host_candidate";
    recommendedActionSummary =
      "This case is technically pre-host ready, but the proposed host is external. Keep it parked unless a separate bounded decision reopens external host promotion work.";
  } else if (hasExactMissingPrerequisites(input.prerequisites, ["proposedHost"])) {
    assistanceState = "blocked_pending_host_selection";
    recommendedActionKind = "clarify_repo_native_host_target";
    recommendedActionSummary =
      "This case cannot reach a manual promotion decision yet because host selection is still pending. Clarify one bounded repo-native host target first.";
  } else if (input.prerequisites.missingPrerequisites.includes("callableStub")) {
    assistanceState = "blocked_missing_callable_boundary";
    recommendedActionKind = "clarify_callable_boundary";
    recommendedActionSummary =
      "This case still lacks an explicit callable-boundary artifact, so recommendation-first promotion help stops at callable clarification.";
  } else {
    assistanceState = "blocked_other";
    recommendedActionKind = "repair_missing_prerequisites";
    recommendedActionSummary =
      "This case still has unresolved pre-host promotion prerequisites. Keep it parked until the missing bounded truth is repaired explicitly.";
  }

  return {
    candidateId: input.prerequisites.candidateId,
    candidateName: input.prerequisites.candidateName,
    currentStage: input.currentStage,
    currentHeadPath: input.currentHeadPath,
    sourcePromotionReadinessPath: input.prerequisites.sourcePromotionReadinessPath,
    promotionSpecificationPath: input.promotionSpecificationPath,
    proposedHost: input.prerequisites.effectiveProposedHost,
    hostScope,
    assistanceState,
    recommendedActionKind,
    recommendedActionSummary,
    approvalRequired: true,
    readOnly: true,
    mutatesWorkflowState: false,
    bypassesApproval: false,
    supportingArtifacts: {
      compileContractArtifact: DIRECTIVE_RUNTIME_TO_HOST_CONTRACT_PATH,
      promotionSpecificationArtifact: input.promotionSpecificationPath,
      existingPromotionRecordPaths: [...input.prerequisites.promotionRecordState.existingPaths],
      parkDecisionArtifact: input.parkDecisionArtifactPath,
    },
    missingPrerequisites: [...input.prerequisites.missingPrerequisites],
    callableExecutionEvidence: input.callableExecutionEvidence,
  };
}

function recommendationPriority(
  recommendation: DirectiveRuntimePromotionAssistanceRecommendation,
) {
  switch (recommendation.assistanceState) {
    case "ready_for_manual_promotion_seam_decision":
      return 10;
    case "ready_but_external_host_candidate":
      return 20;
    case "blocked_pending_host_selection":
      return 30;
    case "blocked_missing_callable_boundary":
      return 40;
    case "blocked_other":
      return 50;
    case "already_promoted_manual_cycle":
      return 90;
    default: {
      const exhaustiveCheck: never = recommendation.assistanceState;
      throw new Error(`unsupported_assistance_state:${String(exhaustiveCheck)}`);
    }
  }
}

function compareRecommendations(
  left: DirectiveRuntimePromotionAssistanceRecommendation,
  right: DirectiveRuntimePromotionAssistanceRecommendation,
) {
  const priorityDelta = recommendationPriority(left) - recommendationPriority(right);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const missingDelta = left.missingPrerequisites.length - right.missingPrerequisites.length;
  if (missingDelta !== 0) {
    return missingDelta;
  }

  return left.candidateId.localeCompare(right.candidateId);
}

export function buildDirectiveRuntimePromotionAssistanceReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): DirectiveRuntimePromotionAssistanceReport {
  const directiveRoot = normalizeAbsolutePath(
    input?.directiveRoot || getDefaultDirectiveWorkspaceRoot(),
  );
  const promotionReadinessRoot = path.join(directiveRoot, "runtime", "05-promotion-readiness");
  const promotionReadinessFiles = fs.existsSync(promotionReadinessRoot)
    ? fs.readdirSync(promotionReadinessRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith("-promotion-readiness.md"))
      .sort((left, right) => left.name.localeCompare(right.name))
    : [];
  const parkDecisionPaths = readRuntimePromotionParkDecisionPaths(directiveRoot);
  const callableExecutionEvidence = buildRuntimeCallableExecutionEvidenceReport({
    directiveRoot,
  });
  const callableEvidenceByCapabilityId = new Map(
    callableExecutionEvidence.capabilities.map((capability) => [capability.capabilityId, capability] as const),
  );

  const recommendations = promotionReadinessFiles.map((entry) => {
    const promotionReadinessPath =
      `runtime/05-promotion-readiness/${entry.name}`;
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot,
      artifactPath: promotionReadinessPath,
    }).focus;
    const prerequisites = evaluatePreHostRuntimePromotionRecordPrerequisites({
      directiveRoot,
      promotionReadinessPath,
    });
    const promotionSpecificationPath = resolveDirectiveRuntimePromotionSpecificationPath({
      promotionReadinessPath,
    });
    const matchedCallableEvidence = callableEvidenceByCapabilityId.get(prerequisites.candidateId);

    return determineRecommendation({
      prerequisites,
      currentStage: focus?.currentStage ?? null,
      currentHeadPath: focus?.currentHead.artifactPath ?? null,
      promotionSpecificationPath,
      parkDecisionArtifactPath: parkDecisionPaths.get(prerequisites.candidateId) ?? null,
      callableExecutionEvidence: matchedCallableEvidence
        ? {
            matchedCapabilityId: matchedCallableEvidence.capabilityId,
            executionCount: matchedCallableEvidence.executionCount,
            successCount: matchedCallableEvidence.successCount,
            nonSuccessCount: matchedCallableEvidence.nonSuccessCount,
            latestExecutionAt: matchedCallableEvidence.latestExecutionAt,
            tools: [...matchedCallableEvidence.tools],
          }
        : {
            matchedCapabilityId: null,
            executionCount: 0,
            successCount: 0,
            nonSuccessCount: 0,
            latestExecutionAt: null,
            tools: [],
          },
    });
  }).sort(compareRecommendations);

  const evidence = aggregateRunEvidence({ directiveRoot });
  const topRecommendation =
    recommendations.find((entry) => entry.recommendedActionKind !== "none") ?? null;

  return {
    ok: true,
    checkerId: "runtime-promotion-assistance",
    snapshotAt: input?.snapshotAt ?? new Date().toISOString(),
    mode: "recommendation_first_read_only",
    guardrails: {
      mutatesQueueOrStateTruth: false,
      autoAdvancesWorkflow: false,
      bypassesApproval: false,
      impliesHostIntegration: false,
      impliesRuntimeExecution: false,
      impliesPromotionAutomation: false,
    },
    manualRuntimePromotionCycles: {
      totalManualPromotionRecords:
        evidence.manualRuntimePromotionCycles.totalManualPromotionRecords,
      validatedLocallyCount:
        evidence.manualRuntimePromotionCycles.validatedLocallyCount,
      latestCandidateId: evidence.manualRuntimePromotionCycles.latestCandidateId,
      latestPromotionRecordPath:
        evidence.manualRuntimePromotionCycles.latestPromotionRecordPath,
    },
    summary: {
      totalPromotionReadinessCases: recommendations.length,
      alreadyPromotedManualCycleCount: recommendations.filter((entry) =>
        entry.assistanceState === "already_promoted_manual_cycle"
      ).length,
      readyForManualPromotionSeamDecisionCount: recommendations.filter((entry) =>
        entry.assistanceState === "ready_for_manual_promotion_seam_decision"
      ).length,
      readyButExternalHostCandidateCount: recommendations.filter((entry) =>
        entry.assistanceState === "ready_but_external_host_candidate"
      ).length,
      blockedPendingHostSelectionCount: recommendations.filter((entry) =>
        entry.assistanceState === "blocked_pending_host_selection"
      ).length,
      blockedMissingCallableBoundaryCount: recommendations.filter((entry) =>
        entry.assistanceState === "blocked_missing_callable_boundary"
      ).length,
      blockedOtherCount: recommendations.filter((entry) =>
        entry.assistanceState === "blocked_other"
      ).length,
    },
    callableExecutionEvidence: {
      totalExecutionRecords: callableExecutionEvidence.totalExecutionRecords,
      capabilityCount: callableExecutionEvidence.capabilityCount,
      successCount: callableExecutionEvidence.successCount,
      nonSuccessCount: callableExecutionEvidence.nonSuccessCount,
      latestExecutionAt: callableExecutionEvidence.latestExecutionAt,
      matchedPromotionReadinessCaseCount: recommendations.filter((entry) =>
        Boolean(entry.callableExecutionEvidence.matchedCapabilityId)
      ).length,
    },
    topRecommendation,
    recommendations,
  };
}
