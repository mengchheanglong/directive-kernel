import os from "node:os";
import path from "node:path";

import {
  DirectiveEngine,
  appendRoutingCorrection,
  assessDirectiveEngineRouting,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  deriveRoutingCorrectionAdjustments,
  extractSourceSignalTokens,
  readRoutingCorrectionLedger,
  type DirectiveEngineProcessSourceInput,
} from "../../../engine/index.ts";
import { runDiscoveryFrontDoorStarterSmoke } from "./discovery-front-door-adapter.smoke.template.ts";
import { runDiscoveryOverviewStarterSmoke } from "./discovery-overview-reader.smoke.template.ts";
import { runDiscoverySignalStarterSmoke } from "./discovery-signal-adapter.smoke.template.ts";
import { runDiscoveryStarterSmoke } from "./discovery-submission-adapter.smoke.template.ts";

export type HostIntegrationAcceptanceModuleSurface =
  | "package_import"
  | "starter_copy"
  | "mixed";

export type HostIntegrationAcceptanceSection = {
  ok: boolean;
  check_count: number;
  summary: string;
};

export type HostIntegrationAcceptanceReport = {
  host_name: string;
  accepted: boolean;
  generated_at: string;
  module_surface: HostIntegrationAcceptanceModuleSurface;
  submission_acceptance: HostIntegrationAcceptanceSection;
  overview_acceptance: HostIntegrationAcceptanceSection;
  signal_acceptance: HostIntegrationAcceptanceSection;
  front_door_acceptance: HostIntegrationAcceptanceSection;
  engine_contract_surface: HostIntegrationAcceptanceSection;
  notes: string[];
};

type RunHostIntegrationAcceptanceOptions = {
  hostName: string;
  moduleSurface: HostIntegrationAcceptanceModuleSurface;
  generatedAt?: string;
};

function createSection(input: {
  ok: boolean;
  checkCount: number;
  summary: string;
}): HostIntegrationAcceptanceSection {
  return {
    ok: input.ok,
    check_count: input.checkCount,
    summary: input.summary,
  };
}

async function runEngineContractSurfaceCheck(): Promise<HostIntegrationAcceptanceSection> {
  const checks: string[] = [];
  let ok = true;

  function check(label: string, condition: boolean) {
    if (!condition) {
      ok = false;
      checks.push(`FAIL: ${label}`);
    } else {
      checks.push(label);
    }
  }

  try {
    check("DirectiveEngine export is constructable", typeof DirectiveEngine === "function");
    check(
      "assessDirectiveEngineRouting export is callable",
      typeof assessDirectiveEngineRouting === "function",
    );

    const vagueRoute = assessDirectiveEngineRouting({
      source: {
        sourceType: "paper",
        sourceRef: "https://example.com/acceptance-contract-vague",
        title: "Improve the system",
        summary: "Generic improvement note.",
      },
      mission: {
        missionId: "acceptance-vague",
        currentObjective: "Improve the system",
        usefulnessSignals: [],
        capabilityLanes: ["architecture", "discovery", "runtime"],
        constraints: [],
        successSignal: null,
        adoptionTarget: null,
        activeMissionMarkdown: "",
      },
      openGaps: [],
    });
    check(
      "routing assessment exposes missionSpecificityWarning for vague missions",
      typeof vagueRoute.missionSpecificityWarning === "string"
        && vagueRoute.missionSpecificityWarning.length > 0,
    );
    check(
      "routing assessment exposes scoreBreakdown.missionFit",
      typeof vagueRoute.scoreBreakdown.missionFit === "number",
    );
    check(
      "routing assessment exposes Goal Copilot diagnostics",
      typeof vagueRoute.goalCopilot?.overallScore === "number",
    );
    check(
      "routing assessment exposes confidence-recovery prompts for weak missions",
      Array.isArray(vagueRoute.confidenceRecovery?.requestedInputs)
        && (vagueRoute.confidenceRecovery?.requestedInputs.length ?? 0) > 0,
    );
    check(
      "routing assessment exposes Mission Health diagnostics",
      typeof vagueRoute.missionHealth?.overallScore === "number",
    );
    check(
      "routing assessment exposes explicit follow-up questions",
      Array.isArray(vagueRoute.followUpQuestions?.questions)
        && (vagueRoute.followUpQuestions?.questions.length ?? 0) > 0,
    );
    check(
      "routing assessment exposes Earned Autonomy diagnostics",
      typeof vagueRoute.earnedAutonomy?.overallScore === "number",
    );

    const recurringPolicyEvents = [
      {
        recordedAt: "2026-04-10T00:00:00.000Z",
        source: "discovery_routing_review" as const,
        candidateId: "acceptance-gap-a",
        sourceType: "workflow-writeup",
        decision: "confirm_architecture",
        originalLaneId: "architecture",
        resolvedLaneId: "architecture",
        originalConfidence: "medium",
        resolvedConfidence: "high",
        originalNeedsHumanReview: true,
        resolvedNeedsHumanReview: false,
        matchedGapId: null,
        missionSpecificityWarning: null,
        goalCopilotWarnings: [],
        followUpRequestedFields: ["source.capabilityGapId"],
        sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
        rationale: "Repeated architecture workflow routing case without a clean open-gap match.",
      },
      {
        recordedAt: "2026-04-11T00:00:00.000Z",
        source: "discovery_routing_review" as const,
        candidateId: "acceptance-gap-b",
        sourceType: "workflow-writeup",
        decision: "confirm_architecture",
        originalLaneId: "architecture",
        resolvedLaneId: "architecture",
        originalConfidence: "medium",
        resolvedConfidence: "high",
        originalNeedsHumanReview: true,
        resolvedNeedsHumanReview: false,
        matchedGapId: null,
        missionSpecificityWarning: null,
        goalCopilotWarnings: [],
        followUpRequestedFields: ["source.capabilityGapId"],
        sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
        rationale: "Repeated architecture workflow routing case without a clean open-gap match.",
      },
    ];
    const radarRoute = assessDirectiveEngineRouting({
      source: {
        sourceType: "workflow-writeup",
        sourceRef: "https://example.com/acceptance-gap-radar",
        title: "Workflow architecture routing engine improvement",
        summary: "Architecture workflow routing engine improvement without a current gap match.",
        primaryAdoptionTarget: "architecture",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
      mission: {
        missionId: "acceptance-radar",
        currentObjective: "Improve directive workspace routing workflow architecture boundaries",
        usefulnessSignals: ["prefer engine routing improvements"],
        capabilityLanes: ["architecture", "discovery", "runtime"],
        constraints: ["keep review explicit", "stay reversible"],
        successSignal: "One bounded routing improvement is materially clearer than before.",
        adoptionTarget: "architecture",
        activeMissionMarkdown: "",
      },
      openGaps: [],
      policyEvents: recurringPolicyEvents,
    });
    check(
      "routing assessment exposes Gap Radar suggestions from policy history",
      Array.isArray(radarRoute.gapRadar?.suggestions)
        && (radarRoute.gapRadar?.suggestions.length ?? 0) > 0,
    );
    check(
      "routing assessment exposes normalized lane proportions",
      Object.values(radarRoute.laneProportions).reduce((sum, value) => sum + value, 0) === 100,
    );

    const directiveRoot = path.resolve(
      os.tmpdir(),
      `directive-workspace-acceptance-contract-${Date.now()}`,
    );
    appendRoutingCorrection({
      directiveRoot,
      entry: {
        correctedAt: "2026-04-10T00:00:00.000Z",
        candidateId: "acceptance-contract",
        sourceType: "workflow-writeup",
        originalLaneId: "runtime",
        correctedLaneId: "architecture",
        reason: "Operator redirected a workflow source back to architecture.",
        sourceSignalTokens: extractSourceSignalTokens(
          "Workflow architecture routing engine improvement",
        ),
      },
    });
    const ledger = readRoutingCorrectionLedger(directiveRoot);
    const correctionAdjustments = deriveRoutingCorrectionAdjustments({
      sourceText: "Workflow architecture routing engine improvement",
      corrections: ledger.corrections,
    });
    check(
      "routing correction ledger round-trips through the public Engine surface",
      ledger.corrections.length === 1,
    );
    check(
      "routing correction adjustments bias corrected lane and penalize original lane",
      (correctionAdjustments.architecture ?? 0) > 0
        && (correctionAdjustments.runtime ?? 0) < 0,
    );

    const engine = new DirectiveEngine({
      laneSet: createDirectiveWorkspaceEngineLanes(),
      store: createMemoryDirectiveEngineStore(),
    });
    const processInput: DirectiveEngineProcessSourceInput = {
      receivedAt: "2026-04-10T00:00:00.000Z",
      mission: {
        missionId: "acceptance-engine",
        currentObjective:
          "Improve directive workspace routing workflow architecture boundaries",
        usefulnessSignals: [
          "prefer engine routing improvements when the source improves directive workspace judgment",
        ],
        capabilityLanes: ["architecture", "discovery", "runtime"],
        constraints: [
          "keep review explicit",
          "stay reversible",
        ],
        successSignal: "One bounded routing improvement is materially clearer than before.",
        adoptionTarget: "architecture",
      },
      gaps: [
        {
          gapId: "gap-acceptance-engine",
          description: "Acceptance harness needs a stable architecture routing gap",
          priority: "high",
          relatedMissionObjective:
            "Improve directive workspace routing workflow architecture boundaries",
          currentState: "Hosts can drift away from the canonical Engine contract",
          desiredState: "Acceptance catches contract drift before host release",
          detectedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      corrections: ledger.corrections,
      policyEvents: recurringPolicyEvents,
      source: {
        sourceId: "acceptance-engine-source",
        sourceType: "workflow-writeup",
        sourceRef: "https://example.com/acceptance-engine-source",
        title: "Workflow architecture routing engine improvement",
        summary:
          "Improve directive workspace routing workflow architecture boundaries with explicit gates.",
        missionAlignmentHint:
          "Improve directive workspace routing workflow architecture boundaries",
        capabilityGapId: "gap-acceptance-engine",
        primaryAdoptionTarget: "architecture",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
    };
    const first = await engine.processSource(processInput);
    const second = await engine.processSource(processInput);
    check(
      "DirectiveEngine processSource exposes deduplication fields",
      second.deduplicated === true && second.duplicateOfRunId === first.record.runId,
    );
    check(
      "DirectiveEngine processSource accepts correction-ledger input",
      first.record.routingAssessment.rationale.some((line) =>
        line.includes("Routing correction ledger applied adjustments:")
      ),
    );
    check(
      "DirectiveEngine processSource preserves Earned Autonomy and Gap Radar surfaces",
      typeof first.record.routingAssessment.earnedAutonomy.overallScore === "number"
        && (
          first.record.routingAssessment.gapRadar === null
          || Array.isArray(first.record.routingAssessment.gapRadar.suggestions)
        ),
    );
    const related = await engine.processSource({
      ...processInput,
      receivedAt: "2026-04-10T01:00:00.000Z",
      source: {
        ...processInput.source,
        sourceId: "acceptance-engine-source-related",
        sourceRef: "https://example.com/acceptance-engine-source-related",
        title: "Workflow architecture routing engine improvement related",
      },
    });
    check(
      "DirectiveEngine processSource preserves source-memory, source-similarity, and prior-plan-context surfaces",
      related.record.routingAssessment.sourceMemory !== null
        && related.record.routingAssessment.sourceSimilarity !== null
        && related.record.priorPlanContext !== null,
    );
  } catch (error) {
    ok = false;
    checks.push(
      `FAIL: unexpected contract-surface error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return createSection({
    ok,
    checkCount: checks.length,
    summary: ok
      ? "Engine contract surface checks passed; public Engine exports preserved mission-specificity, deduplication, and correction-ledger behavior."
      : `Engine contract surface failures: ${checks.filter((c) => c.startsWith("FAIL")).join("; ")}`,
  });
}

export async function runHostIntegrationAcceptance(
  options: RunHostIntegrationAcceptanceOptions,
): Promise<HostIntegrationAcceptanceReport> {
  const submission = await runDiscoveryStarterSmoke();
  const overview = runDiscoveryOverviewStarterSmoke();
  const signal = await runDiscoverySignalStarterSmoke();
  const frontDoor = await runDiscoveryFrontDoorStarterSmoke();

  const submissionAcceptance = createSection({
    ok: submission.ok,
    checkCount: Object.keys(submission.queueStatuses).length,
    summary:
      "Queue-only, fast-path, and split-case submissions all exercised the canonical Discovery submission path.",
  });

  const overviewAcceptance = createSection({
    ok: overview.ok,
    checkCount: overview.recentEntryIds.length + Object.keys(overview.statusCounts).length,
    summary:
      "Overview reader consumed the canonical queue document and returned status counts plus recent entries.",
  });

  const signalAcceptance = createSection({
    ok: signal.ok,
    checkCount: Object.keys(signal.queueStatuses).length,
    summary:
      "Signal adapter accepted degraded signals through canonical Discovery submission and ignored healthy runtime state.",
  });

  const frontDoorAcceptance = createSection({
    ok: frontDoor.ok,
    checkCount: 3,
    summary:
      "Engine-backed front-door submission routed to expected lane, produced routing and engine run records on disk.",
  });

  const engineContractSurface = await runEngineContractSurfaceCheck();

  const accepted =
    submissionAcceptance.ok
    && overviewAcceptance.ok
    && signalAcceptance.ok
    && frontDoorAcceptance.ok
    && engineContractSurface.ok;

  return {
    host_name: options.hostName,
    accepted,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    module_surface: options.moduleSurface,
    submission_acceptance: submissionAcceptance,
    overview_acceptance: overviewAcceptance,
    signal_acceptance: signalAcceptance,
    front_door_acceptance: frontDoorAcceptance,
    engine_contract_surface: engineContractSurface,
    notes: [
      "Directive Workspace remains the product; the host is only accepted as a consumer of the canonical surface.",
      "Passing this acceptance harness does not authorize host-local redefinition of Discovery, Runtime, or Architecture vocabulary.",
      "Engine contract surface checks validate that critical engine exports remain accessible and correctly shaped.",
    ],
  };
}
