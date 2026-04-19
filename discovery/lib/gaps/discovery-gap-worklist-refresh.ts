import fs from "node:fs";
import path from "node:path";

import { readJson, writeJsonAtomic } from "../../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";
import type { DiscoveryIntakeQueueDocument } from "../intake/discovery-intake-queue-writer.ts";
import {
  generateDiscoveryGapWorklist,
  type CapabilityGapRecord,
} from "./discovery-gap-worklist-generator.ts";

export function refreshDiscoveryGapWorklist(input: {
  directiveRoot: string;
  updatedAt?: string;
}) {
  const directiveRoot = normalizeAbsolutePath(input.directiveRoot);
  const gaps = readJson<{ gaps?: CapabilityGapRecord[] }>(
    path.join(directiveRoot, "discovery", "capability-gaps.json"),
  ).gaps ?? [];
  const intakeQueue = readJson<DiscoveryIntakeQueueDocument>(
    path.join(directiveRoot, "discovery", "intake-queue.json"),
  );
  const activeMissionMarkdown = fs.readFileSync(
    path.join(directiveRoot, "knowledge", "active-mission.md"),
    "utf8",
  );
  const worklist = generateDiscoveryGapWorklist({
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    gaps,
    intakeQueueEntries: intakeQueue.entries ?? [],
    activeMissionMarkdown,
  });
  const worklistPath = normalizeAbsolutePath(
    path.join(directiveRoot, "discovery", "gap-worklist.json"),
  );
  writeJsonAtomic(worklistPath, worklist);
  return {
    worklistPath,
    worklist,
  };
}
