import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import {
  Engine,
  createFilesystemEngineStore,
  createDirectiveWorkspaceEngineLanes,
  type EngineMissionInput,
} from "../../engine/index.ts";
import {
  approveGapFormalization,
  approveMissionFeedbackEntry,
  listGapFormalizationRecords,
  listMissionEvolutionHistory,
  listPendingGapFormalizationCandidates,
  listMissionFeedbackDecisions,
  listMissionFeedbackEntries,
  previewMissionFeedbackEntry,
  readActiveMissionEvolution,
  rejectGapFormalization,
  rejectMissionFeedbackEntry,
  revertMissionEvolution,
  supersedeMissionEvolution,
} from "../../engine/mission/index.ts";
import { buildOperatorDecisionInboxReport } from "../../engine/coordination/operator-decision-inbox/operator-decision-inbox.ts";
import { refreshDiscoveryGapWorklist } from "../../discovery/lib/gaps/gap-worklist-refresh.ts";
import {
  buildArchitectureSourceInput,
  writeJson,
  writeUtf8,
} from "./support.ts";

export async function runMissionFeedbackLoopChecks() {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-mission-feedback-${Date.now()}`,
  );

  writeJson(path.join(directiveRoot, "discovery", "intake-queue.json"), {
    status: "primary",
    updatedAt: "2026-04-17",
    entries: [],
  });
  writeJson(path.join(directiveRoot, "discovery", "capability-gaps.json"), {
    gaps: [],
  });
  writeUtf8(
    path.join(directiveRoot, "knowledge", "active-mission.md"),
    [
      "# Active Mission",
      "",
      "## Current Objective",
      "",
      "Improve the system.",
      "",
      "## Adoption Target",
      "",
      "architecture",
      "",
      "## What Usefulness Means Under This Objective",
      "",
      "- be better",
      "",
      "## Capability Lanes That Matter Most",
      "",
      "1. Discovery",
      "2. Architecture",
      "3. Runtime",
      "",
      "## Constraints",
      "",
      "- move fast",
      "",
      "## Success Signal",
      "",
      "Better.",
    ].join("\n"),
  );
  writeUtf8(
    path.join(directiveRoot, "DIRECTIVE_GOAL.md"),
    [
      "# Directive Goal",
      "",
      "## Goal ID",
      "",
      "mission-feedback-hardening",
      "",
      "## Goal Statement",
      "",
      "Improve the system.",
      "",
      "## Why Now",
      "",
      "The mission feedback loop needs a bounded hardening fixture.",
      "",
      "## Adoption Target",
      "",
      "architecture",
      "",
      "## Constraints",
      "",
      "- move fast",
      "",
      "## Success Signal",
      "",
      "Better.",
    ].join("\n"),
  );

  const weakMission: EngineMissionInput = {
    missionId: "mission-feedback-hardening",
    currentObjective: "Improve the system.",
    usefulnessSignals: ["be better"],
    capabilityLanes: ["Discovery", "Architecture", "Runtime"],
    constraints: ["move fast"],
    successSignal: "Better.",
    adoptionTarget: "architecture",
  };
  const store = createFilesystemEngineStore({
    engineRunsRoot: path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs"),
  });
  const engine = new Engine({
    laneSet: createDirectiveWorkspaceEngineLanes(),
    store,
  });
  await engine.processSource({
    ...buildArchitectureSourceInput(),
    mission: weakMission,
    receivedAt: "2026-04-17T00:00:00.000Z",
    source: {
      ...buildArchitectureSourceInput().source,
      sourceId: "mission-feedback-seed",
      sourceRef: "https://example.com/mission-feedback-seed",
      title: "Mission feedback seed source",
    },
  });

  const feedbackEntries = listMissionFeedbackEntries({ directiveRoot });
  assert.ok(feedbackEntries.some((entry) => entry.kind === "objective_rewrite"));
  const previewResult = previewMissionFeedbackEntry({
    directiveRoot,
    feedbackId: feedbackEntries[0]!.feedbackId,
  });
  assert.ok(previewResult.preview.summary.totalRunsAnalyzed >= 1);
  assert.throws(
    () => approveMissionFeedbackEntry({
      directiveRoot,
      feedbackId: feedbackEntries[0]!.feedbackId,
      operatorRationale: "Scope none must reject explicit cascade targets.",
      cascadeScope: "none",
      approvedRunIds: ["forbidden-run-id"],
    }),
    /cascade run ids are not allowed when cascade scope is none/u,
  );

  const inboxBeforeGapFormalization = buildOperatorDecisionInboxReport({ directiveRoot });
  assert.ok(
    inboxBeforeGapFormalization.entries.some((entry) =>
      entry.decisionSurface === "mission_health_feedback"
    ),
  );

  const approvedFeedback = approveMissionFeedbackEntry({
    directiveRoot,
    feedbackId: feedbackEntries[0]!.feedbackId,
    operatorRationale: "Tighten the mission objective.",
  });
  assert.equal(
    readActiveMissionEvolution({ directiveRoot })?.evolutionId,
    approvedFeedback.evolution.evolutionId,
  );
  assert.ok(
    listMissionFeedbackDecisions({ directiveRoot }).some((decision) =>
      decision.feedbackId === approvedFeedback.feedback.feedbackId
      && decision.decision === "approved"
    ),
  );
  assert.match(
    fs.readFileSync(path.join(directiveRoot, "knowledge", "active-mission.md"), "utf8"),
    /Improve/i,
  );
  assert.ok(listMissionEvolutionHistory({ directiveRoot }).length >= 1);

  const remainingFeedback = listMissionFeedbackEntries({ directiveRoot })[0] ?? null;
  if (remainingFeedback) {
    const rejected = rejectMissionFeedbackEntry({
      directiveRoot,
      feedbackId: remainingFeedback.feedbackId,
      operatorRationale: "Not worth changing right now.",
    });
    assert.equal(rejected.decision.decision, "rejected");
  }

  supersedeMissionEvolution({
    directiveRoot,
    newMissionSnapshot: {
      ...approvedFeedback.evolution.missionSnapshot,
      constraints: [
        ...approvedFeedback.evolution.missionSnapshot.constraints,
        "keep review explicit",
      ],
    },
    operatorRationale: "Add one explicit review constraint before testing revert.",
    trigger: {
      kind: "operator_initiated",
      sourceRunIds: [],
    },
    previewSnapshot: null,
    cascade: {
      approved: false,
      scope: "none",
      affectedRunIds: [],
    },
    appliedDelta: {
      constraints: [
        ...approvedFeedback.evolution.missionSnapshot.constraints,
        "keep review explicit",
      ],
    },
  });

  const revertedEvolution = revertMissionEvolution({
    directiveRoot,
    operatorRationale: "Restore the previous mission version.",
  });
  assert.ok(revertedEvolution);

  writeJson(path.join(directiveRoot, "engine", "gap-radar.json"), {
    schemaVersion: 1,
    generatedAt: "2026-04-17T00:10:00.000Z",
    suggestions: [
      {
        radarId: "gap-radar-runtime-observability",
        targetLaneId: "runtime",
        confidence: "high",
        evidenceCount: 4,
        summary: "Repeated runtime cases keep missing an observability capability gap.",
        recommendedChange: "Open a runtime observability gap.",
        signalTokens: ["runtime", "observability", "latency"],
        relatedOpenGapId: null,
        suggestedPriority: "high",
        candidateExamples: ["runtime-a", "runtime-b"],
      },
      {
        radarId: "gap-radar-architecture-bounded-review",
        targetLaneId: "architecture",
        confidence: "medium",
        evidenceCount: 3,
        summary: "Repeated architecture cases keep missing a bounded review capability gap.",
        recommendedChange: "Open an architecture bounded review gap.",
        signalTokens: ["architecture", "bounded", "review"],
        relatedOpenGapId: null,
        suggestedPriority: "medium",
        candidateExamples: ["architecture-a", "architecture-b"],
      },
    ],
  });

  const pendingFormalizations = listPendingGapFormalizationCandidates({ directiveRoot });
  assert.equal(pendingFormalizations.length, 2);
  const inboxWithGapFormalization = buildOperatorDecisionInboxReport({ directiveRoot });
  assert.ok(
    inboxWithGapFormalization.entries.some((entry) =>
      entry.decisionSurface === "gap_formalization_review"
    ),
  );

  const approvedGap = await approveGapFormalization({
    directiveRoot,
    formalizationId: pendingFormalizations[0]!.formalizationId,
    operatorRationale: "Track the repeated runtime pressure explicitly.",
    operatorApprovedPriority: "high",
  });
  assert.equal(approvedGap.formalizationRecord.status, "written");
  const refreshedWorklist = refreshDiscoveryGapWorklist({
    directiveRoot,
    updatedAt: "2026-04-17T00:11:00.000Z",
  });
  assert.ok(fs.existsSync(path.join(directiveRoot, "discovery", "gap-worklist.json")));
  assert.ok((refreshedWorklist.worklist.items?.length ?? 0) >= 1);

  const remainingFormalization = listPendingGapFormalizationCandidates({ directiveRoot })[0] ?? null;
  if (remainingFormalization) {
    const rejectedGap = rejectGapFormalization({
      directiveRoot,
      formalizationId: remainingFormalization.formalizationId,
      operatorRationale: "Not strong enough to track yet.",
    });
    assert.equal(rejectedGap.status, "rejected");
  }
  assert.ok(listGapFormalizationRecords({ directiveRoot }).length >= 2);
}
