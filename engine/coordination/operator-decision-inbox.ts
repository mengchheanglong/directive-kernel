import fs from "node:fs";
import path from "node:path";

import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";
import {
  normalizeDirectiveRelativePath,
} from "../../shared/lib/directive-relative-path.ts";
import {
  readDirectiveArchitectureMaterializationDueCheck,
} from "../../architecture/lib/architecture-materialization-due-check.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
} from "../../discovery/lib/discovery-route-opener.ts";
import {
  readDiscoveryRoutingReviewResolution,
  resolveDiscoveryRoutingReviewResolutionPath,
} from "../../discovery/lib/discovery-routing-review-resolution.ts";
import {
  buildDirectiveRuntimePromotionAssistanceReport,
} from "../../runtime/lib/runtime-promotion-assistance.ts";
import {
  resolveRuntimeHostSelectionResolutionPath,
} from "../../runtime/lib/host/runtime-host-selection-resolution.ts";
import {
  buildDirectiveRuntimePromotionAutomationDryRunReport,
  type DirectiveAutonomousRuntimePromotionAutomationPolicy,
} from "./runtime-promotion-automation.ts";
import {
  listMissionFeedbackEntries,
} from "../mission/mission-feedback-inbox.ts";
import {
  listPendingGapFormalizationCandidates,
} from "../mission/gap-formalization.ts";
import type { DirectiveEngineExecutablePlanState } from "../types.ts";

export const OPERATOR_DECISION_INBOX_VERSION = "operator_decision_inbox.v4" as const;

export type OperatorDecisionInboxLane = "discovery" | "architecture" | "runtime" | "engine";

export type OperatorDecisionInboxEntry = {
  entryId: string;
  lane: OperatorDecisionInboxLane;
  decisionSurface:
    | "mission_health_feedback"
    | "discovery_routing_review"
    | "architecture_materialization_due"
    | "gap_formalization_review"
    | "runtime_host_selection"
    | "runtime_promotion_seam_decision"
    | "runtime_registry_acceptance";
  candidateId: string | null;
  candidateName: string | null;
  currentStage: string | null;
  artifactPath: string;
  blockReason: string;
  eligibleNextAction: string;
  requiredProof: string[];
  resolverCommandOrArtifact: string;
  relatedArtifacts: string[];
  readOnly: true;
  mutatesWorkflowState: false;
  bypassesReview: false;
  stopLine: string;
  planStateSummary?: {
    runId: string;
    proofState: DirectiveEngineExecutablePlanState["proofState"]["finalState"];
    completionRate: number;
    pendingActionCount: number;
    blockedActionCount: number;
    nextActions: string[];
  } | null;
};

export type OperatorDecisionInboxReport = {
  ok: true;
  inboxVersion: typeof OPERATOR_DECISION_INBOX_VERSION;
  snapshotAt: string;
  directiveRoot: string;
  guardrails: {
    readOnly: true;
    mutatesWorkflowState: false;
    bypassesReview: false;
    writesRegistryEntries: false;
    runsHostAdapters: false;
  };
  summary: {
    totalActionableEntries: number;
    missionHealthFeedbackCount: number;
    discoveryRoutingReviewCount: number;
    architectureMaterializationDueCount: number;
    gapFormalizationReviewCount: number;
    runtimeHostSelectionCount: number;
    runtimePromotionSeamDecisionCount: number;
    runtimeRegistryAcceptanceCount: number;
  };
  entries: OperatorDecisionInboxEntry[];
};

const DISABLED_RUNTIME_AUTOMATION_POLICY: DirectiveAutonomousRuntimePromotionAutomationPolicy = {
  autoHostAdapterDescriptor: false,
  autoHostCallableExecution: false,
  autoWriteRegistryEntry: false,
};

type CandidatePlanStateSummary = NonNullable<OperatorDecisionInboxEntry["planStateSummary"]>;

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function buildPlanStateSummary(input: {
  runId: string;
  state: DirectiveEngineExecutablePlanState | null | undefined;
}): CandidatePlanStateSummary | null {
  const state = input.state;
  if (!state?.actions?.length) {
    return null;
  }

  const nextActions = state.nextActionIds
    .map((actionId) => state.actions.find((action) => action.actionId === actionId)?.title ?? null)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  const pendingActionCount = state.actions.filter((action) =>
    action.status !== "completed" && action.status !== "skipped"
  ).length;

  return {
    runId: input.runId,
    proofState: state.proofState.finalState,
    completionRate: state.completionRate,
    pendingActionCount,
    blockedActionCount: state.blockedActionIds.length,
    nextActions,
  };
}

function buildLatestPlanStateSummaryByCandidateId(directiveRoot: string) {
  const engineRunsRoot = path.join(
    directiveRoot,
    "runtime",
    "standalone-host",
    "engine-runs",
  );
  const summaries = new Map<string, {
    summary: CandidatePlanStateSummary;
    recordPath: string;
  }>();

  if (!fs.existsSync(engineRunsRoot)) {
    return summaries;
  }

  const recordPaths = fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));

  for (const absoluteRecordPath of recordPaths) {
    const parsed = readJson(absoluteRecordPath) as {
      runId?: unknown;
      candidate?: {
        candidateId?: unknown;
      };
      executablePlanState?: DirectiveEngineExecutablePlanState | null;
    } | null;
    const candidateId = typeof parsed?.candidate?.candidateId === "string"
      ? parsed.candidate.candidateId
      : null;
    const runId = typeof parsed?.runId === "string" ? parsed.runId : null;
    if (!candidateId || !runId || summaries.has(candidateId)) {
      continue;
    }

    const summary = buildPlanStateSummary({
      runId,
      state: parsed.executablePlanState,
    });
    if (!summary) {
      continue;
    }

    summaries.set(candidateId, {
      summary,
      recordPath: normalizeDirectiveRelativePath(path.relative(directiveRoot, absoluteRecordPath)),
    });
  }

  return summaries;
}

function attachPlanStateSummary(
  entry: OperatorDecisionInboxEntry,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
) {
  if (!entry.candidateId) {
    return entry;
  }

  const planState = summaryByCandidateId.get(entry.candidateId) ?? null;
  if (!planState) {
    return entry;
  }

  return {
    ...entry,
    planStateSummary: planState.summary,
    relatedArtifacts: Array.from(new Set([
      ...entry.relatedArtifacts,
      planState.recordPath,
    ])),
  };
}

function listFiles(input: {
  directiveRoot: string;
  relativeDir: string;
  suffix: string;
}) {
  const absoluteDir = path.join(input.directiveRoot, input.relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(input.suffix))
    .map((entry) => normalizeDirectiveRelativePath(path.join(input.relativeDir, entry.name)))
    .sort();
}

function buildDiscoveryRoutingReviewEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  return listFiles({
    directiveRoot,
    relativeDir: "discovery/03-routing-log",
    suffix: "routing-record.md",
  }).flatMap((routingPath) => {
    try {
      const routing = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot,
        routingPath,
      });
      const resolution = readDiscoveryRoutingReviewResolution({
        directiveRoot,
        routingRecordPath: routingPath,
      });
      const requiresReview =
        routing.needsHumanReview === true
        || routing.routeConflict === true
        || (
          routing.routingConfidence !== null
          && routing.routingConfidence !== "high"
          && (routing.routeDestination === "architecture" || routing.routeDestination === "runtime")
        );

      if (!requiresReview || resolution) {
        return [];
      }

      const resolutionPath = resolveDiscoveryRoutingReviewResolutionPath({
        routingRecordPath: routingPath,
      });
      const defaultDecision = routing.routeDestination === "architecture"
        ? "confirm_architecture"
        : routing.routeDestination === "runtime"
        ? "confirm_runtime"
        : "defer";

      return [attachPlanStateSummary({
        entryId: `discovery:${routing.candidateId}:routing_review`,
        lane: "discovery" as const,
        decisionSurface: "discovery_routing_review" as const,
        candidateId: routing.candidateId,
        candidateName: routing.candidateName,
        currentStage: `discovery.route.${routing.routeDestination}`,
        artifactPath: routingPath,
        blockReason:
          routing.reviewGuidance?.summary
          ?? `routing review required; confidence=${routing.routingConfidence ?? "n/a"}, conflict=${routing.routeConflict === true ? "yes" : "no"}`,
        eligibleNextAction:
          routing.reviewGuidance?.operatorAction
          ?? "Confirm, redirect, reject, or defer the Discovery routing decision explicitly.",
        requiredProof: routing.reviewGuidance?.requiredChecks.length
          ? [...routing.reviewGuidance.requiredChecks]
          : ["review routing confidence", "review route conflict", "preserve original routing record"],
        resolverCommandOrArtifact:
          `node --experimental-strip-types ./scripts/resolve-routing-review.ts --routing-record "${routingPath}" --decision ${defaultDecision} --rationale "<operator rationale>" --reviewed-by "<operator>"`,
        relatedArtifacts: [
          routing.linkedIntakeRecord,
          routing.linkedTriageRecord,
          routing.engineRunRecordPath,
          routing.engineRunReportPath,
          resolutionPath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          routing.reviewGuidance?.stopLine
          ?? "Do not continue downstream until an explicit Discovery routing review resolution exists.",
      }, summaryByCandidateId)];
    } catch {
      return [];
    }
  });
}

function buildArchitectureMaterializationEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  const report = readDirectiveArchitectureMaterializationDueCheck({
    directiveRoot,
  });

  return report.dueItems.map((item) => {
    const isTargetCreation = item.dueKind === "create_implementation_target";
    return attachPlanStateSummary({
      entryId: `architecture:${item.candidateId}:${item.dueKind}`,
      lane: "architecture" as const,
      decisionSurface: "architecture_materialization_due" as const,
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      currentStage: isTargetCreation
        ? "architecture.adoption.adopted"
        : "architecture.implementation_target.opened",
      artifactPath: item.currentArtifactPath,
      blockReason: item.rationale,
      eligibleNextAction: item.nextLegalStep,
      requiredProof: [
        `objective: ${item.objective}`,
        `usefulness level: ${item.usefulnessLevel}`,
        `next artifact path: ${item.nextArtifactPath}`,
      ],
      resolverCommandOrArtifact: isTargetCreation
        ? `Use the Architecture adoption detail surface to create the implementation target: /architecture-adoptions/view?path=${encodeURIComponent(item.currentArtifactPath)}`
        : `Use the Architecture implementation-target detail surface to record the implementation result: /architecture-implementation-targets/view?path=${encodeURIComponent(item.currentArtifactPath)}`,
      relatedArtifacts: [
        item.currentArtifactPath,
        item.nextArtifactPath,
      ],
      readOnly: true,
      mutatesWorkflowState: false,
      bypassesReview: false,
      stopLine:
        "The inbox does not create Architecture implementation targets or results; materialization remains an explicit Architecture lane action.",
    }, summaryByCandidateId);
  });
}

function buildMissionFeedbackInboxEntries(directiveRoot: string): OperatorDecisionInboxEntry[] {
  return listMissionFeedbackEntries({ directiveRoot }).map((entry) => ({
    entryId: `engine:${entry.feedbackId}:mission_health_feedback`,
    lane: "engine" as const,
    decisionSurface: "mission_health_feedback" as const,
    candidateId: null,
    candidateName: entry.proposedAction,
    currentStage: "engine.mission.feedback",
    artifactPath: "knowledge/active-mission.md",
    blockReason: entry.rationale,
    eligibleNextAction: "approve or reject the proposed mission evolution after previewing its routing impact",
    requiredProof: [
      `health grade at generation: ${entry.healthGradeAtGeneration}`,
      ...entry.sourceSignals.map((signal) => `trigger: ${signal}`),
    ],
    resolverCommandOrArtifact:
      `node --experimental-strip-types ./hosts/standalone-host/cli.ts mission-preview --directive-root "${directiveRoot}" --feedback-id "${entry.feedbackId}"`,
    relatedArtifacts: [
      "knowledge/active-mission.md",
      "DIRECTIVE_GOAL.md",
      "shared/contracts/mission-evolution.md",
    ],
    readOnly: true,
    mutatesWorkflowState: false,
    bypassesReview: false,
    stopLine:
      "Do not change the active mission without previewing the routing impact and recording operator rationale.",
  }));
}

function buildGapFormalizationInboxEntries(directiveRoot: string): OperatorDecisionInboxEntry[] {
  return listPendingGapFormalizationCandidates({ directiveRoot }).map((record) => ({
    entryId: `engine:${record.formalizationId}:gap_formalization_review`,
    lane: "engine" as const,
    decisionSurface: "gap_formalization_review" as const,
    candidateId: null,
    candidateName: record.radarSummary,
    currentStage: "engine.gap.formalization",
    artifactPath: "engine/gap-radar.json",
    blockReason: `${record.radarSummary} Evidence count: ${record.radarEvidenceCount}.`,
    eligibleNextAction: "approve or reject the proposed gap formalization explicitly",
    requiredProof: [
      `radar confidence: ${record.radarConfidence}`,
      `recommended change: ${record.radarRecommendedChange}`,
    ],
    resolverCommandOrArtifact:
      `node --experimental-strip-types ./hosts/standalone-host/cli.ts gap-approve --directive-root "${directiveRoot}" --formalization-id "${record.formalizationId}" --priority ${record.radarConfidence === "high" ? "high" : "medium"} --rationale "<operator rationale>"`,
    relatedArtifacts: [
      "engine/gap-radar.json",
      "discovery/capability-gaps.json",
      "shared/contracts/gap-formalization.md",
    ],
    readOnly: true,
    mutatesWorkflowState: false,
    bypassesReview: false,
    stopLine:
      "Do not hand-edit capability gaps or the Discovery worklist; formalize through the explicit approval path.",
  }));
}

function buildRuntimeHostSelectionEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  const report = buildDirectiveRuntimePromotionAssistanceReport({
    directiveRoot,
  });
  return report.recommendations
    .filter((recommendation) => recommendation.recommendedActionKind !== "none")
    .map((recommendation) => {
      const hostSelectionResolutionPath = resolveRuntimeHostSelectionResolutionPath({
        promotionReadinessPath: recommendation.sourcePromotionReadinessPath,
      });
      const isHostSelectionDecision =
        recommendation.recommendedActionKind === "clarify_repo_native_host_target";
      return attachPlanStateSummary({
        entryId: `runtime:${recommendation.candidateId}:${isHostSelectionDecision ? "host_selection" : "promotion_seam_decision"}`,
        lane: "runtime" as const,
        decisionSurface: isHostSelectionDecision
          ? "runtime_host_selection" as const
          : "runtime_promotion_seam_decision" as const,
        candidateId: recommendation.candidateId,
        candidateName: recommendation.candidateName,
        currentStage: recommendation.currentStage,
        artifactPath: recommendation.sourcePromotionReadinessPath,
        blockReason: recommendation.recommendedActionSummary,
        eligibleNextAction: recommendation.recommendedActionKind,
        requiredProof: [
          ...recommendation.missingPrerequisites.map((entry) => `resolve missing prerequisite: ${entry}`),
          recommendation.supportingArtifacts.promotionSpecificationArtifact,
          recommendation.supportingArtifacts.compileContractArtifact,
        ],
        resolverCommandOrArtifact:
          recommendation.recommendedActionKind === "clarify_repo_native_host_target"
            ? `create explicit Runtime host selection resolution artifact at ${hostSelectionResolutionPath}`
            : "complete the recommended Runtime promotion-assistance action through an explicit artifact-backed review",
        relatedArtifacts: [
          recommendation.currentHeadPath,
          recommendation.promotionSpecificationPath,
          recommendation.supportingArtifacts.compileContractArtifact,
          recommendation.supportingArtifacts.parkDecisionArtifact,
          hostSelectionResolutionPath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          "Do not create promotion records, host adapters, callable execution evidence, or registry entries from the inbox report alone.",
      }, summaryByCandidateId);
    });
}

function buildRuntimeRegistryAcceptanceEntries(
  directiveRoot: string,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
): OperatorDecisionInboxEntry[] {
  return listFiles({
    directiveRoot,
    relativeDir: "runtime/07-promotion-records",
    suffix: "promotion-record.md",
  }).flatMap((promotionRecordPath) => {
    try {
      const dryRun = buildDirectiveRuntimePromotionAutomationDryRunReport({
        directiveRoot,
        promotionRecordPath,
        policy: DISABLED_RUNTIME_AUTOMATION_POLICY,
        approvedBy: "operator-decision-inbox",
        acceptedAt: "2026-04-08T00:00:00.000Z",
      });

      if (
        dryRun.existingRegistryEntryPath
        || !dryRun.evidenceEligible
        || dryRun.wouldWriteRegistryEntry
      ) {
        return [];
      }

      return [attachPlanStateSummary({
        entryId: `runtime:${dryRun.candidateId ?? promotionRecordPath}:registry_acceptance`,
        lane: "runtime" as const,
        decisionSurface: "runtime_registry_acceptance" as const,
        candidateId: dryRun.candidateId,
        candidateName: dryRun.candidateName,
        currentStage: dryRun.currentStage,
        artifactPath: promotionRecordPath,
        blockReason: dryRun.stopReason,
        eligibleNextAction:
          "Review registry acceptance evidence and, if approved, enable/write through the gated registry acceptance path.",
        requiredProof: [
          "promotion record",
          "promotion specification",
          "host adapter proof",
          "Runtime callable execution evidence",
          "rollback path",
        ],
        resolverCommandOrArtifact:
          "keep automation disabled by default; use runtime_registry_acceptance_gate.v1 for any manual acceptance decision",
        relatedArtifacts: [
          dryRun.currentHeadPath,
          dryRun.hostCallableAdapterReportPath,
          dryRun.callableExecutionEvidencePath,
        ].filter((entry): entry is string => Boolean(entry)),
        readOnly: true,
        mutatesWorkflowState: false,
        bypassesReview: false,
        stopLine:
          "The inbox does not write registry entries; registry acceptance remains proof-backed and explicitly gated.",
      }, summaryByCandidateId)];
    } catch {
      return [];
    }
  });
}

function sortInboxEntries(left: OperatorDecisionInboxEntry, right: OperatorDecisionInboxEntry) {
  const surfacePriority = new Map<OperatorDecisionInboxEntry["decisionSurface"], number>([
    ["mission_health_feedback", 5],
    ["runtime_host_selection", 10],
    ["runtime_promotion_seam_decision", 15],
    ["architecture_materialization_due", 20],
    ["gap_formalization_review", 25],
    ["runtime_registry_acceptance", 30],
    ["discovery_routing_review", 40],
  ]);
  const priorityDelta =
    (surfacePriority.get(left.decisionSurface) ?? 99)
    - (surfacePriority.get(right.decisionSurface) ?? 99);
  if (priorityDelta !== 0) return priorityDelta;
  return left.entryId.localeCompare(right.entryId);
}

function markdownText(value: unknown) {
  return String(value ?? "n/a").replaceAll("|", "\\|").trim() || "n/a";
}

function renderMarkdownGroup(input: {
  title: string;
  entries: OperatorDecisionInboxEntry[];
}) {
  const lines = [`## ${input.title}`, ""];
  if (!input.entries.length) {
    lines.push("No actionable entries.", "");
    return lines.join("\n");
  }

  input.entries.forEach((entry, index) => {
    lines.push(`### ${index + 1}. ${markdownText(entry.candidateName ?? entry.candidateId ?? entry.entryId)}`);
    lines.push("");
    lines.push(`- Lane: ${markdownText(entry.lane)}`);
    lines.push(`- Decision surface: ${markdownText(entry.decisionSurface)}`);
    lines.push(`- Current stage: ${markdownText(entry.currentStage)}`);
    lines.push(`- Artifact: \`${markdownText(entry.artifactPath)}\``);
    lines.push(`- Why blocked: ${markdownText(entry.blockReason)}`);
    lines.push(`- Eligible next action: ${markdownText(entry.eligibleNextAction)}`);
    lines.push(`- Stop-line: ${markdownText(entry.stopLine)}`);
    if (entry.planStateSummary) {
      lines.push(
        `- Executable plan: proof=${markdownText(entry.planStateSummary.proofState)}, completion=${entry.planStateSummary.completionRate}%, pending=${entry.planStateSummary.pendingActionCount}, blocked=${entry.planStateSummary.blockedActionCount}, run=${markdownText(entry.planStateSummary.runId)}`,
      );
      if (entry.planStateSummary.nextActions.length) {
        lines.push("- Next executable actions:");
        for (const nextAction of entry.planStateSummary.nextActions) {
          lines.push(`  - ${markdownText(nextAction)}`);
        }
      }
    }
    lines.push("- Required proof:");
    for (const proof of entry.requiredProof.length ? entry.requiredProof : ["n/a"]) {
      lines.push(`  - ${markdownText(proof)}`);
    }
    lines.push("- Resolver command or artifact:");
    lines.push("```text");
    lines.push(String(entry.resolverCommandOrArtifact || "n/a"));
    lines.push("```");
    if (entry.relatedArtifacts.length) {
      lines.push("- Related artifacts:");
      for (const artifact of entry.relatedArtifacts) {
        lines.push(`  - \`${markdownText(artifact)}\``);
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}

export function renderOperatorDecisionInboxMarkdown(report: OperatorDecisionInboxReport) {
  const missionFeedbackEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "mission_health_feedback"
  );
  const runtimeHostSelectionEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_host_selection"
  );
  const runtimeRegistryAcceptanceEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_registry_acceptance"
  );
  const runtimePromotionSeamDecisionEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_promotion_seam_decision"
  );
  const architectureMaterializationEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "architecture_materialization_due"
  );
  const gapFormalizationEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "gap_formalization_review"
  );
  const discoveryRoutingReviewEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "discovery_routing_review"
  );

  return [
    "# Operator Decision Inbox",
    "",
    `Snapshot: ${report.snapshotAt}`,
    `Version: ${report.inboxVersion}`,
    `Directive root: \`${markdownText(report.directiveRoot)}\``,
    "",
    "## Guardrails",
    "",
    `- Read-only: ${report.guardrails.readOnly}`,
    `- Mutates workflow state: ${report.guardrails.mutatesWorkflowState}`,
    `- Bypasses review: ${report.guardrails.bypassesReview}`,
    `- Writes registry entries: ${report.guardrails.writesRegistryEntries}`,
    `- Runs host adapters: ${report.guardrails.runsHostAdapters}`,
    "",
    "## Summary",
    "",
    `- Total actionable entries: ${report.summary.totalActionableEntries}`,
    `- Mission health feedback decisions: ${report.summary.missionHealthFeedbackCount}`,
    `- Runtime host-selection decisions: ${report.summary.runtimeHostSelectionCount}`,
    `- Runtime promotion-seam decisions: ${report.summary.runtimePromotionSeamDecisionCount}`,
    `- Architecture materialization decisions: ${report.summary.architectureMaterializationDueCount}`,
    `- Gap formalization decisions: ${report.summary.gapFormalizationReviewCount}`,
    `- Runtime registry-acceptance decisions: ${report.summary.runtimeRegistryAcceptanceCount}`,
    `- Discovery routing-review decisions: ${report.summary.discoveryRoutingReviewCount}`,
    "",
    renderMarkdownGroup({
      title: "Mission Health Feedback",
      entries: missionFeedbackEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Host Selection",
      entries: runtimeHostSelectionEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Promotion Seam Decision",
      entries: runtimePromotionSeamDecisionEntries,
    }),
    renderMarkdownGroup({
      title: "Architecture Materialization",
      entries: architectureMaterializationEntries,
    }),
    renderMarkdownGroup({
      title: "Gap Formalization",
      entries: gapFormalizationEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Registry Acceptance",
      entries: runtimeRegistryAcceptanceEntries,
    }),
    renderMarkdownGroup({
      title: "Discovery Routing Review",
      entries: discoveryRoutingReviewEntries,
    }),
    "## Stop-Line",
    "",
    "This report is read-only. It does not resolve Discovery routes, write Runtime host-selection resolutions, run host adapters, write registry entries, or change automation policy.",
    "",
  ].join("\n");
}

export function buildOperatorDecisionInboxReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): OperatorDecisionInboxReport {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const planStateSummaryByCandidateId = buildLatestPlanStateSummaryByCandidateId(directiveRoot);
  const entries = [
    ...buildMissionFeedbackInboxEntries(directiveRoot),
    ...buildDiscoveryRoutingReviewEntries(directiveRoot, planStateSummaryByCandidateId),
    ...buildArchitectureMaterializationEntries(directiveRoot, planStateSummaryByCandidateId),
    ...buildGapFormalizationInboxEntries(directiveRoot),
    ...buildRuntimeHostSelectionEntries(directiveRoot, planStateSummaryByCandidateId),
    ...buildRuntimeRegistryAcceptanceEntries(directiveRoot, planStateSummaryByCandidateId),
  ].sort(sortInboxEntries);

  return {
    ok: true,
    inboxVersion: OPERATOR_DECISION_INBOX_VERSION,
    snapshotAt: input?.snapshotAt ?? new Date().toISOString(),
    directiveRoot,
    guardrails: {
      readOnly: true,
      mutatesWorkflowState: false,
      bypassesReview: false,
      writesRegistryEntries: false,
      runsHostAdapters: false,
    },
    summary: {
      totalActionableEntries: entries.length,
      missionHealthFeedbackCount: entries.filter((entry) =>
        entry.decisionSurface === "mission_health_feedback"
      ).length,
      discoveryRoutingReviewCount: entries.filter((entry) =>
        entry.decisionSurface === "discovery_routing_review"
      ).length,
      architectureMaterializationDueCount: entries.filter((entry) =>
        entry.decisionSurface === "architecture_materialization_due"
      ).length,
      gapFormalizationReviewCount: entries.filter((entry) =>
        entry.decisionSurface === "gap_formalization_review"
      ).length,
      runtimeHostSelectionCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_host_selection"
      ).length,
      runtimePromotionSeamDecisionCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_promotion_seam_decision"
      ).length,
      runtimeRegistryAcceptanceCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_registry_acceptance"
      ).length,
    },
    entries,
  };
}
