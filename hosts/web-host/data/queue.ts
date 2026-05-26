import path from "node:path";

import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";
import {
  readDirectiveDiscoveryRoutingArtifact,
} from "../../../discovery/lib/routing/route-opener.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";
import { createStandaloneFilesystemHost } from "../../standalone-host/filesystem-host.ts";
import {
  buildDirectiveFrontendArtifactViewPath,
  type FrontendCurrentHead,
} from "./shared.ts";

type StoredFrontendQueueEntry = {
  candidate_id: string;
  candidate_name: string;
  source_type: string;
  source_reference: string;
  received_at: string;
  status: string;
  routing_target: string | null;
  capability_gap_id: string | null;
  intake_record_path: string | null;
  fast_path_record_path: string | null;
  routing_record_path: string | null;
  result_record_path: string | null;
  notes: string | null;
};

export type FrontendQueueEntry = StoredFrontendQueueEntry & {
  integrity_state: "ok" | "broken" | null;
  status_effective: string;
  status_warning: string | null;
  current_case_stage: string | null;
  current_case_next_legal_step: string | null;
  current_head: FrontendCurrentHead | null;
  review_pressure: {
    guidance_kind: string;
    summary: string;
    operator_action: string;
    stop_line: string;
    routing_confidence: string | null;
    route_conflict: boolean | null;
    needs_human_review: boolean | null;
    ambiguity_summary: {
      top_lane_id: string;
      runner_up_lane_id: string | null;
      score_delta: number;
      conflicting_signal_families: string[];
      conflicting_lane_ids: string[];
    } | null;
  } | null;
  runtime_summary: {
    proposed_host: string | null;
    promotion_readiness_blockers: string[];
  } | null;
};

export type FrontendQueueOverview = {
  ok: boolean;
  rootPath: string;
  queuePath: string;
  updatedAt: string | null;
  totalEntries: number;
  entries: FrontendQueueEntry[];
};

function deriveFrontendQueueStatus(input: {
  entry: StoredFrontendQueueEntry;
  resolutionPath: string | null;
  integrityState: "ok" | "broken" | null;
  currentStage: string | null;
  currentHeadPath: string | null;
}) {
  if (
    input.entry.status === "completed"
    && !input.entry.result_record_path
    && (input.entry.routing_record_path || input.resolutionPath)
  ) {
    const completionReference =
      input.entry.routing_record_path
      ?? input.resolutionPath
      ?? "the recorded completion artifact";
    return {
      status_effective: "completed_inconsistent",
      status_warning:
        "Queue still marks this case completed, but result_record_path is missing. "
        + `Canonical truth only resolves through "${completionReference}". `
        + "Do not treat this queue status as a truthful completion signal.",
    };
  }

  if (input.entry.status === "completed" && input.integrityState === "broken") {
    const resolutionReference = input.entry.result_record_path ?? input.resolutionPath ?? "the recorded completion artifact";
    return {
      status_effective: "completed_inconsistent",
      status_warning:
        `Queue still marks this case completed, but canonical truth cannot resolve "${resolutionReference}" cleanly. `
        + "Do not treat this queue status as a truthful completion signal.",
    };
  }

  if (input.entry.status === "routed" && input.integrityState === "broken") {
    const resolutionReference =
      input.entry.routing_record_path
      ?? input.entry.result_record_path
      ?? input.resolutionPath
      ?? "the recorded routed artifact";
    return {
      status_effective: "routed_inconsistent",
      status_warning:
        `Queue still marks this case routed, but canonical truth cannot resolve "${resolutionReference}" cleanly. `
        + "Do not treat this queue status as a clean active-routing signal.",
    };
  }

  if (
    input.entry.status === "routed"
    && (input.entry.result_record_path || input.entry.routing_record_path || input.resolutionPath)
    && input.currentHeadPath
    && input.currentHeadPath
      !== (input.entry.result_record_path ?? input.entry.routing_record_path ?? input.resolutionPath)
  ) {
    const routedReference =
      input.entry.result_record_path
      ?? input.entry.routing_record_path
      ?? input.resolutionPath
      ?? "the recorded routed artifact";
    return {
      status_effective: "routed_progressed",
      status_warning:
        `Queue still marks this case routed, but the live case head has already progressed to `
        + `${input.currentStage ?? "a later stage"} at "${input.currentHeadPath}". `
        + `Do not treat "${routedReference}" as the live continuation point.`,
    };
  }

  return {
    status_effective: input.entry.status,
    status_warning: null,
  };
}

function buildFrontendQueueEntry(input: {
  directiveRoot: string;
  entry: StoredFrontendQueueEntry;
}): FrontendQueueEntry {
  const reviewPressure = (() => {
    if (!input.entry.routing_record_path) {
      return null;
    }

    try {
      const routing = readDirectiveDiscoveryRoutingArtifact({
        directiveRoot: input.directiveRoot,
        routingPath: input.entry.routing_record_path,
      });
      if (!routing.reviewGuidance) {
        return null;
      }

      return {
        guidance_kind: routing.reviewGuidance.guidanceKind,
        summary: routing.reviewGuidance.summary,
        operator_action: routing.reviewGuidance.operatorAction,
        stop_line: routing.reviewGuidance.stopLine,
        routing_confidence: routing.routingConfidence,
        route_conflict: routing.routeConflict,
        needs_human_review: routing.needsHumanReview,
        ambiguity_summary: routing.ambiguitySummary
          ? {
              top_lane_id: routing.ambiguitySummary.topLaneId,
              runner_up_lane_id: routing.ambiguitySummary.runnerUpLaneId,
              score_delta: routing.ambiguitySummary.scoreDelta,
              conflicting_signal_families: [...routing.ambiguitySummary.conflictingSignalFamilies],
              conflicting_lane_ids: [...routing.ambiguitySummary.conflictingLaneIds],
            }
          : null,
      };
    } catch {
      return null;
    }
  })();

  const resolutionPath = input.entry.routing_record_path ?? input.entry.result_record_path ?? null;
  if (!resolutionPath) {
    return {
      ...input.entry,
      integrity_state: null,
      status_effective: input.entry.status,
      status_warning: null,
      current_case_stage: null,
      current_case_next_legal_step: null,
      current_head: null,
      review_pressure: reviewPressure,
      runtime_summary: null,
    };
  }

  try {
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: resolutionPath,
      includeAnchors: false,
    }).focus;

    if (!focus) {
      const status = deriveFrontendQueueStatus({
        entry: input.entry,
        resolutionPath,
        integrityState: "broken",
        currentStage: null,
        currentHeadPath: null,
      });
      return {
        ...input.entry,
        integrity_state: "broken",
        ...status,
        current_case_stage: null,
        current_case_next_legal_step: "Current case head could not be resolved from the canonical resolver.",
        current_head: {
          artifact_path: resolutionPath,
          artifact_kind: "unknown",
          artifact_stage: "unknown",
          artifact_lane: input.entry.routing_target ?? "unknown",
          view_path: `/artifacts?path=${encodeURIComponent(resolutionPath)}`,
        },
        review_pressure: reviewPressure,
        runtime_summary: null,
      };
    }

    const status = deriveFrontendQueueStatus({
      entry: input.entry,
      resolutionPath,
      integrityState: focus.integrityState,
      currentStage: focus.currentStage,
      currentHeadPath: focus.currentHead.artifactPath,
    });

    return {
      ...(() => {
        const runtimeSummary = focus.currentHead.lane === "runtime"
          ? resolveDirectiveWorkspaceState({
              directiveRoot: input.directiveRoot,
              artifactPath: focus.currentHead.artifactPath,
              includeAnchors: false,
            }).focus?.runtime
          : null;
        return {
          runtime_summary: runtimeSummary
            ? {
                proposed_host: runtimeSummary.proposedHost ?? null,
                promotion_readiness_blockers: [...(runtimeSummary.promotionReadinessBlockers ?? [])],
              }
            : null,
        };
      })(),
      ...input.entry,
      integrity_state: focus.integrityState,
      ...status,
      current_case_stage: focus.currentStage,
      current_case_next_legal_step: focus.nextLegalStep,
      review_pressure: reviewPressure,
      current_head: {
        artifact_path: focus.currentHead.artifactPath,
        artifact_kind: focus.currentHead.artifactKind,
        artifact_stage: focus.currentHead.artifactStage,
        artifact_lane: focus.currentHead.lane,
        view_path: buildDirectiveFrontendArtifactViewPath({
          relativePath: focus.currentHead.artifactPath,
          artifactKind: focus.currentHead.artifactKind,
        }),
      },
    };
  } catch (error) {
    const status = deriveFrontendQueueStatus({
      entry: input.entry,
      resolutionPath,
      integrityState: "broken",
      currentStage: null,
      currentHeadPath: null,
    });
    return {
      ...input.entry,
      integrity_state: "broken",
      ...status,
      current_case_stage: null,
      current_case_next_legal_step:
        `Current case head could not be resolved from "${resolutionPath}": ${String((error as Error).message || error)}`,
      review_pressure: reviewPressure,
      current_head: {
        artifact_path: resolutionPath,
        artifact_kind: "unknown",
        artifact_stage: "unknown",
        artifact_lane: input.entry.routing_target ?? "unknown",
        view_path: `/artifacts?path=${encodeURIComponent(resolutionPath)}`,
      },
      runtime_summary: null,
    };
  }
}

function readFrontendQueueOverview(input: {
  directiveRoot: string;
  maxEntries?: number;
}): FrontendQueueOverview {
  const host = createStandaloneFilesystemHost({
    directiveRoot: input.directiveRoot,
  });

  try {
    const queue = host.readQueue() as {
      updatedAt?: string | null;
      entries?: StoredFrontendQueueEntry[];
    } | null;
    const queuePath = normalizeAbsolutePath(
      path.join(input.directiveRoot, "discovery", "intake-queue.json"),
    );

    if (!queue || !Array.isArray(queue.entries)) {
      return {
        ok: false,
        rootPath: normalizeAbsolutePath(input.directiveRoot),
        queuePath,
        updatedAt: null,
        totalEntries: 0,
        entries: [],
      };
    }

    const entries = [...queue.entries]
      .sort((left, right) =>
        `${right.received_at}|${right.candidate_id}`.localeCompare(
          `${left.received_at}|${left.candidate_id}`,
        ))
      .slice(0, Math.max(1, input.maxEntries ?? 12));

    return {
      ok: true,
      rootPath: normalizeAbsolutePath(input.directiveRoot),
      queuePath,
      updatedAt: queue.updatedAt ?? null,
      totalEntries: queue.entries.length,
      entries: entries.map((entry) =>
        buildFrontendQueueEntry({
          directiveRoot: input.directiveRoot,
          entry,
        })),
    };
  } finally {
    host.close();
  }
}

function readDirectiveFrontendQueueEntry(input: {
  directiveRoot: string;
  candidateId: string;
}) {
  const candidateId = String(input.candidateId || "").trim();
  if (!candidateId) {
    return null;
  }

  return readFrontendQueueOverview({
    directiveRoot: input.directiveRoot,
    maxEntries: 500,
  }).entries.find((entry) => entry.candidate_id === candidateId)
    || null;
}

export {
  readDirectiveFrontendQueueEntry,
  readFrontendQueueOverview,
};
