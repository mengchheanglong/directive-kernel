import fs from "node:fs";
import path from "node:path";

import type { DiscoveryGapWorklist, DiscoveryGapWorklistItem } from "./discovery-gap-worklist-generator.ts";
import { readJson } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { resolveDirectiveRelativePath } from "../../shared/lib/directive-relative-path.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

export const DIRECTIVE_DISCOVERY_GAP_SELECTION_ELIGIBLE_STATUSES = [
  "ready",
  "in_progress",
] as const;

export type DirectiveDiscoveryGapSelectionEligibleStatus =
  (typeof DIRECTIVE_DISCOVERY_GAP_SELECTION_ELIGIBLE_STATUSES)[number];

export type DirectiveSelectedDiscoveryGap = Pick<
  DiscoveryGapWorklistItem,
  | "gap_id"
  | "worklist_rank"
  | "priority_score"
  | "next_slice_track"
  | "next_action"
  | "gap_status"
>;

export type DirectiveDiscoveryGapWorklistSelection = {
  directiveRoot: string;
  worklistRelativePath: string;
  worklistAbsolutePath: string;
  worklistUpdatedAt: string;
  selectionRule: string;
  eligibleStatuses: DirectiveDiscoveryGapSelectionEligibleStatus[];
  totalOpenItems: number;
  eligibleOpenItems: number;
  selectedGap: DirectiveSelectedDiscoveryGap | null;
};

const DEFAULT_WORKLIST_RELATIVE_PATH = "discovery/gap-worklist.json";

function asObject(value: unknown) {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function isGapStatus(value: unknown): value is DiscoveryGapWorklistItem["gap_status"] {
  return value === "ready"
    || value === "in_progress"
    || value === "blocked"
    || value === "monitoring"
    || value === "resolved";
}

function isNextSliceTrack(
  value: unknown,
): value is DiscoveryGapWorklistItem["next_slice_track"] {
  return value === "discovery" || value === "architecture" || value === "runtime";
}

function assertWorklistItemShape(
  item: unknown,
  index: number,
): asserts item is DiscoveryGapWorklistItem {
  const record = asObject(item);
  if (!record) {
    throw new Error(`invalid_worklist: item ${index} must be an object`);
  }

  if (typeof record.gap_id !== "string" || record.gap_id.trim().length === 0) {
    throw new Error(`invalid_worklist: item ${index} is missing gap_id`);
  }
  if (!Number.isInteger(record.worklist_rank) || Number(record.worklist_rank) < 1) {
    throw new Error(`invalid_worklist: item ${index} has invalid worklist_rank`);
  }
  if (!Number.isFinite(record.priority_score)) {
    throw new Error(`invalid_worklist: item ${index} has invalid priority_score`);
  }
  if (!isGapStatus(record.gap_status)) {
    throw new Error(`invalid_worklist: item ${index} has invalid gap_status`);
  }
  if (!isNextSliceTrack(record.next_slice_track)) {
    throw new Error(`invalid_worklist: item ${index} has invalid next_slice_track`);
  }
  if (typeof record.next_action !== "string" || record.next_action.trim().length === 0) {
    throw new Error(`invalid_worklist: item ${index} is missing next_action`);
  }
}

function readDiscoveryGapWorklist(input: {
  directiveRoot: string;
  worklistRelativePath: string;
}) {
  const worklistAbsolutePath = path.resolve(
    input.directiveRoot,
    input.worklistRelativePath,
  ).replace(/\\/g, "/");
  if (!fs.existsSync(worklistAbsolutePath)) {
    throw new Error(`invalid_input: worklistPath not found: ${input.worklistRelativePath}`);
  }

  const parsed = readJson<DiscoveryGapWorklist>(worklistAbsolutePath);
  const record = asObject(parsed);
  if (!record || !Array.isArray(record.items)) {
    throw new Error("invalid_worklist: missing items array");
  }
  if (typeof record.updatedAt !== "string" || record.updatedAt.trim().length === 0) {
    throw new Error("invalid_worklist: missing updatedAt");
  }
  const policy = asObject(record.policy);
  if (!policy || typeof policy.selectionRule !== "string" || policy.selectionRule.trim().length === 0) {
    throw new Error("invalid_worklist: missing policy.selectionRule");
  }

  record.items.forEach((item, index) => {
    assertWorklistItemShape(item, index);
  });

  return {
    worklistAbsolutePath,
    worklist: parsed,
  };
}

export function isDiscoveryGapWorklistItemEligibleForSelection(
  item: Pick<DiscoveryGapWorklistItem, "gap_status">,
): item is Pick<DiscoveryGapWorklistItem, "gap_status"> & {
  gap_status: DirectiveDiscoveryGapSelectionEligibleStatus;
} {
  return item.gap_status === "ready" || item.gap_status === "in_progress";
}

export function readTopEligibleDiscoveryGapFromCanonicalWorklist(input?: {
  directiveRoot?: string;
  worklistPath?: string;
}): DirectiveDiscoveryGapWorklistSelection {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const worklistRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input?.worklistPath || DEFAULT_WORKLIST_RELATIVE_PATH,
  );
  const { worklistAbsolutePath, worklist } = readDiscoveryGapWorklist({
    directiveRoot,
    worklistRelativePath,
  });
  const eligibleItems = worklist.items.filter((item) =>
    isDiscoveryGapWorklistItemEligibleForSelection(item)
  );
  const selectedItem = eligibleItems[0] ?? null;

  return {
    directiveRoot,
    worklistRelativePath,
    worklistAbsolutePath,
    worklistUpdatedAt: worklist.updatedAt,
    selectionRule: worklist.policy.selectionRule,
    eligibleStatuses: [...DIRECTIVE_DISCOVERY_GAP_SELECTION_ELIGIBLE_STATUSES],
    totalOpenItems: worklist.items.length,
    eligibleOpenItems: eligibleItems.length,
    selectedGap: selectedItem
      ? {
          gap_id: selectedItem.gap_id,
          worklist_rank: selectedItem.worklist_rank,
          priority_score: selectedItem.priority_score,
          next_slice_track: selectedItem.next_slice_track,
          next_action: selectedItem.next_action,
          gap_status: selectedItem.gap_status,
        }
      : null,
  };
}
