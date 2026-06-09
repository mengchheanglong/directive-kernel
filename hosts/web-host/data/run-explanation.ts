import { readDirectiveFrontendRunDetail, readDirectiveFrontendSnapshot } from "./snapshot.ts";
import type { NextLegalAction } from "./next-legal-actions.ts";

export type RunExplanation = {
  runId: string;
  summary: string;
  lane: string | null;
  status: string;
  blockingConditions: string[];
  nextLegalActions: NextLegalAction[];
  relatedArtifacts: string[];
  rawRecordPath: string;
};

export type FrontendRunExplanation =
  | ({ ok: true } & RunExplanation)
  | {
      ok: false;
      error: string;
      runId: string;
      rawRecordPath: string;
    };

/**
 * Build a deterministic run explanation from a raw run record.
 * Does not read storage or perform external calls.
 */
export function buildRunExplanation(input: {
  run: Record<string, unknown>;
  nextLegalActions?: NextLegalAction[];
  relatedArtifacts?: string[];
}): RunExplanation {
  const run = input.run;
  const runId = String(run.runId ?? "");

  let lane: string | null = null;
  const selectedLane = run.selectedLane as Record<string, unknown> | undefined;
  if (selectedLane?.laneId) {
    lane = String(selectedLane.laneId);
  } else {
    const routingAssessment = run.routingAssessment as Record<string, unknown> | undefined;
    if (routingAssessment?.recommendedLaneId) {
      lane = String(routingAssessment.recommendedLaneId);
    }
  }

  const status = lane ? "routed" : "unknown";
  const blockingConditions = lane ? [] : ["routing lane unavailable"];
  const laneLabel = lane ? `routed to ${lane}` : "no lane assigned";
  const summary = `Run ${runId}: ${laneLabel}.`;
  const rawRecordPath = `/api/engine-runs/${encodeURIComponent(runId)}`;

  return {
    runId,
    summary,
    lane,
    status,
    blockingConditions,
    nextLegalActions: input.nextLegalActions ?? [],
    relatedArtifacts: input.relatedArtifacts ?? [],
    rawRecordPath,
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

export function readDirectiveFrontendRunExplanation(input: {
  directiveRoot: string;
  runId: string;
}): FrontendRunExplanation {
  const runId = String(input.runId || "").trim();
  const rawRecordPath = `/api/engine-runs/${encodeURIComponent(runId)}`;
  const detail = readDirectiveFrontendRunDetail({
    directiveRoot: input.directiveRoot,
    runId,
  });

  if (!detail.ok || !detail.record) {
    return {
      ok: false,
      error: detail.error ?? "run_not_found",
      runId,
      rawRecordPath,
    };
  }

  const snapshot = readDirectiveFrontendSnapshot({
    directiveRoot: input.directiveRoot,
    maxRuns: 200,
    maxQueueEntries: 500,
    maxHandoffs: 250,
  });

  const queueEntry = snapshot.queue.entries.find(
    (entry) => entry.candidate_id === detail.record?.candidate.candidateId,
  );

  const nextLegalActions = [...(queueEntry?.next_legal_actions ?? [])];
  const relatedArtifacts = uniqueStrings([
    detail.recordPath,
    detail.reportPath,
    queueEntry?.routing_record_path,
    queueEntry?.result_record_path,
    queueEntry?.current_head?.artifact_path,
  ]);

  const base = buildRunExplanation({
    run: detail.record as Record<string, unknown>,
    nextLegalActions,
    relatedArtifacts,
  });

  const receivedAt = String(detail.record.receivedAt || "").trim();
  const confidence =
    detail.record.routingAssessment?.confidence
    ?? detail.record.candidate.confidence
    ?? null;
  const stage = queueEntry?.current_case_stage ?? null;
  const stageSummary = stage ? ` Current stage: ${stage}.` : "";
  const confidenceSummary = confidence ? ` Confidence: ${confidence}.` : "";
  const blockingConditions = [
    ...base.blockingConditions,
    ...(queueEntry?.runtime_summary?.promotion_readiness_blockers ?? []),
  ];

  return {
    ok: true,
    ...base,
    status: stage ?? base.status,
    blockingConditions: uniqueStrings(blockingConditions),
    summary: [
      `Run ${base.runId}.`,
      receivedAt ? ` Submitted ${receivedAt}.` : "",
      base.lane ? ` Routed to ${base.lane}.` : " No lane assigned.",
      confidenceSummary,
      stageSummary,
    ].join("").trim(),
  };
}
