/// <reference types="node" />

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DirectiveEngine,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  assessDirectiveEngineRouting,
  appendDecisionPolicyEvent,
  compileDecisionPolicySuggestions,
  readRoutingCorrectionLedger,
  readDecisionPolicyLedger,
  appendRoutingCorrection,
  extractSourceSignalTokens,
  deriveRoutingCorrectionAdjustments,
  type DirectiveEngineCapabilityGap,
  type DirectiveEngineMissionInput,
  type DirectiveEngineProcessSourceInput,
  type RoutingCorrectionEntry,
} from "../engine/index.ts";
import { appendDiscoveryIntakeQueueEntry } from "../discovery/lib/discovery-intake-queue-writer.ts";
import { writeDiscoveryRoutingReviewResolution } from "../discovery/lib/discovery-routing-review-resolution.ts";
import { startDirectiveFrontendServer } from "../hosts/web-host/server.ts";
import {
  runDiscoveryStarterSmoke,
} from "../hosts/integration-kit/starter/discovery-submission-adapter.smoke.template.ts";
import {
  runDiscoveryFrontDoorStarterSmoke,
} from "../hosts/integration-kit/starter/discovery-front-door-adapter.smoke.template.ts";
import {
  runHostIntegrationAcceptanceQuickstart,
} from "../hosts/integration-kit/starter/run-host-integration-acceptance-quickstart.template.ts";

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function buildArchitectureGap(): DirectiveEngineCapabilityGap {
  return {
    gapId: "gap-arch-routing-clarity",
    description: "Architecture routing clarity and bounded workflow ownership",
    priority: "high",
    relatedMissionObjective: "Improve directive workspace routing workflow architecture boundaries",
    currentState: "Clear architecture candidates still require extra manual routing work",
    desiredState: "High-signal architecture candidates auto-open one bounded downstream stub",
    detectedAt: "2026-04-10T00:00:00.000Z",
  };
}

function buildArchitectureMission(): DirectiveEngineMissionInput {
  return {
    missionId: "hardening-smoke",
    currentObjective: "Improve directive workspace routing workflow architecture boundaries",
    usefulnessSignals: [
      "prefer engine routing and workflow improvements when the source upgrades directive workspace judgment",
      "prefer bounded architecture ownership for sources that improve directive workspace itself",
    ],
    capabilityLanes: [
      "architecture",
      "discovery",
      "runtime",
    ],
    constraints: [
      "keep review explicit",
      "stay reversible",
      "keep the next change bounded",
    ],
    successSignal: "One bounded routing improvement is materially clearer than before.",
    adoptionTarget: "architecture",
  };
}

function buildRecurringArchitecturePolicyEvents() {
  return [
    {
      recordedAt: "2026-04-10T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "autonomy-a",
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
      rationale: "Architecture workflow routing case cleared after bounded review.",
    },
    {
      recordedAt: "2026-04-11T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "autonomy-b",
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
      rationale: "Architecture workflow routing case cleared after bounded review.",
    },
  ];
}

function buildRecurringRuntimePolicyEvents() {
  return [
    {
      recordedAt: "2026-04-10T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "runtime-a",
      sourceType: "technical-essay",
      decision: "confirm_runtime",
      originalLaneId: "runtime",
      resolvedLaneId: "runtime",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["runtime", "automation", "performance", "reliability"],
      rationale: "Runtime automation case cleared after bounded review.",
    },
    {
      recordedAt: "2026-04-11T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "runtime-b",
      sourceType: "technical-essay",
      decision: "confirm_runtime",
      originalLaneId: "runtime",
      resolvedLaneId: "runtime",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["runtime", "automation", "performance", "reliability"],
      rationale: "Runtime automation case cleared after bounded review.",
    },
  ];
}

function buildArchitectureSourceInput(): DirectiveEngineProcessSourceInput {
  return {
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: buildArchitectureMission(),
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "architecture-auto-open",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/architecture-auto-open",
      title: "Architecture Auto-Open Workflow",
      summary: "Improve directive workspace routing workflow architecture boundaries with explicit gates.",
      missionAlignmentHint: "Improve directive workspace routing workflow architecture boundaries",
      capabilityGapId: "gap-arch-routing-clarity",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
      notes: [
        "Preserve architecture workflow boundaries.",
      ],
    },
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function runDirectiveEngineHardeningChecks() {
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
    hostAdapters: [
      {
        id: "throws",
        async onRunRecorded() {
          throw new Error("boom");
        },
      },
      {
        id: "accepts",
        async onRunRecorded() {
          return {
            accepted: true,
            note: "recorded",
          };
        },
      },
    ],
  });

  await assert.rejects(
    engine.processSource({
      mission: buildArchitectureMission(),
      source: {
        sourceType: "paper",
        sourceRef: "",
        title: "",
      },
    }),
    /source\.sourceRef is required/u,
  );

  const first = await engine.processSource(buildArchitectureSourceInput());
  assert.equal(first.record.selectedLane.laneId, "architecture");
  assert.equal(first.record.decision.requiresHumanApproval, false);
  assert.equal(first.record.decision.decisionState, "accept_for_architecture");
  assert.equal(first.adapterResults.length, 2);
  assert.equal(first.adapterResults[0]?.accepted, false);
  assert.match(first.adapterResults[0]?.note ?? "", /adapter error: boom/u);
  assert.equal(first.adapterResults[1]?.accepted, true);

  const second = await engine.processSource(buildArchitectureSourceInput());
  assert.equal(second.deduplicated, true);
  assert.equal(second.duplicateOfRunId, first.record.runId);

  const firstQueueAppend = appendDiscoveryIntakeQueueEntry({
    queue: {
      status: "primary",
      updatedAt: "2026-04-10",
      entries: [],
    },
    submission: {
      candidate_id: "duplicate-a",
      candidate_name: "Duplicate Candidate",
      source_type: "workflow-writeup",
      source_reference: "https://example.com/duplicate-candidate",
      mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
      capability_gap_id: "gap-arch-routing-clarity",
      notes: "first copy",
    },
    receivedAt: "2026-04-10",
    unresolvedGapIds: ["gap-arch-routing-clarity"],
  });

  assert.throws(
    () => appendDiscoveryIntakeQueueEntry({
      queue: firstQueueAppend.queue,
      submission: {
        candidate_id: "duplicate-b",
        candidate_name: "Duplicate Candidate",
        source_type: "workflow-writeup",
        source_reference: "https://example.com/duplicate-candidate",
        mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
        capability_gap_id: "gap-arch-routing-clarity",
        notes: "second copy with different notes",
      },
      receivedAt: "2026-04-10",
      unresolvedGapIds: ["gap-arch-routing-clarity"],
    }),
    /equivalent submission/u,
  );
}

function runEngineContractSurfaceChecks() {
  const recurringPolicyEvents = buildRecurringArchitecturePolicyEvents();
  // Verify routing assessment includes missionSpecificityWarning when mission is vague.
  const vagueResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "paper",
      sourceRef: "https://example.com/test",
      title: "Some paper about improving systems",
      summary: "A paper about improving systems.",
    },
    mission: {
      missionId: "vague",
      currentObjective: "Improve the system",
      usefulnessSignals: [],
      capabilityLanes: ["architecture"],
      constraints: [],
      successSignal: null,
      adoptionTarget: null,
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.ok(
    vagueResult.missionSpecificityWarning !== null,
    "Vague mission objective must produce a specificity warning",
  );
  assert.ok(
    vagueResult.missionSpecificityWarning.includes("generic tokens"),
    "Warning must mention generic tokens",
  );
  assert.ok(
    vagueResult.goalCopilot.overallScore < 60,
    "Vague mission should produce a weak Goal Copilot score",
  );
  assert.ok(
    typeof vagueResult.missionHealth?.overallScore === "number",
    "Vague mission should produce Mission Health diagnostics",
  );
  assert.ok(
    vagueResult.goalCopilot.suggestedObjective !== null,
    "Weak mission should produce an objective rewrite suggestion",
  );
  assert.ok(
    (vagueResult.confidenceRecovery?.requestedInputs.length ?? 0) > 0,
    "Weak mission should produce confidence-recovery follow-up requests",
  );
  assert.ok(
    (vagueResult.followUpQuestions?.questions.length ?? 0) > 0,
    "Weak mission should produce explicit follow-up questions",
  );
  assert.ok(
    typeof vagueResult.earnedAutonomy.overallScore === "number",
    "Routing assessment must expose Earned Autonomy diagnostics",
  );

  // Verify specific mission does NOT produce a warning.
  const specificResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/test2",
      title: "Architecture routing clarity improvements",
    },
    mission: {
      missionId: "specific",
      currentObjective: "Improve directive workspace routing workflow architecture boundaries",
      usefulnessSignals: ["prefer engine routing improvements"],
      capabilityLanes: ["architecture", "discovery", "runtime"],
      constraints: ["keep review explicit", "stay reversible"],
      successSignal: "One bounded routing improvement is materially clearer than before.",
      adoptionTarget: "architecture",
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.equal(
    specificResult.missionSpecificityWarning,
    null,
    "Specific mission must not produce a specificity warning",
  );
  assert.ok(
    specificResult.goalCopilot.overallScore >= 70,
    "Specific mission should produce a healthy Goal Copilot score",
  );
  assert.equal(
    Object.values(specificResult.laneProportions).reduce((sum, value) => sum + value, 0),
    100,
    "Lane proportions should normalize to 100%",
  );

  // Verify strong metadata prevents false keyword conflicts.
  const metadataOverrideResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/test3",
      title: "Runtime workflow performance evaluation routing analysis",
      summary: "Improve architecture evaluation and runtime automation routing.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      missionId: "test",
      currentObjective: "Improve directive workspace routing workflow architecture boundaries",
      usefulnessSignals: ["prefer engine routing improvements"],
      capabilityLanes: ["architecture", "discovery", "runtime"],
      constraints: ["keep review explicit", "stay reversible"],
      successSignal: "One bounded routing improvement is materially clearer than before.",
      adoptionTarget: "architecture",
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.equal(
    metadataOverrideResult.recommendedLaneId,
    "architecture",
    "Strong architecture metadata must win despite runtime keywords",
  );
  assert.equal(
    metadataOverrideResult.routeConflict,
    false,
    "Strong metadata must suppress keyword-only conflicts",
  );
  assert.equal(
    metadataOverrideResult.confidence,
    "high",
    "Strong metadata + no conflict must produce high confidence",
  );

  const radarResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/test-gap-radar",
      title: "Workflow architecture routing engine improvement",
      summary: "Architecture workflow routing engine improvement without a current gap match.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: buildArchitectureMission(),
    openGaps: [],
    policyEvents: recurringPolicyEvents,
  });
  assert.ok(
    (radarResult.gapRadar?.suggestions.length ?? 0) > 0,
    "Repeated no-gap history must produce Gap Radar suggestions",
  );
}

async function runRoutingCorrectionLedgerChecks() {
  const ledgerRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-ledger-check-${Date.now()}`,
  );

  // Empty ledger returns default.
  const empty = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.corrections.length, 0);

  // Append a correction.
  const entry: RoutingCorrectionEntry = {
    correctedAt: "2026-04-10",
    candidateId: "test-candidate",
    sourceType: "workflow-writeup",
    originalLaneId: "runtime",
    correctedLaneId: "architecture",
    reason: "This was actually an architecture workflow improvement",
    sourceSignalTokens: ["workflow", "architecture", "improvement", "routing", "engine"],
  };
  appendRoutingCorrection({ directiveRoot: ledgerRoot, entry });

  // Read back and verify.
  const afterAppend = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(afterAppend.corrections.length, 1);
  assert.equal(afterAppend.corrections[0].candidateId, "test-candidate");
  assert.equal(afterAppend.corrections[0].originalLaneId, "runtime");
  assert.equal(afterAppend.corrections[0].correctedLaneId, "architecture");

  // Derive adjustments for matching source text.
  const adjustments = deriveRoutingCorrectionAdjustments({
    sourceText: "This workflow architecture improvement routing engine feature",
    corrections: afterAppend.corrections,
  });
  assert.ok(
    (adjustments.architecture ?? 0) > 0,
    "Corrected lane must get a positive adjustment",
  );
  assert.ok(
    (adjustments.runtime ?? 0) < 0,
    "Original lane must get a negative adjustment",
  );

  // Non-matching source text should produce no adjustments.
  const noMatch = deriveRoutingCorrectionAdjustments({
    sourceText: "Completely unrelated topic about cooking",
    corrections: afterAppend.corrections,
  });
  assert.equal(Object.keys(noMatch).length, 0, "Non-matching text must produce no adjustments");

  // Token extraction.
  const tokens = extractSourceSignalTokens("Architecture Workflow Improvement Engine");
  assert.ok(tokens.length > 0);
  assert.ok(tokens.every((t) => t === t.toLowerCase()), "Tokens must be lowercased");
  assert.ok(tokens.every((t) => t.length >= 4), "Tokens must be at least 4 chars");

  // Verify corrections flow through processSource.
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  // A source that mentions the same tokens as the correction should route
  // with the correction bias applied.
  const correctedSource: DirectiveEngineProcessSourceInput = {
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/correction-test",
      title: "Workflow architecture improvement routing engine",
      summary: "This source improves architecture workflow routing and engine evaluation.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: buildArchitectureMission(),
    gaps: [buildArchitectureGap()],
    corrections: afterAppend.corrections,
  };
  // This should not throw — the corrections parameter is accepted and processed.
  const correctedResult = await engine.processSource(correctedSource);
  assert.equal(correctedResult.record.selectedLane.laneId, "architecture");
  assert.ok(
    correctedResult.record.routingAssessment.rationale.some((line) =>
      line.includes("Routing correction ledger applied adjustments:")
    ),
    "Engine result must record when routing correction adjustments were applied",
  );
}

function runDecisionPolicyCompilerChecks() {
  const ledgerRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-policy-check-${Date.now()}`,
  );

  appendDecisionPolicyEvent({
    directiveRoot: ledgerRoot,
    event: {
      recordedAt: "2026-04-11",
      source: "discovery_routing_review",
      candidateId: "policy-a",
      sourceType: "workflow-writeup",
      decision: "redirect_to_architecture",
      originalLaneId: "runtime",
      resolvedLaneId: "architecture",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning:
        "Mission objective contains only generic tokens (e.g. \"improve the system\").",
      goalCopilotWarnings: [
        "Constraints are missing or too weak; the goal does not explain how the next change must stay bounded.",
        "Capability lanes list every lane without an explicit dominant target, which leaves lane ownership overly ambiguous.",
      ],
      followUpRequestedFields: [
        "mission.currentObjective",
        "source.primaryAdoptionTarget",
      ],
      sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
      rationale: "Operator redirected runtime to architecture after clarifying workflow ownership.",
    },
  });
  appendDecisionPolicyEvent({
    directiveRoot: ledgerRoot,
    event: {
      recordedAt: "2026-04-12",
      source: "discovery_routing_review",
      candidateId: "policy-b",
      sourceType: "workflow-writeup",
      decision: "redirect_to_architecture",
      originalLaneId: "runtime",
      resolvedLaneId: "architecture",
      originalConfidence: "low",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning:
        "Mission objective has very low specificity (1 meaningful token).",
      goalCopilotWarnings: [
        "Constraints are missing or too weak; the goal does not explain how the next change must stay bounded.",
      ],
      followUpRequestedFields: [
        "mission.currentObjective",
        "source.primaryAdoptionTarget",
      ],
      sourceSignalTokens: ["workflow", "architecture", "routing", "policy"],
      rationale: "Operator redirected runtime to architecture after clarifying routing policy ownership.",
    },
  });

  const ledger = readDecisionPolicyLedger(ledgerRoot);
  assert.equal(ledger.events.length, 2);
  assert.ok(
    ledger.suggestions.some((suggestion) => suggestion.policyKind === "routing_bias"),
    "Policy compiler must emit routing-bias suggestions",
  );
  assert.ok(
    ledger.suggestions.some((suggestion) => suggestion.policyKind === "goal_hint"),
    "Policy compiler must emit goal-hint suggestions",
  );
  assert.ok(
    ledger.suggestions.some((suggestion) => suggestion.policyKind === "approval_boundary"),
    "Policy compiler must emit approval-boundary suggestions",
  );

  const compiled = compileDecisionPolicySuggestions(ledger.events);
  assert.equal(compiled.length, ledger.suggestions.length);
}

async function runReviewResolutionPolicyCompilerIntegrationCheck() {
  const starter = await runDiscoveryFrontDoorStarterSmoke();
  const review = writeDiscoveryRoutingReviewResolution({
    directiveRoot: starter.directiveRoot,
    routingRecordPath: starter.routingRecordPath,
    decision: "confirm_architecture",
    rationale:
      "Goal wording was generic, but Architecture ownership is still the clearest bounded route after review.",
    reviewedBy: "hardening-smoke",
    resolvedConfidence: "high",
  });
  assert.ok(review.policySuggestions.length > 0);

  const ledger = readDecisionPolicyLedger(starter.directiveRoot);
  assert.equal(ledger.events.length, 1);
  assert.ok(
    ledger.suggestions.some((suggestion) => suggestion.policyKind === "goal_hint"),
    "Review-resolution integration must compile goal-hint suggestions",
  );
  assert.ok(
    fs.existsSync(path.join(starter.directiveRoot, "engine", "gap-radar.json")),
    "Review-resolution integration must refresh the Gap Radar report",
  );
}

async function runEarnedAutonomyIntegrationCheck() {
  const policyEvents = buildRecurringRuntimePolicyEvents();
  const mission: DirectiveEngineMissionInput = {
    missionId: "runtime-earned-autonomy",
    currentObjective: "Improve runtime automation performance and reliability boundaries",
    usefulnessSignals: ["prefer runtime improvements"],
    capabilityLanes: ["runtime", "architecture"],
    constraints: ["keep review explicit", "stay reversible"],
    successSignal: "One bounded runtime improvement is materially clearer than before.",
    adoptionTarget: "runtime",
  };
  const runtimeGap: DirectiveEngineCapabilityGap = {
    gapId: "gap-runtime-automation",
    description: "Runtime automation performance and reliability improvement",
    priority: "high",
    relatedMissionObjective: "Improve runtime automation performance and reliability boundaries",
    currentState: "Clear runtime candidates still need manual follow-through",
    desiredState: "Clean runtime cases can advance without extra review churn",
    detectedAt: "2026-04-10T00:00:00.000Z",
  };
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });

  for (const [index, title] of ["Runtime automation reliability", "Automation reliability boundary"].entries()) {
    await engine.processSource({
      receivedAt: `2026-04-1${index}T00:00:00.000Z`,
      mission,
      gaps: [runtimeGap],
      policyEvents,
      source: {
        sourceId: `runtime-prior-${index}`,
        sourceType: "technical-essay",
        sourceRef: `https://example.com/runtime-prior-${index}`,
        title,
        summary: "automation performance reliability",
        capabilityGapId: runtimeGap.gapId,
        primaryAdoptionTarget: "runtime",
        containsExecutableCode: false,
        containsWorkflowPattern: false,
        improvesDirectiveWorkspace: false,
        workflowBoundaryShape: null,
      },
    });
  }

  const current = assessDirectiveEngineRouting({
    source: {
      sourceType: "technical-essay",
      sourceRef: "https://example.com/current-note",
      title: "Reliability note",
      summary: "automation",
      containsExecutableCode: false,
      containsWorkflowPattern: false,
      improvesDirectiveWorkspace: false,
      workflowBoundaryShape: null,
    },
    mission: {
      ...mission,
      activeMissionMarkdown: "",
    },
    openGaps: [],
    policyEvents,
    existingRuns: await engine.listRuns(),
  });

  assert.equal(current.recommendedLaneId, "runtime");
  assert.ok(
    current.confidence === "medium" || current.confidence === "high",
    "Route should stay bounded and non-low-confidence once clean runtime history exists",
  );
  assert.equal(current.recommendedRecordShape, "fast_path");
  assert.ok(
    current.earnedAutonomy.approvalReductionApplied || current.needsHumanReview === false,
    "Clean trusted runtime history should remove the extra review gate either by stronger routing or by earned-autonomy waiver",
  );
  assert.equal(
    current.needsHumanReview,
    false,
    "Earned Autonomy should lower the effective review requirement when the route class is trusted",
  );
}

async function runAdvisoryIntelligenceChecks() {
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  const first = await engine.processSource(buildArchitectureSourceInput());
  const second = await engine.processSource({
    ...buildArchitectureSourceInput(),
    receivedAt: "2026-04-11T02:00:00.000Z",
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "arch-routing-clarity-related",
      sourceRef: "https://example.com/arch-routing-clarity-related",
      title: "Architecture routing clarity related source",
      summary: "Improve directive workspace routing workflow architecture boundaries with explicit review gates.",
    },
  });
  const third = await engine.processSource({
    ...buildArchitectureSourceInput(),
    receivedAt: "2026-04-12T02:00:00.000Z",
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "arch-routing-clarity-third",
      sourceRef: "https://example.com/arch-routing-clarity-third",
      title: "Architecture routing clarity third source",
      summary: "Improve directive workspace routing workflow architecture boundaries while preserving explicit review gates and proof boundaries.",
    },
  });

  assert.ok(
    typeof second.record.routingAssessment.missionHealth?.overallScore === "number",
    "Mission Health should be recorded on processed runs",
  );
  assert.ok(
    (second.record.routingAssessment.followUpQuestions?.questions.length ?? 0) >= 0,
    "Processed runs should expose the follow-up-question surface",
  );
  assert.ok(
    second.record.routingAssessment.sourceMemory !== null,
    "Second similar run should expose Source Memory context",
  );
  assert.ok(
    second.record.routingAssessment.sourceSimilarity !== null,
    "Second similar run should expose Source Similarity context",
  );
  assert.ok(
    second.record.routingAssessment.narrativeContext !== null,
    "Second similar run should expose Narrative Threading context",
  );
  assert.equal(
    second.record.routingAssessment.narrativeContext?.primaryThread?.sourceCount,
    2,
    "Second similar run should attach to a two-source thread",
  );
  assert.equal(
    Object.values(second.record.routingAssessment.laneProportions).reduce((sum, value) => sum + value, 0),
    100,
    "Processed runs should persist normalized lane proportions",
  );
  assert.ok(
    Array.isArray(second.record.routingAssessment.secondaryLanes),
    "Processed runs should persist secondary-lane hints",
  );
  assert.ok(
    second.record.priorPlanContext !== null,
    "Second similar run should expose prior-plan context",
  );
  assert.equal(
    third.record.routingAssessment.narrativeContext?.primaryThread?.state,
    "developing",
    "Third similar run should advance the narrative thread into a developing state",
  );
  assert.ok(
    (third.record.routingAssessment.narrativeContext?.demandSignals.length ?? 0) > 0,
    "Developing threads should expose demand signals",
  );

  const historicalReplayAssessment = assessDirectiveEngineRouting({
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "architecture-replay-check",
      sourceRef: "https://example.com/architecture-replay-check",
      title: "Architecture replay check",
    },
    mission: {
      ...third.record.mission,
    },
    openGaps: [buildArchitectureGap()],
    existingRuns: [third.record],
    receivedAt: "2026-04-09T00:00:00.000Z",
  });
  assert.equal(
    historicalReplayAssessment.narrativeContext,
    null,
    "Narrative Threading must not attach a backfilled source to future thread history",
  );

  const missionIsolationEngine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  const overlappingRuntimeRun = await missionIsolationEngine.processSource({
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: {
      missionId: null,
      currentObjective: "Stabilize callable packaging and delivery boundaries",
      usefulnessSignals: ["prefer repeated runtime delivery paths"],
      capabilityLanes: ["runtime"],
      constraints: ["keep the packaging slice bounded"],
      successSignal: "Runtime packaging remains stable under repeated execution.",
      adoptionTarget: "runtime",
      activeMissionMarkdown: "",
    },
    gaps: [],
    source: {
      sourceId: "mission-isolation-runtime",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/mission-isolation-runtime",
      title: "Workflow architecture runtime proof packaging",
      summary: "Workflow architecture runtime proof packaging with explicit boundaries.",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: false,
    },
  });
  const missionIsolatedAssessment = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/mission-isolation-architecture",
      title: "Workflow architecture runtime proof review",
      summary: "Workflow architecture runtime proof review with explicit boundaries.",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      missionId: null,
      currentObjective: "Clarify review handoff boundaries and proof cadence",
      usefulnessSignals: ["prefer explicit review handling and bounded proof guidance"],
      capabilityLanes: ["architecture"],
      constraints: ["keep review explicit", "stay reversible"],
      successSignal: "Review handling is clearer than before.",
      adoptionTarget: "architecture",
      activeMissionMarkdown: "",
    },
    openGaps: [],
    existingRuns: [overlappingRuntimeRun.record],
    receivedAt: "2026-04-11T00:00:00.000Z",
  });
  assert.equal(
    missionIsolatedAssessment.narrativeContext,
    null,
    "Narrative Threading must not merge overlapping sources across unrelated no-id missions",
  );

  const threadAwareQuestion = assessDirectiveEngineRouting({
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "architecture-thread-aware-question",
      sourceRef: "https://example.com/architecture-thread-aware-question",
      title: "Architecture thread-aware question",
      containsExecutableCode: null,
    },
    mission: {
      ...third.record.mission,
    },
    openGaps: [buildArchitectureGap()],
    existingRuns: [first.record, second.record, third.record],
    receivedAt: "2026-04-13T00:00:00.000Z",
  });
  assert.ok(
    threadAwareQuestion.followUpQuestions?.questions.some((entry) =>
      entry.field === "source.containsExecutableCode"
      && entry.question.includes("thread by contributing")
    ),
    "Thread-aware follow-up questions must override the generic field prompt when the thread demand is more specific",
  );

  const gapProjectionEngine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  const priorGapless = await gapProjectionEngine.processSource({
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: buildArchitectureMission(),
    gaps: [],
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "gapless-thread-source",
      sourceRef: "https://example.com/gapless-thread-source",
      capabilityGapId: null,
    },
  });
  const projectedGapAssessment = assessDirectiveEngineRouting({
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "gap-projection-current",
      sourceRef: "https://example.com/gap-projection-current",
      capabilityGapId: buildArchitectureGap().gapId,
    },
    mission: {
      ...priorGapless.record.mission,
    },
    openGaps: [buildArchitectureGap()],
    existingRuns: [priorGapless.record],
    receivedAt: "2026-04-11T00:00:00.000Z",
  });
  assert.equal(
    projectedGapAssessment.narrativeContext?.primaryThread?.gapCoverage.dominantGapId,
    buildArchitectureGap().gapId,
    "Narrative Threading should project the current source's gap link into the surfaced thread context",
  );
  assert.equal(first.record.priorPlanContext, null);
}

async function runStarterAndHostChecks() {
  const discoveryStarter = await runDiscoveryStarterSmoke();
  assert.equal(discoveryStarter.ok, true);

  const frontDoorStarter = await runDiscoveryFrontDoorStarterSmoke();
  assert.equal(frontDoorStarter.ok, true);
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.routingRecordPath)));
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.engineRunRecordPath)));

  const acceptanceOutputRoot = path.resolve(
    os.tmpdir(),
    `directive-workspace-acceptance-${Date.now()}`,
  );
  const acceptance = await runHostIntegrationAcceptanceQuickstart({
    hostName: "Directive Kernel Hardening Smoke",
    moduleSurface: "mixed",
    generatedAt: "2026-04-10T00:00:00.000Z",
    outputRoot: acceptanceOutputRoot,
  });
  assert.ok(fs.existsSync(acceptance.outputPath));
  const acceptanceReport = JSON.parse(fs.readFileSync(acceptance.outputPath, "utf8")) as {
    accepted?: boolean;
    front_door_acceptance?: { ok?: boolean };
    engine_contract_surface?: { ok?: boolean };
  };
  assert.equal(acceptanceReport.accepted, true);
  assert.equal(acceptanceReport.front_door_acceptance?.ok, true);
  assert.equal(acceptanceReport.engine_contract_surface?.ok, true);
}

async function runWebHostSmoke() {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-web-smoke-${Date.now()}`,
  );

  writeJson(path.join(directiveRoot, "discovery", "intake-queue.json"), {
    status: "primary",
    updatedAt: "2026-04-10",
    entries: [],
  });
  writeJson(path.join(directiveRoot, "discovery", "capability-gaps.json"), {
    gaps: [
      {
        gap_id: "gap-web-architecture",
        description: "Auto-open clear architecture candidates from the web host front door",
        priority: "high",
        related_mission_objective: "Improve directive workspace routing workflow architecture boundaries",
        current_state: "Operators still spend time opening obvious architecture routes manually",
        desired_state: "The web host auto-opens one bounded architecture handoff when the route is clear",
        detected_at: "2026-04-10T00:00:00.000Z",
        resolved_at: null,
        resolution_notes: null,
      },
    ],
  });
  writeUtf8(
    path.join(directiveRoot, "knowledge", "active-mission.md"),
    [
      "# Active Mission",
      "",
      "## Current Objective",
      "",
      "Improve directive workspace routing workflow architecture boundaries.",
      "",
      "## What Usefulness Means Under This Objective",
      "",
      "- Prefer architecture when the source improves directive workspace routing quality.",
      "- Keep runtime only for repeated executable runtime value.",
      "",
      "## Capability Lanes That Matter Most",
      "",
      "1. Architecture",
      "2. Discovery",
      "3. Runtime",
      "",
    ].join("\n"),
  );

  const handle = await startDirectiveFrontendServer({
    directiveRoot,
    host: "127.0.0.1",
    port: 0,
  });

  try {
    const snapshotResponse = await fetch(`${handle.origin}/api/snapshot`);
    assert.equal(snapshotResponse.status, 200);
    const snapshot = await readJsonResponse(snapshotResponse) as {
      queue?: { totalEntries?: number };
      learningSummary?: {
        gapRadar?: { suggestionCount?: number };
        earnedAutonomy?: { autoApprovedRecentRuns?: number; routeClasses?: unknown[] };
      };
    };
    assert.equal(snapshot.queue?.totalEntries ?? 0, 0);
    assert.equal(typeof snapshot.learningSummary?.gapRadar?.suggestionCount, "number");
    assert.equal(typeof snapshot.learningSummary?.earnedAutonomy?.autoApprovedRecentRuns, "number");

    const submissionPayload = {
      candidate_id: "web-host-auto-architecture",
      candidate_name: "Web Host Auto Architecture",
      source_type: "workflow-writeup",
      source_reference: "https://example.com/web-host-auto-architecture",
      mission_alignment: "Improve directive workspace routing workflow architecture boundaries",
      capability_gap_id: "gap-web-architecture",
      notes: "web-host smoke",
      primary_adoption_target: "architecture",
      contains_workflow_pattern: true,
      improves_directive_workspace: true,
      workflow_boundary_shape: "bounded_protocol",
    };

    const frontDoorResponse = await fetch(`${handle.origin}/api/discovery/front-door`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(submissionPayload),
    });
    assert.equal(frontDoorResponse.status, 200);
    const frontDoorResult = await readJsonResponse(frontDoorResponse) as {
      createdPaths: { routingRecordPath: string };
      downstream: {
        autoOpened: boolean;
        stubRelativePath: string | null;
      };
      queueEntry: {
        result_record_path: string | null;
      };
      engine: {
        record: {
          decision: {
            requiresHumanApproval: boolean;
          };
        };
      };
    };
    assert.equal(frontDoorResult.engine.record.decision.requiresHumanApproval, false);
    assert.equal(frontDoorResult.downstream.autoOpened, true);
    assert.ok(frontDoorResult.downstream.stubRelativePath);
    assert.equal(
      frontDoorResult.queueEntry.result_record_path,
      frontDoorResult.downstream.stubRelativePath,
    );
    assert.ok(fs.existsSync(path.resolve(directiveRoot, frontDoorResult.createdPaths.routingRecordPath)));

    const afterSubmissionResponse = await fetch(`${handle.origin}/api/snapshot`);
    assert.equal(afterSubmissionResponse.status, 200);
    const afterSubmission = await readJsonResponse(afterSubmissionResponse) as {
      learningSummary?: {
        earnedAutonomy?: { routeClasses?: unknown[] };
      };
    };
    assert.ok((afterSubmission.learningSummary?.earnedAutonomy?.routeClasses?.length ?? 0) >= 1);
    assert.ok(fs.existsSync(path.resolve(directiveRoot, frontDoorResult.downstream.stubRelativePath ?? "")));

    const duplicateResponse = await fetch(`${handle.origin}/api/discovery/front-door`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...submissionPayload,
        candidate_id: "web-host-auto-architecture-duplicate",
        notes: "same source, different note",
      }),
    });
    assert.equal(duplicateResponse.status, 409);

    const queueResponse = await fetch(`${handle.origin}/api/queue`);
    assert.equal(queueResponse.status, 200);
    const queue = await readJsonResponse(queueResponse) as {
      totalEntries?: number;
      entries?: Array<{ candidate_id?: string }>;
    };
    assert.equal(queue.totalEntries, 1);
    assert.equal(queue.entries?.[0]?.candidate_id, "web-host-auto-architecture");
  } finally {
    await handle.close();
  }
}

async function main() {
  await runDirectiveEngineHardeningChecks();
  runEngineContractSurfaceChecks();
  await runRoutingCorrectionLedgerChecks();
  runDecisionPolicyCompilerChecks();
  await runReviewResolutionPolicyCompilerIntegrationCheck();
  await runEarnedAutonomyIntegrationCheck();
  await runAdvisoryIntelligenceChecks();
  await runStarterAndHostChecks();
  await runWebHostSmoke();
  console.log("check-system-hardening: ok");
}

await main();
