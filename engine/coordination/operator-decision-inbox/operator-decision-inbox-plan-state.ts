import fs from "node:fs";
import path from "node:path";

import {
  normalizeDirectiveRelativePath,
} from "../../../shared/lib/directive-relative-path.ts";
import type { DirectiveEngineExecutablePlanState } from "../../types.ts";
import type {
  CandidatePlanStateSummary,
  OperatorDecisionInboxEntry,
} from "./operator-decision-inbox-types.ts";

function readJson(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function buildPlanStateSummary(input: {
  runId: string;
  state: DirectiveEngineExecutablePlanState | null | undefined;
}): CandidatePlanStateSummary | null {
  const state = input.state;
  if (!state?.actions?.length) {
    return null;
  }

  const nextActions = state.nextActionIds
    .map((actionId) => state.actions.find((action) => action.actionId === actionId)?.title ?? null)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  const pendingActionCount = state.actions.filter((action) =>
    action.status !== "completed" && action.status !== "skipped"
  ).length;

  return {
    runId: input.runId,
    proofState: state.proofState.finalState,
    completionRate: state.completionRate,
    pendingActionCount,
    blockedActionCount: state.blockedActionIds.length,
    nextActions,
  };
}

export function buildLatestPlanStateSummaryByCandidateId(directiveRoot: string) {
  const engineRunsRoot = path.join(
    directiveRoot,
    "runtime",
    "standalone-host",
    "engine-runs",
  );
  const summaries = new Map<string, {
    summary: CandidatePlanStateSummary;
    recordPath: string;
  }>();

  if (!fs.existsSync(engineRunsRoot)) {
    return summaries;
  }

  const recordPaths = fs
    .readdirSync(engineRunsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(engineRunsRoot, entry.name))
    .sort((left, right) => path.basename(right).localeCompare(path.basename(left)));

  for (const absoluteRecordPath of recordPaths) {
    const parsed = readJson(absoluteRecordPath) as {
      runId?: unknown;
      candidate?: {
        candidateId?: unknown;
      };
      executablePlanState?: DirectiveEngineExecutablePlanState | null;
    } | null;
    const candidateId = typeof parsed?.candidate?.candidateId === "string"
      ? parsed.candidate.candidateId
      : null;
    const runId = typeof parsed?.runId === "string" ? parsed.runId : null;
    if (!candidateId || !runId || summaries.has(candidateId)) {
      continue;
    }

    const summary = buildPlanStateSummary({
      runId,
      state: parsed.executablePlanState,
    });
    if (!summary) {
      continue;
    }

    summaries.set(candidateId, {
      summary,
      recordPath: normalizeDirectiveRelativePath(path.relative(directiveRoot, absoluteRecordPath)),
    });
  }

  return summaries;
}

export function attachPlanStateSummary(
  entry: OperatorDecisionInboxEntry,
  summaryByCandidateId: Map<string, { summary: CandidatePlanStateSummary; recordPath: string }>,
) {
  if (!entry.candidateId) {
    return entry;
  }

  const planState = summaryByCandidateId.get(entry.candidateId) ?? null;
  if (!planState) {
    return entry;
  }

  return {
    ...entry,
    planStateSummary: planState.summary,
    relatedArtifacts: Array.from(new Set([
      ...entry.relatedArtifacts,
      planState.recordPath,
    ])),
  };
}

export function listFiles(input: {
  directiveRoot: string;
  relativeDir: string;
  suffix: string;
}) {
  const absoluteDir = path.join(input.directiveRoot, input.relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(input.suffix))
    .map((entry) => normalizeDirectiveRelativePath(path.join(input.relativeDir, entry.name)))
    .sort();
}
