import fs from "node:fs";
import path from "node:path";
import { readJson } from "../../shared/lib/file-io.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  normalizePath,
  resolveDirectiveRelativePath,
} from "./architecture-deep-tail-artifact-helpers.ts";

export const OPERATOR_SIMPLICITY_SLICE_KINDS = [
  "clarity",
  "audit",
  "organization",
  "archive",
  "cleanup",
] as const;

export const OPERATOR_SIMPLICITY_SLICE_STATES = [
  "completed",
  "pending",
  "blocked",
] as const;

export const OPERATOR_SIMPLICITY_SELECTION_STATES = [
  "selected",
  "complete",
  "needs_decision",
  "blocked",
] as const;

export type OperatorSimplicitySliceKind =
  (typeof OPERATOR_SIMPLICITY_SLICE_KINDS)[number];
export type OperatorSimplicitySliceState =
  (typeof OPERATOR_SIMPLICITY_SLICE_STATES)[number];
export type OperatorSimplicitySelectionState =
  (typeof OPERATOR_SIMPLICITY_SELECTION_STATES)[number];

export type OperatorSimplicityMigrationStatus = {
  version: number;
  updatedAt: string;
  anchorPath: string;
  currentTargetId: string;
  currentTargetDescription: string;
  selectionRule: string;
  lastCompletedSliceId: string | null;
  lastContextArtifactPath: string | null;
};

export type OperatorSimplicityMigrationSlice = {
  sliceId: string;
  title: string;
  kind: OperatorSimplicitySliceKind;
  owningLane: "architecture";
  priorityRank: number;
  state: OperatorSimplicitySliceState;
  dependsOn: string[];
  blockingReason: string | null;
  proofCommands: string[];
  rollbackSurface: string[];
  selectionHint: string;
};

export type OperatorSimplicityMigrationRegistry = {
  version: number;
  updatedAt: string;
  policy: {
    selectionRule: string;
    syncRule: string;
  };
  items: OperatorSimplicityMigrationSlice[];
};

export type OperatorSimplicityLoopControlReport = {
  ok: boolean;
  checkerId: "operator_simplicity_loop_control";
  snapshotAt: string;
  mode: "bounded_operator_simplicity_followthrough_loop";
  guardrails: {
    mutatesProductTruth: false;
    opensWorkflowSeams: false;
    renamesHighReferenceAnchorsCasually: false;
    massDeletesHistory: false;
    bundlesUnrelatedCleanup: false;
  };
  setupReadiness: {
    hasMigrationAnchor: boolean;
    hasOperatorStart: boolean;
    hasControlReadme: boolean;
    hasControlStateReadme: boolean;
    hasStateReadme: boolean;
    hasRuntimeFollowUpReadme: boolean;
  };
  migrationStatus: {
    anchorPath: string;
    currentTargetId: string;
    currentTargetDescription: string;
    lastCompletedSliceId: string | null;
    lastContextArtifactPath: string | null;
  };
  counts: {
    completed: number;
    pending: number;
    blocked: number;
    frontierPending: number;
  };
  migrationContext: {
    groupedCheckerFamilies: string[];
    rootRuntimeFollowUpCheckerCount: number;
  };
  blockedFrontier: Array<{
    sliceId: string;
    priorityRank: number;
    kind: OperatorSimplicitySliceKind;
    blockingReason: string;
  }>;
  selectedSlice: null | {
    sliceId: string;
    title: string;
    kind: OperatorSimplicitySliceKind;
    priorityRank: number;
    selectionHint: string;
    proofCommands: string[];
    rollbackSurface: string[];
  };
  selectionState: OperatorSimplicitySelectionState;
  reason: string;
};

const DEFAULT_STATUS_RELATIVE_PATH = "control/state/operator-simplicity-migration-status.json";
const DEFAULT_SLICES_RELATIVE_PATH = "control/state/operator-simplicity-migration-slices.json";

function asObject(value: unknown) {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`invalid_shape: ${label} must be a string array`);
  }
}

function isSliceKind(value: unknown): value is OperatorSimplicitySliceKind {
  return typeof value === "string"
    && OPERATOR_SIMPLICITY_SLICE_KINDS.includes(value as OperatorSimplicitySliceKind);
}

function isSliceState(value: unknown): value is OperatorSimplicitySliceState {
  return typeof value === "string"
    && OPERATOR_SIMPLICITY_SLICE_STATES.includes(value as OperatorSimplicitySliceState);
}



function assertStatusShape(value: unknown): asserts value is OperatorSimplicityMigrationStatus {
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

function assertSliceShape(
  value: unknown,
  index: number,
): asserts value is OperatorSimplicityMigrationSlice {
  const record = asObject(value);
  if (!record) {
    throw new Error(`invalid_registry: item ${index} must be an object`);
  }
  for (const field of ["sliceId", "title", "selectionHint"] as const) {
    if (typeof record[field] !== "string" || record[field].trim().length === 0) {
      throw new Error(`invalid_registry: item ${index} missing ${field}`);
    }
  }
  if (!isSliceKind(record.kind)) {
    throw new Error(`invalid_registry: item ${index} has invalid kind`);
  }
  if (record.owningLane !== "architecture") {
    throw new Error(`invalid_registry: item ${index} has invalid owningLane`);
  }
  if (!Number.isInteger(record.priorityRank) || Number(record.priorityRank) < 1) {
    throw new Error(`invalid_registry: item ${index} has invalid priorityRank`);
  }
  if (!isSliceState(record.state)) {
    throw new Error(`invalid_registry: item ${index} has invalid state`);
  }
  assertStringArray(record.dependsOn, `items[${index}].dependsOn`);
  assertStringArray(record.proofCommands, `items[${index}].proofCommands`);
  assertStringArray(record.rollbackSurface, `items[${index}].rollbackSurface`);
  if (
    record.blockingReason !== null
    && (typeof record.blockingReason !== "string" || record.blockingReason.trim().length === 0)
  ) {
    throw new Error(`invalid_registry: item ${index} has invalid blockingReason`);
  }
}

function readMigrationControlSurface(input: {
  directiveRoot: string;
  statusRelativePath: string;
  slicesRelativePath: string;
}) {
  const statusAbsolutePath = normalizePath(
    path.join(input.directiveRoot, input.statusRelativePath),
  );
  const slicesAbsolutePath = normalizePath(
    path.join(input.directiveRoot, input.slicesRelativePath),
  );

  const status = readJson<OperatorSimplicityMigrationStatus>(statusAbsolutePath);
  const registry = readJson<OperatorSimplicityMigrationRegistry>(slicesAbsolutePath);

  assertStatusShape(status);
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
    assertSliceShape(item, index);
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

  return { status, registry };
}

function listGroupedCheckerFamilies(directiveRoot: string) {
  const scriptsRoot = path.join(directiveRoot, "scripts");
  if (!fs.existsSync(scriptsRoot)) {
    return [];
  }

  return fs.readdirSync(scriptsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const directoryPath = path.join(scriptsRoot, name);
      return fs.readdirSync(directoryPath).some((entry) => /^check-.*\.ts$/.test(entry));
    })
    .sort();
}

function countRootRuntimeFollowUpCheckers(directiveRoot: string) {
  const scriptsRoot = path.join(directiveRoot, "scripts");
  if (!fs.existsSync(scriptsRoot)) {
    return 0;
  }

  return fs.readdirSync(scriptsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^check-runtime-follow-up-.*\.ts$/.test(entry.name))
    .length;
}

export function buildDirectiveOperatorSimplicityLoopControlReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
  statusPath?: string;
  slicesPath?: string;
}): OperatorSimplicityLoopControlReport {
  const directiveRoot = normalizePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const snapshotAt = input?.snapshotAt ?? new Date().toISOString();
  const statusRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input?.statusPath || DEFAULT_STATUS_RELATIVE_PATH,
  );
  const slicesRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input?.slicesPath || DEFAULT_SLICES_RELATIVE_PATH,
  );

  const { status, registry } = readMigrationControlSurface({
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
  const blockedItems = registry.items.filter((item) => item.state === "blocked");
  const frontierPending = pendingItems
    .filter((item) => item.dependsOn.every((dependencyId) => completedSliceIds.has(dependencyId)))
    .sort((left, right) => left.priorityRank - right.priorityRank);
  const blockedFrontier = blockedItems
    .filter((item) => item.dependsOn.every((dependencyId) => completedSliceIds.has(dependencyId)))
    .sort((left, right) => left.priorityRank - right.priorityRank)
    .map((item) => ({
      sliceId: item.sliceId,
      priorityRank: item.priorityRank,
      kind: item.kind,
      blockingReason: item.blockingReason || "blocked without explicit reason",
    }));

  const setupReadiness = {
    hasMigrationAnchor: fs.existsSync(path.join(directiveRoot, status.anchorPath)),
    hasControlReadme: fs.existsSync(path.join(directiveRoot, "control/README.md")),
    hasControlStateReadme: fs.existsSync(path.join(directiveRoot, "control/state/README.md")),
    hasStateReadme: fs.existsSync(path.join(directiveRoot, "state/README.md")),
    hasRuntimeFollowUpReadme: fs.existsSync(path.join(directiveRoot, "runtime/00-follow-up/README.md")),
  };
  const migrationContext = {
    groupedCheckerFamilies: listGroupedCheckerFamilies(directiveRoot),
    rootRuntimeFollowUpCheckerCount: countRootRuntimeFollowUpCheckers(directiveRoot),
  };

  if (pendingItems.length === 0 && blockedItems.length === 0) {
    return {
      ok: true,
      checkerId: "operator_simplicity_loop_control",
      snapshotAt,
      mode: "bounded_operator_simplicity_followthrough_loop",
      guardrails: {
        mutatesProductTruth: false,
        opensWorkflowSeams: false,
        renamesHighReferenceAnchorsCasually: false,
        massDeletesHistory: false,
        bundlesUnrelatedCleanup: false,
      },
      setupReadiness,
      migrationStatus: {
        anchorPath: status.anchorPath,
        currentTargetId: status.currentTargetId,
        currentTargetDescription: status.currentTargetDescription,
        lastCompletedSliceId: status.lastCompletedSliceId,
        lastContextArtifactPath: status.lastContextArtifactPath,
      },
      counts: {
        completed: completedSliceIds.size,
        pending: 0,
        blocked: 0,
        frontierPending: 0,
      },
      migrationContext,
      blockedFrontier: [],
      selectedSlice: null,
      selectionState: "complete",
      reason: "All operator-simplicity migration slices in the registry are completed.",
    };
  }

  if (frontierPending.length > 0) {
    const topEligible = frontierPending[0]!;
    const nextEligible = frontierPending[1] ?? null;

    if (nextEligible && nextEligible.priorityRank === topEligible.priorityRank) {
      return {
        ok: true,
        checkerId: "operator_simplicity_loop_control",
        snapshotAt,
        mode: "bounded_operator_simplicity_followthrough_loop",
        guardrails: {
          mutatesProductTruth: false,
          opensWorkflowSeams: false,
          renamesHighReferenceAnchorsCasually: false,
          massDeletesHistory: false,
          bundlesUnrelatedCleanup: false,
        },
        setupReadiness,
        migrationStatus: {
          anchorPath: status.anchorPath,
          currentTargetId: status.currentTargetId,
          currentTargetDescription: status.currentTargetDescription,
          lastCompletedSliceId: status.lastCompletedSliceId,
          lastContextArtifactPath: status.lastContextArtifactPath,
        },
        counts: {
          completed: completedSliceIds.size,
          pending: pendingItems.length,
          blocked: blockedItems.length,
          frontierPending: frontierPending.length,
        },
        migrationContext,
        blockedFrontier,
        selectedSlice: null,
        selectionState: "needs_decision",
        reason: `Multiple pending operator-simplicity slices share the same best priority rank ${topEligible.priorityRank}.`,
      };
    }

    return {
      ok: true,
      checkerId: "operator_simplicity_loop_control",
      snapshotAt,
      mode: "bounded_operator_simplicity_followthrough_loop",
      guardrails: {
        mutatesProductTruth: false,
        opensWorkflowSeams: false,
        renamesHighReferenceAnchorsCasually: false,
        massDeletesHistory: false,
        bundlesUnrelatedCleanup: false,
      },
      setupReadiness,
      migrationStatus: {
        anchorPath: status.anchorPath,
        currentTargetId: status.currentTargetId,
        currentTargetDescription: status.currentTargetDescription,
        lastCompletedSliceId: status.lastCompletedSliceId,
        lastContextArtifactPath: status.lastContextArtifactPath,
      },
      counts: {
        completed: completedSliceIds.size,
        pending: pendingItems.length,
        blocked: blockedItems.length,
        frontierPending: frontierPending.length,
      },
      migrationContext,
      blockedFrontier,
      selectedSlice: {
        sliceId: topEligible.sliceId,
        title: topEligible.title,
        kind: topEligible.kind,
        priorityRank: topEligible.priorityRank,
        selectionHint: topEligible.selectionHint,
        proofCommands: [...topEligible.proofCommands],
        rollbackSurface: [...topEligible.rollbackSurface],
      },
      selectionState: "selected",
      reason: `Selected the top eligible operator-simplicity slice ${topEligible.sliceId} at priority rank ${topEligible.priorityRank}.`,
    };
  }

  return {
    ok: true,
    checkerId: "operator_simplicity_loop_control",
    snapshotAt,
    mode: "bounded_operator_simplicity_followthrough_loop",
    guardrails: {
      mutatesProductTruth: false,
      opensWorkflowSeams: false,
      renamesHighReferenceAnchorsCasually: false,
      massDeletesHistory: false,
      bundlesUnrelatedCleanup: false,
    },
    setupReadiness,
    migrationStatus: {
      anchorPath: status.anchorPath,
      currentTargetId: status.currentTargetId,
      currentTargetDescription: status.currentTargetDescription,
      lastCompletedSliceId: status.lastCompletedSliceId,
      lastContextArtifactPath: status.lastContextArtifactPath,
    },
    counts: {
      completed: completedSliceIds.size,
      pending: pendingItems.length,
      blocked: blockedItems.length,
      frontierPending: 0,
    },
    migrationContext,
    blockedFrontier,
    selectedSlice: null,
    selectionState: "blocked",
    reason: "No eligible pending operator-simplicity slice exists; the remaining frontier is currently blocked.",
  };
}
