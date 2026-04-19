import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";

import type { StandaloneRuntimeOverviewSummary } from "./types.ts";
import {
  listJsonFiles,
  listMarkdownFiles,
  readField,
  readHeading,
} from "./shared.ts";

export function readStandaloneRuntimeOverview(input: {
  directiveRoot: string;
  maxEntries?: number;
}): StandaloneRuntimeOverviewSummary {
  const followUpDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "follow-up"),
  );
  const recordsDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "records"),
  );
  const transformationRecordFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && filePath.endsWith("-transformation-record.md"),
  );
  const proofChecklistFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && /-proof-checklist(?:-artifact)?\.md$/i.test(filePath),
  );
  const transformationProofFiles = listJsonFiles(recordsDir).filter((filePath) =>
    filePath.endsWith("-transformation-proof.json")
  );
  const promotionRecordsDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "07-promotion-records"),
  );
  const registryDir = normalizeAbsolutePath(
    path.resolve(input.directiveRoot, "runtime", "registry"),
  );
  const followUpFiles = listMarkdownFiles(followUpDir).filter(
    (filePath) => !filePath.endsWith("/README.md") && !filePath.endsWith("/.gitkeep"),
  );
  const recordFiles = listMarkdownFiles(recordsDir).filter(
    (filePath) => !filePath.endsWith("/README.md") && filePath.endsWith("-runtime-record.md"),
  );
  const promotionRecordFiles = listMarkdownFiles(promotionRecordsDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md")
      && !filePath.endsWith("-runtime-promotion-backlog.md")
      && filePath.endsWith("-promotion-record.md"),
  );
  const registryEntryFiles = listMarkdownFiles(registryDir).filter(
    (filePath) =>
      !filePath.endsWith("/README.md") && filePath.endsWith("-registry-entry.md"),
  );

  const recentEntries = [
    ...followUpFiles,
    ...recordFiles,
    ...proofChecklistFiles,
    ...transformationRecordFiles,
    ...transformationProofFiles,
    ...promotionRecordFiles,
    ...registryEntryFiles,
  ]
    .map((filePath) => {
      const isJson = filePath.endsWith(".json");
      const content = fs.readFileSync(filePath, "utf8");
      const json =
        isJson && content.trim().length > 0
          ? (JSON.parse(content) as Record<string, unknown>)
          : null;
      const kind = filePath.includes("/runtime/00-follow-up/")
        || filePath.includes("/runtime/follow-up/")
        ? ("follow_up" as const)
        : filePath.includes("/runtime/legacy-records/")
          || filePath.includes("/runtime/records/")
          ? /-proof-checklist(?:-artifact)?\.md$/i.test(filePath)
            ? ("proof_bundle" as const)
            : filePath.endsWith("-transformation-record.md")
              ? ("transformation_record" as const)
              : filePath.endsWith("-transformation-proof.json")
                ? ("transformation_proof" as const)
                : ("record" as const)
          : filePath.includes("/runtime/07-promotion-records/")
            ? ("promotion_record" as const)
            : ("registry_entry" as const);
      return {
        kind,
        path: filePath,
        title:
          kind === "transformation_proof"
            ? `Transformation Proof: ${String(json?.candidate_id ?? "unknown")}`
            : readHeading(content),
        candidateId:
          kind === "transformation_proof"
            ? String(json?.candidate_id ?? "").trim() || null
            : readField(content, "Candidate id") ?? readField(content, "Capability id"),
        candidateName:
          kind === "transformation_proof"
            ? null
            : readField(content, "Candidate name")
              ?? readField(content, "Capability name"),
        status:
          kind === "follow_up"
            ? readField(content, "Current status")
            : kind === "record"
              ? readField(content, "Current status")
              : kind === "proof_bundle"
                ? readField(content, "Status")
                : kind === "transformation_record"
                  ? readField(content, "Decision state")
                  : kind === "transformation_proof"
                    ? Array.isArray(json?.regression_checks)
                      && (json?.regression_checks as Array<Record<string, unknown>>).length > 0
                      ? (json?.regression_checks as Array<Record<string, unknown>>).every(
                          (check) => check.result === "pass",
                        )
                        ? "pass"
                        : "fail"
                      : null
                    : kind === "promotion_record"
                      ? readField(content, "Promotion decision")
                      : readField(content, "Runtime status"),
        mtime: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtime - left.mtime)
    .slice(0, input.maxEntries ?? 8)
    .map(({ mtime: _mtime, ...entry }) => entry);

  return {
    followUpCount: followUpFiles.length,
    recordCount: recordFiles.length,
    proofBundleCount: proofChecklistFiles.length,
    transformationRecordCount: transformationRecordFiles.length,
    transformationProofCount: transformationProofFiles.length,
    promotionRecordCount: promotionRecordFiles.length,
    registryEntryCount: registryEntryFiles.length,
    recentEntries,
  };
}
