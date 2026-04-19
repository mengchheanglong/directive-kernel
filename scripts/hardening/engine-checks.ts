import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DirectiveEngine,
  createFilesystemDirectiveEngineStore,
  createDirectiveWorkspaceEngineLanes,
  createMemoryDirectiveEngineStore,
  type DirectiveEngineRunRecord,
} from "../../engine/index.ts";
import {
  fileExistsInDirectiveWorkspace,
  isDirectiveWorkspaceArtifactReference,
  readLinkedArtifactIfPresent,
  recordExpectedArtifactIfMissing,
  recordInconsistentLink,
  recordMissingLinkedArtifactIfAbsent,
} from "../../engine/artifact-link-validation.ts";
import { countTokenOverlap } from "../../engine/engine-source-utils.ts";
import { createDefaultDirectiveMission } from "../../engine/mission/default-mission.ts";
import { assessDirectiveEngineRouting } from "../../engine/routing/index.ts";
import { inferDirectiveEngineSourceType } from "../../engine/source-type-inference.ts";
import { resolveDirectiveEngineStoreRecordPath } from "../../engine/storage.ts";
import {
  readDirectiveEngineProcessFingerprintCacheStats,
  resetDirectiveEngineProcessFingerprintCache,
} from "../../engine/directive-engine.ts";
import { appendDiscoveryIntakeQueueEntry } from "../../discovery/lib/intake/discovery-intake-queue-writer.ts";
import {
  buildArchitectureGap,
  buildArchitectureMission,
  buildArchitectureSourceInput,
  buildRecurringArchitecturePolicyEvents,
} from "./support.ts";

export async function runDirectiveEngineHardeningChecks() {
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
  assert.equal(first.record.schemaVersion, 8);
  assert.equal(first.record.decision.requiresHumanApproval, false);
  assert.equal(first.record.decision.decisionState, "accept_for_architecture");
  assert.equal(first.record.routingAssessment.digest.headline, "Architecture, high confidence.");
  assert.ok(first.record.structuredExtractionPlan);
  assert.ok(first.record.structuredAdaptationPlan);
  assert.ok(first.record.structuredImprovementPlan);
  assert.ok(first.record.structuredProofPlan);
  assert.ok(first.record.executablePlanState);
  assert.equal(first.record.structuredExtractionPlan?.completionRate, 0);
  assert.equal(first.record.structuredAdaptationPlan?.completionRate, 0);
  assert.equal(first.record.structuredImprovementPlan?.completionRate, 0);
  assert.equal(first.record.structuredProofPlan?.completionRate, 0);
  assert.ok((first.record.executablePlanState?.actions.length ?? 0) > 0);
  assert.ok((first.record.executablePlanState?.nextActionIds.length ?? 0) > 0);
  assert.equal(first.record.executablePlanState?.proofState.finalState, "proof_pending");
  assert.equal(first.adapterResults.length, 2);
  assert.equal(first.adapterResults[0]?.accepted, false);
  assert.match(first.adapterResults[0]?.note ?? "", /adapter error: boom/u);
  assert.equal(first.adapterResults[1]?.accepted, true);

  const progressed = await engine.updatePlanProgress({
    runId: first.record.runId,
    at: "2026-04-10T01:00:00.000Z",
    updates: [
      {
        plan: "proof",
        itemType: "objective",
        status: "completed",
      },
      {
        plan: "proof",
        itemType: "requiredEvidence",
        index: 0,
        status: "completed",
      },
    ],
  });
  assert.equal(progressed.structuredProofPlan?.objective.status, "completed");
  assert.equal(
    progressed.structuredProofPlan?.requiredEvidence[0]?.status,
    "completed",
  );
  assert.equal(
    progressed.executablePlanState?.actions.find((action) => action.actionId === "proof:objective")?.status,
    "completed",
  );
  assert.equal(
    progressed.executablePlanState?.proofState.objectiveState,
    "defined",
  );
  assert.ok(
    progressed.executablePlanState?.proofState.outstandingEvidenceActionIds.every((actionId) =>
      actionId !== "proof:requiredEvidence:0"
    ) ?? false,
  );
  assert.ok(
    (progressed.structuredProofPlan?.completionRate ?? 0) > 0,
    "Plan progress updates should raise the structured proof completion rate",
  );
  assert.ok(
    (progressed.planQualitySignal?.proofGateCompletion ?? 0) > 0,
    "Plan quality should consume direct structured proof completion",
  );
  const persistedProgress = await engine.getRun(first.record.runId);
  assert.equal(persistedProgress?.structuredProofPlan?.objective.status, "completed");
  assert.equal(
    persistedProgress?.executablePlanState?.actions.find((action) => action.actionId === "proof:objective")?.status,
    "completed",
  );

  const missionPreview = await engine.previewMissionChange({
    runId: first.record.runId,
    change: {
      objective: "Improve the system",
      usefulnessSignals: [],
      constraints: [],
      successSignal: null,
      adoptionTarget: null,
    },
    receivedAt: "2026-04-10T01:05:00.000Z",
  });
  assert.ok(
    missionPreview.diff.length > 0,
    "Mission preview should produce a digest diff when the mission changes materially",
  );
  assert.equal(
    missionPreview.after.primaryConcern?.kind,
    "mission_weakness",
    "Mission preview should surface mission weakness when the proposed rewrite is too vague",
  );
  const afterPreview = await engine.getRun(first.record.runId);
  assert.equal(
    afterPreview?.routingAssessment.digest.primaryConcern?.kind ?? null,
    progressed.routingAssessment.digest.primaryConcern?.kind ?? null,
    "Mission preview must not mutate the stored run record",
  );

  const second = await engine.processSource(buildArchitectureSourceInput());
  assert.equal(second.deduplicated, true);
  assert.equal(second.duplicateOfRunId, first.record.runId);
  resetDirectiveEngineProcessFingerprintCache({ clearCache: true });
  const duplicateMiss = await engine.processSource({
    ...buildArchitectureSourceInput(),
    source: {
      ...buildArchitectureSourceInput().source,
      sourceRef: "https://example.com/duplicate-fingerprint-cache",
      title: "Duplicate fingerprint cache source",
    },
  });
  assert.notEqual(
    duplicateMiss.deduplicated,
    true,
    "The first unique source should persist normally before later duplicate checks can hit the fingerprint cache",
  );
  const duplicateMissStats = readDirectiveEngineProcessFingerprintCacheStats();
  assert.ok(
    duplicateMissStats.misses > 0,
    "The first fingerprint comparison over existing records should populate the fingerprint cache",
  );
  const duplicateHit = await engine.processSource({
    ...buildArchitectureSourceInput(),
    source: {
      ...buildArchitectureSourceInput().source,
      sourceRef: "https://example.com/duplicate-fingerprint-cache",
      title: "Duplicate fingerprint cache source",
    },
  });
  assert.equal(duplicateHit.deduplicated, true);
  assert.equal(duplicateHit.duplicateOfRunId, duplicateMiss.record.runId);
  const duplicateWarm = await engine.processSource({
    ...buildArchitectureSourceInput(),
    source: {
      ...buildArchitectureSourceInput().source,
      sourceRef: "https://example.com/duplicate-fingerprint-cache",
      title: "Duplicate fingerprint cache source",
    },
  });
  assert.equal(duplicateWarm.deduplicated, true);
  assert.equal(duplicateWarm.duplicateOfRunId, duplicateMiss.record.runId);
  const duplicateHitStats = readDirectiveEngineProcessFingerprintCacheStats();
  assert.ok(
    duplicateHitStats.hits > 0,
    "Repeated duplicate detection should reuse cached historical record fingerprints once the matching record has been fingerprinted",
  );

  const rerouteSeed = await engine.processSource({
    receivedAt: "2026-04-10T02:00:00.000Z",
    mission: {
      missionId: "reroute-hardening",
      currentObjective: "Clarify architecture ownership boundaries for workflow sources",
      usefulnessSignals: [
        "prefer architecture when workflow boundaries remain explicit and bounded",
      ],
      capabilityLanes: ["architecture"],
      constraints: ["keep review explicit", "stay reversible"],
      successSignal: "The dominant owner is explicit.",
      adoptionTarget: "architecture",
    },
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "reroute-seed",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/reroute-seed",
      title: "Architecture workflow boundary review",
      summary: "Architecture workflow review guidance with explicit protocol boundaries.",
      primaryAdoptionTarget: "runtime",
      containsExecutableCode: true,
      containsWorkflowPattern: true,
      workflowBoundaryShape: "bounded_protocol",
    },
  });
  assert.equal(rerouteSeed.record.routingAssessment.routeConflict, true);
  const rerouted = await engine.reRouteWithAnswers({
    runId: rerouteSeed.record.runId,
    answers: {
      "source.primaryAdoptionTarget": "architecture",
    },
    receivedAt: "2026-04-10T02:05:00.000Z",
  });
  assert.equal(rerouted.record.routingAssessment.routeConflict, false);
  assert.equal(rerouted.record.selectedLane.laneId, "architecture");
  assert.notEqual(rerouted.record.runId, rerouteSeed.record.runId);

  const minimal = await engine.processMinimalSource({
    title: "Runtime reliability repo",
    url: "https://github.com/example/runtime-reliability",
  });
  assert.equal(minimal.record.source.sourceType, "github-repo");
  assert.equal(
    minimal.record.source.sourceRef,
    "https://github.com/example/runtime-reliability",
  );
  assert.equal(
    minimal.record.mission.currentObjective,
    createDefaultDirectiveMission().currentObjective,
  );

  const minimalWithoutUrl = await engine.processMinimalSource({
    title: "Architecture routing note",
    summary: "Workflow routing and review boundaries.",
  });
  assert.match(
    minimalWithoutUrl.record.source.sourceRef,
    /^inline:\/\/minimal\//u,
  );

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

export async function runFilesystemStoreCachingChecks() {
  const engineRunsRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-storage-cache-${Date.now()}`,
    "engine-runs",
  );
  const writerStore = createFilesystemDirectiveEngineStore({ engineRunsRoot });
  const writerEngine = new DirectiveEngine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store: writerStore,
  });

  const first = await writerEngine.processSource(buildArchitectureSourceInput());
  const second = await writerEngine.processSource({
    ...buildArchitectureSourceInput(),
    receivedAt: "2026-04-10T00:01:00.000Z",
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "architecture-storage-cache-second",
      sourceRef: "https://example.com/architecture-storage-cache-second",
      title: "Architecture storage cache second source",
    },
  });
  void second;

  const readerStore = createFilesystemDirectiveEngineStore({ engineRunsRoot });
  const originalReadFileSync = fs.readFileSync;
  let readCount = 0;
  fs.readFileSync = ((...args: Parameters<typeof fs.readFileSync>) => {
    readCount += 1;
    return originalReadFileSync(...args);
  }) as typeof fs.readFileSync;

  let initialRecords: DirectiveEngineRunRecord[] = [];
  let cachedRecords: DirectiveEngineRunRecord[] = [];
  try {
    initialRecords = await readerStore.listRuns();
    const initialReadCount = readCount;
    readCount = 0;
    cachedRecords = await readerStore.listRuns();
    const cachedReadCount = readCount;

    assert.deepEqual(
      cachedRecords,
      initialRecords,
      "Cached listRuns results must stay byte-for-byte equivalent to the initial hydrated records",
    );
    assert.ok(
      initialReadCount >= initialRecords.length,
      "Initial filesystem hydration should read persisted run files",
    );
    assert.equal(
      cachedReadCount,
      0,
      "A second listRuns call on unchanged files must reuse the in-memory cache instead of rereading files",
    );
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  await new Promise((resolve) => setTimeout(resolve, 20));
  const storedFirstRecord = initialRecords.find((record) => record.runId === first.record.runId);
  assert.ok(storedFirstRecord, "The first persisted run must be present before external modification");
  const externallyModifiedRecord = {
    ...storedFirstRecord,
    candidate: {
      ...storedFirstRecord.candidate,
      candidateName: "Externally Updated Candidate",
    },
    source: {
      ...storedFirstRecord.source,
      title: "Externally Updated Candidate",
    },
  } satisfies DirectiveEngineRunRecord;
  const recordPath = resolveDirectiveEngineStoreRecordPath({
    engineRunsRoot,
    record: first.record,
  });
  fs.writeFileSync(recordPath, `${JSON.stringify(externallyModifiedRecord, null, 2)}\n`, "utf8");

  const refreshedRecords = await readerStore.listRuns();
  const refreshedRecord = refreshedRecords.find((record) => record.runId === first.record.runId);
  assert.equal(
    refreshedRecord?.candidate.candidateName,
    "Externally Updated Candidate",
    "Filesystem store cache must invalidate when a persisted run file changes on disk",
  );
}

export function runEngineContractSurfaceChecks() {
  const artifactRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-artifact-link-check-${Date.now()}`,
  );
  const linkedArtifactPath = "runtime/06-promotion-specifications/example.json";
  const linkedArtifactAbsolutePath = path.join(artifactRoot, linkedArtifactPath);
  fs.mkdirSync(path.dirname(linkedArtifactAbsolutePath), { recursive: true });
  fs.writeFileSync(linkedArtifactAbsolutePath, JSON.stringify({ ok: true }), "utf8");

  assert.equal(
    isDirectiveWorkspaceArtifactReference("runtime\\06-promotion-specifications\\example.json"),
    true,
    "Artifact-link validation should treat workspace-relative backslash paths as valid workspace artifact references",
  );
  assert.equal(
    isDirectiveWorkspaceArtifactReference("https://example.com/spec.json"),
    false,
    "Artifact-link validation should reject non-workspace artifact references",
  );
  assert.equal(
    fileExistsInDirectiveWorkspace(artifactRoot, linkedArtifactPath),
    true,
    "Artifact-link validation should resolve workspace-relative artifact paths against the directive root",
  );
  assert.deepEqual(
    readLinkedArtifactIfPresent({
      directiveRoot: artifactRoot,
      relativePath: linkedArtifactPath,
      read: (relativePath) => ({ relativePath }),
    }),
    { relativePath: linkedArtifactPath },
    "Linked-artifact reads should delegate only when the workspace-relative target exists",
  );
  assert.equal(
    readLinkedArtifactIfPresent({
      directiveRoot: artifactRoot,
      relativePath: "runtime/06-promotion-specifications/missing.json",
      read: () => ({ unreachable: true }),
    }),
    null,
    "Linked-artifact reads should stay null for missing workspace-relative artifacts",
  );
  const validationState = {
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
  };
  recordExpectedArtifactIfMissing({
    directiveRoot: artifactRoot,
    state: validationState,
    relativePath: "runtime/06-promotion-specifications/missing.json",
  });
  recordExpectedArtifactIfMissing({
    directiveRoot: artifactRoot,
    state: validationState,
    relativePath: "https://example.com/spec.json",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: artifactRoot,
    state: validationState,
    relativePath: "runtime/06-promotion-specifications/missing.json",
    label: "promotion specification",
  });
  recordInconsistentLink(validationState, "duplicate issue");
  recordInconsistentLink(validationState, "duplicate issue");
  assert.deepEqual(
    validationState.missingExpectedArtifacts,
    ["runtime/06-promotion-specifications/missing.json"],
    "Expected-artifact tracking should record only missing workspace-relative artifacts once",
  );
  assert.deepEqual(
    validationState.inconsistentLinks,
    ["missing linked promotion specification: runtime/06-promotion-specifications/missing.json", "duplicate issue"],
    "Inconsistent-link tracking should stay deduplicated and keep explicit missing-link messages",
  );

  const recurringPolicyEvents = buildRecurringArchitecturePolicyEvents();
  const overlapFromArray = countTokenOverlap(
    ["alpha", "beta", "gamma"],
    ["beta", "gamma", "delta"],
  );
  const overlapFromMap = countTokenOverlap(
    ["alpha", "beta", "gamma"],
    new Map([
      ["beta", 1],
      ["gamma", 1],
      ["delta", 1],
    ]).keys(),
  );
  assert.equal(
    overlapFromMap,
    overlapFromArray,
    "Token-overlap lookup reuse must preserve the exact overlap count when the right-hand side is already a lookup structure",
  );
  assert.equal(
    inferDirectiveEngineSourceType({
      title: "Repository",
      url: "https://github.com/example/directive-kernel",
    }),
    "github-repo",
  );
  assert.equal(
    inferDirectiveEngineSourceType({
      title: "New routing paper",
      url: "https://arxiv.org/abs/2604.12345",
    }),
    "paper",
  );

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
  assert.ok(vagueResult.missionSpecificityWarning !== null);
  assert.ok(vagueResult.missionSpecificityWarning.includes("generic tokens"));
  assert.ok(vagueResult.goalCopilot.overallScore < 60);
  assert.ok(typeof vagueResult.missionHealth?.overallScore === "number");
  assert.ok(vagueResult.goalCopilot.suggestedObjective !== null);
  assert.ok((vagueResult.confidenceRecovery?.requestedInputs.length ?? 0) > 0);
  assert.ok((vagueResult.followUpQuestions?.questions.length ?? 0) > 0);
  assert.ok(typeof vagueResult.earnedAutonomy.overallScore === "number");
  assert.ok(vagueResult.digest.headline.length > 0);

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
  assert.equal(specificResult.missionSpecificityWarning, null);
  assert.ok(specificResult.goalCopilot.overallScore >= 70);
  assert.equal(
    Object.values(specificResult.laneProportions).reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.ok(specificResult.digest.headline.startsWith("Architecture, "));
  assert.ok(specificResult.digest.headline.endsWith(" confidence."));

  const missionWeaknessResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/mission-weakness",
      title: "Architecture routing clarity workflow",
      summary: "Explicit architecture routing workflow boundary with review gates.",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      missionId: "mission-weakness",
      currentObjective: "Improve the system",
      usefulnessSignals: [],
      capabilityLanes: ["architecture"],
      constraints: ["keep review explicit"],
      successSignal: "Better than before.",
      adoptionTarget: null,
      activeMissionMarkdown: "",
    },
    openGaps: [],
  });
  assert.equal(missionWeaknessResult.routeConflict, false);
  assert.equal(
    missionWeaknessResult.digest.primaryConcern?.kind,
    "mission_weakness",
  );

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
  assert.equal(metadataOverrideResult.recommendedLaneId, "architecture");
  assert.equal(metadataOverrideResult.routeConflict, false);
  assert.equal(metadataOverrideResult.confidence, "high");

  const conflictResult = assessDirectiveEngineRouting({
    source: {
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/conflict",
      title: "Architecture workflow boundary review",
      summary: "Architecture workflow review guidance with explicit protocol boundaries.",
      primaryAdoptionTarget: "runtime",
      containsExecutableCode: true,
      containsWorkflowPattern: true,
      workflowBoundaryShape: "bounded_protocol",
    },
    mission: {
      missionId: "conflict",
      currentObjective: "Clarify architecture ownership boundaries for workflow sources",
      usefulnessSignals: ["prefer architecture when workflow boundaries remain explicit and bounded"],
      capabilityLanes: ["architecture"],
      constraints: ["keep review explicit", "stay reversible"],
      successSignal: "The dominant owner is explicit.",
      adoptionTarget: "architecture",
      activeMissionMarkdown: "",
    },
    openGaps: [buildArchitectureGap()],
  });
  assert.equal(conflictResult.routeConflict, true);
  assert.equal(conflictResult.digest.primaryConcern?.kind, "conflict");

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
  assert.ok((radarResult.gapRadar?.suggestions.length ?? 0) > 0);
}
