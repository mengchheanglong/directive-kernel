// Fixtures for the `engine/directive-workspace-lanes.ts` unit test (task 10.2).
//
// Each factory returns a fully-typed planning input that the lane callbacks
// in `engine/directive-workspace-lanes.ts` (and the helpers under
// `engine/planning/lane-planning-defaults.ts`) can consume without throwing.
// Defaults are deliberately plausible — non-empty strings, valid enum values,
// real-looking iso timestamps — so the callbacks exercise their normal code
// paths instead of bailing on missing data.
//
// Overrides apply via shallow `{ ...defaults, ...overrides }` merge per the
// task spec; deeper nested overrides are not part of task 10.2's needs.
//
// The two `buildRoutingAssessment*` factories cover the runtime `planProof`
// branch in `buildRuntimeProofPlan`, which reads
// `routingAssessment.scoreBreakdown.transformationSignal > 0`. The "with"
// variant sets that field to `1`; the "without" variant sets it to `0`.

import type {
  EngineLaneAdaptationPlanningInput,
  EngineLaneDefinition,
  EngineLaneExtractionPlanningInput,
  EngineLaneImprovementPlanningInput,
  EngineLaneIntegrationPlanningInput,
  EngineLanePlanningInput,
  EngineLaneProofPlanningInput,
} from "../../../../engine/lane.ts";
import type {
  EngineAdaptationPlan,
  EngineCapabilityGap,
  EngineExtractionPlan,
  EngineImprovementPlan,
  EngineMissionContext,
  EngineProofPlan,
  EngineRoutingAssessment,
  EngineSourceItem,
} from "../../../../engine/types.ts";

const DEFAULT_RECEIVED_AT = "2024-06-01T12:00:00.000Z" as const;

function buildSource(): EngineSourceItem {
  return {
    sourceId: "fixture-source-1",
    sourceType: "technical-essay",
    sourceRef: "https://example.invalid/fixtures/lane-planning",
    title: "Fixture Source for Lane Planning",
    summary: "A representative source used to drive the lane planning callbacks.",
    notes: [
      "Fixture note one — describes a structural pattern.",
      "Fixture note two — describes an excluded baggage item.",
    ],
    missionAlignmentHint: "Improve directive workspace lane planning coverage.",
    capabilityGapId: "fixture-gap-1",
    primaryAdoptionTarget: "architecture",
    containsExecutableCode: false,
    containsWorkflowPattern: true,
    improvesDirectiveWorkspace: true,
    workflowBoundaryShape: "bounded_protocol",
  };
}

function buildMission(): EngineMissionContext {
  return {
    missionId: "fixture-mission-1",
    currentObjective:
      "Validate that lane planning callbacks return well-formed plans for representative inputs.",
    usefulnessSignals: ["test coverage"],
    capabilityLanes: ["discovery", "architecture", "runtime"],
    constraints: ["no host adapters in the fixture"],
    successSignal: "All lane callbacks return non-empty structural plans.",
    adoptionTarget: "architecture",
    activeMissionMarkdown:
      "# Fixture mission\n\nDrive lane planning callbacks from a hermetic fixture.",
  };
}

function buildOpenGaps(): EngineCapabilityGap[] {
  return [
    {
      gapId: "fixture-gap-1",
      description: "Need lane unit-test coverage.",
      priority: "medium",
      relatedMissionObjective:
        "Validate that lane planning callbacks return well-formed plans for representative inputs.",
      currentState: "No lane unit tests exist.",
      desiredState: "Lane unit tests cover every plan callback.",
      detectedAt: DEFAULT_RECEIVED_AT,
      resolvedAt: null,
      resolutionNotes: null,
    },
  ];
}

function buildLane(): EngineLaneDefinition {
  // Default to a discovery-shaped lane. The lane unit test (task 10.2)
  // overrides this field per iteration with the real lane definitions
  // returned from `createDirectiveWorkspaceEngineLanes`.
  return {
    laneId: "discovery",
    label: "Discovery",
    hostDependence: "engine_only",
    valuableWithoutHostRuntime: true,
    defaultIntegrationMode: "none",
    handoffArtifactFamily: "discovery_backlog",
    nextAction: "Keep the candidate in Discovery until routing clarity improves.",
    defaultDecisionState: "hold_in_discovery",
  };
}

function buildBaseRoutingAssessment(
  transformationSignal: number,
): EngineRoutingAssessment {
  return {
    recommendedLaneId: "architecture",
    recommendedRecordShape: "split_case",
    missionPriorityScore: 0.5,
    confidence: "medium",
    matchedGapId: "fixture-gap-1",
    matchedGapRank: 1,
    explicitRouteDestination: null,
    routeConflict: false,
    needsHumanReview: false,
    ambiguitySummary: {
      topLaneId: "architecture",
      runnerUpLaneId: "discovery",
      scoreDelta: 0.2,
      conflictingSignalFamilies: [],
      conflictingLaneIds: [],
    },
    reviewGuidance: null,
    digest: {
      headline: "Architecture-leaning candidate",
      explanation: "Fixture digest for lane planning unit tests.",
      primaryConcern: null,
      secondaryConcerns: [],
      threadContext: null,
      trustLevel: "medium",
    },
    missionSpecificityWarning: null,
    missionHealth: null,
    goalCopilot: {
      overallScore: 0.6,
      objectiveSpecificityScore: 0.6,
      usefulnessSignalQualityScore: 0.5,
      constraintQualityScore: 0.5,
      laneClarityScore: 0.7,
      warnings: [],
      rationale: ["Fixture goal-copilot rationale."],
      suggestedObjective: null,
      suggestedConstraints: [],
      suggestedUsefulnessSignals: [],
      suggestedCapabilityLanes: [],
    },
    confidenceRecovery: null,
    followUpQuestions: null,
    gapRadar: null,
    earnedAutonomy: {
      routeClass: "fixture-route-class",
      overallScore: 0.4,
      evidenceCount: 0,
      operatorAgreementRate: null,
      reviewClearRate: null,
      reversalCount: 0,
      autoApprovalEligible: false,
      approvalReductionApplied: false,
      summary: "Fixture earned-autonomy summary.",
      rationale: [],
    },
    sourceMemory: null,
    sourceSimilarity: null,
    narrativeContext: null,
    laneProportions: { discovery: 0.2, architecture: 0.6, runtime: 0.2 },
    secondaryLanes: [
      { laneId: "discovery", proportion: 0.2, reason: "fixture secondary lane" },
    ],
    scoreBreakdown: {
      missionFit: 0.5,
      gapAlignment: 0.5,
      laneScores: { discovery: 0.2, architecture: 0.6, runtime: 0.2 },
      keywordLaneScores: { discovery: 0.0, architecture: 0.3, runtime: 0.0 },
      metadataLaneScores: { discovery: 0.1, architecture: 0.2, runtime: 0.1 },
      gapLaneScores: { discovery: 0.0, architecture: 0.1, runtime: 0.0 },
      metaUsefulnessSignal: 0,
      patternExtractionSignal: 0,
      transformationSignal,
      runtimeSignal: 0,
      ambiguityPenalty: 0,
      total: 0.5,
    },
    explanationBreakdown: {
      keywordSignals: ["fixture keyword signal"],
      metadataSignals: ["fixture metadata signal"],
      gapAlignmentSignals: [],
      ambiguitySignals: [],
    },
    rationale: ["Fixture rationale entry."],
  };
}

export function buildRoutingAssessmentWithTransformationSignal(): EngineRoutingAssessment {
  // `buildRuntimeProofPlan` returns `runtime_transformation_proof` when
  // `scoreBreakdown.transformationSignal > 0`. Any positive number works;
  // we pick `1` so the intent is obvious in test output.
  return buildBaseRoutingAssessment(1);
}

export function buildRoutingAssessmentWithoutTransformationSignal(): EngineRoutingAssessment {
  // `buildRuntimeProofPlan` falls through to `runtime_proof` when
  // `scoreBreakdown.transformationSignal` is `0` (or any non-positive value).
  return buildBaseRoutingAssessment(0);
}

function buildLanePlanningInput(): EngineLanePlanningInput {
  return {
    source: buildSource(),
    mission: buildMission(),
    openGaps: buildOpenGaps(),
    candidateId: "fixture-candidate-1",
    receivedAt: DEFAULT_RECEIVED_AT,
    routingAssessment: buildRoutingAssessmentWithoutTransformationSignal(),
    lane: buildLane(),
  };
}

function buildExtractionPlan(): EngineExtractionPlan {
  return {
    extractedValue: [
      "Fixture extracted value: a structural pattern worth carrying into the engine.",
    ],
    excludedBaggage: [
      "Fixture excluded baggage: source-specific implementation detail.",
    ],
  };
}

function buildAdaptationPlan(): EngineAdaptationPlan {
  return {
    directiveOwnedForm:
      "Fixture directive-owned form: an engine-owned mechanism representing the adapted value.",
    adaptedValue: [
      "Fixture adapted value: the extracted pattern, restated as engine logic.",
    ],
  };
}

function buildImprovementPlan(): EngineImprovementPlan {
  return {
    improvementGoals: ["fixture improvement goal one", "fixture improvement goal two"],
    intendedDelta:
      "Fixture intended delta: compound future source consumption with engine-owned improvements.",
  };
}

function buildProofPlan(): EngineProofPlan {
  return {
    proofKind: "fixture_proof",
    objective: "Fixture proof objective.",
    requiredEvidence: ["fixture evidence one", "fixture evidence two"],
    requiredGates: ["fixture_gate"],
    rollbackPrompt: "Fixture rollback prompt.",
  };
}

export function buildExtractionPlanningInput(
  overrides?: Partial<EngineLaneExtractionPlanningInput>,
): EngineLaneExtractionPlanningInput {
  const defaults: EngineLaneExtractionPlanningInput = {
    planningInput: buildLanePlanningInput(),
  };
  return { ...defaults, ...overrides };
}

export function buildAdaptationPlanningInput(
  overrides?: Partial<EngineLaneAdaptationPlanningInput>,
): EngineLaneAdaptationPlanningInput {
  const defaults: EngineLaneAdaptationPlanningInput = {
    planningInput: buildLanePlanningInput(),
    extractionPlan: buildExtractionPlan(),
  };
  return { ...defaults, ...overrides };
}

export function buildImprovementPlanningInput(
  overrides?: Partial<EngineLaneImprovementPlanningInput>,
): EngineLaneImprovementPlanningInput {
  const defaults: EngineLaneImprovementPlanningInput = {
    planningInput: buildLanePlanningInput(),
    extractionPlan: buildExtractionPlan(),
    adaptationPlan: buildAdaptationPlan(),
    runtimePromotionFeedbackSignal: null,
    runtimeExecutionEvidenceSignal: null,
  };
  return { ...defaults, ...overrides };
}

export function buildProofPlanningInput(
  overrides?: Partial<EngineLaneProofPlanningInput>,
): EngineLaneProofPlanningInput {
  const defaults: EngineLaneProofPlanningInput = {
    planningInput: buildLanePlanningInput(),
    extractionPlan: buildExtractionPlan(),
    adaptationPlan: buildAdaptationPlan(),
    improvementPlan: buildImprovementPlan(),
  };
  return { ...defaults, ...overrides };
}

export function buildIntegrationPlanningInput(
  overrides?: Partial<EngineLaneIntegrationPlanningInput>,
): EngineLaneIntegrationPlanningInput {
  const defaults: EngineLaneIntegrationPlanningInput = {
    planningInput: buildLanePlanningInput(),
    extractionPlan: buildExtractionPlan(),
    adaptationPlan: buildAdaptationPlan(),
    improvementPlan: buildImprovementPlan(),
    proofPlan: buildProofPlan(),
  };
  return { ...defaults, ...overrides };
}
