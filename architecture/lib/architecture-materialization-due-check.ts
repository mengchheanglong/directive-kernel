import path from "node:path";

import {
  getDirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-decision-store.ts";
import type {
  DirectiveArchitectureCycleDecisionSummary,
} from "./architecture-cycle-decision-summary.ts";
import {
  summarizeDirectiveArchitectureCycleDecisions,
} from "./architecture-cycle-decision-summary.ts";
import {
  readDirectiveArchitectureImplementationTargetDetail,
  readDirectiveArchitectureImplementationTargetPathForAdoption,
} from "./architecture-implementation-target.ts";
import {
  readDirectiveArchitectureImplementationResultPathForTarget,
} from "./architecture-implementation-result.ts";
import {
  readDirectiveArchitectureAdoptionDetail,
} from "./architecture-result-adoption.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";
import {
  getDefaultDirectiveWorkspaceRoot,
  normalizeRelativePath,
  normalizePath,
} from "./architecture-deep-tail-artifact-helpers.ts";
import { listDirectiveWorkspaceArtifactRelativePaths } from "../../shared/lib/directive-workspace-artifact-storage.ts";

export type DirectiveArchitectureMaterializationDueKind =
  | "create_implementation_target"
  | "record_implementation_result";

export type DirectiveArchitectureMaterializationDueItem = {
  candidateId: string;
  candidateName: string;
  usefulnessLevel: string;
  dueKind: DirectiveArchitectureMaterializationDueKind;
  currentArtifactPath: string;
  nextArtifactPath: string;
  nextLegalStep: string;
  objective: string;
  rationale: string;
};

export type DirectiveArchitectureMaterializationDueCheck = {
  ok: true;
  snapshotAt: string;
  directiveRoot: string;
  summary: {
    totalDueItems: number;
    adoptionsNeedingTargets: number;
    targetsNeedingResults: number;
  };
  adoptionCompatibility: {
    scannedAdoptionArtifacts: number;
    skippedLegacyIncompatibleAdoptions: number;
    skippedRuntimeHandoffArtifacts: number;
    skippedNonAdoptionArtifacts: number;
    skippedUnreadableAdoptions: number;
    dueAdoptions: number;
    decisionBackedDueAdoptions: number;
    dueAdoptionsMissingDecisionArtifacts: number;
    dueAdoptionsWithUnreadableDecisionArtifacts: number;
  };
  dueAdoptionDecisionSummary: {
    totalAdoptionsSummarized: number;
    recordRelativePaths: string[];
    decisionRelativePaths: string[];
    summary: DirectiveArchitectureCycleDecisionSummary;
  } | null;
  warnings: string[];
  dueItems: DirectiveArchitectureMaterializationDueItem[];
};

type WarningBucket = {
  count: number;
  samples: string[];
};

function listMarkdownRelativePaths(directiveRoot: string, relativeDir: string) {
  return listDirectiveWorkspaceArtifactRelativePaths({
    directiveRoot,
    relativeDir,
    suffix: ".md",
  });
}

function listImplementationTargetRelativePaths(directiveRoot: string) {
  return listMarkdownRelativePaths(directiveRoot, ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir)
    .filter((relativePath) => relativePath.endsWith(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.artifactSuffix));
}

function extractRetainedObjective(content: string) {
  return content.match(/- Objective retained: (.+)$/m)?.[1]?.trim()
    || "Materialize the retained Architecture value as one bounded product-owned slice.";
}

function pushWarningSample(bucket: WarningBucket, relativePath: string) {
  bucket.count += 1;
  if (bucket.samples.length < 3) {
    bucket.samples.push(relativePath);
  }
}

function formatWarningWithSamples(input: {
  count: number;
  message: string;
  samples: string[];
}) {
  if (input.count === 0) {
    return null;
  }

  const sampleText = input.samples.length > 0
    ? ` Samples: ${input.samples.map((sample) => `"${sample}"`).join(", ")}.`
    : "";

  return `${input.message} Count: ${input.count}.${sampleText}`;
}

function isOutOfScopeRuntimeHandoffArtifact(input: {
  decisionVerdict: string | null | undefined;
  completionStatus: string | null | undefined;
  runtimeHandoffRequired: boolean;
}) {
  return input.decisionVerdict === "hand_off_to_runtime"
    && input.completionStatus === "routed_out_of_architecture"
    && input.runtimeHandoffRequired;
}

export function readDirectiveArchitectureMaterializationDueCheck(input: {
  directiveRoot?: string;
} = {}): DirectiveArchitectureMaterializationDueCheck {
  const directiveRoot = normalizePath(input.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const snapshotAt = new Date().toISOString();
  const dueItems: DirectiveArchitectureMaterializationDueItem[] = [];
  const warnings: string[] = [];
  const legacyIncompatibleAdoptions: WarningBucket = { count: 0, samples: [] };
  const runtimeHandoffArtifacts: WarningBucket = { count: 0, samples: [] };
  const nonAdoptionArtifacts: WarningBucket = { count: 0, samples: [] };
  const unreadableAdoptions: WarningBucket = { count: 0, samples: [] };
  const dueAdoptionsMissingDecisionArtifacts: WarningBucket = { count: 0, samples: [] };
  const dueAdoptionsUnreadableDecisionArtifacts: WarningBucket = { count: 0, samples: [] };
  const summarizedDueDecisionRecords: string[] = [];
  const summarizedDueDecisionPaths: string[] = [];
  const summarizedDueDecisionArtifacts: Parameters<typeof summarizeDirectiveArchitectureCycleDecisions>[0]["adoptionArtifacts"] = [];
  let scannedAdoptionArtifacts = 0;
  let dueAdoptions = 0;

  for (const adoptionRelativePath of listMarkdownRelativePaths(directiveRoot, "architecture/02-adopted")) {
    scannedAdoptionArtifacts += 1;

    try {
      const storedDecision = getDirectiveArchitectureAdoptionDecisionArtifact({
        directiveRoot,
        recordRelativePath: adoptionRelativePath,
      });
      if (storedDecision && isOutOfScopeRuntimeHandoffArtifact({
        decisionVerdict: storedDecision.artifact.decision.verdict,
        completionStatus: storedDecision.artifact.decision.completion_status,
        runtimeHandoffRequired: storedDecision.artifact.runtime_handoff?.required === true,
      })) {
        pushWarningSample(runtimeHandoffArtifacts, adoptionRelativePath);
        continue;
      }
    } catch {
      // Keep the existing reader path authoritative for legacy/incompatible records.
    }

    let adoptionDetail: ReturnType<typeof readDirectiveArchitectureAdoptionDetail>;
    try {
      adoptionDetail = readDirectiveArchitectureAdoptionDetail({
        directiveRoot,
        adoptionPath: adoptionRelativePath,
      });
    } catch (error) {
      const message = String((error as Error).message || error);
      if (message.includes("legacy adoption candidate id is required")) {
        pushWarningSample(legacyIncompatibleAdoptions, adoptionRelativePath);
      } else if (message.includes("adoptionPath must point to an adopted Architecture artifact")) {
        pushWarningSample(nonAdoptionArtifacts, adoptionRelativePath);
      } else {
        pushWarningSample(unreadableAdoptions, adoptionRelativePath);
      }
      continue;
    }

    let targetRelativePath: string | null;
    try {
      targetRelativePath = readDirectiveArchitectureImplementationTargetPathForAdoption({
        directiveRoot,
        adoptionRelativePath,
      });
    } catch {
      pushWarningSample(unreadableAdoptions, adoptionRelativePath);
      continue;
    }
    if (targetRelativePath) {
      continue;
    }

    if (!adoptionDetail.deepContinuationRequired) {
      continue;
    }

    dueAdoptions += 1;

    const fileName = path.posix.basename(adoptionRelativePath);
    const nextArtifactPath = normalizeRelativePath(path.posix.join(
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir,
      fileName.replace(/-adopted(?:-planned-next)?\.md$/u, "-implementation-target.md"),
    ));

    dueItems.push({
      candidateId: adoptionDetail.candidateId,
      candidateName: adoptionDetail.candidateName,
      usefulnessLevel: adoptionDetail.usefulnessLevel,
      dueKind: "create_implementation_target",
      currentArtifactPath: adoptionRelativePath,
      nextArtifactPath,
      nextLegalStep: "Explicitly create the implementation target.",
      objective: extractRetainedObjective(adoptionDetail.content),
      rationale:
        "This adopted Architecture output explicitly requires deep continuation, but no bounded implementation target exists yet.",
    });

    if (!adoptionDetail.decisionExists) {
      pushWarningSample(dueAdoptionsMissingDecisionArtifacts, adoptionRelativePath);
      continue;
    }

    try {
      const storedDecision = getDirectiveArchitectureAdoptionDecisionArtifact({
        directiveRoot,
        recordRelativePath: adoptionRelativePath,
      });
      if (!storedDecision) {
        pushWarningSample(dueAdoptionsMissingDecisionArtifacts, adoptionRelativePath);
        continue;
      }

      summarizedDueDecisionRecords.push(storedDecision.recordRelativePath);
      summarizedDueDecisionPaths.push(storedDecision.decisionRelativePath);
      summarizedDueDecisionArtifacts.push(storedDecision.artifact);
    } catch {
      pushWarningSample(dueAdoptionsUnreadableDecisionArtifacts, adoptionRelativePath);
    }
  }

  for (const targetRelativePath of listImplementationTargetRelativePaths(directiveRoot)) {
    let targetDetail: ReturnType<typeof readDirectiveArchitectureImplementationTargetDetail>;
    try {
      targetDetail = readDirectiveArchitectureImplementationTargetDetail({
        directiveRoot,
        targetPath: targetRelativePath,
      });
    } catch (error) {
      warnings.push(
        `Skipped implementation target "${targetRelativePath}": ${String((error as Error).message || error)}`,
      );
      continue;
    }
    const resultRelativePath = readDirectiveArchitectureImplementationResultPathForTarget({
      directiveRoot,
      targetRelativePath,
    });
    if (resultRelativePath) {
      continue;
    }

    const fileName = path.posix.basename(targetRelativePath);
    const nextArtifactPath = normalizeRelativePath(path.posix.join(
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result.relativeDir,
      fileName.replace(/-implementation-target\.md$/u, "-implementation-result.md"),
    ));

    dueItems.push({
      candidateId: targetDetail.candidateId,
      candidateName: targetDetail.candidateName,
      usefulnessLevel: targetDetail.usefulnessLevel,
      dueKind: "record_implementation_result",
      currentArtifactPath: targetRelativePath,
      nextArtifactPath,
      nextLegalStep: "Explicitly record the implementation result.",
      objective: targetDetail.objective,
      rationale:
        "This bounded implementation target is open in repo-backed state but has no recorded result yet, so the iteration is not ratcheted closed.",
    });
  }

  let dueAdoptionDecisionSummary: DirectiveArchitectureMaterializationDueCheck["dueAdoptionDecisionSummary"] = null;
  if (summarizedDueDecisionArtifacts.length > 0) {
    dueAdoptionDecisionSummary = {
      totalAdoptionsSummarized: summarizedDueDecisionRecords.length,
      recordRelativePaths: summarizedDueDecisionRecords,
      decisionRelativePaths: summarizedDueDecisionPaths,
      summary: summarizeDirectiveArchitectureCycleDecisions({
        adoptionArtifacts: summarizedDueDecisionArtifacts,
      }),
    };
  }

  const legacyWarning = formatWarningWithSamples({
    count: legacyIncompatibleAdoptions.count,
    message:
      "Skipped incompatible legacy adopted artifacts that do not expose the minimum candidate-id compatibility needed for the current materialization due-check.",
    samples: legacyIncompatibleAdoptions.samples,
  });
  if (legacyWarning) {
    warnings.push(legacyWarning);
  }

  const nonAdoptionWarning = formatWarningWithSamples({
    count: nonAdoptionArtifacts.count,
    message:
      "Skipped non-adoption artifacts stored under architecture/02-adopted; they remain outside the Architecture materialization due-check scope.",
    samples: nonAdoptionArtifacts.samples,
  });
  if (nonAdoptionWarning) {
    warnings.push(nonAdoptionWarning);
  }

  const unreadableAdoptionWarning = formatWarningWithSamples({
    count: unreadableAdoptions.count,
    message:
      "Skipped adopted artifacts that could not be read compatibly by the current Architecture materialization due-check.",
    samples: unreadableAdoptions.samples,
  });
  if (unreadableAdoptionWarning) {
    warnings.push(unreadableAdoptionWarning);
  }

  const missingDecisionWarning = formatWarningWithSamples({
    count: dueAdoptionsMissingDecisionArtifacts.count,
    message:
      "Due adopted artifacts are still reported, but they are omitted from the due adopted decision summary because paired adoption decision artifacts are missing.",
    samples: dueAdoptionsMissingDecisionArtifacts.samples,
  });
  if (missingDecisionWarning) {
    warnings.push(missingDecisionWarning);
  }

  const unreadableDecisionWarning = formatWarningWithSamples({
    count: dueAdoptionsUnreadableDecisionArtifacts.count,
    message:
      "Due adopted artifacts were omitted from the due adopted decision summary because their paired adoption decision artifacts could not be read cleanly.",
    samples: dueAdoptionsUnreadableDecisionArtifacts.samples,
  });
  if (unreadableDecisionWarning) {
    warnings.push(unreadableDecisionWarning);
  }

  return {
    ok: true,
    snapshotAt,
    directiveRoot,
    summary: {
      totalDueItems: dueItems.length,
      adoptionsNeedingTargets: dueItems.filter((item) => item.dueKind === "create_implementation_target").length,
      targetsNeedingResults: dueItems.filter((item) => item.dueKind === "record_implementation_result").length,
    },
    adoptionCompatibility: {
      scannedAdoptionArtifacts,
      skippedLegacyIncompatibleAdoptions: legacyIncompatibleAdoptions.count,
      skippedRuntimeHandoffArtifacts: runtimeHandoffArtifacts.count,
      skippedNonAdoptionArtifacts: nonAdoptionArtifacts.count,
      skippedUnreadableAdoptions: unreadableAdoptions.count,
      dueAdoptions,
      decisionBackedDueAdoptions: summarizedDueDecisionArtifacts.length,
      dueAdoptionsMissingDecisionArtifacts: dueAdoptionsMissingDecisionArtifacts.count,
      dueAdoptionsWithUnreadableDecisionArtifacts: dueAdoptionsUnreadableDecisionArtifacts.count,
    },
    dueAdoptionDecisionSummary,
    warnings,
    dueItems,
  };
}
