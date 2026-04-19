import type { FrontendArchitectureSummaryCase } from "./architecture.ts";
import type { FrontendEngineRunsOverview } from "./engine.ts";
import type { FrontendQueueOverview } from "./discovery.ts";
import type { FrontendHandoffStub, FrontendLaneAnchor } from "./shared.ts";
import type { FrontendRuntimeSummaryCase } from "./runtime.ts";

export type FrontendSnapshot = {
  engineRuns: FrontendEngineRunsOverview;
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
    activeCases: FrontendRuntimeSummaryCase[];
    recentAnchors: FrontendLaneAnchor[];
  };
  architectureSummary: {
    activeCases: FrontendArchitectureSummaryCase[];
    recentAnchors: FrontendLaneAnchor[];
  };
  handoffStubs: FrontendHandoffStub[];
  handoffWarnings: string[];
};
