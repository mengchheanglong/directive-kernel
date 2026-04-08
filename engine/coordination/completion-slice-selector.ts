import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../shared/lib/file-io.ts";
import { resolveDirectiveRelativePath } from "../../shared/lib/directive-relative-path.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

export const DIRECTIVE_COMPLETION_SLICE_KINDS = [
  "decision",
  "implementation",
  "proof",
] as const;

export const DIRECTIVE_COMPLETION_SLICE_STATES = [
  "completed",
  "pending",
] as const;

export const DIRECTIVE_COMPLETION_SLICE_OWNING_LANES = [
  "architecture",
  "runtime",
  "discovery",
  "shared_engine",
] as const;

export const DIRECTIVE_COMPLETION_SELECTION_STATES = [
  "selected",
  "complete",
  "needs_decision",
  "blocked",
] as const;

export type DirectiveCompletionSliceKind =
  (typeof DIRECTIVE_COMPLETION_SLICE_KINDS)[number];
export type DirectiveCompletionSliceState =
  (typeof DIRECTIVE_COMPLETION_SLICE_STATES)[number];
export type DirectiveCompletionSliceOwningLane =
  (typeof DIRECTIVE_COMPLETION_SLICE_OWNING_LANES)[number];
export type DirectiveCompletionSelectionState =
  (typeof DIRECTIVE_COMPLETION_SELECTION_STATES)[number];

export type DirectiveCompletionStatus = {
  version: number;
  updatedAt: string;
  anchorPath: string;
  currentTargetId: string;
  currentTargetDescription: string;
  selectionRule: string;
  closedSeams: string[];
  lastCompletedSliceId: string | null;
  lastContextArtifactPath: string | null;
};

export type DirectiveCompletionSlice = {
  sliceId: string;
  title: string;
  phase: string;
  kind: DirectiveCompletionSliceKind;
  owningLane: DirectiveCompletionSliceOwningLane;
  priorityRank: number;
  state: DirectiveCompletionSliceState;
  dependsOn: string[];
  blockedByClosedSeam: string[];
  proofCommands: string[];
  rollbackSurface: string[];
  selectionHint: string;
};

export type DirectiveCompletionSliceRegistry = {
  version: number;
  updatedAt: string;
  policy: {
    selectionRule: string;
    syncRule: string;
  };
  items: DirectiveCompletionSlice[];
};

export type DirectiveCompletionSliceSelection = {
  directiveRoot: string;
  statusRelativePath: string;
  slicesRelativePath: string;
  selectionState: DirectiveCompletionSelectionState;
  currentTarget: {
    id: string;
    description: string;
  };
  selectionRule: string;
  closedSeams: string[];
  lastCompletedSliceId: string | null;
  lastContextArtifactPath: string | null;
  counts: {
    completed: number;
    pending: number;
    frontier: number;
    eligible: number;
    blockedByClosedSeam: number;
  };
  frontier: Array<{
    sliceId: string;
    priorityRank: number;
    phase: string;
    kind: DirectiveCompletionSliceKind;
    owningLane: DirectiveCompletionSliceOwningLane;
    blockingClosedSeams: string[];
  }>;
  selectedSlice: null | {
    sliceId: string;
    title: string;
    phase: string;
    kind: DirectiveCompletionSliceKind;
    owningLane: DirectiveCompletionSliceOwningLane;
    priorityRank: number;
    selectionHint: string;
    proofCommands: string[];
    rollbackSurface: string[];
  };
  reason: string;
};

const DEFAULT_STATUS_RELATIVE_PATH = "control/state/completion-status.json";
const DEFAULT_SLICES_RELATIVE_PATH = "control/state/completion-slices.json";

function asObject(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`invalid_shape: ${label} must be a string array`);
  }
}

function isCompletionSliceKind(value: unknown): value is DirectiveCompletionSliceKind {
  return typeof value === "string"
    && DIRECTIVE_COMPLETION_SLICE_KINDS.includes(value as DirectiveCompletionSliceKind);
}

function isCompletionSliceState(value: unknown): value is DirectiveCompletionSliceState {
  return typeof value === "string"
    && DIRECTIVE_COMPLETION_SLICE_STATES.includes(value as DirectiveCompletionSliceState);
}

function isCompletionSliceOwningLane(
  value: unknown,
): value is DirectiveCompletionSliceOwningLane {
  return typeof value === "string"
    && DIRECTIVE_COMPLETION_SLICE_OWNING_LANES.includes(value as DirectiveCompletionSliceOwningLane);
}

function assertCompletionStatusShape(
  value: unknown,
): asserts value is DirectiveCompletionStatus {
  const record = asObject(value);
  if (!record) {
    throw new Error("invalid_status: status must be an object");
  }
  if (!Number.isInteger(record.version) || Number(record.version) < 1) {
    throw new Error("invalid_status: version must be a positive integer");
  }
  for (const field of [
    "updatedAt",
    "anchorPath",
    "currentTargetId",
    "currentTargetDescription",
    "selectionRule",
  ] as const) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      throw new Error(`invalid_status: ${field} must be a non-empty string`);
    }
  }
  assertStringArray(record.closedSeams, "closedSeams");
  if (
    record.lastCompletedSliceId !== null
    && typeof record.lastCompletedSliceId !== "string"
  ) {
    throw new Error("invalid_status: lastCompletedSliceId must be string or null");
  }
  if (
    record.lastContextArtifactPath !== null
    && typeof record.lastContextArtifactPath !== "string"
  ) {
    throw new Error("invalid_status: lastContextArtifactPath must be string or null");
  }
}

function assertCompletionSliceShape(
  value: unknown,
  index: number,
): asserts value is DirectiveCompletionSlice {
  const record = asObject(value);
  if (!record) {
    throw new Error(`invalid_registry: item ${index} must be an object`);
  }
  for (const field of ["sliceId", "title", "phase", "selectionHint"] as const) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      throw new Error(`invalid_registry: item ${index} missing ${field}`);
    }
  }
  if (!isCompletionSliceKind(record.kind)) {
    throw new Error(`invalid_registry: item ${index} has invalid kind`);
  }
  if (!isCompletionSliceOwningLane(record.owningLane)) {
    throw new Error(`invalid_registry: item ${index} has invalid owningLane`);
  }
  if (!Number.isInteger(record.priorityRank) || Number(record.priorityRank) < 1) {
    throw new Error(`invalid_registry: item ${index} has invalid priorityRank`);
  }
  if (!isCompletionSliceState(record.state)) {
    throw new Error(`invalid_registry: item ${index} has invalid state`);
  }
  assertStringArray(record.dependsOn, `items[${index}].dependsOn`);
  assertStringArray(record.blockedByClosedSeam, `items[${index}].blockedByClosedSeam`);
  assertStringArray(record.proofCommands, `items[${index}].proofCommands`);
  assertStringArray(record.rollbackSurface, `items[${index}].rollbackSurface`);
}



function readCompletionControlSurface(input: {
  directiveRoot: string;
  statusRelativePath: string;
  slicesRelativePath: string;
}) {
  const statusAbsolutePath = normalizeAbsolutePath(
    path.join(input.directiveRoot, input.statusRelativePath),
  );
  const slicesAbsolutePath = normalizeAbsolutePath(
    path.join(input.directiveRoot, input.slicesRelativePath),
  );

  const status = readJson<DirectiveCompletionStatus>(statusAbsolutePath);
  const registry = readJson<DirectiveCompletionSliceRegistry>(slicesAbsolutePath);

  assertCompletionStatusShape(status);
  const registryRecord = asObject(registry);
  if (!registryRecord) {
    throw new Error("invalid_registry: registry must be an object");
  }
  if (!Number.isInteger(registry.version) || registry.version < 1) {
    throw new Error("invalid_registry: version must be a positive integer");
  }
  if (typeof registry.updatedAt !== "string" || registry.updatedAt.trim().length === 0) {
    throw new Error("invalid_registry: updatedAt must be a non-empty string");
  }
  const policy = asObject(registry.policy);
  if (!policy) {
    throw new Error("invalid_registry: policy must be an object");
  }
  if (
    typeof policy.selectionRule !== "string"
    || policy.selectionRule.trim().length === 0
    || typeof policy.syncRule !== "string"
    || policy.syncRule.trim().length === 0
  ) {
    throw new Error("invalid_registry: policy must contain selectionRule and syncRule");
  }
  if (!Array.isArray(registry.items)) {
    throw new Error("invalid_registry: items must be an array");
  }

  registry.items.forEach((item, index) => {
    assertCompletionSliceShape(item, index);
  });

  const ids = new Set<string>();
  for (const item of registry.items) {
    if (ids.has(item.sliceId)) {
      throw new Error(`invalid_registry: duplicate sliceId ${item.sliceId}`);
    }
    ids.add(item.sliceId);
  }

  for (const item of registry.items) {
    for (const dependencyId of item.dependsOn) {
      if (!ids.has(dependencyId)) {
        throw new Error(
          `invalid_registry: slice ${item.sliceId} depends on missing slice ${dependencyId}`,
        );
      }
    }
  }

  return {
    status,
    registry,
  };
}

export function selectNextDirectiveCompletionSlice(input?: {
  directiveRoot?: string;
  statusPath?: string;
  slicesPath?: string;
}): DirectiveCompletionSliceSelection {
  const directiveRoot = normalizeAbsolutePath(
    input?.directiveRoot || getDefaultDirectiveWorkspaceRoot(),
  );
  const statusRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input?.statusPath || DEFAULT_STATUS_RELATIVE_PATH,
  );
  const slicesRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input?.slicesPath || DEFAULT_SLICES_RELATIVE_PATH,
  );

  const { status, registry } = readCompletionControlSurface({
    directiveRoot,
    statusRelativePath,
    slicesRelativePath,
  });

  const completedSliceIds = new Set(
    registry.items.filter((item) => item.state === "completed").map((item) => item.sliceId),
  );

  if (status.lastCompletedSliceId && !completedSliceIds.has(status.lastCompletedSliceId)) {
    throw new Error(
      `invalid_status: lastCompletedSliceId ${status.lastCompletedSliceId} is not completed`,
    );
  }

  const pendingItems = registry.items.filter((item) => item.state === "pending");
  const frontierItems = pendingItems.filter((item) =>
    item.dependsOn.every((dependencyId) => completedSliceIds.has(dependencyId))
  );
  const frontierWithBlocking = frontierItems.map((item) => {
    const blockingClosedSeams = item.blockedByClosedSeam.filter((seam) =>
      status.closedSeams.includes(seam)
    );
    return {
      item,
      blockingClosedSeams,
    };
  });
  const eligibleItems = frontierWithBlocking
    .filter((entry) => entry.blockingClosedSeams.length === 0)
    .sort((left, right) => left.item.priorityRank - right.item.priorityRank);

  const frontier = frontierWithBlocking
    .map(({ item, blockingClosedSeams }) => ({
      sliceId: item.sliceId,
      priorityRank: item.priorityRank,
      phase: item.phase,
      kind: item.kind,
      owningLane: item.owningLane,
      blockingClosedSeams,
    }))
    .sort((left, right) => left.priorityRank - right.priorityRank);

  if (pendingItems.length === 0) {
    return {
      directiveRoot,
      statusRelativePath,
      slicesRelativePath,
      selectionState: "complete",
      currentTarget: {
        id: status.currentTargetId,
        description: status.currentTargetDescription,
      },
      selectionRule: status.selectionRule,
      closedSeams: [...status.closedSeams],
      lastCompletedSliceId: status.lastCompletedSliceId,
      lastContextArtifactPath: status.lastContextArtifactPath,
      counts: {
        completed: completedSliceIds.size,
        pending: 0,
        frontier: 0,
        eligible: 0,
        blockedByClosedSeam: 0,
      },
      frontier: [],
      selectedSlice: null,
      reason: "All completion slices in the registry are completed.",
    };
  }

  if (eligibleItems.length > 0) {
    const topEligible = eligibleItems[0]!;
    const nextEligible = eligibleItems[1] ?? null;

    if (nextEligible && nextEligible.item.priorityRank === topEligible.item.priorityRank) {
      return {
        directiveRoot,
        statusRelativePath,
        slicesRelativePath,
        selectionState: "needs_decision",
        currentTarget: {
          id: status.currentTargetId,
          description: status.currentTargetDescription,
        },
        selectionRule: status.selectionRule,
        closedSeams: [...status.closedSeams],
        lastCompletedSliceId: status.lastCompletedSliceId,
        lastContextArtifactPath: status.lastContextArtifactPath,
        counts: {
          completed: completedSliceIds.size,
          pending: pendingItems.length,
          frontier: frontierItems.length,
          eligible: eligibleItems.length,
          blockedByClosedSeam: frontierWithBlocking.filter(
            (entry) => entry.blockingClosedSeams.length > 0,
          ).length,
        },
        frontier,
        selectedSlice: null,
        reason: `Multiple eligible slices share the same best priority rank ${topEligible.item.priorityRank}.`,
      };
    }

    return {
      directiveRoot,
      statusRelativePath,
      slicesRelativePath,
      selectionState: "selected",
      currentTarget: {
        id: status.currentTargetId,
        description: status.currentTargetDescription,
      },
      selectionRule: status.selectionRule,
      closedSeams: [...status.closedSeams],
      lastCompletedSliceId: status.lastCompletedSliceId,
      lastContextArtifactPath: status.lastContextArtifactPath,
      counts: {
        completed: completedSliceIds.size,
        pending: pendingItems.length,
        frontier: frontierItems.length,
        eligible: eligibleItems.length,
        blockedByClosedSeam: frontierWithBlocking.filter(
          (entry) => entry.blockingClosedSeams.length > 0,
        ).length,
      },
      frontier,
      selectedSlice: {
        sliceId: topEligible.item.sliceId,
        title: topEligible.item.title,
        phase: topEligible.item.phase,
        kind: topEligible.item.kind,
        owningLane: topEligible.item.owningLane,
        priorityRank: topEligible.item.priorityRank,
        selectionHint: topEligible.item.selectionHint,
        proofCommands: [...topEligible.item.proofCommands],
        rollbackSurface: [...topEligible.item.rollbackSurface],
      },
      reason: `Selected the top eligible slice ${topEligible.item.sliceId} at priority rank ${topEligible.item.priorityRank}.`,
    };
  }

  const blockedFrontier = frontierWithBlocking.filter((entry) => entry.blockingClosedSeams.length > 0);
  if (blockedFrontier.length > 0) {
    return {
      directiveRoot,
      statusRelativePath,
      slicesRelativePath,
      selectionState: "blocked",
      currentTarget: {
        id: status.currentTargetId,
        description: status.currentTargetDescription,
      },
      selectionRule: status.selectionRule,
      closedSeams: [...status.closedSeams],
      lastCompletedSliceId: status.lastCompletedSliceId,
      lastContextArtifactPath: status.lastContextArtifactPath,
      counts: {
        completed: completedSliceIds.size,
        pending: pendingItems.length,
        frontier: frontierItems.length,
        eligible: 0,
        blockedByClosedSeam: blockedFrontier.length,
      },
      frontier,
      selectedSlice: null,
      reason: "All frontier completion slices are currently blocked by intentionally closed seams.",
    };
  }

  throw new Error(
    "invalid_registry: pending completion slices exist, but no frontier slice has satisfiable dependencies",
  );
}
