import fs from "node:fs";
import path from "node:path";

import {
  buildOperatorDecisionInboxReport,
  type OperatorDecisionInboxReport,
} from "../../../engine/coordination/index.ts";
import {
  resolveDirectiveWorkspaceState,
  type WorkspaceStateReport,
} from "../../../engine/state/index.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/submission-router.ts";
import {
  readDiscoveryOverviewWithHostBridge,
  type DiscoveryOverviewSummary,
} from "./discovery-overview-reader.ts";
import {
  readDirectiveGoalEnvelope,
  renderDirectiveGoalTemplate,
  type GoalEnvelope,
  type ResolvedDirectiveGoalEnvelope,
} from "../../../shared/lib/goal.ts";
import { readJson, writeJson, writeUtf8 } from "../../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";
import {
  submitDiscoveryEntryThroughFrontDoor,
  type DiscoveryFrontDoorStarterOptions,
} from "./discovery-front-door-adapter.ts";

export type FirstHostGoalEnvelopeInput = Omit<
  GoalEnvelope,
  "sourcePath" | "rawMarkdown"
>;

export type FirstHostSourceInput = {
  candidateId: string;
  candidateName: string;
  sourceType?: DiscoverySubmissionRequest["source_type"];
  sourceReference: string;
  summary: string;
  notes?: string | null;
  capabilityGapId?: string | null;
  primaryAdoptionTarget?: DiscoverySubmissionRequest["primary_adoption_target"];
  containsExecutableCode?: boolean | null;
  containsWorkflowPattern?: boolean | null;
  improvesDirectiveWorkspace?: boolean | null;
  workflowBoundaryShape?: DiscoverySubmissionRequest["workflow_boundary_shape"];
  missionAlignment?: string | null;
};

export type FirstHostResolvedGoalEnvelope =
  | {
      ok: true;
      source: "provided_goal_envelope";
      path: string;
      goal: GoalEnvelope;
    }
  | ResolvedDirectiveGoalEnvelope;

export type FirstHostKernelSnapshot = {
  discoveryOverview: DiscoveryOverviewSummary;
  workspaceState: WorkspaceStateReport;
  operatorInbox: OperatorDecisionInboxReport;
};

export type RunFirstHostIntegrationFlowResult = {
  goalResolution: FirstHostResolvedGoalEnvelope;
  request: DiscoverySubmissionRequest;
  submission: Awaited<
    ReturnType<typeof submitDiscoveryEntryThroughFrontDoor>
  >;
  snapshot: FirstHostKernelSnapshot;
};

function normalizeDirectiveRoot(directiveRoot: string) {
  return normalizeAbsolutePath(directiveRoot);
}

function normalizeGoalEnvelopeInput(
  directiveRoot: string,
  goal: FirstHostGoalEnvelopeInput | GoalEnvelope,
): GoalEnvelope {
  const goalPath = normalizeAbsolutePath(path.join(directiveRoot, "DIRECTIVE_GOAL.md"));
  const rawMarkdown = renderDirectiveGoalTemplate({
    goalId: goal.goalId,
    goalStatement: goal.goalStatement,
    whyNow: goal.whyNow,
    adoptionTarget: goal.adoptionTarget,
    constraints: goal.constraints,
    successSignal: goal.successSignal,
  });

  return {
    goalId: goal.goalId,
    goalStatement: goal.goalStatement,
    whyNow: goal.whyNow,
    adoptionTarget: goal.adoptionTarget,
    constraints: [...goal.constraints],
    successSignal: goal.successSignal,
    sourcePath: "sourcePath" in goal ? goal.sourcePath : goalPath,
    rawMarkdown: "rawMarkdown" in goal ? goal.rawMarkdown : rawMarkdown,
  };
}

function renderActiveMissionMarkdown(goal: GoalEnvelope) {
  const normalizedAdoptionTarget = String(goal.adoptionTarget || "").trim().toLowerCase();
  const orderedLanes = normalizedAdoptionTarget === "architecture"
    ? ["Architecture", "Discovery", "Runtime"]
    : normalizedAdoptionTarget === "discovery"
      ? ["Discovery", "Architecture", "Runtime"]
      : ["Runtime", "Architecture", "Discovery"];

  return [
    "# Active Mission",
    "",
    "## Current Objective",
    "",
    goal.goalStatement,
    "",
    "## Adoption Target",
    "",
    goal.adoptionTarget,
    "",
    "## What Usefulness Means Under This Objective",
    "",
    `- Prefer work that directly advances ${goal.goalStatement}.`,
    `- Why now: ${goal.whyNow}`,
    `- Success signal: ${goal.successSignal}`,
    ...goal.constraints.map((constraint) => `- Constraint: ${constraint}`),
    "",
    "## Capability Lanes That Matter Most",
    "",
    ...orderedLanes.map((lane, index) => `${index + 1}. ${lane}`),
    "",
  ].join("\n");
}

function resolvePrimaryAdoptionTarget(
  goal: GoalEnvelope,
  source: FirstHostSourceInput,
): DiscoverySubmissionRequest["primary_adoption_target"] {
  if (source.primaryAdoptionTarget) {
    return source.primaryAdoptionTarget;
  }

  const normalized = String(goal.adoptionTarget || "").trim().toLowerCase();
  if (
    normalized === "runtime"
    || normalized === "architecture"
    || normalized === "discovery"
  ) {
    return normalized;
  }
  return null;
}

function buildMissionAlignment(goal: GoalEnvelope, source: FirstHostSourceInput) {
  if (source.missionAlignment && source.missionAlignment.trim()) {
    return source.missionAlignment.trim();
  }

  return [
    `Goal: ${goal.goalStatement}`,
    `Why now: ${goal.whyNow}`,
    `Source value: ${source.summary}`,
    `Success signal: ${goal.successSignal}`,
    goal.constraints.length > 0 ? `Constraints: ${goal.constraints.join("; ")}` : null,
  ].filter(Boolean).join(" ");
}

function buildNotes(source: FirstHostSourceInput) {
  return [source.summary, source.notes ?? null].filter(Boolean).join(" ").trim() || null;
}

function ensureDirectiveRootSubdirs(directiveRoot: string) {
  for (const relativeDir of [
    "discovery",
    "knowledge",
    "runtime/host-artifacts",
  ]) {
    fs.mkdirSync(path.join(directiveRoot, relativeDir), { recursive: true });
  }
}

function readJsonFile<T>(filePath: string) {
  return readJson<T>(filePath);
}

export function resolveFirstHostGoalEnvelope(input: {
  directiveRoot: string;
  goal?: FirstHostGoalEnvelopeInput | GoalEnvelope | null;
}): FirstHostResolvedGoalEnvelope {
  const directiveRoot = normalizeDirectiveRoot(input.directiveRoot);
  if (input.goal) {
    const goal = normalizeGoalEnvelopeInput(directiveRoot, input.goal);
    return {
      ok: true,
      source: "provided_goal_envelope",
      path: goal.sourcePath,
      goal,
    };
  }
  return readDirectiveGoalEnvelope(directiveRoot);
}

export function prepareDirectiveKernelFirstHostRoot(input: {
  directiveRoot: string;
  goal: FirstHostGoalEnvelopeInput | GoalEnvelope;
  syncGoalFiles?: boolean;
  receivedAt?: string;
}) {
  const directiveRoot = normalizeDirectiveRoot(input.directiveRoot);
  const goal = normalizeGoalEnvelopeInput(directiveRoot, input.goal);
  const receivedAt = String(input.receivedAt || new Date().toISOString().slice(0, 10)).trim();
  const syncGoalFiles = input.syncGoalFiles !== false;

  ensureDirectiveRootSubdirs(directiveRoot);

  const queuePath = path.join(directiveRoot, "discovery", "intake-queue.json");
  if (!fs.existsSync(queuePath)) {
    writeJson(queuePath, {
      status: "primary",
      updatedAt: receivedAt,
      entries: [],
    });
  }

  const capabilityGapsPath = path.join(directiveRoot, "discovery", "capability-gaps.json");
  if (!fs.existsSync(capabilityGapsPath)) {
    writeJson(capabilityGapsPath, { gaps: [] });
  }

  if (syncGoalFiles) {
    writeUtf8(path.join(directiveRoot, "DIRECTIVE_GOAL.md"), `${goal.rawMarkdown.trim()}\n`);
    writeUtf8(
      path.join(directiveRoot, "knowledge", "active-mission.md"),
      `${renderActiveMissionMarkdown(goal).trim()}\n`,
    );
  }

  return {
    directiveRoot,
    queuePath: normalizeAbsolutePath(queuePath),
    capabilityGapsPath: normalizeAbsolutePath(capabilityGapsPath),
    goalPath: normalizeAbsolutePath(path.join(directiveRoot, "DIRECTIVE_GOAL.md")),
    activeMissionPath: normalizeAbsolutePath(path.join(directiveRoot, "knowledge", "active-mission.md")),
  };
}

export function buildDiscoverySubmissionFromGoalEnvelope(input: {
  goal: FirstHostGoalEnvelopeInput | GoalEnvelope;
  source: FirstHostSourceInput;
}): DiscoverySubmissionRequest {
  const goal = "rawMarkdown" in input.goal && "sourcePath" in input.goal
    ? input.goal
    : normalizeGoalEnvelopeInput(process.cwd(), input.goal);
  return {
    candidate_id: input.source.candidateId,
    candidate_name: input.source.candidateName,
    source_type: input.source.sourceType ?? "internal-signal",
    source_reference: input.source.sourceReference,
    mission_alignment: buildMissionAlignment(goal, input.source),
    capability_gap_id: input.source.capabilityGapId ?? null,
    notes: buildNotes(input.source),
    primary_adoption_target: resolvePrimaryAdoptionTarget(goal, input.source),
    contains_executable_code: input.source.containsExecutableCode ?? null,
    contains_workflow_pattern: input.source.containsWorkflowPattern ?? null,
    improves_directive_workspace: input.source.improvesDirectiveWorkspace ?? null,
    workflow_boundary_shape: input.source.workflowBoundaryShape ?? null,
  };
}

export function readFirstHostKernelSnapshot(input: {
  directiveRoot: string;
  artifactPath?: string | null;
  maxEntries?: number;
}): FirstHostKernelSnapshot {
  const directiveRoot = normalizeDirectiveRoot(input.directiveRoot);
  return {
    discoveryOverview: readDiscoveryOverviewWithHostBridge({
      storage: {
        directiveRoot,
        readJson: readJsonFile,
      },
      maxEntries: input.maxEntries,
    }),
    workspaceState: resolveDirectiveWorkspaceState({
      directiveRoot,
      artifactPath: input.artifactPath ?? undefined,
    }),
    operatorInbox: buildOperatorDecisionInboxReport({
      directiveRoot,
    }),
  };
}

export async function runFirstHostIntegrationFlow(input: {
  directiveRoot: string;
  goal?: FirstHostGoalEnvelopeInput | GoalEnvelope | null;
  source: FirstHostSourceInput;
  runtimeArtifactsRoot?: string;
  receivedAt?: string;
}): Promise<RunFirstHostIntegrationFlowResult> {
  const directiveRoot = normalizeDirectiveRoot(input.directiveRoot);
  const goalResolution = resolveFirstHostGoalEnvelope({
    directiveRoot,
    goal: input.goal ?? null,
  });
  if (!goalResolution.ok) {
    throw new Error(goalResolution.reason);
  }

  prepareDirectiveKernelFirstHostRoot({
    directiveRoot,
    goal: goalResolution.goal,
    receivedAt: input.receivedAt,
  });

  const request = buildDiscoverySubmissionFromGoalEnvelope({
    goal: goalResolution.goal,
    source: input.source,
  });
  const submission = await submitDiscoveryEntryThroughFrontDoor({
    directiveRoot,
    request,
    runtimeArtifactsRoot: input.runtimeArtifactsRoot,
    receivedAt: input.receivedAt,
  } satisfies DiscoveryFrontDoorStarterOptions);
  const snapshot = readFirstHostKernelSnapshot({
    directiveRoot,
    artifactPath: submission.engine.recordRelativePath,
  });

  return {
    goalResolution,
    request,
    submission,
    snapshot,
  };
}
