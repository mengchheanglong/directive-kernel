import fs from "node:fs";
import path from "node:path";

import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";

const FOLLOW_UP_RECORD_PATTERN =
  /(?:runtime-follow-up-record|runtime-followup-record|runtime-followup)\.md$/u;

function isMarkdownFile(name: string) {
  return name.toLowerCase().endsWith(".md");
}

function classifySupportKind(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.includes("profile-checker-decision")) return "profile_checker_decision";
  if (lower.includes("promotion-input-package")) return "promotion_input_package";
  if (lower.includes("seam-review-compile-contract")) return "seam_review_compile_contract";
  if (lower.includes("runtime-implementation-slice") && lower.includes("result")) {
    return "runtime_implementation_result";
  }
  if (lower.includes("runtime-implementation-slice")) return "runtime_implementation_slice";
  if (lower.includes("pre-promotion-implementation-slice")) return "pre_promotion_implementation_slice";
  if (lower.includes("keep-confirmation")) return "keep_confirmation";
  if (lower.includes("runtime-wave")) return "wave_shortlist";
  if (lower.includes("cutover")) return "cutover_note";
  if (lower.includes("closure")) return "closure_note";
  if (lower.includes("playbook")) return "playbook";
  if (lower.includes("runbook")) return "runbook";
  if (lower.includes("bundle")) return "bundle";
  if (lower.includes("contract")) return "contract";
  return "support_note";
}

export function buildDirectiveRuntimeFollowUpNavigationReport(input: {
  directiveRoot: string;
}) {
  const followUpDir = path.join(input.directiveRoot, "runtime", "00-follow-up");
  const archiveDir = path.join(followUpDir, "archive");

  const topLevelEntries = fs
    .readdirSync(followUpDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isMarkdownFile(entry.name) && entry.name !== "README.md")
    .sort((a, b) => a.name.localeCompare(b.name));

  const followUpRecords = topLevelEntries.filter((entry) => FOLLOW_UP_RECORD_PATTERN.test(entry.name));
  const supportFiles = topLevelEntries.filter((entry) => !FOLLOW_UP_RECORD_PATTERN.test(entry.name));

  const followUpRecordSummaries = followUpRecords.map((entry) => {
    const artifactPath = `runtime/00-follow-up/${entry.name}`;
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath,
      includeAnchors: false,
    }).focus;
    const currentHeadPath = focus?.currentHead?.artifactPath ?? null;
    const currentHeadMatchesArtifact = currentHeadPath === artifactPath;

    return {
      artifactPath,
      candidateId: focus?.candidateId ?? null,
      currentStage: focus?.currentStage ?? null,
      nextLegalStep: focus?.nextLegalStep ?? null,
      currentHeadPath,
      currentHeadMatchesArtifact,
      navigationBucket: currentHeadMatchesArtifact ? "active_follow_up_record" : "support_reference_only",
    };
  });

  const supportBundleSummaries = supportFiles.map((entry) => ({
    artifactPath: `runtime/00-follow-up/${entry.name}`,
    supportKind: classifySupportKind(entry.name),
  }));

  const archiveEntries = fs.existsSync(archiveDir)
    ? fs
        .readdirSync(archiveDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && isMarkdownFile(entry.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({
          artifactPath: `runtime/00-follow-up/archive/${entry.name}`,
        }))
    : [];

  return {
    ok: true,
    reportId: "runtime_follow_up_navigation",
    directiveRoot: input.directiveRoot,
    // `npmCommand` is retained for compatibility with older host snapshots.
    canonicalOperatorSurface: {
      packageManagerCommand: "pnpm run report:runtime-follow-up-navigation",
      npmCommand: "pnpm run report:runtime-follow-up-navigation",
      folderPath: "runtime/00-follow-up/",
      defaultNavigationRule:
        "Use this report as the canonical operator entry surface. Do not use raw folder recency as the default navigation method.",
    },
    summary: {
      activeFollowUpRecordCount: followUpRecordSummaries.filter((entry) => entry.currentHeadMatchesArtifact).length,
      supportOnlyFollowUpRecordCount: followUpRecordSummaries.filter((entry) => !entry.currentHeadMatchesArtifact)
        .length,
      supportBundleCount: supportBundleSummaries.length,
      archiveEntryCount: archiveEntries.length,
    },
    noteModeGuidance: {
      defaultStopLine:
        "In NOTE-mode Runtime work, the normal daily stop is the follow-up record. Continue deeper only when a later stage adds concrete new product value.",
      operatorRule:
        "If a case is exploratory or parked, stay on the active follow-up record rather than browsing deeper support bundles by default.",
    },
    activeFollowUpRecords: followUpRecordSummaries.filter((entry) => entry.currentHeadMatchesArtifact),
    supportReferences: {
      followUpRecordsAdvancedPastHead: followUpRecordSummaries.filter((entry) => !entry.currentHeadMatchesArtifact),
      supportBundles: supportBundleSummaries,
    },
    archive: {
      path: "runtime/00-follow-up/archive/",
      operatorRule:
        "Archive is historical only. Do not move support bundles there while active checkers or active operator surfaces still reference them.",
      entries: archiveEntries,
    },
  };
}
