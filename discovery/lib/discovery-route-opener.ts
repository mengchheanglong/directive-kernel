import fs from "node:fs";
import path from "node:path";

import { readUtf8 } from "../../shared/lib/file-io.ts";

import {
  normalizeDirectiveApprovalActor,
  normalizeDirectiveWorkspaceRoot,
  requireDirectiveExplicitApproval,
  requireDirectiveString,
  resolveDirectiveWorkspaceRelativePath,
  writeDirectiveArtifactIfMissing,
} from "../../engine/approval-boundary.ts";
import { writeJson as writeJsonPretty } from "../../shared/lib/file-io.ts";
import {
  normalizeDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";
import {
  renderRuntimeFollowUpRecord,
  type RuntimeFollowUpRecordRequest,
} from "../../runtime/lib/runtime-follow-up-record-writer.ts";
import { readDiscoveryRoutingReviewResolution } from "./discovery-routing-review-resolution.ts";
import {
  deriveEffectiveDiscoveryRouteBoundary,
  type DiscoveryRouteDestination,
} from "./discovery-routing-effective-boundary.ts";
import { type DiscoveryIntakeQueueDocument } from "./discovery-intake-queue-writer.ts";
import { syncDiscoveryIntakeLifecycle } from "./discovery-intake-lifecycle-sync.ts";
import {
  extractRuntimeOpenerMarkdownTitle as extractMarkdownTitle,
  extractRuntimeOpenerOptionalBulletValue as extractOptionalBulletValue,
  extractRuntimeOpenerRequiredBulletValue as extractBulletValue,
} from "../../runtime/lib/runtime-opener-shared.ts";
import {
  describeDirectiveEngineGapPressure,
  type DirectiveEngineGapPressureDetail,
} from "../../engine/execution/engine-run-artifacts.ts";

type DirectiveEngineRunRecordLike = {
  runId: string;
  receivedAt: string;
  source: {
    sourceRef: string;
  };
  candidate: {
    candidateId: string;
    candidateName: string;
    usefulnessLevel: string;
    missionPriorityScore?: number;
    matchedGapId?: string | null;
  };
  analysis: {
    usefulnessRationale: string;
  };
  openGaps?: Array<{
    gapId: string;
    description: string;
    priority: string;
    relatedMissionObjective?: string;
    currentState?: string;
    desiredState?: string;
  }>;
  routingAssessment?: {
    confidence?: string;
    matchedGapId?: string | null;
    matchedGapRank?: number | null;
    routeConflict?: boolean;
    needsHumanReview?: boolean;
    digest?: {
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
    };
    missionSpecificityWarning?: string | null;
    missionHealth?: {
      overallScore: number;
      healthGrade: "A" | "B" | "C" | "D" | "F";
      objectiveSpecificityScore: number;
      usefulnessSignalQualityScore: number;
      constraintQualityScore: number;
      lanePriorityClarityScore: number;
      overmatchRiskScore: number;
      stalenessRiskScore: number;
      warnings: string[];
      tensionSignals: string[];
      rationale: string[];
      suggestedObjectiveRewrite: string | null;
      suggestedConstraintAdditions: string[];
    } | null;
    ambiguitySummary?: {
      topLaneId: string;
      runnerUpLaneId: string | null;
      scoreDelta: number;
      conflictingSignalFamilies: string[];
      conflictingLaneIds: string[];
    } | null;
    goalCopilot?: {
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
    confidenceRecovery?: {
      summary: string;
      confidenceLift: string;
      requestedInputs: Array<{
        field: string;
        question: string;
        whyItMatters: string;
        exampleAnswer: string | null;
      }>;
    } | null;
    followUpQuestions?: {
      summary: string;
      questions: Array<{
        field: string;
        question: string;
        whyItMatters: string;
        exampleAnswer: string | null;
        predictedEffect: string;
      }>;
    } | null;
    gapRadar?: {
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
    earnedAutonomy?: {
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
    sourceMemory?: {
      summary: string;
      biasAdjustments: Record<string, number>;
      matchingTopics: Array<{
        token: string;
        recentCount: number;
        totalCount: number;
        dominantLaneId: string;
      }>;
      matchingRouteClass: {
        routeClass: string;
        laneId: string;
        sourceType: string;
        recentCount: number;
        totalCount: number;
        lastSeenAt: string;
      } | null;
      rationale: string[];
    } | null;
    sourceSimilarity?: {
      summary: string;
      relatedSources: Array<{
        runId: string;
        candidateId: string;
        candidateName: string;
        laneId: string;
        decisionState: string;
        receivedAt: string;
        similarityScore: number;
        sharedTokens: string[];
        summary: string;
      }>;
    } | null;
    narrativeContext?: {
      summary: string;
      primaryThread: {
        threadId: string;
        name: string;
        state: "nascent" | "developing" | "mature" | "stalled" | "completed";
        summary: string;
        sourceCount: number;
        firstSeenAt: string;
        lastSeenAt: string;
        activeSpanDays: number;
        currentSourceOverlap: number;
        topTokens: string[];
        laneTendency: {
          dominantLaneId: string;
          dominancePercent: number;
          laneCounts: Record<string, number>;
          biasAdjustment: number;
        };
        gapCoverage: {
          dominantGapId: string | null;
          matchedGapIds: string[];
          status: "none" | "emerging" | "partially_addressed" | "closed";
        };
        followThrough: {
          completedProofCount: number;
          stalledProofCount: number;
          followThroughRate: number;
        };
        demandSignals: Array<{
          kind: string;
          priority: string;
          summary: string;
          requestedLaneId: string | null;
        }>;
        relatedRunIds: string[];
      } | null;
      relatedThreads: Array<{
        threadId: string;
        name: string;
        state: "nascent" | "developing" | "mature" | "stalled" | "completed";
        summary: string;
        sourceCount: number;
        firstSeenAt: string;
        lastSeenAt: string;
        activeSpanDays: number;
        currentSourceOverlap: number;
        topTokens: string[];
        laneTendency: {
          dominantLaneId: string;
          dominancePercent: number;
          laneCounts: Record<string, number>;
          biasAdjustment: number;
        };
        gapCoverage: {
          dominantGapId: string | null;
          matchedGapIds: string[];
          status: "none" | "emerging" | "partially_addressed" | "closed";
        };
        followThrough: {
          completedProofCount: number;
          stalledProofCount: number;
          followThroughRate: number;
        };
        demandSignals: Array<{
          kind: string;
          priority: string;
          summary: string;
          requestedLaneId: string | null;
        }>;
        relatedRunIds: string[];
      }>;
      biasAdjustments: Record<string, number>;
      demandSignals: Array<{
        kind: string;
        priority: string;
        summary: string;
        requestedLaneId: string | null;
      }>;
      rationale: string[];
    } | null;
    laneProportions?: Record<string, number>;
    secondaryLanes?: Array<{
      laneId: string;
      proportion: number;
      reason: string;
    }>;
    scoreBreakdown?: {
      gapAlignment?: number;
    };
  };
  extractionPlan: {
    extractedValue: string[];
    excludedBaggage: string[];
  };
  proofPlan: {
    objective: string;
    requiredEvidence: string[];
    requiredGates: string[];
    rollbackPrompt: string;
  };
  decision: {
    decisionState: string;
  };
  integrationProposal: {
    integrationMode: string;
    nextAction: string;
    valuableWithoutHostRuntime: boolean;
    hostDependence?: string | null;
  };
};

export type DirectiveDiscoveryRoutingArtifact = {
  title: string;
  date: string;
  candidateId: string;
  candidateName: string;
  routingDate: string;
  sourceType: string;
  decisionState: string;
  adoptionTarget: string;
  routeDestination: DiscoveryRouteDestination;
  effectiveRouteDestination: DiscoveryRouteDestination;
  whyThisRoute: string;
  whyNotAlternatives: string;
  handoffContractUsed: string | null;
  receivingTrackOwner: string;
  requiredNextArtifact: string;
  reentryOrPromotionConditions: string | null;
  reviewCadence: string | null;
  missionPriorityScore: number | null;
  linkedIntakeRecord: string;
  linkedTriageRecord: string | null;
  routingRelativePath: string;
  routingAbsolutePath: string;
  effectiveRequiredNextArtifact: string;
  downstreamStubRelativePath: string | null;
  downstreamStubExists: boolean;
  approvalAllowed: boolean;
  engineRunRecordPath: string | null;
  engineRunReportPath: string | null;
  engineRunId: string | null;
  usefulnessLevel: string | null;
  usefulnessRationale: string | null;
  matchedGapId: string | null;
  gapPressure: DirectiveEngineGapPressureDetail | null;
  routingConfidence: string | null;
  routeConflict: boolean | null;
  needsHumanReview: boolean | null;
  digest: DirectiveEngineRunRecordLike["routingAssessment"]["digest"] | null;
  missionSpecificityWarning: string | null;
  missionHealth: DirectiveEngineRunRecordLike["routingAssessment"]["missionHealth"] | null;
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
  followUpQuestions: DirectiveEngineRunRecordLike["routingAssessment"]["followUpQuestions"] | null;
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
  sourceMemory: DirectiveEngineRunRecordLike["routingAssessment"]["sourceMemory"] | null;
  sourceSimilarity: DirectiveEngineRunRecordLike["routingAssessment"]["sourceSimilarity"] | null;
  narrativeContext: DirectiveEngineRunRecordLike["routingAssessment"]["narrativeContext"] | null;
  laneProportions: Record<string, number> | null;
  secondaryLanes: Array<{
    laneId: string;
    proportion: number;
    reason: string;
  }> | null;
};

export type DirectiveDiscoveryRouteOpenResult = {
  ok: true;
  created: boolean;
  directiveRoot: string;
  routingRelativePath: string;
  routeDestination: "architecture" | "runtime";
  stubKind: "architecture_handoff" | "runtime_follow_up";
  stubRelativePath: string;
  stubAbsolutePath: string;
  candidateId: string;
  candidateName: string;
  queuePath: string;
};

function optionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "n/a") {
    return null;
  }
  return normalized;
}

function normalizeEngineCandidateId(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function candidateIdsMatch(input: {
  expectedCandidateId: string;
  observedCandidateId: string;
}) {
  if (input.expectedCandidateId === input.observedCandidateId) {
    return true;
  }
  const expectedNormalized = normalizeEngineCandidateId(input.expectedCandidateId);
  const observedNormalized = normalizeEngineCandidateId(input.observedCandidateId);
  return Boolean(expectedNormalized) && expectedNormalized === observedNormalized;
}



function readOptionalBullet(markdown: string, label: string) {
  return optionalString(extractOptionalBulletValue(markdown, label));
}

function parseYesNoBoolean(value: string | null) {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

function extractSection(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingMatch = new RegExp(`^## ${escaped}\\r?\\n`, "m").exec(markdown);
  if (!headingMatch || typeof headingMatch.index !== "number") {
    return null;
  }
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const remainingMarkdown = markdown.slice(sectionStart);
  const nextHeadingMatch = /^## .*(?:\r?\n|$)/m.exec(remainingMarkdown);
  const sectionBody = nextHeadingMatch && typeof nextHeadingMatch.index === "number"
    ? remainingMarkdown.slice(0, nextHeadingMatch.index)
    : remainingMarkdown;
  return optionalString(sectionBody.trim());
}

function extractSectionLines(markdown: string, heading: string, prefix: string) {
  const section = extractSection(markdown, heading);
  if (!section) {
    return [];
  }
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim())
    .filter(Boolean);
}

function readSectionBullet(markdown: string, heading: string, label: string) {
  const section = extractSection(markdown, heading);
  if (!section) {
    return null;
  }
  const prefix = `- ${label}:`;
  const line = section
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));
  if (!line) {
    return null;
  }
  return optionalString(line.slice(prefix.length).trim());
}

function parseDiscoveryRoutingMarkdown(markdown: string) {
  const dateLine = markdown
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("Date: "));
  const title = extractMarkdownTitle(markdown, "routing record title")
    .replace(/^Discovery Routing Record:\s*/, "")
    .trim();

  return {
    title,
    date: requireDirectiveString(dateLine?.replace(/^Date:\s*/, ""), "routing record date"),
    candidateId: extractBulletValue(markdown, "Candidate id", 'invalid_input: missing "Candidate id" in Discovery routing record'),
    candidateName: extractBulletValue(markdown, "Candidate name", 'invalid_input: missing "Candidate name" in Discovery routing record'),
    routingDate: extractBulletValue(markdown, "Routing date", 'invalid_input: missing "Routing date" in Discovery routing record'),
    sourceType: extractBulletValue(markdown, "Source type", 'invalid_input: missing "Source type" in Discovery routing record'),
    decisionState: extractBulletValue(markdown, "Decision state", 'invalid_input: missing "Decision state" in Discovery routing record'),
    adoptionTarget: extractBulletValue(markdown, "Adoption target", 'invalid_input: missing "Adoption target" in Discovery routing record'),
    routeDestination: extractBulletValue(markdown, "Route destination", 'invalid_input: missing "Route destination" in Discovery routing record') as DiscoveryRouteDestination,
    usefulnessLevel: optionalString(extractOptionalBulletValue(markdown, "Usefulness level")),
    usefulnessRationale: optionalString(extractOptionalBulletValue(markdown, "Usefulness rationale")),
    whyThisRoute: extractBulletValue(markdown, "Why this route", 'invalid_input: missing "Why this route" in Discovery routing record'),
    whyNotAlternatives: extractBulletValue(markdown, "Why not the alternatives", 'invalid_input: missing "Why not the alternatives" in Discovery routing record'),
    handoffContractUsed: optionalString(extractBulletValue(markdown, "Handoff contract used", 'invalid_input: missing "Handoff contract used" in Discovery routing record')),
    receivingTrackOwner: extractBulletValue(markdown, "Receiving track owner", 'invalid_input: missing "Receiving track owner" in Discovery routing record'),
    requiredNextArtifact: extractBulletValue(markdown, "Required next artifact", 'invalid_input: missing "Required next artifact" in Discovery routing record'),
    reentryOrPromotionConditions: optionalString(
      extractBulletValue(markdown, "Re-entry/Promotion trigger conditions", 'invalid_input: missing "Re-entry/Promotion trigger conditions" in Discovery routing record'),
    ),
    reviewCadence: optionalString(extractBulletValue(markdown, "Review cadence", 'invalid_input: missing "Review cadence" in Discovery routing record')),
    missionPriorityScore: optionalString(extractOptionalBulletValue(markdown, "Mission priority score")) === null
      ? null
      : Number(readOptionalBullet(markdown, "Mission priority score")),
    routingConfidence: readOptionalBullet(markdown, "Routing confidence"),
    matchedGapId: readOptionalBullet(markdown, "Matched gap id"),
    matchedGapRank: optionalString(extractOptionalBulletValue(markdown, "Matched gap rank")) === null
      ? null
      : Number(readOptionalBullet(markdown, "Matched gap rank")),
    routeConflict: parseYesNoBoolean(readOptionalBullet(markdown, "Route conflict")),
    needsHumanReview: parseYesNoBoolean(readOptionalBullet(markdown, "Needs human review")),
    missionSpecificityWarning: readOptionalBullet(markdown, "Mission specificity warning"),
    linkedIntakeRecord: extractBulletValue(markdown, "Linked intake record", 'invalid_input: missing "Linked intake record" in Discovery routing record'),
    linkedTriageRecord: optionalString(extractBulletValue(markdown, "Linked triage record", 'invalid_input: missing "Linked triage record" in Discovery routing record')),
    linkedEngineRunRecord: optionalString(
      extractOptionalBulletValue(
        markdown,
        "Linked Engine run record",
      ),
    ),
    linkedEngineRunReport: optionalString(
      extractOptionalBulletValue(
        markdown,
        "Linked Engine run report",
      ),
    ),
    ambiguitySummary: extractSection(markdown, "Ambiguity Summary")
      ? {
          topTrack: readSectionBullet(markdown, "Ambiguity Summary", "Top track") ?? "discovery",
          runnerUpTrack: readSectionBullet(markdown, "Ambiguity Summary", "Runner-up track"),
          scoreDelta: Number(readSectionBullet(markdown, "Ambiguity Summary", "Score delta") ?? "0"),
          conflictingSignalFamilies: (readSectionBullet(markdown, "Ambiguity Summary", "Conflicting signal families") ?? "none")
            .split(/\s*,\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          conflictingTracks: (readSectionBullet(markdown, "Ambiguity Summary", "Conflicting tracks") ?? "none")
            .split(/\s*,\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
        }
      : null,
    reviewGuidance: extractSection(markdown, "Review Guidance")
      ? {
          guidanceKind: readSectionBullet(markdown, "Review Guidance", "Guidance kind") ?? "bounded_lane_review",
          summary: readSectionBullet(markdown, "Review Guidance", "Summary") ?? "",
          operatorAction: readSectionBullet(markdown, "Review Guidance", "Operator action") ?? "",
          requiredChecks: (readSectionBullet(markdown, "Review Guidance", "Required checks") ?? "none")
            .split(/\s*\|\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          stopLine: readSectionBullet(markdown, "Review Guidance", "Stop-line") ?? "",
        }
      : null,
    goalCopilot: extractSection(markdown, "Goal Copilot")
      ? {
          overallScore: Number(readSectionBullet(markdown, "Goal Copilot", "Overall score")?.replace(/\/100$/, "") ?? "0"),
          objectiveSpecificityScore: Number(
            readSectionBullet(markdown, "Goal Copilot", "Objective specificity score")?.replace(/\/5$/, "") ?? "0",
          ),
          usefulnessSignalQualityScore: Number(
            readSectionBullet(markdown, "Goal Copilot", "Usefulness signal quality score")?.replace(/\/5$/, "") ?? "0",
          ),
          constraintQualityScore: Number(
            readSectionBullet(markdown, "Goal Copilot", "Constraint quality score")?.replace(/\/5$/, "") ?? "0",
          ),
          laneClarityScore: Number(
            readSectionBullet(markdown, "Goal Copilot", "Lane clarity score")?.replace(/\/5$/, "") ?? "0",
          ),
          warnings: (readSectionBullet(markdown, "Goal Copilot", "Warnings") ?? "none")
            .split(/\s*\|\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          rationale: extractSectionLines(markdown, "Goal Copilot", "- Rationale:"),
          suggestedObjective: readSectionBullet(markdown, "Goal Copilot", "Suggested objective"),
          suggestedConstraints: (readSectionBullet(markdown, "Goal Copilot", "Suggested constraints") ?? "none")
            .split(/\s*\|\s*/)
            .map((entry) => entry.trim())
            .filter((entry) => entry && entry !== "none"),
          suggestedUsefulnessSignals:
            (readSectionBullet(markdown, "Goal Copilot", "Suggested usefulness signals") ?? "none")
              .split(/\s*\|\s*/)
              .map((entry) => entry.trim())
              .filter((entry) => entry && entry !== "none"),
          suggestedCapabilityLanes:
            (readSectionBullet(markdown, "Goal Copilot", "Suggested capability lanes") ?? "none")
              .split(/\s*\|\s*/)
              .map((entry) => entry.trim())
              .filter((entry) => entry && entry !== "none"),
        }
      : null,
    confidenceRecovery: extractSection(markdown, "Confidence Recovery Follow-Up")
      ? {
          summary: readSectionBullet(markdown, "Confidence Recovery Follow-Up", "Summary") ?? "",
          confidenceLift: readSectionBullet(markdown, "Confidence Recovery Follow-Up", "Confidence lift") ?? "",
          requestedInputs: extractSectionLines(
            markdown,
            "Confidence Recovery Follow-Up",
            "- Requested input:",
          ).map((entry) => {
            const [fieldPart, questionPart, whyPart, examplePart] = entry.split(/\s+\|\s+/);
            return {
              field: fieldPart.trim(),
              question: questionPart?.replace(/^Question:\s*/, "").trim() ?? "",
              whyItMatters: whyPart?.replace(/^Why it matters:\s*/, "").trim() ?? "",
              exampleAnswer: optionalString(examplePart?.replace(/^Example answer:\s*/, "").trim()),
            };
          }),
        }
      : null,
    gapRadar: extractSection(markdown, "Gap Radar")
      ? {
          summary: readSectionBullet(markdown, "Gap Radar", "Summary") ?? "",
          suggestions: extractSectionLines(markdown, "Gap Radar", "- Suggestion:").map((entry) => {
            const [
              targetLanePart,
              confidencePart,
              evidencePart,
              summaryPart,
              recommendedChangePart,
              signalsPart,
              relatedGapPart,
              suggestedPriorityPart,
            ] = entry.split(/\s+\|\s+/);
            return {
              radarId: [
                targetLanePart?.trim() ?? "gap",
                summaryPart?.trim() ?? "suggestion",
              ]
                .join("-")
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 96),
              targetLaneId: targetLanePart?.trim() ?? "",
              confidence: confidencePart?.replace(/\s+confidence$/i, "").trim() ?? "low",
              evidenceCount: Number(evidencePart?.replace(/\s+events$/i, "").trim() ?? "0"),
              summary: summaryPart?.trim() ?? "",
              recommendedChange:
                recommendedChangePart?.replace(/^Recommended change:\s*/i, "").trim() ?? "",
              signalTokens:
                signalsPart?.replace(/^Signals:\s*/i, "").split(/\s*,\s*/).map((value) => value.trim()).filter(Boolean)
                ?? [],
              relatedOpenGapId:
                optionalString(relatedGapPart?.replace(/^Related open gap:\s*/i, "").trim()),
              suggestedPriority:
                suggestedPriorityPart?.replace(/^Suggested priority:\s*/i, "").trim() ?? "low",
            };
          }),
        }
      : null,
    earnedAutonomy: extractSection(markdown, "Earned Autonomy")
      ? {
          routeClass: readSectionBullet(markdown, "Earned Autonomy", "Route class") ?? "",
          overallScore: Number(readSectionBullet(markdown, "Earned Autonomy", "Overall score")?.replace(/\/100$/, "") ?? "0"),
          evidenceCount: Number(readSectionBullet(markdown, "Earned Autonomy", "Evidence count") ?? "0"),
          operatorAgreementRate: (() => {
            const value = readSectionBullet(markdown, "Earned Autonomy", "Operator agreement rate");
            if (!value || value === "n/a") {
              return null;
            }
            return Number(value.replace(/%$/, "")) / 100;
          })(),
          reviewClearRate: (() => {
            const value = readSectionBullet(markdown, "Earned Autonomy", "Review clear rate");
            if (!value || value === "n/a") {
              return null;
            }
            return Number(value.replace(/%$/, "")) / 100;
          })(),
          reversalCount: Number(readSectionBullet(markdown, "Earned Autonomy", "Reversal count") ?? "0"),
          autoApprovalEligible:
            parseYesNoBoolean(readSectionBullet(markdown, "Earned Autonomy", "Auto-approval eligible")) ?? false,
          approvalReductionApplied:
            parseYesNoBoolean(readSectionBullet(markdown, "Earned Autonomy", "Approval reduction applied")) ?? false,
          summary: readSectionBullet(markdown, "Earned Autonomy", "Summary") ?? "",
          rationale: extractSectionLines(markdown, "Earned Autonomy", "- Rationale:"),
        }
      : null,
    explanationBreakdown: extractSection(markdown, "Routing Explanation Breakdown")
      ? {
          keywordSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Keyword:"),
          metadataSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Metadata:"),
          gapAlignmentSignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Gap:"),
          ambiguitySignals: extractSectionLines(markdown, "Routing Explanation Breakdown", "- Ambiguity:"),
        }
      : null,
  };
}

function isDirectiveEngineRunRecordLike(value: unknown): value is DirectiveEngineRunRecordLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.candidate as Record<string, unknown> | undefined;
  const analysis = record.analysis as Record<string, unknown> | undefined;
  const extractionPlan = record.extractionPlan as Record<string, unknown> | undefined;
  const proofPlan = record.proofPlan as Record<string, unknown> | undefined;
  const integrationProposal = record.integrationProposal as Record<string, unknown> | undefined;
  const source = record.source as Record<string, unknown> | undefined;

  return Boolean(
    typeof record.runId === "string"
      && typeof record.receivedAt === "string"
      && typeof source?.sourceRef === "string"
      && typeof candidate?.candidateId === "string"
      && typeof candidate?.candidateName === "string"
      && typeof candidate?.usefulnessLevel === "string"
      && typeof analysis?.usefulnessRationale === "string"
      && Array.isArray(extractionPlan?.extractedValue)
      && Array.isArray(extractionPlan?.excludedBaggage)
      && typeof proofPlan?.objective === "string"
      && Array.isArray(proofPlan?.requiredEvidence)
      && Array.isArray(proofPlan?.requiredGates)
      && typeof proofPlan?.rollbackPrompt === "string"
      && typeof integrationProposal?.integrationMode === "string"
      && typeof integrationProposal?.nextAction === "string"
      && typeof integrationProposal?.valuableWithoutHostRuntime === "boolean",
  );
}

function findEngineRunForCandidate(input: {
  directiveRoot: string;
  candidateId: string;
}) {
  const engineRunsRoot = path.join(input.directiveRoot, "runtime", "standalone-host", "engine-runs");
  if (!fs.existsSync(engineRunsRoot)) {
    return null;
  }

  const matches = fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .map((recordPath) => {
      try {
        const parsed = JSON.parse(readUtf8(recordPath)) as unknown;
        if (!isDirectiveEngineRunRecordLike(parsed)) {
          return null;
        }
        if (!candidateIdsMatch({
          expectedCandidateId: input.candidateId,
          observedCandidateId: parsed.candidate.candidateId,
        })) {
          return null;
        }
        const reportPath = recordPath.replace(/\.json$/i, ".md");
        return {
          record: parsed,
          recordAbsolutePath: path.resolve(recordPath).replace(/\\/g, "/"),
          recordRelativePath: normalizeDirectiveRelativePath(
            path.relative(input.directiveRoot, recordPath),
          ),
          reportAbsolutePath: fs.existsSync(reportPath)
            ? path.resolve(reportPath).replace(/\\/g, "/")
            : null,
          reportRelativePath: fs.existsSync(reportPath)
            ? normalizeDirectiveRelativePath(path.relative(input.directiveRoot, reportPath))
            : null,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => right.record.receivedAt.localeCompare(left.record.receivedAt));

  return matches[0] ?? null;
}

function readEngineRunByRecordPath(input: {
  directiveRoot: string;
  candidateId: string;
  recordRelativePath: string;
  reportRelativePath: string | null;
}) {
  const recordRelativePath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.recordRelativePath,
    "linked_engine_run_record",
  );
  const recordAbsolutePath = path.join(input.directiveRoot, recordRelativePath);
  if (!fs.existsSync(recordAbsolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readUtf8(recordAbsolutePath)) as unknown;
    if (!isDirectiveEngineRunRecordLike(parsed)) {
      return null;
    }
    if (!candidateIdsMatch({
      expectedCandidateId: input.candidateId,
      observedCandidateId: parsed.candidate.candidateId,
    })) {
      return null;
    }

    const reportFromInput = input.reportRelativePath
      ? resolveDirectiveWorkspaceRelativePath(
        input.directiveRoot,
        input.reportRelativePath,
        "linked_engine_run_report",
      )
      : null;
    const reportFromInputExists = reportFromInput
      ? fs.existsSync(path.join(input.directiveRoot, reportFromInput))
      : false;
    const derivedReportRelativePath = recordRelativePath.replace(/\.json$/i, ".md");
    const resolvedReportRelativePath = reportFromInputExists
      ? reportFromInput
      : (fs.existsSync(path.join(input.directiveRoot, derivedReportRelativePath))
        ? derivedReportRelativePath
        : null);

    return {
      record: parsed,
      recordAbsolutePath: path.resolve(recordAbsolutePath).replace(/\\/g, "/"),
      recordRelativePath: normalizeDirectiveRelativePath(recordRelativePath),
      reportAbsolutePath: resolvedReportRelativePath
        ? path.resolve(path.join(input.directiveRoot, resolvedReportRelativePath)).replace(/\\/g, "/")
        : null,
      reportRelativePath: resolvedReportRelativePath
        ? normalizeDirectiveRelativePath(resolvedReportRelativePath)
        : null,
    };
  } catch {
    return null;
  }
}

function readQueueDocument(directiveRoot: string) {
  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  if (!fs.existsSync(queuePath)) {
    throw new Error(`invalid_input: discovery queue not found: ${path.resolve(queuePath).replace(/\\/g, "/")}`);
  }
  return {
    queuePath: path.resolve(queuePath).replace(/\\/g, "/"),
    queue: JSON.parse(readUtf8(queuePath)) as DiscoveryIntakeQueueDocument,
  };
}

function renderArchitectureHandoffMarkdown(input: {
  routingRelativePath: string;
  routeDate: string;
  engineRecordRelativePath: string;
  engineReportRelativePath: string | null;
  record: DirectiveEngineRunRecordLike;
}) {
  const extractedValue = input.record.extractionPlan.extractedValue.length > 0
    ? input.record.extractionPlan.extractedValue.map((value) => `  - ${value}`).join("\n")
    : "  - n/a";
  const requiredGates = input.record.proofPlan.requiredGates.length > 0
    ? input.record.proofPlan.requiredGates.map((gate) => `  - \`${gate}\``).join("\n")
    : "  - n/a";

  return [
    `# ${input.record.candidate.candidateName} Engine-Routed Architecture Experiment`,
    "",
    `Date: ${input.routeDate}`,
    "Track: Architecture",
    "Type: engine-routed handoff",
    "Status: pending_review",
    "",
    "## Source",
    "",
    `- Candidate id: \`${input.record.candidate.candidateId}\``,
    `- Source reference: \`${input.record.source.sourceRef}\``,
    `- Engine run record: \`${input.engineRecordRelativePath}\``,
    `- Engine run report: \`${input.engineReportRelativePath ?? "n/a"}\``,
    `- Discovery routing record: \`${input.routingRelativePath}\``,
    `- Usefulness level: \`${input.record.candidate.usefulnessLevel}\``,
    `- Usefulness rationale: ${input.record.analysis.usefulnessRationale}`,
    "",
    "## Objective",
    "",
    input.record.integrationProposal.nextAction,
    "",
    "## Bounded scope",
    "",
    "- Keep this at one Architecture experiment slice.",
    "- Preserve human review before any adoption or host integration.",
    "- Do not execute downstream Engine changes from this stub alone.",
    "",
    "## Inputs",
    "",
    extractedValue,
    "",
    "## Validation gate(s)",
    "",
    requiredGates,
    "",
    "## Lifecycle classification",
    "",
    "- Origin: `source-driven`",
    `- Usefulness level: \`${input.record.candidate.usefulnessLevel}\``,
    `- Runtime threshold check: Would this mechanism still be valuable without a runtime surface? \`${input.record.integrationProposal.valuableWithoutHostRuntime ? "yes" : "no"}\``,
    "",
    "## Rollback",
    "",
    input.record.proofPlan.rollbackPrompt,
    "",
    "## Next decision",
    "",
    "- `needs-more-evidence`",
    "",
  ].join("\n");
}

function inferRuntimeHostSelection(record: DirectiveEngineRunRecordLike): {
  proposed_host: string;
  host_selection_mode: "inferred" | "manual_required";
  proposed_host_confidence: "high" | "medium" | "low";
} {
  const hostDependence = record.integrationProposal.hostDependence ?? "";
  const needsHost = hostDependence === "host_adapter_required"
    || record.integrationProposal.valuableWithoutHostRuntime === false;
  const routingConfidence = record.routingAssessment?.confidence ?? "";
  const highRoutingConfidence = routingConfidence === "high";
  const hasIntegrationMode = Boolean(record.integrationProposal.integrationMode);

  if (needsHost && highRoutingConfidence && hasIntegrationMode) {
    return {
      proposed_host: "Directive Kernel standalone host (hosts/standalone-host/)",
      host_selection_mode: "inferred",
      proposed_host_confidence: "medium",
    };
  }

  return {
    proposed_host: "pending_host_selection",
    host_selection_mode: "manual_required",
    proposed_host_confidence: "low",
  };
}

function buildRuntimeFollowUpRequest(input: {
  artifact: DirectiveDiscoveryRoutingArtifact;
  record: DirectiveEngineRunRecordLike;
}): RuntimeFollowUpRecordRequest {
  const hostSelection = inferRuntimeHostSelection(input.record);

  return {
    candidate_id: input.artifact.candidateId,
    candidate_name: input.artifact.candidateName,
    follow_up_date: input.artifact.routingDate,
    current_decision_state: input.record.decision.decisionState || input.artifact.decisionState,
    origin_track: "discovery-routing-approval",
    runtime_value_to_operationalize:
      input.record.integrationProposal.nextAction
      || input.record.extractionPlan.extractedValue[0]
      || "Bounded runtime usefulness conversion remains to be defined.",
    proposed_host: hostSelection.proposed_host,
    host_selection_mode: hostSelection.host_selection_mode,
    proposed_host_confidence: hostSelection.proposed_host_confidence,
    proposed_integration_mode: input.record.integrationProposal.integrationMode,
    source_pack_allowlist_profile: "n/a",
    allowed_export_surfaces: [
      "bounded runtime capability",
      "callable capability boundary",
    ],
    excluded_baggage: input.record.extractionPlan.excludedBaggage,
    promotion_contract_path: null,
    reentry_contract_path: null,
    reentry_preconditions: [
      "Human review confirms the bounded runtime objective.",
      "Proof scope stays narrow and reversible.",
    ],
    required_proof: input.record.proofPlan.requiredEvidence,
    required_gates: input.record.proofPlan.requiredGates,
    trial_scope_limit: [
      "Keep this as a follow-up stub only.",
      "Do not execute runtime integration from this record alone.",
    ],
    risks: [
      "Human review still required.",
      "Host-specific baggage can leak into runtime implementation if adaptation is skipped.",
    ],
    rollback: input.record.proofPlan.rollbackPrompt,
    no_op_path:
      "Leave the candidate routed with a follow-up stub only and do not materialize runtime execution yet.",
    review_cadence:
      input.artifact.reviewCadence
      ?? "Review on the next active Directive Kernel operating pass.",
    current_status: "pending_review",
    linked_handoff_path: input.artifact.routingRelativePath,
    output_relative_path: input.artifact.requiredNextArtifact,
  };
}

function readRoutingArtifact(input: {
  directiveRoot: string;
  routingRelativePath: string;
}): DirectiveDiscoveryRoutingArtifact {
  if (!input.routingRelativePath.startsWith("discovery/03-routing-log/")) {
    throw new Error("invalid_input: routingPath must point to discovery/03-routing-log/");
  }

  const routingAbsolutePath = path.resolve(input.directiveRoot, input.routingRelativePath).replace(/\\/g, "/");
  if (!fs.existsSync(routingAbsolutePath)) {
    throw new Error(`invalid_input: routingPath not found: ${input.routingRelativePath}`);
  }

  const parsed = parseDiscoveryRoutingMarkdown(readUtf8(routingAbsolutePath));
  const reviewResolution = readDiscoveryRoutingReviewResolution({
    directiveRoot: input.directiveRoot,
    routingRecordPath: input.routingRelativePath,
  });
  const effectiveBoundary = deriveEffectiveDiscoveryRouteBoundary({
    candidateId: parsed.candidateId,
    routingDate: parsed.routingDate,
    routeDestination: parsed.routeDestination,
    decisionState: parsed.decisionState,
    requiredNextArtifact: parsed.requiredNextArtifact,
    reviewResolution,
  });
  const engineRun = parsed.linkedEngineRunRecord
    ? readEngineRunByRecordPath({
      directiveRoot: input.directiveRoot,
      candidateId: parsed.candidateId,
      recordRelativePath: parsed.linkedEngineRunRecord,
      reportRelativePath: parsed.linkedEngineRunReport,
    })
    : findEngineRunForCandidate({
      directiveRoot: input.directiveRoot,
      candidateId: parsed.candidateId,
    });
  const { queue } = readQueueDocument(input.directiveRoot);
  const queueEntry = queue.entries.find((entry) => entry.candidate_id === parsed.candidateId) ?? null;
  const approvalAllowed = effectiveBoundary.approvalAllowed;
  const downstreamStubRelativePath = approvalAllowed
    ? optionalString(queueEntry?.result_record_path)
      ?? (fs.existsSync(path.join(input.directiveRoot, effectiveBoundary.effectiveRequiredNextArtifact))
        ? effectiveBoundary.effectiveRequiredNextArtifact
        : null)
    : null;

  return {
    ...parsed,
    effectiveRouteDestination: effectiveBoundary.effectiveRouteDestination,
    routingRelativePath: input.routingRelativePath,
    routingAbsolutePath,
    effectiveRequiredNextArtifact: effectiveBoundary.effectiveRequiredNextArtifact,
    downstreamStubRelativePath,
    downstreamStubExists: Boolean(downstreamStubRelativePath),
    approvalAllowed,
    engineRunRecordPath:
      parsed.linkedEngineRunRecord
      ?? engineRun?.recordRelativePath
      ?? null,
    engineRunReportPath:
      parsed.linkedEngineRunReport
      ?? engineRun?.reportRelativePath
      ?? null,
    engineRunId: engineRun?.record.runId ?? null,
    usefulnessLevel: parsed.usefulnessLevel ?? engineRun?.record.candidate.usefulnessLevel ?? null,
    usefulnessRationale: parsed.usefulnessRationale ?? engineRun?.record.analysis.usefulnessRationale ?? null,
    missionPriorityScore:
      parsed.missionPriorityScore
      ?? engineRun?.record.candidate.missionPriorityScore
      ?? null,
    matchedGapId:
      parsed.matchedGapId
      ?? engineRun?.record.candidate.matchedGapId
      ?? engineRun?.record.routingAssessment?.matchedGapId
      ?? null,
    gapPressure: engineRun?.record
      ? describeDirectiveEngineGapPressure(engineRun.record)
      : null,
    routingConfidence:
      parsed.routingConfidence
      ?? engineRun?.record.routingAssessment?.confidence
      ?? engineRun?.record.candidate.confidence
      ?? null,
    digest:
      engineRun?.record.routingAssessment?.digest ?? null,
    missionSpecificityWarning:
      parsed.missionSpecificityWarning
      ?? engineRun?.record.routingAssessment?.missionSpecificityWarning
      ?? null,
    missionHealth:
      engineRun?.record.routingAssessment?.missionHealth ?? null,
    routeConflict: parsed.routeConflict ?? engineRun?.record.routingAssessment?.routeConflict ?? null,
    needsHumanReview:
      parsed.needsHumanReview
      ?? engineRun?.record.routingAssessment?.needsHumanReview
      ?? engineRun?.record.candidate.requiresHumanReview
      ?? null,
    explanationBreakdown:
      parsed.explanationBreakdown
      ?? (engineRun?.record?.routingAssessment?.explanationBreakdown
        ? {
            keywordSignals: [...engineRun.record.routingAssessment.explanationBreakdown.keywordSignals],
            metadataSignals: [...engineRun.record.routingAssessment.explanationBreakdown.metadataSignals],
            gapAlignmentSignals: [...engineRun.record.routingAssessment.explanationBreakdown.gapAlignmentSignals],
            ambiguitySignals: [...engineRun.record.routingAssessment.explanationBreakdown.ambiguitySignals],
          }
        : null),
    ambiguitySummary:
      parsed.ambiguitySummary
      ? {
          topLaneId: parsed.ambiguitySummary.topTrack,
          runnerUpLaneId: parsed.ambiguitySummary.runnerUpTrack,
          scoreDelta: parsed.ambiguitySummary.scoreDelta,
          conflictingSignalFamilies: [...parsed.ambiguitySummary.conflictingSignalFamilies],
          conflictingLaneIds: [...parsed.ambiguitySummary.conflictingTracks],
        }
      : engineRun?.record.routingAssessment?.ambiguitySummary ?? null,
    reviewGuidance:
      parsed.reviewGuidance
      ? {
          guidanceKind: parsed.reviewGuidance.guidanceKind,
          summary: parsed.reviewGuidance.summary,
          operatorAction: parsed.reviewGuidance.operatorAction,
          requiredChecks: [...parsed.reviewGuidance.requiredChecks],
          stopLine: parsed.reviewGuidance.stopLine,
        }
      : engineRun?.record.routingAssessment?.reviewGuidance ?? null,
    goalCopilot:
      parsed.goalCopilot
      ? {
          overallScore: parsed.goalCopilot.overallScore,
          objectiveSpecificityScore: parsed.goalCopilot.objectiveSpecificityScore,
          usefulnessSignalQualityScore: parsed.goalCopilot.usefulnessSignalQualityScore,
          constraintQualityScore: parsed.goalCopilot.constraintQualityScore,
          laneClarityScore: parsed.goalCopilot.laneClarityScore,
          warnings: [...parsed.goalCopilot.warnings],
          rationale: [...parsed.goalCopilot.rationale],
          suggestedObjective: parsed.goalCopilot.suggestedObjective,
          suggestedConstraints: [...parsed.goalCopilot.suggestedConstraints],
          suggestedUsefulnessSignals: [...parsed.goalCopilot.suggestedUsefulnessSignals],
          suggestedCapabilityLanes: [...parsed.goalCopilot.suggestedCapabilityLanes],
        }
      : engineRun?.record.routingAssessment?.goalCopilot ?? null,
    confidenceRecovery:
      parsed.confidenceRecovery
      ? {
          summary: parsed.confidenceRecovery.summary,
          confidenceLift: parsed.confidenceRecovery.confidenceLift,
          requestedInputs: parsed.confidenceRecovery.requestedInputs.map((entry) => ({
            field: entry.field,
            question: entry.question,
            whyItMatters: entry.whyItMatters,
            exampleAnswer: entry.exampleAnswer,
          })),
        }
      : engineRun?.record.routingAssessment?.confidenceRecovery ?? null,
    followUpQuestions:
      engineRun?.record.routingAssessment?.followUpQuestions ?? null,
    gapRadar:
      parsed.gapRadar
      ? {
          summary: parsed.gapRadar.summary,
          suggestions: parsed.gapRadar.suggestions.map((entry) => ({
            radarId: entry.radarId,
            targetLaneId: entry.targetLaneId,
            confidence: entry.confidence,
            evidenceCount: entry.evidenceCount,
            summary: entry.summary,
            recommendedChange: entry.recommendedChange,
            signalTokens: [...entry.signalTokens],
            relatedOpenGapId: entry.relatedOpenGapId,
            suggestedPriority: entry.suggestedPriority,
          })),
        }
      : engineRun?.record.routingAssessment?.gapRadar ?? null,
    earnedAutonomy:
      parsed.earnedAutonomy
      ? {
          routeClass: parsed.earnedAutonomy.routeClass,
          overallScore: parsed.earnedAutonomy.overallScore,
          evidenceCount: parsed.earnedAutonomy.evidenceCount,
          operatorAgreementRate: parsed.earnedAutonomy.operatorAgreementRate,
          reviewClearRate: parsed.earnedAutonomy.reviewClearRate,
          reversalCount: parsed.earnedAutonomy.reversalCount,
          autoApprovalEligible: parsed.earnedAutonomy.autoApprovalEligible,
          approvalReductionApplied: parsed.earnedAutonomy.approvalReductionApplied,
          summary: parsed.earnedAutonomy.summary,
          rationale: [...parsed.earnedAutonomy.rationale],
        }
      : engineRun?.record.routingAssessment?.earnedAutonomy ?? null,
    sourceMemory:
      engineRun?.record.routingAssessment?.sourceMemory ?? null,
    sourceSimilarity:
      engineRun?.record.routingAssessment?.sourceSimilarity ?? null,
    narrativeContext:
      engineRun?.record.routingAssessment?.narrativeContext ?? null,
    laneProportions:
      engineRun?.record.routingAssessment?.laneProportions ?? null,
    secondaryLanes:
      engineRun?.record.routingAssessment?.secondaryLanes ?? null,
  };
}

function updateQueueForOpenedRoute(input: {
  directiveRoot: string;
  artifact: DirectiveDiscoveryRoutingArtifact;
  stubRelativePath: string;
  approvedBy: string;
}) {
  const { queuePath, queue } = readQueueDocument(input.directiveRoot);
  const result = syncDiscoveryIntakeLifecycle({
    directiveRoot: input.directiveRoot,
    queue,
    transitionDate: input.artifact.routingDate,
    request: {
      candidate_id: input.artifact.candidateId,
      target_phase: "routed",
      routing_target: input.artifact.effectiveRouteDestination,
      intake_record_path: input.artifact.linkedIntakeRecord,
      routing_record_path: input.artifact.routingRelativePath,
      result_record_path: input.stubRelativePath,
      note_append: `route approval by ${input.approvedBy} opened ${input.stubRelativePath}`,
    },
  });
  writeJsonPretty(queuePath, result.queue);
  return queuePath;
}

export function readDirectiveDiscoveryRoutingArtifact(input: {
  routingPath: string;
  directiveRoot?: string;
}) {
  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingPath,
    "routingPath",
  );
  return readRoutingArtifact({
    directiveRoot,
    routingRelativePath,
  });
}

export function openDirectiveDiscoveryRoute(input: {
  routingPath: string;
  approved?: boolean;
  approvedBy?: string | null;
  directiveRoot?: string;
}): DirectiveDiscoveryRouteOpenResult {
  requireDirectiveExplicitApproval({
    approved: input.approved,
    action: "open a Discovery route",
  });

  const directiveRoot = normalizeDirectiveWorkspaceRoot(input.directiveRoot);
  const routingRelativePath = resolveDirectiveWorkspaceRelativePath(
    directiveRoot,
    input.routingPath,
    "routingPath",
  );
  const artifact = readRoutingArtifact({
    directiveRoot,
    routingRelativePath,
  });

  if (!artifact.approvalAllowed) {
    throw new Error(
      `invalid_input: routing record cannot open downstream work for effective route destination "${artifact.effectiveRouteDestination}" and decision "${artifact.decisionState}"`,
    );
  }

  const engineRun = artifact.engineRunRecordPath
    ? readEngineRunByRecordPath({
      directiveRoot,
      candidateId: artifact.candidateId,
      recordRelativePath: artifact.engineRunRecordPath,
      reportRelativePath: artifact.engineRunReportPath,
    })
    : findEngineRunForCandidate({
      directiveRoot,
      candidateId: artifact.candidateId,
    });
  if (!engineRun) {
    if (artifact.engineRunRecordPath) {
      throw new Error(
        `invalid_state: linked Engine run artifact not found for candidate ${artifact.candidateId}: ${artifact.engineRunRecordPath}`,
      );
    }
    throw new Error(
      `invalid_state: no Engine run artifact found for candidate ${artifact.candidateId}`,
    );
  }
  if (!engineRun.reportRelativePath) {
    throw new Error(
      `invalid_state: Engine run report missing for candidate ${artifact.candidateId}`,
    );
  }

  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const stubRelativePath = normalizeDirectiveRelativePath(artifact.effectiveRequiredNextArtifact);
  const stubAbsolutePath = path.resolve(directiveRoot, stubRelativePath).replace(/\\/g, "/");

  if (artifact.effectiveRouteDestination === "architecture") {
    if (
      !stubRelativePath.startsWith("architecture/01-experiments/")
      || !stubRelativePath.endsWith("-engine-handoff.md")
    ) {
      throw new Error("invalid_input: Architecture route must open an engine handoff stub");
    }

    const created = writeDirectiveArtifactIfMissing({
      absolutePath: stubAbsolutePath,
      content: renderArchitectureHandoffMarkdown({
        routingRelativePath,
        routeDate: artifact.routingDate,
        engineRecordRelativePath: engineRun.recordRelativePath,
        engineReportRelativePath: engineRun.reportRelativePath,
        record: engineRun.record,
      }),
    });

    const queuePath = updateQueueForOpenedRoute({
      directiveRoot,
      artifact,
      stubRelativePath,
      approvedBy,
    });

    return {
      ok: true,
      created,
      directiveRoot,
      routingRelativePath,
      routeDestination: "architecture",
      stubKind: "architecture_handoff",
      stubRelativePath,
      stubAbsolutePath,
      candidateId: artifact.candidateId,
      candidateName: artifact.candidateName,
      queuePath,
    };
  }

  if (
    !stubRelativePath.startsWith("runtime/00-follow-up/")
    || !stubRelativePath.endsWith("-runtime-follow-up-record.md")
  ) {
    throw new Error("invalid_input: Runtime route must open a Runtime follow-up stub");
  }

  const created = writeDirectiveArtifactIfMissing({
    absolutePath: stubAbsolutePath,
    content: renderRuntimeFollowUpRecord(
      buildRuntimeFollowUpRequest({
        artifact,
        record: engineRun.record,
      }),
    ),
  });

  const queuePath = updateQueueForOpenedRoute({
    directiveRoot,
    artifact,
    stubRelativePath,
    approvedBy,
  });

  return {
    ok: true,
    created,
    directiveRoot,
    routingRelativePath,
    routeDestination: "runtime",
    stubKind: "runtime_follow_up",
    stubRelativePath,
    stubAbsolutePath,
    candidateId: artifact.candidateId,
    candidateName: artifact.candidateName,
    queuePath,
  };
}

