import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath, normalizeRelativePath } from "../../../shared/lib/path-normalization.ts";

import {
  type ArchitectureBoundedCloseoutAssist,
  type ArchitectureResultEvidenceSlot,
  type ArchitectureBoundedResultArtifact,
  type ArchitectureBoundedStartArtifact,
} from "../../../architecture/lib/experiments/closeout.ts";
import {
  type ArchitectureImplementationResultDetail,
} from "../../../architecture/lib/materialization/implementation-result.ts";
import {
  type ArchitectureRetentionDetail,
} from "../../../architecture/lib/materialization/retention.ts";
import {
  type ArchitectureIntegrationRecordDetail,
} from "../../../architecture/lib/materialization/integration-record.ts";
import {
  type ArchitectureConsumptionRecordDetail,
} from "../../../architecture/lib/materialization/consumption-record.ts";
import {
  type ArchitecturePostConsumptionEvaluationDetail,
} from "../../../architecture/lib/materialization/post-consumption-evaluation.ts";
import {
  readArchitectureHandoffArtifact,
  type ArchitectureHandoffArtifact,
} from "../../../architecture/lib/experiments/handoff-start.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
  type DiscoveryRoutingArtifact,
} from "../../../discovery/lib/routing/route-opener.ts";
import {
  readRuntimeFollowUpArtifact,
  type RuntimeFollowUpArtifact,
} from "../../../runtime/lib/operations/follow-up.ts";
import {
  type RuntimeRecordArtifact,
} from "../../../runtime/lib/operations/record-proof-opener.ts";
import {
  type RuntimeProofArtifact,
} from "../../../runtime/lib/operations/proof-runtime-capability-boundary-opener.ts";
import {
  type RuntimeRuntimeCapabilityBoundaryArtifact,
} from "../../../runtime/lib/operations/promotion-readiness.ts";
import {
  readEngineRunDetail,
  readEngineRunsOverview,
  type EngineRunDetail,
  type EngineRunsOverview,
} from "../../../engine/orchestration/run-artifacts.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
} from "../../../architecture/lib/control/materialization-tail-stage-map.ts";
import {
  resolveDirectiveWorkspaceArtifactAbsolutePath,
} from "../../../engine/state/artifact-storage.ts";
import { isDirectiveAbsolutePathWithinRoot } from "../../../shared/lib/relative-path.ts";
import {
  readDirectiveFrontendQueueEntry,
  readFrontendQueueOverview,
} from "./queue.ts";
import type {
  FrontendQueueEntry,
  FrontendQueueOverview,
} from "./queue.ts";
import {
  readRuntimeApprovalAllowedFromCurrentHead,
  type FrontendCurrentHead,
} from "./shared.ts";
import {
  deriveDirectiveEarnedAutonomySnapshotSummary,
  readDirectiveGapRadarSnapshotSummary,
} from "./snapshot-learning.ts";
import {
  deriveLegacyRuntimeFollowUpCandidateId,
  deriveLegacyRuntimeFollowUpCandidateName,
  deriveLegacyRuntimeHandoffCandidateName,
  extractMarkdownSectionSummary,
  isLegacyRuntimeFollowUpRelativePath,
  readArchitectureHandoffStubs,
  readLegacyRuntimeHandoffStubs,
  readRuntimeFollowUpStubs,
  type FrontendHandoffStub,
} from "./snapshot-handoffs.ts";
import {
  readDirectiveFrontendRuntimePromotionReadinessDetail as readDirectiveFrontendRuntimePromotionReadinessDetailImpl,
  readDirectiveFrontendRuntimeProofDetail as readDirectiveFrontendRuntimeProofDetailImpl,
  readDirectiveFrontendRuntimeRecordDetail as readDirectiveFrontendRuntimeRecordDetailImpl,
  readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail as readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetailImpl,
} from "./snapshot-runtime-details.ts";
import {
  readDirectiveFrontendArchitectureConsumptionRecordDetail as readDirectiveFrontendArchitectureConsumptionRecordDetailImpl,
  readDirectiveFrontendArchitectureImplementationResultDetail as readDirectiveFrontendArchitectureImplementationResultDetailImpl,
  readDirectiveFrontendArchitectureImplementationTargetDetail as readDirectiveFrontendArchitectureImplementationTargetDetailImpl,
  readDirectiveFrontendArchitectureIntegrationRecordDetail as readDirectiveFrontendArchitectureIntegrationRecordDetailImpl,
  readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail as readDirectiveFrontendArchitecturePostConsumptionEvaluationDetailImpl,
  readDirectiveFrontendArchitectureRetentionDetail as readDirectiveFrontendArchitectureRetentionDetailImpl,
} from "./snapshot-architecture-details.ts";
import {
  readDirectiveFrontendArchitectureAdoptionDetail as readDirectiveFrontendArchitectureAdoptionDetailImpl,
  readDirectiveFrontendArchitectureResultDetail as readDirectiveFrontendArchitectureResultDetailImpl,
  readDirectiveFrontendArchitectureStartDetail as readDirectiveFrontendArchitectureStartDetailImpl,
} from "./snapshot-architecture-core-details.ts";

export type { FrontendQueueEntry, FrontendQueueOverview } from "./queue.ts";
export type { FrontendCurrentHead } from "./shared.ts";
export type { FrontendHandoffStub } from "./snapshot-handoffs.ts";
export { readDirectiveFrontendQueueEntry, readFrontendQueueOverview };

export type FrontendSnapshot = {
  engineRuns: EngineRunsOverview;
  queue: FrontendQueueOverview;
  learningSummary: {
    gapRadar: {
      generatedAt: string | null;
      suggestionCount: number;
      suggestions: Array<{
        radarId: string;
        targetLaneId: string;
        confidence: string;
        evidenceCount: number;
        summary: string;
        recommendedChange: string;
        signalTokens: string[];
        relatedOpenGapId: string | null;
        suggestedPriority: string;
        candidateExamples: string[];
      }>;
    };
    earnedAutonomy: {
      autoApprovedRecentRuns: number;
      eligibleRouteClassCount: number;
      routeClasses: Array<{
        routeClass: string;
        overallScore: number;
        evidenceCount: number;
        autoApprovalEligible: boolean;
        approvalReductionApplied: boolean;
        summary: string;
        runId: string;
        candidateId: string;
        candidateName: string;
        laneId: string;
      }>;
    };
  };
  runtimeSummary: {
    activeCases: Array<{
      candidate_id: string;
      candidate_name: string;
      current_case_stage: string | null;
      current_case_next_legal_step: string | null;
      current_head: FrontendCurrentHead | null;
      runtime_summary: {
        proposed_host: string | null;
        promotion_readiness_blockers: string[];
      } | null;
    }>;
    recentAnchors: Array<{
      label: string;
      artifactPath: string;
      currentStage: string;
      nextLegalStep: string;
      candidateId: string | null;
      candidateName: string | null;
    }>;
  };
  architectureSummary: {
    activeCases: Array<{
      candidate_id: string;
      candidate_name: string;
      current_case_stage: string | null;
      current_case_next_legal_step: string | null;
      current_head: FrontendCurrentHead | null;
    }>;
    recentAnchors: Array<{
      label: string;
      artifactPath: string;
      currentStage: string;
      nextLegalStep: string;
      candidateId: string | null;
      candidateName: string | null;
    }>;
  };
  architectureHandoffs: ArchitectureHandoffArtifact[];
  handoffStubs: FrontendHandoffStub[];
  handoffWarnings: string[];
};

export type FrontendHandoffDetail =
  | {
      ok: true;
      kind: "architecture_handoff";
      relativePath: string;
      content: string;
      artifact: ArchitectureHandoffArtifact;
    }
  | {
      ok: true;
      kind: "runtime_follow_up";
      relativePath: string;
      content: string;
      title: string;
      candidateId: string;
      candidateName: string;
      status: string;
      runtimeValueToOperationalize: string;
      proposedHost: string;
      proposedIntegrationMode: string;
      reviewCadence: string;
      linkedRoutingPath: string | null;
      runtimeRecordRelativePath: string;
      runtimeRecordExists: boolean;
      approvalAllowed: boolean;
      artifact: RuntimeFollowUpArtifact;
    }
  | {
      ok: true;
      kind: "runtime_follow_up_legacy";
      relativePath: string;
      content: string;
      title: string;
      candidateId: string;
      candidateName: string;
      currentDecisionState: string | null;
      runtimeValueToOperationalize: string;
      proposedHost: string;
      proposedIntegrationMode: string | null;
      reentryContractPath: string | null;
      currentStatus: string | null;
      reviewCadence: string | null;
      requiredProof: string[];
      requiredGates: string[];
      rollbackNote: string | null;
    }
  | {
      ok: true;
      kind: "runtime_handoff_legacy";
      relativePath: string;
      content: string;
      title: string;
      candidateId: string;
      candidateName: string;
      handoffType: string | null;
      runtimeValueToOperationalize: string;
      proposedHost: string;
      proposedRuntimeSurface: string;
      originatingArchitectureRecordPath: string | null;
      mixedValuePartitionRef: string | null;
      runtimeFollowUpPath: string | null;
      runtimeRecordPath: string | null;
      runtimeProofPath: string | null;
      promotionRecordPath: string | null;
      registryEntryPath: string | null;
      qualityGateResult: string | null;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendDiscoveryRoutingDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      sourceType: string;
      decisionState: string;
      adoptionTarget: string;
      routeDestination: string;
      whyThisRoute: string;
      whyNotAlternatives: string;
      requiredNextArtifact: string;
      linkedIntakeRecord: string;
      linkedTriageRecord: string | null;
      reviewCadence: string | null;
      engineRunId: string | null;
      engineRunRecordPath: string | null;
      engineRunReportPath: string | null;
      usefulnessLevel: string | null;
      usefulnessRationale: string | null;
      missionPriorityScore: number | null;
      matchedGapId: string | null;
      gapPressure: {
        openGapCount: number;
        gapAlignmentScore: number | null;
        matchedGapId: string | null;
        matchedGapRank: number | null;
        matchedGapPriority: string | null;
        matchedGapDescription: string | null;
        relatedMissionObjective: string | null;
        currentState: string | null;
        desiredState: string | null;
      } | null;
      routingConfidence: string | null;
      routeConflict: boolean | null;
      needsHumanReview: boolean | null;
      digest: {
        headline: string;
        explanation: string;
        primaryConcern: {
          kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
          summary: string;
          suggestedAction: string;
        } | null;
        secondaryConcerns: Array<{
          kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
          summary: string;
        }>;
        threadContext: string | null;
        trustLevel: string;
      } | null;
      missionSpecificityWarning: string | null;
      missionHealth: DiscoveryRoutingArtifact["missionHealth"] | null;
      explanationBreakdown: {
        keywordSignals: string[];
        metadataSignals: string[];
        gapAlignmentSignals: string[];
        ambiguitySignals: string[];
      } | null;
      ambiguitySummary: {
        topLaneId: string;
        runnerUpLaneId: string | null;
        scoreDelta: number;
        conflictingSignalFamilies: string[];
        conflictingLaneIds: string[];
      } | null;
      reviewGuidance: {
        guidanceKind: string;
        summary: string;
        operatorAction: string;
        requiredChecks: string[];
        stopLine: string;
      } | null;
      goalCopilot: {
        overallScore: number;
        objectiveSpecificityScore: number;
        usefulnessSignalQualityScore: number;
        constraintQualityScore: number;
        laneClarityScore: number;
        warnings: string[];
        rationale: string[];
        suggestedObjective: string | null;
        suggestedConstraints: string[];
        suggestedUsefulnessSignals: string[];
        suggestedCapabilityLanes: string[];
      } | null;
      confidenceRecovery: {
        summary: string;
        confidenceLift: string;
        requestedInputs: Array<{
          field: string;
          question: string;
          whyItMatters: string;
          exampleAnswer: string | null;
        }>;
      } | null;
      followUpQuestions: DiscoveryRoutingArtifact["followUpQuestions"] | null;
      gapRadar: {
        summary: string;
        suggestions: Array<{
          radarId: string;
          targetLaneId: string;
          confidence: string;
          evidenceCount: number;
          summary: string;
          recommendedChange: string;
          signalTokens: string[];
          relatedOpenGapId: string | null;
          suggestedPriority: string;
        }>;
      } | null;
      earnedAutonomy: {
        routeClass: string;
        overallScore: number;
        evidenceCount: number;
        operatorAgreementRate: number | null;
        reviewClearRate: number | null;
        reversalCount: number;
        autoApprovalEligible: boolean;
        approvalReductionApplied: boolean;
        summary: string;
        rationale: string[];
      } | null;
      sourceMemory: DiscoveryRoutingArtifact["sourceMemory"] | null;
      sourceSimilarity: DiscoveryRoutingArtifact["sourceSimilarity"] | null;
      narrativeContext: DiscoveryRoutingArtifact["narrativeContext"] | null;
      laneProportions: DiscoveryRoutingArtifact["laneProportions"] | null;
      secondaryLanes: DiscoveryRoutingArtifact["secondaryLanes"] | null;
      downstreamStubRelativePath: string | null;
      approvalAllowed: boolean;
      content: string;
      artifact: DiscoveryRoutingArtifact;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureStartDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      objective: string;
      startApproval: string;
      resultSummary: string;
      handoffStubPath: string;
      resultRelativePath: string | null;
      decisionRelativePath: string | null;
      closeoutAssist: ArchitectureBoundedCloseoutAssist;
      resultEvidence: ArchitectureResultEvidenceSlot;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendRuntimeRecordDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      runtimeObjective: string;
      proposedHost: string;
      proposedRuntimeSurface: string;
      requiredProofSummary: string;
      currentStatus: string;
      linkedFollowUpRecord: string;
      linkedRoutingPath: string | null;
      runtimeProofRelativePath: string;
      proofExists: boolean;
      approvalAllowed: boolean;
      content: string;
      artifact: RuntimeRecordArtifact;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendRuntimeProofDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      runtimeObjective: string;
      proposedHost: string;
      proposedRuntimeSurface: string;
      currentStatus: string;
      linkedRuntimeRecordPath: string;
      linkedFollowUpPath: string;
      linkedRoutingPath: string | null;
      runtimeCapabilityBoundaryRelativePath: string;
      runtimeCapabilityBoundaryExists: boolean;
      approvalAllowed: boolean;
      content: string;
      artifact: RuntimeProofArtifact;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendRuntimeRuntimeCapabilityBoundaryDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      runtimeObjective: string;
      proposedHost: string;
      proposedRuntimeSurface: string;
      currentProofStatus: string;
      linkedRuntimeProofPath: string;
      linkedRuntimeRecordPath: string;
      linkedFollowUpPath: string;
      linkedRoutingPath: string | null;
      promotionReadinessRelativePath: string;
      promotionReadinessExists: boolean;
      approvalAllowed: boolean;
      content: string;
      artifact: RuntimeRuntimeCapabilityBoundaryArtifact;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendRuntimePromotionReadinessDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      runtimeObjective: string;
      proposedHost: string;
      proposedRuntimeSurface: string;
      executionState: string;
      currentStatus: string;
      promotionReadinessDecision: string;
      hostFacingPromotionDecision: string;
      frontendCapabilityDecision: string;
      openedRuntimeImplementationSlicePath: string | null;
      prePromotionImplementationSlicePath: string | null;
      promotionInputPackagePath: string | null;
      profileCheckerDecisionPath: string | null;
      compileContractPath: string | null;
      promotionGoNoGoDecisionPath: string | null;
      linkedCapabilityBoundaryPath: string;
      linkedRuntimeProofPath: string;
      linkedRuntimeRecordPath: string;
      linkedFollowUpPath: string;
      linkedRoutingPath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      promotionReadinessBlockers: string[];
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureResultDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      objective: string;
      closeoutApproval: string;
      resultSummary: string;
      nextDecision: string;
      verdict: string;
      rationale: string;
      startRelativePath: string | null;
      handoffStubPath: string;
      decisionRelativePath: string;
      continuationStartRelativePath: string | null;
      adoptionRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      resultEvidence: ArchitectureResultEvidenceSlot;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureAdoptionDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      finalStatus: string;
      sourceResultRelativePath: string;
      decisionRelativePath: string;
      implementationTargetRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureImplementationTargetDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      title: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      artifactType: string;
      finalStatus: string;
      objective: string;
      expectedOutcome: string;
      selectedBoundedSlice: string[];
      mechanicalSuccessCriteria: string[];
      explicitLimitations: string[];
      sourceAdoptionVerdict: string;
      sourceReadinessPassed: boolean;
      sourceFailedReadinessChecks: string[];
      sourceRuntimeHandoffRequired: boolean;
      sourceRuntimeHandoffRationale: string;
      sourceArtifactPath: string;
      sourcePrimaryEvidencePath: string;
      sourceSelfImprovementCategory: string;
      sourceSelfImprovementVerificationMethod: string;
      sourceSelfImprovementVerificationResult: string;
      adoptionRelativePath: string;
      decisionRelativePath: string;
      sourceResultRelativePath: string;
      implementationResultRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureImplementationResultDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      objective: string;
      selectedBoundedSlice: string[];
      mechanicalSuccessCriteria: string[];
      explicitLimitations: string[];
      sourceAdoptionVerdict: string;
      sourceReadinessPassed: boolean;
      sourceFailedReadinessChecks: string[];
      sourceRuntimeHandoffRequired: boolean;
      sourceRuntimeHandoffRationale: string;
      sourceArtifactPath: string;
      sourcePrimaryEvidencePath: string;
      sourceSelfImprovementCategory: string;
      sourceSelfImprovementVerificationMethod: string;
      sourceSelfImprovementVerificationResult: string;
      outcome: "success" | "failure";
      resultSummary: string;
      validationResult: string;
      rollbackNote: string;
      targetRelativePath: string;
      adoptionRelativePath: string;
      sourceResultRelativePath: string;
      retainedRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureRetentionDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      objective: string;
      stabilityLevel: string;
      reuseScope: string;
      confirmationDecision: string;
      rollbackBoundary: string;
      resultRelativePath: string;
      targetRelativePath: string;
      adoptionRelativePath: string;
      sourceResultRelativePath: string;
      integrationRecordRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureIntegrationRecordDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      objective: string;
      integrationTargetSurface: string;
      readinessSummary: string;
      expectedEffect: string;
      validationBoundary: string;
      integrationDecision: string;
      rollbackBoundary: string;
      retainedRelativePath: string;
      resultRelativePath: string;
      targetRelativePath: string;
      adoptionRelativePath: string;
      sourceResultRelativePath: string;
      consumptionRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitectureConsumptionRecordDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      objective: string;
      appliedSurface: string;
      applicationSummary: string;
      observedEffect: string;
      validationResult: string;
      outcome: "success" | "failure";
      rollbackNote: string;
      integrationRelativePath: string;
      retainedRelativePath: string;
      resultRelativePath: string;
      targetRelativePath: string;
      adoptionRelativePath: string;
      sourceResultRelativePath: string;
      evaluationRelativePath: string | null;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

export type FrontendArchitecturePostConsumptionEvaluationDetail =
  | {
      ok: true;
      relativePath: string;
      absolutePath: string;
      candidateId: string;
      candidateName: string;
      usefulnessLevel: string;
      objective: string;
      decision: "keep" | "reopen";
      rationale: string;
      observedStability: string;
      retainedUsefulnessAssessment: string;
      nextBoundedAction: string;
      rollbackNote: string;
      reopenedStartRelativePath: string | null;
      consumptionRelativePath: string;
      integrationRelativePath: string;
      retainedRelativePath: string;
      resultRelativePath: string;
      targetRelativePath: string;
      adoptionRelativePath: string;
      sourceResultRelativePath: string;
      artifactStage: string;
      artifactNextLegalStep: string;
      currentStage: string;
      nextLegalStep: string;
      currentHead: FrontendCurrentHead;
      content: string;
    }
  | {
      ok: false;
      error: string;
      relativePath: string;
    };

function extractMarkdownTitle(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^# /, "")
    .trim()
    || "";
}

function extractBulletValue(markdown: string, label: string) {
  const prefix = `- ${label}:`;
  const lines = markdown.split(/\r?\n/);
  const line = lines.find((entry) => entry.trim().startsWith(prefix));
  if (!line) {
    return "";
  }

  const inlineValue = line
    .trim()
    .replace(prefix, "")
    .trim()
    .replace(/^`|`$/g, "");
  if (inlineValue) {
    return inlineValue;
  }

  const index = lines.indexOf(line);
  for (let offset = index + 1; offset < lines.length; offset += 1) {
    const candidate = lines[offset];
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    if (/^- /.test(trimmed) && !/^\s+- /.test(candidate)) {
      break;
    }
    if (/^- /.test(trimmed) || /^\s+- /.test(candidate)) {
      return trimmed.replace(/^- /, "").trim().replace(/^`|`$/g, "");
    }
    break;
  }

  return "";
}

function optionalDisplayValue(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/`/g, "");
  const lower = normalized.toLowerCase();
  if (lower === "n/a" || lower === "pending") {
    return null;
  }
  return normalized;
}

function extractLabeledValue(markdown: string, labels: string[]) {
  const lines = markdown.split(/\r?\n/);
  for (const label of labels) {
    const bulletValue = extractBulletValue(markdown, label);
    if (bulletValue) {
      return bulletValue;
    }

    const prefix = `${label}:`;
    const line = lines.find((entry) => entry.trim().startsWith(prefix));
    if (line) {
      return line.trim().replace(prefix, "").trim();
    }
  }
  return "";
}

function extractBulletList(markdown: string, label: string) {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((entry) => entry.trim() === `- ${label}:`);
  if (startIndex === -1) {
    return [] as string[];
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("  - ")) {
      break;
    }

    const normalized = line.replace(/^  - /u, "").trim().replace(/^`|`$/gu, "");
    if (normalized) {
      values.push(normalized);
    }
  }
  return values;
}

function normalizeDirectiveWorkspaceArtifactReference(input: {
  directiveRoot: string;
  value: string | null | undefined;
}) {
  const rawValue = optionalDisplayValue(input.value);
  if (!rawValue) {
    return null;
  }

  const directiveRoot = normalizeAbsolutePath(input.directiveRoot);
  const normalizedValue = normalizeRelativePath(rawValue);
  const absolutePath = path.isAbsolute(normalizedValue)
    ? normalizeAbsolutePath(normalizedValue)
    : normalizeAbsolutePath(path.join(directiveRoot, normalizedValue));
  const workspaceRootSegment = `/${path.basename(directiveRoot)}/`;

  if (isDirectiveAbsolutePathWithinRoot(directiveRoot, absolutePath)) {
    return normalizeRelativePath(path.relative(directiveRoot, absolutePath));
  }

  const workspaceRootIndex = absolutePath.indexOf(workspaceRootSegment);
  if (workspaceRootIndex >= 0) {
    return normalizeRelativePath(
      absolutePath.slice(workspaceRootIndex + workspaceRootSegment.length),
    );
  }

  return normalizedValue;
}

function normalizeLegacyRuntimeReentryContractReference(input: {
  directiveRoot: string;
  value: string | null | undefined;
}) {
  const rawValue = optionalDisplayValue(input.value);
  if (!rawValue || /^(n\/a|pending)\b/i.test(rawValue)) {
    return null;
  }
  return normalizeDirectiveWorkspaceArtifactReference({
    directiveRoot: input.directiveRoot,
    value: rawValue,
  });
}

export function readDirectiveFrontendSnapshot(input: {
  directiveRoot: string;
  maxRuns?: number;
  maxQueueEntries?: number;
  maxHandoffs?: number;
}): FrontendSnapshot {
  const architecture = readArchitectureHandoffStubs({
    directiveRoot: input.directiveRoot,
    maxEntries: input.maxHandoffs ?? 20,
  });
  const handoffStubs: FrontendHandoffStub[] = [
    ...architecture.stubs,
    ...readRuntimeFollowUpStubs({
      directiveRoot: input.directiveRoot,
      maxEntries: input.maxHandoffs ?? 20,
      readHandoffDetail: readDirectiveFrontendHandoffDetail,
    }),
    ...readLegacyRuntimeHandoffStubs({
      directiveRoot: input.directiveRoot,
      maxEntries: input.maxHandoffs ?? 20,
      readHandoffDetail: readDirectiveFrontendHandoffDetail,
    }),
  ].sort((left, right) => right.relativePath.localeCompare(left.relativePath));
  const queue = readFrontendQueueOverview({
    directiveRoot: input.directiveRoot,
    maxEntries: input.maxQueueEntries ?? 12,
  });
  const runtimeAnchors = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    includeAnchors: true,
  }).anchors
    .filter((anchor) => anchor.lane === "runtime")
    .sort((left, right) => right.artifactPath.localeCompare(left.artifactPath))
    .filter((anchor, index, all) =>
      all.findIndex((candidate) => candidate.candidateId === anchor.candidateId) === index
    )
    .slice(0, 4);
  const architectureAnchors = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    includeAnchors: true,
  }).anchors
    .filter((anchor) => anchor.lane === "architecture")
    .sort((left, right) => right.artifactPath.localeCompare(left.artifactPath))
    .filter((anchor, index, all) =>
      all.findIndex((candidate) => candidate.candidateId === anchor.candidateId) === index
    )
    .slice(0, 4);
  const activeRuntimeCases = queue.entries
    .filter((entry) => entry.current_head?.artifact_lane === "runtime" || entry.routing_target === "runtime")
    .sort((left, right) => {
      const rank = (stage: string | null | undefined) => {
        if (!stage) return 0;
        if (stage.startsWith("runtime.promotion_record.")) return 6;
        if (stage.startsWith("runtime.promotion_readiness.")) return 5;
        if (stage.startsWith("runtime.runtime_capability_boundary.")) return 4;
        if (stage.startsWith("runtime.proof.")) return 3;
        if (stage.startsWith("runtime.record.")) return 2;
        if (stage.startsWith("runtime.follow_up.")) return 1;
        return 0;
      };
      return rank(right.current_case_stage) - rank(left.current_case_stage);
    })
    .slice(0, 4)
    .map((entry) => ({
      candidate_id: entry.candidate_id,
      candidate_name: entry.candidate_name,
      current_case_stage: entry.current_case_stage,
      current_case_next_legal_step: entry.current_case_next_legal_step,
      current_head: entry.current_head,
      runtime_summary: entry.runtime_summary,
    }));
  const activeArchitectureCases = queue.entries
    .filter((entry) => entry.current_head?.artifact_lane === "architecture" || entry.routing_target === "architecture")
    .slice(0, 4)
    .map((entry) => ({
      candidate_id: entry.candidate_id,
      candidate_name: entry.candidate_name,
      current_case_stage: entry.current_case_stage,
      current_case_next_legal_step: entry.current_case_next_legal_step,
      current_head: entry.current_head,
    }));
  const engineRuns = readEngineRunsOverview({
    directiveRoot: input.directiveRoot,
    maxRuns: input.maxRuns ?? 8,
  });

  return {
    engineRuns,
    queue,
    learningSummary: {
      gapRadar: readDirectiveGapRadarSnapshotSummary(input.directiveRoot),
      earnedAutonomy: deriveDirectiveEarnedAutonomySnapshotSummary(engineRuns),
    },
    runtimeSummary: {
      activeCases: activeRuntimeCases,
      recentAnchors: runtimeAnchors.map((anchor) => ({
        label: anchor.label,
        artifactPath: anchor.artifactPath,
        currentStage: anchor.currentStage,
        nextLegalStep: anchor.nextLegalStep,
        candidateId: anchor.candidateId,
        candidateName: anchor.candidateName,
      })),
    },
    architectureSummary: {
      activeCases: activeArchitectureCases,
      recentAnchors: architectureAnchors.map((anchor) => ({
        label: anchor.label,
        artifactPath: anchor.artifactPath,
        currentStage: anchor.currentStage,
        nextLegalStep: anchor.nextLegalStep,
        candidateId: anchor.candidateId,
        candidateName: anchor.candidateName,
      })),
    },
    architectureHandoffs: architecture.artifacts,
    handoffStubs,
    handoffWarnings: architecture.warnings,
  };
}

export function readDirectiveFrontendRunDetail(input: {
  directiveRoot: string;
  runId: string;
}): EngineRunDetail {
  return readEngineRunDetail({
    directiveRoot: input.directiveRoot,
    runId: input.runId,
  });
}

export function readDirectiveFrontendArtifactText(input: {
  directiveRoot: string;
  relativePath: string;
}) {
  const directiveRoot = normalizeAbsolutePath(input.directiveRoot);
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    throw new Error("invalid_input: relativePath is required");
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error("invalid_input: relativePath must be relative to directive-workspace");
  }

  const absolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath,
    mode: "read",
  });
  if (!isDirectiveAbsolutePathWithinRoot(directiveRoot, absolutePath)) {
    throw new Error("invalid_input: relativePath must stay within directive-workspace");
  }
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`invalid_input: artifact not found: ${relativePath}`);
  }

  return {
    relativePath,
    absolutePath,
    content: fs.readFileSync(absolutePath, "utf8"),
  };
}

export function readDirectiveFrontendDiscoveryRoutingDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendDiscoveryRoutingDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  if (
    !relativePath.startsWith("discovery/03-routing-log/")
    || !relativePath.endsWith("-routing-record.md")
  ) {
    return {
      ok: false,
      error: "invalid_discovery_routing_record_path",
      relativePath,
    };
  }

  try {
    const artifactText = readDirectiveFrontendArtifactText({
      directiveRoot: input.directiveRoot,
      relativePath,
    });
    const artifact = readDirectiveDiscoveryRoutingArtifact({
      directiveRoot: input.directiveRoot,
      routingPath: relativePath,
    });

    return {
      ok: true,
      relativePath,
      absolutePath: artifact.routingAbsolutePath,
      title: artifact.title,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      sourceType: artifact.sourceType,
      decisionState: artifact.decisionState,
      adoptionTarget: artifact.adoptionTarget,
      routeDestination: artifact.routeDestination,
      whyThisRoute: artifact.whyThisRoute,
      whyNotAlternatives: artifact.whyNotAlternatives,
      requiredNextArtifact: artifact.requiredNextArtifact,
      linkedIntakeRecord: artifact.linkedIntakeRecord,
      linkedTriageRecord: artifact.linkedTriageRecord,
      reviewCadence: artifact.reviewCadence,
      engineRunId: artifact.engineRunId,
      engineRunRecordPath: artifact.engineRunRecordPath,
      engineRunReportPath: artifact.engineRunReportPath,
      usefulnessLevel: artifact.usefulnessLevel,
      usefulnessRationale: artifact.usefulnessRationale,
      missionPriorityScore: artifact.missionPriorityScore,
      matchedGapId: artifact.matchedGapId,
      gapPressure: artifact.gapPressure,
      routingConfidence: artifact.routingConfidence,
      routeConflict: artifact.routeConflict,
      needsHumanReview: artifact.needsHumanReview,
      digest: artifact.digest,
      missionSpecificityWarning: artifact.missionSpecificityWarning,
      missionHealth: artifact.missionHealth,
      explanationBreakdown: artifact.explanationBreakdown,
      ambiguitySummary: artifact.ambiguitySummary,
      reviewGuidance: artifact.reviewGuidance,
      goalCopilot: artifact.goalCopilot,
      confidenceRecovery: artifact.confidenceRecovery,
      followUpQuestions: artifact.followUpQuestions,
      gapRadar: artifact.gapRadar,
      earnedAutonomy: artifact.earnedAutonomy,
      sourceMemory: artifact.sourceMemory,
      sourceSimilarity: artifact.sourceSimilarity,
      narrativeContext: artifact.narrativeContext,
      laneProportions: artifact.laneProportions,
      secondaryLanes: artifact.secondaryLanes,
      downstreamStubRelativePath: artifact.downstreamStubRelativePath,
      approvalAllowed: artifact.approvalAllowed,
      content: artifactText.content,
      artifact,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendHandoffDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendHandoffDetail {
  const relativePath = normalizeRelativePath(String(input.relativePath || "").trim());
  if (!relativePath) {
    return {
      ok: false,
      error: "missing_relative_path",
      relativePath,
    };
  }

  try {
    const artifactText = readDirectiveFrontendArtifactText({
      directiveRoot: input.directiveRoot,
      relativePath,
    });

    if (
      relativePath.startsWith("architecture/01-experiments/")
      && relativePath.endsWith("-engine-handoff.md")
    ) {
      return {
        ok: true,
        kind: "architecture_handoff",
        relativePath,
        content: artifactText.content,
        artifact: readArchitectureHandoffArtifact({
          directiveRoot: input.directiveRoot,
          handoffPath: relativePath,
        }),
      };
    }

    if (
      relativePath.startsWith("runtime/legacy-handoff/")
      && relativePath.endsWith("-architecture-to-runtime-handoff.md")
    ) {
      const title = extractMarkdownTitle(artifactText.content);
      return {
        ok: true,
        kind: "runtime_handoff_legacy",
        relativePath,
        content: artifactText.content,
        title,
        candidateId: extractBulletValue(artifactText.content, "Candidate id"),
        candidateName:
          optionalDisplayValue(extractBulletValue(artifactText.content, "Candidate name"))
          ?? deriveLegacyRuntimeHandoffCandidateName(title),
        handoffType: optionalDisplayValue(extractLabeledValue(artifactText.content, ["Handoff type"])),
        runtimeValueToOperationalize: extractLabeledValue(artifactText.content, [
          "Runtime value to operationalize in Runtime",
          "Runtime value to operationalize",
        ]),
        proposedHost: optionalDisplayValue(extractLabeledValue(artifactText.content, ["Proposed host"])) ?? "",
        proposedRuntimeSurface: extractLabeledValue(artifactText.content, ["Proposed runtime surface"]),
        originatingArchitectureRecordPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Originating Architecture record"]),
        }),
        mixedValuePartitionRef: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Mixed-value partition ref"]),
        }),
        runtimeFollowUpPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Runtime follow-up"]),
        }),
        runtimeRecordPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Runtime record"]),
        }),
        runtimeProofPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Proof artifact"]),
        }),
        promotionRecordPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, [
            "Promotion record (if promoted)",
            "Promotion record",
          ]),
        }),
        registryEntryPath: normalizeDirectiveWorkspaceArtifactReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Registry entry"]),
        }),
        qualityGateResult: optionalDisplayValue(extractLabeledValue(artifactText.content, ["Quality gate result"])),
      };
    }

    if (isLegacyRuntimeFollowUpRelativePath(relativePath)) {
      try {
        const artifact = readRuntimeFollowUpArtifact({
          directiveRoot: input.directiveRoot,
          followUpPath: relativePath,
        });
        return {
          ok: true,
          kind: "runtime_follow_up",
          relativePath,
          content: artifactText.content,
          title: artifact.title || path.basename(relativePath),
          candidateId: artifact.candidateId,
          candidateName: artifact.candidateName,
          status: artifact.currentStatus || "unknown",
          runtimeValueToOperationalize: artifact.runtimeValueToOperationalize,
          proposedHost: artifact.proposedHost,
          proposedIntegrationMode: artifact.proposedIntegrationMode,
          reviewCadence: artifact.reviewCadence,
          linkedRoutingPath: artifact.linkedHandoffPath,
          runtimeRecordRelativePath: artifact.runtimeRecordRelativePath,
          runtimeRecordExists: artifact.runtimeRecordExists,
          approvalAllowed:
            artifact.approvalAllowed
            && readRuntimeApprovalAllowedFromCurrentHead({
              directiveRoot: input.directiveRoot,
              relativePath,
              allowedCurrentStages: ["runtime.follow_up."],
            }),
          artifact,
        };
      } catch (runtimeFollowUpError) {
        const candidateId =
          optionalDisplayValue(extractBulletValue(artifactText.content, "Candidate id"))
          ?? deriveLegacyRuntimeFollowUpCandidateId(path.basename(relativePath));
        const candidateName =
          optionalDisplayValue(extractBulletValue(artifactText.content, "Candidate name"))
          ?? deriveLegacyRuntimeFollowUpCandidateName(
            extractMarkdownTitle(artifactText.content) || path.basename(relativePath),
          )
          ?? candidateId;
        const runtimeValueToOperationalize =
          extractLabeledValue(artifactText.content, ["Runtime value to operationalize"])
          || extractMarkdownSectionSummary(artifactText.content, "Runtime Value To Evaluate");
        const currentDecisionState = optionalDisplayValue(extractLabeledValue(artifactText.content, [
          "Current decision state",
        ]));
        const currentStatus = optionalDisplayValue(extractLabeledValue(artifactText.content, [
          "Current status",
          "Status",
        ]));
        const reentryContractPath = normalizeLegacyRuntimeReentryContractReference({
          directiveRoot: input.directiveRoot,
          value: extractLabeledValue(artifactText.content, ["Re-entry contract path (if deferred)"]),
        });
        const legacyDeferred =
          /defer/i.test(currentDecisionState ?? "") || /deferred/i.test(currentStatus ?? "");

        if (!runtimeValueToOperationalize || !currentStatus || (legacyDeferred && !reentryContractPath)) {
          throw runtimeFollowUpError;
        }

        return {
          ok: true,
          kind: "runtime_follow_up_legacy",
          relativePath,
          content: artifactText.content,
          title: extractMarkdownTitle(artifactText.content) || path.basename(relativePath),
          candidateId,
          candidateName,
          currentDecisionState,
          runtimeValueToOperationalize,
          proposedHost:
            optionalDisplayValue(extractLabeledValue(artifactText.content, ["Proposed host"]))
            ?? "",
          proposedIntegrationMode: optionalDisplayValue(extractLabeledValue(artifactText.content, [
            "Proposed integration mode",
          ])),
          reentryContractPath,
          currentStatus,
          reviewCadence: optionalDisplayValue(extractLabeledValue(artifactText.content, [
            "Review cadence",
          ])),
          requiredProof: extractBulletList(artifactText.content, "Required proof"),
          requiredGates: extractBulletList(artifactText.content, "Required gates"),
          rollbackNote: optionalDisplayValue(extractLabeledValue(artifactText.content, ["Rollback"])),
        };
      }
    }

    return {
      ok: false,
      error: "unsupported_handoff_kind",
      relativePath,
    };
  } catch (error) {
    return {
      ok: false,
      error: String((error as Error).message || error),
      relativePath,
    };
  }
}

export function readDirectiveFrontendArchitectureStartDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureStartDetail {
  return readDirectiveFrontendArchitectureStartDetailImpl(input, {
    readDirectiveFrontendArtifactText,
    extractMarkdownTitle,
    extractBulletValue,
  });
}

export function readDirectiveFrontendRuntimeRecordDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimeRecordDetail {
  return readDirectiveFrontendRuntimeRecordDetailImpl(input);
}

export function readDirectiveFrontendRuntimeProofDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimeProofDetail {
  return readDirectiveFrontendRuntimeProofDetailImpl(input);
}

export function readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimeRuntimeCapabilityBoundaryDetail {
  return readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetailImpl(input);
}

export function readDirectiveFrontendRuntimePromotionReadinessDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendRuntimePromotionReadinessDetail {
  return readDirectiveFrontendRuntimePromotionReadinessDetailImpl(input, {
    readDirectiveFrontendArtifactText,
    extractMarkdownTitle,
    extractBulletValue,
  });
}

export function readDirectiveFrontendArchitectureResultDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureResultDetail {
  return readDirectiveFrontendArchitectureResultDetailImpl(input, {
    readDirectiveFrontendArtifactText,
    extractMarkdownTitle,
    extractBulletValue,
  });
}

export function readDirectiveFrontendArchitectureAdoptionDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureAdoptionDetail {
  return readDirectiveFrontendArchitectureAdoptionDetailImpl(input);
}

export function readDirectiveFrontendArchitectureImplementationTargetDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureImplementationTargetDetail {
  return readDirectiveFrontendArchitectureImplementationTargetDetailImpl(input);
}

export function readDirectiveFrontendArchitectureImplementationResultDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureImplementationResultDetail {
  return readDirectiveFrontendArchitectureImplementationResultDetailImpl(input);
}

export function readDirectiveFrontendArchitectureRetentionDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureRetentionDetail {
  return readDirectiveFrontendArchitectureRetentionDetailImpl(input);
}

export function readDirectiveFrontendArchitectureIntegrationRecordDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureIntegrationRecordDetail {
  return readDirectiveFrontendArchitectureIntegrationRecordDetailImpl(input);
}

export function readDirectiveFrontendArchitectureConsumptionRecordDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitectureConsumptionRecordDetail {
  return readDirectiveFrontendArchitectureConsumptionRecordDetailImpl(input);
}

export function readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail(input: {
  directiveRoot: string;
  relativePath: string;
}): FrontendArchitecturePostConsumptionEvaluationDetail {
  return readDirectiveFrontendArchitecturePostConsumptionEvaluationDetailImpl(input);
}

export type WorkbenchQueueEntry = FrontendQueueEntry;
export type WorkbenchQueueOverview = FrontendQueueOverview;
export type WorkbenchHandoffStub = FrontendHandoffStub;
export type WorkbenchSnapshot = FrontendSnapshot;
export type WorkbenchDiscoveryRoutingDetail =
  FrontendDiscoveryRoutingDetail;
export type WorkbenchHandoffDetail = FrontendHandoffDetail;
export type WorkbenchRuntimeRecordDetail = FrontendRuntimeRecordDetail;
export type WorkbenchRuntimeProofDetail = FrontendRuntimeProofDetail;
export type WorkbenchRuntimeRuntimeCapabilityBoundaryDetail =
  FrontendRuntimeRuntimeCapabilityBoundaryDetail;
export type WorkbenchRuntimePromotionReadinessDetail =
  FrontendRuntimePromotionReadinessDetail;
export type WorkbenchArchitectureStartDetail = FrontendArchitectureStartDetail;
export type WorkbenchArchitectureResultDetail = FrontendArchitectureResultDetail;
export type WorkbenchArchitectureAdoptionDetail = FrontendArchitectureAdoptionDetail;
export type WorkbenchArchitectureImplementationTargetDetail =
  FrontendArchitectureImplementationTargetDetail;
export type WorkbenchArchitectureImplementationResultDetail =
  FrontendArchitectureImplementationResultDetail;
export type WorkbenchArchitectureRetentionDetail =
  FrontendArchitectureRetentionDetail;
export type WorkbenchArchitectureIntegrationRecordDetail =
  FrontendArchitectureIntegrationRecordDetail;
export type WorkbenchArchitectureConsumptionRecordDetail =
  FrontendArchitectureConsumptionRecordDetail;
export type WorkbenchArchitecturePostConsumptionEvaluationDetail =
  FrontendArchitecturePostConsumptionEvaluationDetail;

export const readWorkbenchQueueOverview = readFrontendQueueOverview;
export const readDirectiveWorkbenchSnapshot = readDirectiveFrontendSnapshot;
export const readDirectiveWorkbenchRunDetail = readDirectiveFrontendRunDetail;
export const readDirectiveWorkbenchArtifactText = readDirectiveFrontendArtifactText;
export const readDirectiveWorkbenchQueueEntry = readDirectiveFrontendQueueEntry;
export const readDirectiveWorkbenchDiscoveryRoutingDetail =
  readDirectiveFrontendDiscoveryRoutingDetail;
export const readDirectiveWorkbenchHandoffDetail = readDirectiveFrontendHandoffDetail;
export const readDirectiveWorkbenchRuntimeRecordDetail = readDirectiveFrontendRuntimeRecordDetail;
export const readDirectiveWorkbenchRuntimeProofDetail = readDirectiveFrontendRuntimeProofDetail;
export const readDirectiveWorkbenchRuntimeRuntimeCapabilityBoundaryDetail =
  readDirectiveFrontendRuntimeRuntimeCapabilityBoundaryDetail;
export const readDirectiveWorkbenchRuntimePromotionReadinessDetail =
  readDirectiveFrontendRuntimePromotionReadinessDetail;
export const readDirectiveWorkbenchArchitectureStartDetail =
  readDirectiveFrontendArchitectureStartDetail;
export const readDirectiveWorkbenchArchitectureResultDetail =
  readDirectiveFrontendArchitectureResultDetail;
export const readDirectiveWorkbenchArchitectureAdoptionDetail =
  readDirectiveFrontendArchitectureAdoptionDetail;
export const readDirectiveWorkbenchArchitectureImplementationTargetDetail =
  readDirectiveFrontendArchitectureImplementationTargetDetail;
export const readDirectiveWorkbenchArchitectureImplementationResultDetail =
  readDirectiveFrontendArchitectureImplementationResultDetail;
export const readDirectiveWorkbenchArchitectureRetentionDetail =
  readDirectiveFrontendArchitectureRetentionDetail;
export const readDirectiveWorkbenchArchitectureIntegrationRecordDetail =
  readDirectiveFrontendArchitectureIntegrationRecordDetail;
export const readDirectiveWorkbenchArchitectureConsumptionRecordDetail =
  readDirectiveFrontendArchitectureConsumptionRecordDetail;
export const readDirectiveWorkbenchArchitecturePostConsumptionEvaluationDetail =
  readDirectiveFrontendArchitecturePostConsumptionEvaluationDetail;


