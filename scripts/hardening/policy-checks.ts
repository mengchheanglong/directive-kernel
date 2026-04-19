import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DirectiveEngine,
  appendDecisionPolicyEvent,
  appendRoutingCorrection,
  assessDirectiveEngineRouting,
  compileDecisionPolicySuggestions,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  deriveDirectiveRoutingOutcomes,
  deriveDirectiveRoutingQualityAssessment,
  extractSourceSignalTokens,
  readDecisionPolicyLedger,
  readRoutingCorrectionLedger,
  deriveRoutingCorrectionAdjustments,
  type DirectiveEngineCapabilityGap,
  type DirectiveEngineMissionInput,
  type DirectiveEngineProcessSourceInput,
  type RoutingCorrectionEntry,
} from "../../engine/index.ts";
import {
  readSourceSignalTokenCacheStats,
  resetSourceSignalTokenCache,
} from "../../engine/routing/routing-correction-ledger.ts";
import { writeDiscoveryRoutingReviewResolution } from "../../discovery/lib/discovery-routing-review-resolution.ts";
import {
  runDiscoveryFrontDoorStarterSmoke,
} from "../../hosts/integration-kit/starter/discovery-front-door-adapter.smoke.template.ts";
import {
  buildArchitectureGap,
  buildArchitectureMission,
  buildArchitectureSourceInput,
  buildRecurringArchitecturePolicyEvents,
  buildRecurringRuntimePolicyEvents,
} from "./support.ts";

export async function runRoutingCorrectionLedgerChecks() {
  const ledgerRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-ledger-check-${Date.now()}`,
  );

  const empty = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(empty.schemaVersion, 1);
  assert.equal(empty.corrections.length, 0);

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

  const afterAppend = readRoutingCorrectionLedger(ledgerRoot);
  assert.equal(afterAppend.corrections.length, 1);
  assert.equal(afterAppend.corrections[0].candidateId, "test-candidate");
  assert.equal(afterAppend.corrections[0].originalLaneId, "runtime");
  assert.equal(afterAppend.corrections[0].correctedLaneId, "architecture");

  const adjustments = deriveRoutingCorrectionAdjustments({
    sourceText: "This workflow architecture improvement routing engine feature",
    corrections: afterAppend.corrections,
  });
  assert.ok((adjustments.architecture ?? 0) > 0);
  assert.ok((adjustments.runtime ?? 0) < 0);

  const noMatch = deriveRoutingCorrectionAdjustments({
    sourceText: "Completely unrelated topic about cooking",
    corrections: afterAppend.corrections,
  });
  assert.equal(Object.keys(noMatch).length, 0);

  const tokens = extractSourceSignalTokens("Architecture Workflow Improvement Engine");
  assert.ok(tokens.length > 0);
  assert.ok(tokens.every((t) => t === t.toLowerCase()));
  assert.ok(tokens.every((t) => t.length >= 4));
  resetSourceSignalTokenCache({ clearCache: true });
  const firstTokenization = extractSourceSignalTokens("Architecture Workflow Improvement Engine");
  const afterFirstStats = readSourceSignalTokenCacheStats();
  assert.equal(afterFirstStats.misses, 1);
  assert.equal(afterFirstStats.hits, 0);
  firstTokenization.push("mutated");
  const secondTokenization = extractSourceSignalTokens("Architecture Workflow Improvement Engine");
  const afterSecondStats = readSourceSignalTokenCacheStats();
  assert.equal(afterSecondStats.misses, 1);
  assert.equal(afterSecondStats.hits, 1);
  assert.ok(!secondTokenization.includes("mutated"));

  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
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
  const correctedResult = await engine.processSource(correctedSource);
  assert.equal(correctedResult.record.selectedLane.laneId, "architecture");
  assert.ok(
    correctedResult.record.routingAssessment.rationale.some((line) =>
      line.includes("Routing correction ledger applied adjustments:")
    ),
  );
}

export async function runOutcomeTrackingChecks() {
  const engine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  const baseInput = buildArchitectureSourceInput();
  const first = await engine.processSource(baseInput);
  const second = await engine.processSource({
    ...baseInput,
    receivedAt: "2026-04-11T00:00:00.000Z",
    source: {
      ...baseInput.source,
      sourceId: "outcome-second",
      sourceRef: "https://example.com/outcome-second",
      title: "Architecture outcome second source",
    },
  });

  const policyEvents = [
    ...buildRecurringArchitecturePolicyEvents(),
    {
      recordedAt: "2026-04-12T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: first.record.candidate.candidateId,
      sourceType: first.record.source.sourceType,
      decision: "confirm_architecture",
      originalLaneId: "architecture",
      resolvedLaneId: "architecture",
      originalConfidence: first.record.routingAssessment.confidence,
      resolvedConfidence: "high",
      originalNeedsHumanReview: first.record.routingAssessment.needsHumanReview,
      resolvedNeedsHumanReview: false,
      matchedGapId: first.record.routingAssessment.matchedGapId,
      missionSpecificityWarning: first.record.routingAssessment.missionSpecificityWarning,
      goalCopilotWarnings: [...first.record.routingAssessment.goalCopilot.warnings],
      followUpRequestedFields: [],
      sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
      rationale: "Outcome tracking confirmation event.",
    },
  ];
  const corrections: RoutingCorrectionEntry[] = [
    {
      correctedAt: "2026-04-12T12:00:00.000Z",
      candidateId: second.record.candidate.candidateId,
      sourceType: second.record.source.sourceType,
      originalLaneId: "architecture",
      correctedLaneId: "runtime",
      reason: "Synthetic correction for outcome tracking coverage.",
      sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
    },
  ];

  const outcomes = deriveDirectiveRoutingOutcomes({
    existingRuns: [first.record, second.record],
    policyEvents,
    corrections,
  });
  assert.equal(outcomes.length, 2);
  assert.equal(
    outcomes.find((outcome) => outcome.runId === first.record.runId)?.operatorAgreed,
    true,
  );
  assert.equal(
    outcomes.find((outcome) => outcome.runId === second.record.runId)?.operatorCorrected,
    true,
  );

  const quality = deriveDirectiveRoutingQualityAssessment({
    routeClass: first.record.routingAssessment.earnedAutonomy.routeClass,
    existingRuns: [first.record, second.record],
    policyEvents,
    corrections,
  });
  assert.ok(quality.overallScore >= 0 && quality.overallScore <= 100);
  assert.equal(quality.resolvedOutcomeCount, 2);
  assert.ok(quality.summary.includes("recorded outcome"));

  const qualityInfluencedAssessment = assessDirectiveEngineRouting({
    source: {
      ...baseInput.source,
      sourceId: "outcome-quality-current",
      sourceRef: "https://example.com/outcome-quality-current",
      title: "Architecture quality current source",
    },
    mission: buildArchitectureMission(),
    openGaps: [buildArchitectureGap()],
    existingRuns: [first.record, second.record],
    policyEvents,
    corrections,
  });
  assert.ok(
    qualityInfluencedAssessment.earnedAutonomy.rationale.some((line) =>
      line.includes("Routing quality is")
    ),
  );
}

export function runDecisionPolicyCompilerChecks() {
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
  assert.ok(ledger.suggestions.some((suggestion) => suggestion.policyKind === "routing_bias"));
  assert.ok(ledger.suggestions.some((suggestion) => suggestion.policyKind === "goal_hint"));
  assert.ok(ledger.suggestions.some((suggestion) => suggestion.policyKind === "approval_boundary"));

  const compiled = compileDecisionPolicySuggestions(ledger.events);
  assert.equal(compiled.length, ledger.suggestions.length);
}

export async function runReviewResolutionPolicyCompilerIntegrationCheck() {
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
  );
  assert.ok(
    fs.existsSync(path.join(starter.directiveRoot, "engine", "gap-radar.json")),
  );
}

export async function runEarnedAutonomyIntegrationCheck() {
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
  assert.ok(current.confidence === "medium" || current.confidence === "high");
  assert.equal(current.recommendedRecordShape, "fast_path");
  assert.ok(
    current.earnedAutonomy.approvalReductionApplied || current.needsHumanReview === false,
  );
  assert.equal(current.needsHumanReview, false);
}
