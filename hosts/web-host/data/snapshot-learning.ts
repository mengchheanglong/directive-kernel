import fs from "node:fs";

import {
  resolveDirectiveGapRadarPath,
  type DirectiveGapRadarReport,
} from "../../../engine/routing/gap-radar.ts";
import type { DirectiveEngineRunsOverview } from "../../../engine/execution/engine-run-artifacts.ts";

export function readDirectiveGapRadarSnapshotSummary(directiveRoot: string) {
  const reportPath = resolveDirectiveGapRadarPath(directiveRoot);
  if (!fs.existsSync(reportPath)) {
    return {
      generatedAt: null,
      suggestionCount: 0,
      suggestions: [],
    };
  }

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as DirectiveGapRadarReport;
    return {
      generatedAt: report.generatedAt ?? null,
      suggestionCount: report.suggestions.length,
      suggestions: report.suggestions.slice(0, 4).map((entry) => ({
        radarId: entry.radarId,
        targetLaneId: entry.targetLaneId,
        confidence: entry.confidence,
        evidenceCount: entry.evidenceCount,
        summary: entry.summary,
        recommendedChange: entry.recommendedChange,
        signalTokens: [...entry.signalTokens],
        relatedOpenGapId: entry.relatedOpenGapId ?? null,
        suggestedPriority: entry.suggestedPriority,
        candidateExamples: [...entry.candidateExamples],
      })),
    };
  } catch {
    return {
      generatedAt: null,
      suggestionCount: 0,
      suggestions: [],
    };
  }
}

export function deriveDirectiveEarnedAutonomySnapshotSummary(
  engineRuns: DirectiveEngineRunsOverview,
) {
  const routeClassMap = new Map<string, {
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
  }>();

  const recentRuns = engineRuns.recentRuns ?? [];
  for (const run of recentRuns) {
    const autonomy = run.record.routingAssessment?.earnedAutonomy;
    if (!autonomy) {
      continue;
    }

    const current = {
      routeClass: autonomy.routeClass,
      overallScore: autonomy.overallScore,
      evidenceCount: autonomy.evidenceCount,
      autoApprovalEligible: autonomy.autoApprovalEligible,
      approvalReductionApplied: autonomy.approvalReductionApplied,
      summary: autonomy.summary,
      runId: run.record.runId,
      candidateId: run.record.candidate.candidateId,
      candidateName: run.record.candidate.candidateName,
      laneId: run.record.selectedLane.laneId,
    };
    const existing = routeClassMap.get(autonomy.routeClass);
    if (!existing) {
      routeClassMap.set(autonomy.routeClass, current);
      continue;
    }

    const currentWins =
      (current.approvalReductionApplied && !existing.approvalReductionApplied)
      || (
        current.approvalReductionApplied === existing.approvalReductionApplied
        && (
          current.overallScore > existing.overallScore
          || (
            current.overallScore === existing.overallScore
            && current.evidenceCount > existing.evidenceCount
          )
        )
      );
    if (currentWins) {
      routeClassMap.set(autonomy.routeClass, current);
    }
  }

  const routeClasses = [...routeClassMap.values()]
    .sort((left, right) => {
      if (left.approvalReductionApplied !== right.approvalReductionApplied) {
        return Number(right.approvalReductionApplied) - Number(left.approvalReductionApplied);
      }
      if (left.autoApprovalEligible !== right.autoApprovalEligible) {
        return Number(right.autoApprovalEligible) - Number(left.autoApprovalEligible);
      }
      if (right.overallScore !== left.overallScore) {
        return right.overallScore - left.overallScore;
      }
      return right.evidenceCount - left.evidenceCount;
    })
    .slice(0, 4);

  return {
    autoApprovedRecentRuns: recentRuns.filter((run) =>
      run.record.routingAssessment?.earnedAutonomy?.approvalReductionApplied === true
    ).length,
    eligibleRouteClassCount: routeClasses.filter((entry) => entry.autoApprovalEligible).length,
    routeClasses,
  };
}
