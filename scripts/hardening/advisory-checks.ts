import assert from "node:assert/strict";

import {
  DirectiveEngine,
  assessDirectiveEngineRouting,
  buildDirectiveRunSourceTokenMap,
  buildDirectiveSourceNarrativeThreads,
  createDirectiveSourceMemorySnapshot,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  deriveDirectivePriorPlanContext,
  deriveDirectiveSourceNarrativeContext,
  deriveDirectiveSourceSimilarityAssessment,
  flattenSourceText,
} from "../../engine/index.ts";
import {
  buildArchitectureGap,
  buildArchitectureMission,
  buildArchitectureSourceInput,
} from "./support.ts";

export async function runAdvisoryIntelligenceChecks() {
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

  assert.ok(typeof second.record.routingAssessment.missionHealth?.overallScore === "number");
  assert.ok((second.record.routingAssessment.followUpQuestions?.questions.length ?? 0) >= 0);
  assert.ok(second.record.routingAssessment.sourceMemory !== null);
  assert.ok(second.record.routingAssessment.sourceSimilarity !== null);
  assert.ok(second.record.routingAssessment.narrativeContext !== null);
  const precomputedSourceTokens = buildDirectiveRunSourceTokenMap([first.record]);
  const sourceMemoryWithPrecomputedTokens = createDirectiveSourceMemorySnapshot({
    runs: [first.record],
    precomputedSourceTokens,
  });
  const sourceMemoryWithoutPrecomputedTokens = createDirectiveSourceMemorySnapshot({
    runs: [first.record],
  });
  assert.deepEqual(
    {
      ...sourceMemoryWithPrecomputedTokens,
      generatedAt: sourceMemoryWithoutPrecomputedTokens.generatedAt,
    },
    sourceMemoryWithoutPrecomputedTokens,
  );
  assert.deepEqual(
    deriveDirectiveSourceSimilarityAssessment({
      source: second.record.source,
      sourceText: flattenSourceText(second.record.source),
      existingRuns: [first.record],
      recommendedLaneId: second.record.selectedLane.laneId,
      precomputedSourceTokens,
    }),
    deriveDirectiveSourceSimilarityAssessment({
      source: second.record.source,
      sourceText: flattenSourceText(second.record.source),
      existingRuns: [first.record],
      recommendedLaneId: second.record.selectedLane.laneId,
    }),
  );
  assert.deepEqual(
    deriveDirectivePriorPlanContext({
      source: second.record.source,
      recommendedLaneId: second.record.selectedLane.laneId,
      existingRuns: [first.record],
      precomputedSourceTokens,
    }),
    deriveDirectivePriorPlanContext({
      source: second.record.source,
      recommendedLaneId: second.record.selectedLane.laneId,
      existingRuns: [first.record],
    }),
  );
  const prebuiltNarrativeThreads = buildDirectiveSourceNarrativeThreads({
    runs: [first.record],
    mission: second.record.mission,
  });
  const prebuiltNarrativeContext = deriveDirectiveSourceNarrativeContext({
    source: second.record.source,
    sourceText: [
      second.record.source.title,
      second.record.source.summary ?? "",
      second.record.source.sourceRef,
      second.record.source.missionAlignmentHint ?? "",
      second.record.source.capabilityGapId ?? "",
      second.record.source.primaryAdoptionTarget ?? "",
      ...(second.record.source.notes ?? []),
    ]
      .filter(Boolean)
      .join(" "),
    mission: second.record.mission,
    existingRuns: [first.record],
    prebuiltThreads: prebuiltNarrativeThreads,
    provisionalLaneId: second.record.selectedLane.laneId,
    currentMatchedGapId:
      second.record.routingAssessment.matchedGapId
      ?? second.record.source.capabilityGapId
      ?? null,
    receivedAt: second.record.receivedAt,
  });
  const directNarrativeContext = deriveDirectiveSourceNarrativeContext({
    source: second.record.source,
    sourceText: [
      second.record.source.title,
      second.record.source.summary ?? "",
      second.record.source.sourceRef,
      second.record.source.missionAlignmentHint ?? "",
      second.record.source.capabilityGapId ?? "",
      second.record.source.primaryAdoptionTarget ?? "",
      ...(second.record.source.notes ?? []),
    ]
      .filter(Boolean)
      .join(" "),
    mission: second.record.mission,
    existingRuns: [first.record],
    provisionalLaneId: second.record.selectedLane.laneId,
    currentMatchedGapId:
      second.record.routingAssessment.matchedGapId
      ?? second.record.source.capabilityGapId
      ?? null,
    receivedAt: second.record.receivedAt,
  });
  assert.deepEqual(prebuiltNarrativeContext, directNarrativeContext);
  assert.equal(second.record.routingAssessment.narrativeContext?.primaryThread?.sourceCount, 2);
  assert.equal(
    Object.values(second.record.routingAssessment.laneProportions).reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.ok(Array.isArray(second.record.routingAssessment.secondaryLanes));
  assert.ok(second.record.priorPlanContext !== null);
  assert.ok(second.record.planQualitySignal !== null);
  assert.ok(second.record.planQualitySignal?.overallPlanQuality !== "unknown");
  assert.ok(second.record.executablePlanState !== null);
  assert.ok(
    second.record.executablePlanState?.actions.some((action) => action.plan === "proof"),
  );
  assert.equal(third.record.routingAssessment.narrativeContext?.primaryThread?.state, "developing");
  assert.ok((third.record.routingAssessment.narrativeContext?.demandSignals.length ?? 0) > 0);
  assert.ok((third.record.narrativeActions?.length ?? 0) > 0);
  assert.ok(
    third.record.routingAssessment.digest.primaryConcern?.kind === "narrative_action"
      || third.record.routingAssessment.digest.secondaryConcerns.some((entry) =>
        entry.kind === "narrative_action"
      ),
  );
  assert.ok(third.record.planQualitySignal?.rationale.length);

  const tieBreakEngine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: createMemoryDirectiveEngineStore(),
  });
  const tieBreakMission = buildArchitectureMission();
  await tieBreakEngine.processSource({
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: tieBreakMission,
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "thread-tie-a",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/thread-tie-a",
      title: "Alpha Beta Gamma Architecture",
      summary: "Alpha beta gamma architecture workflow boundary.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
  });
  await tieBreakEngine.processSource({
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: tieBreakMission,
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "thread-tie-b",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/thread-tie-b",
      title: "Delta Epsilon Zeta Architecture",
      summary: "Delta epsilon zeta architecture workflow boundary.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
  });
  const tieBreakAssessment = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/thread-tie-current",
      title: "Alpha Beta Gamma Delta Epsilon Zeta Bridge",
      summary: "Alpha beta gamma delta epsilon zeta architecture workflow boundary.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      ...tieBreakMission,
      activeMissionMarkdown: "",
    },
    openGaps: [buildArchitectureGap()],
    existingRuns: await tieBreakEngine.listRuns(),
    receivedAt: "2026-04-11T00:00:00.000Z",
  });
  assert.equal(
    tieBreakAssessment.narrativeContext?.primaryThread?.threadId,
    "thread-1",
  );

  const progressedThread = await engine.updatePlanProgress({
    runId: third.record.runId,
    at: "2026-04-12T03:00:00.000Z",
    updates: [
      {
        plan: "proof",
        itemType: "objective",
        status: "completed",
      },
    ],
  });
  const proofFollowUpAction = progressedThread.narrativeActions?.find((action) =>
    action.actionKind === "proof_follow_up_request"
  );
  assert.ok(
    proofFollowUpAction?.suggestedNextStep.includes(
      progressedThread.structuredProofPlan?.requiredEvidence[0]?.value ?? "",
    ) ?? false,
  );
  assert.ok((progressedThread.planQualitySignal?.proofGateCompletion ?? 0) > 0);
  assert.equal(progressedThread.executablePlanState?.proofState.objectiveState, "defined");

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
  assert.equal(historicalReplayAssessment.narrativeContext, null);

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
  assert.equal(missionIsolatedAssessment.narrativeContext, null);

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
  );
  assert.equal(first.record.priorPlanContext, null);
}
