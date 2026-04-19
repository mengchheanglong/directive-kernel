import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

import { startDirectiveFrontendServer } from "../../hosts/web-host/server.ts";
import {
  buildRuntimeCallableExecutionHostAdapterDescriptor,
} from "../../runtime/lib/host/runtime-host-callable-adapter-contract.ts";
import {
  readJsonResponse,
  writeJson,
  writeUtf8,
} from "./support.ts";

export async function runWebHostSmoke() {
  const directiveRoot = path.resolve(
    os.tmpdir(),
    `directive-kernel-web-smoke-${Date.now()}`,
  );
  const runtimeCandidateId = "web-host-runtime-pending-host";
  const runtimeDate = "2026-04-10";
  const runtimeRoutingPath = `discovery/03-routing-log/${runtimeCandidateId}-routing-record.md`;
  const runtimeFollowUpPath =
    `runtime/00-follow-up/${runtimeDate}-${runtimeCandidateId}-runtime-follow-up-record.md`;
  const runtimeRecordPath = `runtime/02-records/${runtimeDate}-${runtimeCandidateId}-runtime-record.md`;
  const runtimeProofPath = `runtime/03-proof/${runtimeDate}-${runtimeCandidateId}-proof.md`;
  const runtimeBoundaryPath =
    `runtime/04-capability-boundaries/${runtimeDate}-${runtimeCandidateId}-runtime-capability-boundary.md`;
  const runtimePromotionReadinessPath =
    `runtime/05-promotion-readiness/${runtimeDate}-${runtimeCandidateId}-promotion-readiness.md`;
  const runtimePromotionSpecificationPath =
    `runtime/06-promotion-specifications/${runtimeDate}-${runtimeCandidateId}-promotion-specification.json`;
  const runtimeHostConsumptionReportPath =
    `runtime/standalone-host/host-consumption/${runtimeDate}-${runtimeCandidateId}-host-consumption-report.json`;
  const runtimeCallableExecutionPath =
    `runtime/callable-executions/${runtimeDate}-${runtimeCandidateId}-callable-execution.json`;

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
  writeJson(path.join(directiveRoot, "engine", "gap-radar.json"), {
    schemaVersion: 1,
    generatedAt: "2026-04-10T00:05:00.000Z",
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
  writeUtf8(
    path.join(directiveRoot, "shared", "contracts", "runtime-to-host.md"),
    "# Runtime To Host Contract\n\nWeb-host smoke fixture.\n",
  );
  writeUtf8(
    path.join(directiveRoot, runtimeRoutingPath),
    "# Discovery Routing Record\n\nWeb-host smoke fixture.\n",
  );
  writeUtf8(
    path.join(directiveRoot, runtimeRecordPath),
    [
      "# Runtime Record: Web Host Runtime Pending Host",
      "",
      `- Candidate id: ${runtimeCandidateId}`,
      "- Candidate name: Web Host Runtime Pending Host",
      "- Current status: follow_up_review_opened",
      "",
      "## follow-up review decision",
      `- Source follow-up record: \`${runtimeFollowUpPath}\``,
      `- Linked Discovery routing record: \`${runtimeRoutingPath}\``,
      `- Next Runtime proof artifact if later approved: \`${runtimeProofPath}\``,
      "",
    ].join("\n"),
  );
  writeUtf8(
    path.join(directiveRoot, runtimeProofPath),
    [
      "# Runtime Proof: Web Host Runtime Pending Host",
      "",
      `- Candidate id: ${runtimeCandidateId}`,
      "- Candidate name: Web Host Runtime Pending Host",
      "",
      "## runtime record identity",
      `- Legacy Runtime record path: \`${runtimeRecordPath}\``,
      `- Source follow-up record path: \`${runtimeFollowUpPath}\``,
      `- Linked Discovery routing record: \`${runtimeRoutingPath}\``,
      "",
    ].join("\n"),
  );
  writeUtf8(
    path.join(directiveRoot, runtimeBoundaryPath),
    [
      "# Legacy Runtime Runtime Capability Boundary: Web Host Runtime Pending Host",
      "",
      `- Proof artifact: \`${runtimeProofPath}\``,
      `- Runtime record: \`${runtimeRecordPath}\``,
      "- Current Runtime proof status: proof_scope_opened",
      "",
    ].join("\n"),
  );
  writeUtf8(
    path.join(directiveRoot, runtimePromotionReadinessPath),
    [
      "# Runtime Promotion-Readiness Artifact: Web Host Runtime Pending Host",
      "",
      "## runtime capability boundary identity",
      `- Candidate id: \`${runtimeCandidateId}\``,
      "- Candidate name: `Web Host Runtime Pending Host`",
      `- Runtime capability boundary: \`${runtimeBoundaryPath}\``,
      `- Runtime capability boundary path: \`${runtimeBoundaryPath}\``,
      `- Runtime proof artifact: \`${runtimeProofPath}\``,
      `- Source Runtime proof artifact: \`${runtimeProofPath}\``,
      `- Legacy Runtime record: \`${runtimeRecordPath}\``,
      `- Source Legacy Runtime record: \`${runtimeRecordPath}\``,
      `- Source Runtime follow-up record: \`${runtimeFollowUpPath}\``,
      `- Linked Discovery routing record: \`${runtimeRoutingPath}\``,
      "- Promotion-readiness decision: `approved_for_non_executing_promotion_readiness`",
      "- Opened by: `web-host-smoke`",
      `- Opened on: \`${runtimeDate}\``,
      "- Current status: `promotion_readiness_opened`",
      "",
      "## bounded runtime usefulness preserved",
      "- Runtime objective: Host a bounded repo-native runtime capability through the standalone host.",
      "- Proposed host: `pending_host_selection`",
      "- Proposed runtime surface: standalone_host_runtime_capability",
      "- Capability form: non-executing promotion-readiness artifact",
      "- Execution state: not executing, not host-integrated, not implemented, not promoted",
      "",
      "## what is now explicit",
      "- `behavior_preservation`",
      "- `metric_improvement_or_equivalent_value`",
      "- `runtime_boundary_review`",
      "",
      "## rollback boundary",
      "- Rollback: Delete this smoke fixture.",
      "",
    ].join("\n"),
  );
  writeUtf8(
    path.join(directiveRoot, runtimeFollowUpPath),
    [
      "# Runtime Follow-Up: Web Host Runtime Pending Host",
      "",
      `- Follow-up date: ${runtimeDate}`,
      `- Candidate id: ${runtimeCandidateId}`,
      "- Candidate name: Web Host Runtime Pending Host",
      "- Current decision state: route_confirmed",
      "- Origin track: discovery_runtime_route",
      "- Runtime value to operationalize: Expose a bounded repo-native runtime capability through a selected Directive Kernel host.",
      "- Proposed host: pending_host_selection",
      "- Proposed integration mode: standalone_host_runtime_capability",
      "- Current status: pending_review",
      "Linked handoff:",
      `- \`${runtimeRoutingPath}\``,
      "- Allowed export surfaces:",
      "  - `Directive Kernel standalone host`",
      "- Excluded baggage:",
      "  - automatic promotion",
      "- Required proof:",
      "  - explicit host-selection resolution",
      "- Required gates:",
      "  - behavior_preservation",
      "  - metric_improvement_or_equivalent_value",
      "  - runtime_boundary_review",
      "- Risks:",
      "  - host selection remains unresolved",
      "  - promotion seam opened too early",
      "- Rollback: Delete this smoke fixture.",
      "- No-op path: Leave the case parked until an explicit host selection exists.",
      "- Review cadence: Recheck when operator attention returns to runtime promotion blockers.",
      "",
    ].join("\n"),
  );
  writeJson(path.join(directiveRoot, runtimePromotionSpecificationPath), {
    schemaVersion: 1,
    generatedAt: "2026-04-10T00:00:00.000Z",
    candidateId: runtimeCandidateId,
    candidateName: "Web Host Runtime Pending Host",
    sourcePromotionReadinessPath: runtimePromotionReadinessPath,
    integrationMode: "standalone_host_runtime_capability",
    targetRuntimeSurface: "bounded repo-native runtime capability",
    owner: "directive-workspace",
    sourceIntentArtifact: runtimeBoundaryPath,
    compileContractArtifact: "shared/contracts/runtime-to-host.md",
    runtimePermissionsProfile: {
      readOnlyLane: "read_only",
      writeLane: null,
    },
    safeOutputScope: null,
    sanitizePolicy: null,
    requiredGates: [
      "behavior_preservation",
      "metric_improvement_or_equivalent_value",
      "runtime_boundary_review",
    ],
    rollbackPlan: "Delete this smoke fixture.",
    proofArtifactPath: runtimeProofPath,
    proposedHost: "pending_host_selection",
    hostDependence: "pending_host_selection",
    executionState: "not executing, not host-integrated, not implemented, not promoted",
    linkedArtifacts: {
      capabilityBoundaryPath: runtimeBoundaryPath,
      runtimeProofPath,
      runtimeRecordPath,
      followUpPath: runtimeFollowUpPath,
      routingPath: runtimeRoutingPath,
      callableStubPath: null,
      promotionRecordPath: null,
    },
    openDecisions: ["Host selection: no host has been chosen for this candidate."],
    hostConsumableDescription:
      "Host selection is pending. Once a host is chosen, it would receive a bounded runtime capability.",
  });

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
          runId: string;
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

    const discoveryReviewResponse = await fetch(`${handle.origin}/api/discovery/resolve-routing-review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        routingRecordPath: frontDoorResult.createdPaths.routingRecordPath,
        decision: "confirm_architecture",
        rationale: "web-host smoke confirm path",
        resolvedConfidence: "high",
      }),
    });
    assert.equal(discoveryReviewResponse.status, 200);
    const discoveryReview = await readJsonResponse(discoveryReviewResponse) as {
      resolution?: {
        decision?: string;
        resolvedRouteDestination?: string;
      };
      reviewResolutionRelativePath?: string;
    };
    assert.equal(discoveryReview.resolution?.decision, "confirm_architecture");
    assert.equal(discoveryReview.resolution?.resolvedRouteDestination, "architecture");
    assert.ok(discoveryReview.reviewResolutionRelativePath);
    assert.ok(fs.existsSync(path.resolve(directiveRoot, discoveryReview.reviewResolutionRelativePath ?? "")));

    const inboxBeforeHostSelectionResponse = await fetch(`${handle.origin}/api/operator-decision-inbox`);
    assert.equal(inboxBeforeHostSelectionResponse.status, 200);
    const inboxBeforeHostSelection = await readJsonResponse(inboxBeforeHostSelectionResponse) as {
      summary?: {
        runtimeHostSelectionCount?: number;
      };
    };
    assert.ok((inboxBeforeHostSelection.summary?.runtimeHostSelectionCount ?? 0) >= 1);

    const runtimeHostSelectionResponse = await fetch(`${handle.origin}/api/runtime/host-selection-resolutions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        promotionReadinessPath: runtimePromotionReadinessPath,
        decision: "select_standalone",
        rationale: "web-host smoke selects the repo-native standalone host",
        resolvedConfidence: "high",
      }),
    });
    assert.equal(runtimeHostSelectionResponse.status, 200);
    const runtimeHostSelection = await readJsonResponse(runtimeHostSelectionResponse) as {
      resolution?: {
        decision?: string;
        resolvedHost?: string;
      };
      hostSelectionResolutionRelativePath?: string;
    };
    assert.equal(runtimeHostSelection.resolution?.decision, "select_standalone");
    assert.equal(
      runtimeHostSelection.resolution?.resolvedHost,
      "Directive Kernel standalone host (hosts/standalone-host/)",
    );
    assert.ok(runtimeHostSelection.hostSelectionResolutionRelativePath);
    assert.ok(
      fs.existsSync(
        path.resolve(directiveRoot, runtimeHostSelection.hostSelectionResolutionRelativePath ?? ""),
      ),
    );

    const inboxAfterHostSelectionResponse = await fetch(`${handle.origin}/api/operator-decision-inbox`);
    assert.equal(inboxAfterHostSelectionResponse.status, 200);
    const inboxAfterHostSelection = await readJsonResponse(inboxAfterHostSelectionResponse) as {
      summary?: {
        runtimeHostSelectionCount?: number;
        runtimePromotionSeamDecisionCount?: number;
      };
    };
    assert.equal(inboxAfterHostSelection.summary?.runtimeHostSelectionCount ?? 0, 0);
    assert.ok((inboxAfterHostSelection.summary?.runtimePromotionSeamDecisionCount ?? 0) >= 1);

    const promotionSeamResponse = await fetch(`${handle.origin}/api/runtime/promotion-seam-decisions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        promotionReadinessPath: runtimePromotionReadinessPath,
        rationale: "web-host smoke opens one bounded manual promotion record after repo-native host selection",
      }),
    });
    assert.equal(promotionSeamResponse.status, 200);
    const promotionSeam = await readJsonResponse(promotionSeamResponse) as {
      relativePath?: string;
      candidate_id?: string;
    };
    assert.equal(promotionSeam.candidate_id, runtimeCandidateId);
    assert.ok(promotionSeam.relativePath);
    assert.ok(fs.existsSync(path.resolve(directiveRoot, promotionSeam.relativePath ?? "")));

    const hostCallableAdapter = buildRuntimeCallableExecutionHostAdapterDescriptor({
      adapterId: `${runtimeCandidateId}:standalone_host:web_host_smoke_runtime_callable_execution`,
      candidateId: runtimeCandidateId,
      candidateName: "Web Host Runtime Pending Host",
      hostName: "Directive Kernel standalone host",
      hostSurface: "Directive Kernel standalone host callable invoke adapter",
      callableSurface: "bounded repo-native runtime capability",
      evidencePaths: {
        promotionRecordPath: promotionSeam.relativePath ?? null,
        promotionSpecificationPath: runtimePromotionSpecificationPath,
        hostSelectionResolutionPath:
          runtimeHostSelection.hostSelectionResolutionRelativePath ?? null,
        executionEvidencePath: runtimeCallableExecutionPath,
      },
      proof: {
        primaryChecker: "pnpm run check:web-host-smoke-runtime-registry",
        supportingCheckers: [
          "pnpm run check:runtime-host-callable-adapter-contract",
          "pnpm run check:runtime-registry-acceptance-gate",
        ],
      },
      stopLine:
        "Web-host smoke keeps registry acceptance and future automation explicit until the dedicated registry gate is approved.",
      hostIntegrationClaimed: true,
    });
    writeJson(path.join(directiveRoot, runtimeHostConsumptionReportPath), {
      reportVersion: "web_host_smoke_runtime_host_consumption/v1",
      generatedAt: "2026-04-10T00:10:00.000Z",
      candidateId: runtimeCandidateId,
      candidateName: "Web Host Runtime Pending Host",
      hostCallableAdapter,
    });
    writeJson(path.join(directiveRoot, runtimeCallableExecutionPath), {
      capability: {
        capabilityId: runtimeCandidateId,
      },
      invocation: {
        ok: true,
        status: "success",
      },
    });

    const inboxBeforeRegistryResponse = await fetch(`${handle.origin}/api/operator-decision-inbox`);
    assert.equal(inboxBeforeRegistryResponse.status, 200);
    const inboxBeforeRegistry = await readJsonResponse(inboxBeforeRegistryResponse) as {
      summary?: {
        runtimeRegistryAcceptanceCount?: number;
      };
    };
    assert.ok((inboxBeforeRegistry.summary?.runtimeRegistryAcceptanceCount ?? 0) >= 1);

    const registryAcceptanceResponse = await fetch(`${handle.origin}/api/runtime/registry-acceptance-decisions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        promotionRecordPath: promotionSeam.relativePath,
        rationale: "web-host smoke accepts the registry entry because the host adapter report and callable execution evidence already pass the explicit gate",
      }),
    });
    assert.equal(registryAcceptanceResponse.status, 200);
    const registryAcceptance = await readJsonResponse(registryAcceptanceResponse) as {
      relativePath?: string;
      candidate_id?: string;
    };
    assert.equal(registryAcceptance.candidate_id, runtimeCandidateId);
    assert.ok(registryAcceptance.relativePath);
    assert.ok(fs.existsSync(path.resolve(directiveRoot, registryAcceptance.relativePath ?? "")));

    const inboxAfterRegistryResponse = await fetch(`${handle.origin}/api/operator-decision-inbox`);
    assert.equal(inboxAfterRegistryResponse.status, 200);
    const inboxAfterRegistry = await readJsonResponse(inboxAfterRegistryResponse) as {
      summary?: {
        runtimeRegistryAcceptanceCount?: number;
      };
    };
    assert.equal(inboxAfterRegistry.summary?.runtimeRegistryAcceptanceCount ?? 0, 0);

    const planProgressResponse = await fetch(
      `${handle.origin}/api/engine-runs/${encodeURIComponent(frontDoorResult.engine.record.runId)}/plan-progress`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      },
    );
    assert.equal(planProgressResponse.status, 200);
    const progressedRecord = await readJsonResponse(planProgressResponse) as {
      record?: {
        executablePlanState?: {
          proofState?: {
            objectiveState?: string;
            outstandingEvidenceActionIds?: string[];
          };
        };
      };
    };
    assert.equal(
      progressedRecord.record?.executablePlanState?.proofState?.objectiveState,
      "defined",
    );
    assert.ok(
      !(
        progressedRecord.record?.executablePlanState?.proofState?.outstandingEvidenceActionIds ?? []
      ).includes("proof:requiredEvidence:0"),
    );

    const missionFeedbackResponse = await fetch(`${handle.origin}/api/mission/feedback`);
    assert.equal(missionFeedbackResponse.status, 200);
    const missionFeedbackEntries = await readJsonResponse(missionFeedbackResponse) as Array<{
      feedbackId?: string;
    }>;
    assert.ok((missionFeedbackEntries.length ?? 0) >= 1);
    const missionFeedbackId = String(missionFeedbackEntries[0]?.feedbackId || "");
    assert.ok(missionFeedbackId.length > 0);

    const missionPreviewResponse = await fetch(`${handle.origin}/api/mission/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        feedbackId: missionFeedbackId,
      }),
    });
    assert.equal(missionPreviewResponse.status, 200);
    const missionPreview = await readJsonResponse(missionPreviewResponse) as {
      feedback?: {
        feedbackId?: string;
      };
      preview?: {
        summary?: {
          totalRunsAnalyzed?: number;
        };
      };
    };
    assert.equal(missionPreview.feedback?.feedbackId, missionFeedbackId);
    assert.equal(typeof missionPreview.preview?.summary?.totalRunsAnalyzed, "number");

    const missionRejectResponse = await fetch(`${handle.origin}/api/mission/reject`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        feedbackId: missionFeedbackId,
        rationale: "web-host smoke reject path",
      }),
    });
    assert.equal(missionRejectResponse.status, 200);
    const missionReject = await readJsonResponse(missionRejectResponse) as {
      decision?: {
        feedbackId?: string;
        decision?: string;
      };
    };
    assert.equal(missionReject.decision?.feedbackId, missionFeedbackId);
    assert.equal(missionReject.decision?.decision, "rejected");

    writeJson(path.join(directiveRoot, "engine", "gap-radar.json"), {
      schemaVersion: 1,
      generatedAt: "2026-04-10T00:05:00.000Z",
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
      ],
    });

    const pendingGapResponse = await fetch(`${handle.origin}/api/gaps/pending`);
    assert.equal(pendingGapResponse.status, 200);
    const pendingGapFormalizations = await readJsonResponse(pendingGapResponse) as Array<{
      formalizationId?: string;
      radarConfidence?: string;
    }>;
    assert.ok((pendingGapFormalizations.length ?? 0) >= 1);
    const formalizationId = String(pendingGapFormalizations[0]?.formalizationId || "");
    assert.ok(formalizationId.length > 0);

    const gapApproveResponse = await fetch(`${handle.origin}/api/gaps/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        formalizationId,
        rationale: "web-host smoke approve path",
        priority: pendingGapFormalizations[0]?.radarConfidence === "high" ? "high" : "medium",
      }),
    });
    assert.equal(gapApproveResponse.status, 200);
    const gapApprove = await readJsonResponse(gapApproveResponse) as {
      formalizationRecord?: {
        formalizationId?: string;
        status?: string;
      };
      newGap?: {
        gap_id?: string;
      } | null;
      refreshedWorklist?: {
        worklistPath?: string;
        worklist?: {
          items?: Array<{ gap_id?: string }>;
        };
      };
    };
    assert.equal(gapApprove.formalizationRecord?.formalizationId, formalizationId);
    assert.equal(gapApprove.formalizationRecord?.status, "written");
    assert.ok(gapApprove.newGap?.gap_id);
    assert.ok(fs.existsSync(path.resolve(directiveRoot, "discovery", "gap-worklist.json")));
    assert.ok(
      (gapApprove.refreshedWorklist?.worklist?.items ?? []).some((entry) =>
        entry.gap_id === gapApprove.newGap?.gap_id
      ),
    );

    const rerouteSubmissionResponse = await fetch(`${handle.origin}/api/discovery/front-door`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        candidate_id: "web-host-reroute-probe",
        candidate_name: "Web Host Reroute Probe",
        source_type: "workflow-writeup",
        source_reference: "https://example.com/web-host-reroute-probe",
        mission_alignment: "General workflow improvement notes",
        notes: "web-host reroute smoke",
        contains_workflow_pattern: true,
      }),
    });
    assert.equal(rerouteSubmissionResponse.status, 200);
    const rerouteSubmission = await readJsonResponse(rerouteSubmissionResponse) as {
      engine: {
        record: {
          runId: string;
        };
      };
    };
    const rerouteRunId = rerouteSubmission.engine.record.runId;

    const rerouteDetailResponse = await fetch(
      `${handle.origin}/api/engine-runs/${encodeURIComponent(rerouteRunId)}`,
    );
    assert.equal(rerouteDetailResponse.status, 200);
    const rerouteDetail = await readJsonResponse(rerouteDetailResponse) as {
      record?: {
        routingAssessment?: {
          confidenceRecovery?: {
            requestedInputs?: Array<{ field?: string }>;
          } | null;
          followUpQuestions?: {
            questions?: Array<{ field?: string }>;
          } | null;
        };
      };
    };
    const rerouteFields = new Set([
      ...(
        rerouteDetail.record?.routingAssessment?.confidenceRecovery?.requestedInputs ?? []
      ).map((entry) => entry.field ?? ""),
      ...(
        rerouteDetail.record?.routingAssessment?.followUpQuestions?.questions ?? []
      ).map((entry) => entry.field ?? ""),
    ]);
    assert.ok(rerouteFields.has("source.improvesDirectiveWorkspace"));

    const rerouteResponse = await fetch(
      `${handle.origin}/api/engine-runs/${encodeURIComponent(rerouteRunId)}/reroute`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          answers: {
            "source.improvesDirectiveWorkspace": true,
          },
        }),
      },
    );
    assert.equal(rerouteResponse.status, 200);
    const rerouteResult = await readJsonResponse(rerouteResponse) as {
      result?: {
        record?: {
          runId?: string;
          source?: {
            improvesDirectiveWorkspace?: boolean | null;
          };
        };
      };
    };
    assert.notEqual(rerouteResult.result?.record?.runId, rerouteRunId);
    assert.equal(
      rerouteResult.result?.record?.source?.improvesDirectiveWorkspace,
      true,
    );

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
    assert.equal(queue.totalEntries, 2);
    assert.ok(
      (queue.entries ?? []).some((entry) => entry.candidate_id === "web-host-auto-architecture"),
    );
    assert.ok(
      (queue.entries ?? []).some((entry) => entry.candidate_id === "web-host-reroute-probe"),
    );
  } finally {
    await handle.close();
  }
}
