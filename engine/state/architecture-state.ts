import {
  readDirectiveArchitectureHandoffArtifact,
  type DirectiveArchitectureHandoffArtifact,
} from "../../architecture/lib/experiments/architecture-handoff-start.ts";
import {
  readDirectiveArchitectureBoundedResultArtifact,
  readDirectiveArchitectureBoundedStartArtifact,
  type DirectiveArchitectureBoundedResultArtifact,
  type DirectiveArchitectureBoundedStartArtifact,
} from "../../architecture/lib/experiments/architecture-bounded-closeout.ts";
import {
  readDirectiveArchitectureAdoptionDetail,
  type DirectiveArchitectureAdoptionDetail,
} from "../../architecture/lib/adoption/architecture-result-adoption.ts";
import {
  readDirectiveArchitectureImplementationTargetDetail,
  type DirectiveArchitectureImplementationTargetDetail,
} from "../../architecture/lib/materialization/architecture-implementation-target.ts";
import {
  readDirectiveArchitectureImplementationResultDetail,
  type DirectiveArchitectureImplementationResultDetail,
} from "../../architecture/lib/materialization/architecture-implementation-result.ts";
import {
  readDirectiveArchitectureRetentionDetail,
  type DirectiveArchitectureRetentionDetail,
} from "../../architecture/lib/materialization/architecture-retention.ts";
import {
  readDirectiveArchitectureIntegrationRecordDetail,
  type DirectiveArchitectureIntegrationRecordDetail,
} from "../../architecture/lib/materialization/architecture-integration-record.ts";
import {
  readDirectiveArchitectureConsumptionRecordDetail,
  type DirectiveArchitectureConsumptionRecordDetail,
} from "../../architecture/lib/materialization/architecture-consumption-record.ts";
import {
  readDirectiveArchitecturePostConsumptionEvaluationDetail,
  type DirectiveArchitecturePostConsumptionEvaluationDetail,
} from "../../architecture/lib/materialization/architecture-post-consumption-evaluation.ts";
import {
  lookupArchitectureDeepTailLinkedArtifactPath,
  recordArchitectureDeepTailLinkedArtifactPath,
} from "../../architecture/lib/control/architecture-deep-tail-linkage-index.ts";
import {
  ARCHITECTURE_DEEP_TAIL_STAGE,
} from "../../architecture/lib/control/architecture-deep-tail-stage-map.ts";
import type { ArchitectureDeepTailStageId } from "../../architecture/lib/control/architecture-deep-tail-stage-map.ts";
import {
  readLinkedArtifactIfPresent,
  recordInconsistentLink,
  recordMissingExpectedArtifact,
  recordMissingLinkedArtifactIfAbsent,
} from "../artifact-link-validation.ts";
import {
  findQueueEntryByCandidateId,
  listFiles,
  resolveDirectiveRelativePath,
  zeroLinkedArtifacts,
} from "./shared-state-helpers.ts";
import type {
  DirectiveWorkspaceArtifactKind,
  DirectiveWorkspaceLinkedArtifacts,
} from "./resolve-directive-workspace-state.ts";

function findLinkedArchitectureArtifact<Detail>(input: {
  directiveRoot: string;
  relativeDir: string;
  expectedLinkedPath: string;
  stageId?: ArchitectureDeepTailStageId;
  suffix?: string;
  readDetail: (artifactPath: string) => Detail;
  readLinkedPath: (detail: Detail) => string | null | undefined;
}) {
  if (typeof input.expectedLinkedPath !== "string" || input.expectedLinkedPath.trim().length === 0) {
    return null;
  }

  if (input.stageId) {
    const indexedPath = lookupArchitectureDeepTailLinkedArtifactPath({
      directiveRoot: input.directiveRoot,
      stageId: input.stageId,
      sourceRelativePath: input.expectedLinkedPath,
    });
    if (indexedPath) {
      try {
        const detail = input.readDetail(indexedPath);
        if (input.readLinkedPath(detail) === input.expectedLinkedPath) {
          return {
            path: indexedPath,
            detail,
          };
        }
      } catch {
        // fall through to scan
      }
    }
  }

  for (const artifactPath of listFiles({
    directiveRoot: input.directiveRoot,
    relativeDir: input.relativeDir,
    suffix: input.suffix ?? ".md",
  })) {
    try {
      const detail = input.readDetail(artifactPath);
      if (input.readLinkedPath(detail) === input.expectedLinkedPath) {
        if (input.stageId) {
          recordArchitectureDeepTailLinkedArtifactPath({
            directiveRoot: input.directiveRoot,
            stageId: input.stageId,
            sourceRelativePath: input.expectedLinkedPath,
            targetRelativePath: artifactPath,
          });
        }
        return {
          path: artifactPath,
          detail,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function findArchitectureAdoptionForResult(directiveRoot: string, resultPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: "architecture/02-adopted",
    readDetail: (adoptionPath) => readDirectiveArchitectureAdoptionDetail({
      directiveRoot,
      adoptionPath,
    }),
    readLinkedPath: (detail) => detail.sourceResultRelativePath,
    expectedLinkedPath: resultPath,
  });
}

export function readArchitectureUpstreamChainFromAdoption(input: {
  directiveRoot: string;
  adoptionDetail: DirectiveArchitectureAdoptionDetail;
}) {
  if (!input.adoptionDetail.sourceResultRelativePath) {
    return {
      result: null,
      start: null,
      handoff: null,
    };
  }

  const result = readDirectiveArchitectureBoundedResultArtifact({
    directiveRoot: input.directiveRoot,
    resultPath: input.adoptionDetail.sourceResultRelativePath,
  });
  const start = result.startRelativePath
    ? readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot: input.directiveRoot,
      startPath: result.startRelativePath,
    })
    : null;
  const handoff = readLinkedArtifactIfPresent({
    directiveRoot: input.directiveRoot,
    relativePath: result.handoffStubPath,
    read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
      directiveRoot: input.directiveRoot,
      handoffPath,
    }),
  });

  return {
    result,
    start,
    handoff,
  };
}

export function findArchitectureImplementationTargetForAdoption(directiveRoot: string, adoptionPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir,
    stageId: "implementation_target",
    readDetail: (targetPath) => readDirectiveArchitectureImplementationTargetDetail({
      directiveRoot,
      targetPath,
    }),
    readLinkedPath: (detail) => detail.adoptionRelativePath,
    expectedLinkedPath: adoptionPath,
  });
}

export function findArchitectureImplementationResultForTarget(directiveRoot: string, targetPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result.relativeDir,
    stageId: "implementation_result",
    readDetail: (resultPath) => readDirectiveArchitectureImplementationResultDetail({
      directiveRoot,
      resultPath,
    }),
    readLinkedPath: (detail) => detail.targetRelativePath,
    expectedLinkedPath: targetPath,
  });
}

export function findArchitectureRetentionForResult(directiveRoot: string, implementationResultPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.retained.relativeDir,
    stageId: "retained",
    readDetail: (retainedPath) => readDirectiveArchitectureRetentionDetail({
      directiveRoot,
      retainedPath,
    }),
    readLinkedPath: (detail) => detail.resultRelativePath,
    expectedLinkedPath: implementationResultPath,
  });
}

export function findArchitectureIntegrationForRetention(directiveRoot: string, retainedPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.integration_record.relativeDir,
    stageId: "integration_record",
    readDetail: (integrationPath) => readDirectiveArchitectureIntegrationRecordDetail({
      directiveRoot,
      integrationPath,
    }),
    readLinkedPath: (detail) => detail.retainedRelativePath,
    expectedLinkedPath: retainedPath,
  });
}

export function findArchitectureConsumptionForIntegration(directiveRoot: string, integrationPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record.relativeDir,
    stageId: "consumption_record",
    readDetail: (consumptionPath) => readDirectiveArchitectureConsumptionRecordDetail({
      directiveRoot,
      consumptionPath,
    }),
    readLinkedPath: (detail) => detail.integrationRelativePath,
    expectedLinkedPath: integrationPath,
  });
}

export function findArchitectureEvaluationForConsumption(directiveRoot: string, consumptionPath: string) {
  return findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.relativeDir,
    stageId: "post_consumption_evaluation",
    readDetail: (evaluationPath) => readDirectiveArchitecturePostConsumptionEvaluationDetail({
      directiveRoot,
      evaluationPath,
    }),
    readLinkedPath: (detail) => detail.consumptionRelativePath,
    expectedLinkedPath: consumptionPath,
  });
}

export function findArchitectureReopenedStartForEvaluation(directiveRoot: string, evaluationPath: string) {
  const match = findLinkedArchitectureArtifact({
    directiveRoot,
    relativeDir: "architecture/01-experiments",
    suffix: "-bounded-start.md",
    readDetail: (startPath) => readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot,
      startPath,
    }),
    readLinkedPath: (artifact) => artifact.sourceAnalysisRef,
    expectedLinkedPath: evaluationPath,
  });

  return match
    ? {
      path: match.path,
      artifact: match.detail,
    }
    : null;
}

function isNoteOperatingMode(operatingMode: string | null | undefined) {
  return String(operatingMode ?? "").trim().toLowerCase() === "note";
}

function getArchitectureHandoffNextLegalStep(operatingMode: string | null | undefined) {
  return isNoteOperatingMode(operatingMode)
    ? "Explicitly review the Architecture handoff and record one NOTE-mode bounded result; no bounded start is required."
    : "Explicitly approve the bounded Architecture start.";
}

export function isNoteDirectArchitectureBoundedResult(input: {
  operatingMode: string | null | undefined;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
}) {
  return isNoteOperatingMode(input.operatingMode) && !input.result?.startRelativePath;
}

function getNoteDirectArchitectureBoundedResultNextLegalStep(input: {
  result?: DirectiveArchitectureBoundedResultArtifact | null;
}) {
  if (input.result?.verdict === "adopt") {
    return "No automatic Architecture step is open; this NOTE-mode bounded result is an explicit stop unless a new bounded pressure justifies deeper materialization.";
  }
  return "No automatic Architecture step is open; this NOTE-mode bounded result is an explicit stop unless a new bounded pressure is introduced.";
}

export function buildArchitectureState(input: {
  directiveRoot: string;
  operatingMode?: string | null;
  handoff?: DirectiveArchitectureHandoffArtifact | null;
  start?: DirectiveArchitectureBoundedStartArtifact | null;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
  adoption?: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null;
  implementationTarget?: { path: string; detail: DirectiveArchitectureImplementationTargetDetail } | null;
  implementationResult?: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null;
  retained?: { path: string; detail: DirectiveArchitectureRetentionDetail } | null;
  integration?: { path: string; detail: DirectiveArchitectureIntegrationRecordDetail } | null;
  consumption?: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null;
  evaluation?: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null;
  reopenedStart?: { path: string; artifact: DirectiveArchitectureBoundedStartArtifact } | null;
}) {
  const linked: DirectiveWorkspaceLinkedArtifacts = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.architectureHandoffPath = input.handoff?.handoffRelativePath ?? null;
  linked.architectureBoundedStartPath = input.start?.startRelativePath ?? null;
  linked.architectureBoundedResultPath = input.result?.resultRelativePath ?? null;
  linked.architectureContinuationStartPath =
    input.result?.continuationStartExists ? input.result.continuationStartRelativePath : null;
  linked.architectureAdoptionPath = input.adoption?.path ?? null;
  linked.architectureImplementationTargetPath = input.implementationTarget?.path ?? null;
  linked.architectureImplementationResultPath = input.implementationResult?.path ?? null;
  linked.architectureRetainedPath = input.retained?.path ?? null;
  linked.architectureIntegrationRecordPath = input.integration?.path ?? null;
  linked.architectureConsumptionRecordPath = input.consumption?.path ?? null;
  linked.architectureEvaluationPath = input.evaluation?.path ?? null;
  linked.architectureReopenedStartPath = input.reopenedStart?.path ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.handoff?.discoveryRoutingRecordPath,
    label: "Discovery routing record",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.start?.handoffStubPath,
    label: "Architecture handoff",
  });
  if (input.result && !input.result.decisionExists) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `missing Architecture closeout decision artifact: ${input.result.decisionRelativePath}`,
    );
  }
  if (input.evaluation?.detail.decision === "keep" && input.reopenedStart) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      "keep evaluation unexpectedly links to a reopened Architecture start",
    );
  }
  if (input.evaluation?.detail.decision === "reopen" && !input.reopenedStart) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      "architecture/01-experiments/*-reopened-bounded-start.md",
    );
  }
  if (
    input.result?.verdict === "stay_experimental"
    && !input.result.continuationStartExists
    && !input.adoption
    && !isNoteDirectArchitectureBoundedResult({
      operatingMode: input.operatingMode ?? null,
      result: input.result,
    })
  ) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      input.result.continuationStartRelativePath,
    );
  }
  if (input.result?.verdict === "adopt" && !input.adoption) {
    recordMissingExpectedArtifact({ missingExpectedArtifacts, inconsistentLinks }, "architecture/02-adopted/*.md");
  }
  if (input.adoption && !input.implementationTarget) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.gapPattern,
    );
  }
  if (input.implementationTarget && !input.implementationResult) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result.gapPattern,
    );
  }
  if (input.implementationResult && !input.retained) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.retained.gapPattern,
    );
  }
  if (input.retained && !input.integration) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.integration_record.gapPattern,
    );
  }
  if (input.integration && !input.consumption) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record.gapPattern,
    );
  }
  if (input.consumption && !input.evaluation) {
    recordMissingExpectedArtifact(
      { missingExpectedArtifacts, inconsistentLinks },
      ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation.gapPattern,
    );
  }

  let currentStage = "architecture.handoff.pending_review";
  let nextLegalStep = getArchitectureHandoffNextLegalStep(input.operatingMode ?? null);

  if (input.handoff && input.start && !input.result) {
    currentStage = "architecture.bounded_start.opened";
    nextLegalStep = "Explicitly record bounded closeout/result.";
  }
  if (input.result) {
    currentStage = `architecture.bounded_result.${input.result.verdict}`;
    nextLegalStep =
      isNoteDirectArchitectureBoundedResult({
        operatingMode: input.operatingMode ?? null,
        result: input.result,
      })
        ? getNoteDirectArchitectureBoundedResultNextLegalStep({ result: input.result })
        : input.result.verdict === "stay_experimental"
        ? "Explicitly continue the experimental Architecture slice or stop without auto-advancing."
        : "Explicitly adopt/materialize the bounded Architecture result.";
  }
  if (input.adoption) {
    currentStage = `architecture.adoption.${input.adoption.detail.finalStatus}`;
    nextLegalStep = "Explicitly create the implementation target.";
  }
  if (input.implementationTarget) {
    currentStage = "architecture.implementation_target.opened";
    nextLegalStep = "Explicitly record the implementation result.";
  }
  if (input.implementationResult) {
    currentStage = `architecture.implementation_result.${input.implementationResult.detail.outcome}`;
    nextLegalStep = "Explicitly confirm retention.";
  }
  if (input.retained) {
    currentStage = "architecture.retained.confirmed";
    nextLegalStep = "Explicitly create the integration record.";
  }
  if (input.integration) {
    currentStage = "architecture.integration_record.ready";
    nextLegalStep = "Explicitly record consumption.";
  }
  if (input.consumption) {
    currentStage = `architecture.consumption.${input.consumption.detail.outcome}`;
    nextLegalStep = "Explicitly evaluate the applied Architecture output after use.";
  }
  if (input.evaluation) {
    currentStage = `architecture.post_consumption_evaluation.${input.evaluation.detail.decision}`;
    nextLegalStep =
      input.evaluation.detail.decision === "reopen"
        ? input.reopenedStart
          ? "Explicitly continue or close the reopened bounded Architecture slice; no automatic move is open."
          : "Explicitly approve reopening one bounded Architecture slice."
        : "No automatic Architecture step is open; keep remains an explicit stop unless a new bounded pressure is introduced.";
  }

  return {
    currentStage,
    nextLegalStep,
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "automatic Architecture advancement",
      "Runtime execution from Architecture artifacts",
      "lifecycle orchestration",
    ],
  };
}

export function buildArchitectureArtifactStage(input: {
  artifactKind: DirectiveWorkspaceArtifactKind;
  operatingMode?: string | null;
  result?: DirectiveArchitectureBoundedResultArtifact | null;
  adoption?: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null;
  implementationResult?: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null;
  consumption?: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null;
  evaluation?: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null;
}) {
  switch (input.artifactKind) {
    case "architecture_handoff":
      return {
        artifactStage: "architecture.handoff.pending_review",
        artifactNextLegalStep: getArchitectureHandoffNextLegalStep(input.operatingMode ?? null),
      };
    case "architecture_bounded_start":
      return {
        artifactStage: "architecture.bounded_start.opened",
        artifactNextLegalStep: "Explicitly record bounded closeout/result.",
      };
    case "architecture_bounded_result":
      return {
        artifactStage: `architecture.bounded_result.${input.result?.verdict ?? "unknown"}`,
        artifactNextLegalStep:
          isNoteDirectArchitectureBoundedResult({
            operatingMode: input.operatingMode ?? null,
            result: input.result ?? null,
          })
            ? getNoteDirectArchitectureBoundedResultNextLegalStep({ result: input.result ?? null })
            : input.result?.verdict === "stay_experimental"
            ? "Explicitly continue the experimental Architecture slice or stop without auto-advancing."
            : "Explicitly adopt/materialize the bounded Architecture result.",
      };
    case "architecture_adoption":
      return {
        artifactStage: `architecture.adoption.${input.adoption?.detail.finalStatus ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly create the implementation target.",
      };
    case "architecture_implementation_target":
      return {
        artifactStage: "architecture.implementation_target.opened",
        artifactNextLegalStep: "Explicitly record the implementation result.",
      };
    case "architecture_implementation_result":
      return {
        artifactStage: `architecture.implementation_result.${input.implementationResult?.detail.outcome ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly confirm retention.",
      };
    case "architecture_retained":
      return {
        artifactStage: "architecture.retained.confirmed",
        artifactNextLegalStep: "Explicitly create the integration record.",
      };
    case "architecture_integration_record":
      return {
        artifactStage: "architecture.integration_record.ready",
        artifactNextLegalStep: "Explicitly record consumption.",
      };
    case "architecture_consumption_record":
      return {
        artifactStage: `architecture.consumption.${input.consumption?.detail.outcome ?? "unknown"}`,
        artifactNextLegalStep: "Explicitly evaluate the applied Architecture output after use.",
      };
    case "architecture_post_consumption_evaluation":
      return {
        artifactStage: `architecture.post_consumption_evaluation.${input.evaluation?.detail.decision ?? "unknown"}`,
        artifactNextLegalStep:
          input.evaluation?.detail.decision === "reopen"
            ? "Explicitly approve reopening one bounded Architecture slice."
            : "No automatic Architecture step is open; keep remains an explicit stop unless a new bounded pressure is introduced.",
      };
    default:
      return {
        artifactStage: "architecture.unknown",
        artifactNextLegalStep: "Inspect the bounded Architecture artifact chain directly.",
      };
  }
}

export function resolveArchitectureFocusFromAnyPath(input: {
  directiveRoot: string;
  artifactPath: string;
}) {
  const relativePath = resolveDirectiveRelativePath(input.directiveRoot, input.artifactPath, "artifactPath");

  let handoff: DirectiveArchitectureHandoffArtifact | null = null;
  let start: DirectiveArchitectureBoundedStartArtifact | null = null;
  let result: DirectiveArchitectureBoundedResultArtifact | null = null;
  let adoption: { path: string; detail: DirectiveArchitectureAdoptionDetail } | null = null;
  let implementationTarget: { path: string; detail: DirectiveArchitectureImplementationTargetDetail } | null = null;
  let implementationResult: { path: string; detail: DirectiveArchitectureImplementationResultDetail } | null = null;
  let retained: { path: string; detail: DirectiveArchitectureRetentionDetail } | null = null;
  let integration: { path: string; detail: DirectiveArchitectureIntegrationRecordDetail } | null = null;
  let consumption: { path: string; detail: DirectiveArchitectureConsumptionRecordDetail } | null = null;
  let evaluation: { path: string; detail: DirectiveArchitecturePostConsumptionEvaluationDetail } | null = null;
  let reopenedStart: { path: string; artifact: DirectiveArchitectureBoundedStartArtifact } | null = null;
  let artifactKind: DirectiveWorkspaceArtifactKind = "unknown";

  if (relativePath.endsWith("-engine-handoff.md")) {
    handoff = readDirectiveArchitectureHandoffArtifact({
      directiveRoot: input.directiveRoot,
      handoffPath: relativePath,
    });
    artifactKind = "architecture_handoff";
    if (handoff.startExists) {
      start = readDirectiveArchitectureBoundedStartArtifact({
        directiveRoot: input.directiveRoot,
        startPath: handoff.startRelativePath as string,
      });
    }
    if (handoff.resultExists) {
      result = readDirectiveArchitectureBoundedResultArtifact({
        directiveRoot: input.directiveRoot,
        resultPath: handoff.resultRelativePath,
      });
    }
  } else if (relativePath.endsWith("-bounded-start.md")) {
    start = readDirectiveArchitectureBoundedStartArtifact({
      directiveRoot: input.directiveRoot,
      startPath: relativePath,
    });
    artifactKind = "architecture_bounded_start";
    handoff = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: start.handoffStubPath,
      read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
        directiveRoot: input.directiveRoot,
        handoffPath,
      }),
    });
  } else if (relativePath.endsWith("-bounded-result.md")) {
    result = readDirectiveArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: relativePath,
    });
    artifactKind = "architecture_bounded_result";
    if (result.startRelativePath) {
      start = readDirectiveArchitectureBoundedStartArtifact({
        directiveRoot: input.directiveRoot,
        startPath: result.startRelativePath,
      });
    }
    handoff = readLinkedArtifactIfPresent({
      directiveRoot: input.directiveRoot,
      relativePath: result.handoffStubPath,
      read: (handoffPath) => readDirectiveArchitectureHandoffArtifact({
        directiveRoot: input.directiveRoot,
        handoffPath,
      }),
    });
  } else if (relativePath.startsWith("architecture/02-adopted/")) {
    adoption = {
      path: relativePath,
      detail: readDirectiveArchitectureAdoptionDetail({
        directiveRoot: input.directiveRoot,
        adoptionPath: relativePath,
      }),
    };
    artifactKind = "architecture_adoption";
    ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
      directiveRoot: input.directiveRoot,
      adoptionDetail: adoption.detail,
    }));
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target, relativePath)) {
    implementationTarget = {
      path: relativePath,
      detail: readDirectiveArchitectureImplementationTargetDetail({
        directiveRoot: input.directiveRoot,
        targetPath: relativePath,
      }),
    };
    artifactKind = "architecture_implementation_target";
    adoption = implementationTarget.detail.adoptionRelativePath
      ? {
        path: implementationTarget.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: implementationTarget.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_result, relativePath)) {
    implementationResult = {
      path: relativePath,
      detail: readDirectiveArchitectureImplementationResultDetail({
        directiveRoot: input.directiveRoot,
        resultPath: relativePath,
      }),
    };
    artifactKind = "architecture_implementation_result";
    implementationTarget = findArchitectureImplementationTargetForAdoption(
      input.directiveRoot,
      implementationResult.detail.adoptionRelativePath,
    );
    adoption = implementationResult.detail.adoptionRelativePath
      ? {
        path: implementationResult.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: implementationResult.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.retained, relativePath)) {
    retained = {
      path: relativePath,
      detail: readDirectiveArchitectureRetentionDetail({
        directiveRoot: input.directiveRoot,
        retainedPath: relativePath,
      }),
    };
    artifactKind = "architecture_retained";
    implementationResult = findArchitectureImplementationResultForTarget(
      input.directiveRoot,
      retained.detail.targetRelativePath,
    );
    implementationTarget = implementationResult
      ? findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        implementationResult.detail.adoptionRelativePath,
      )
      : null;
    adoption = retained.detail.adoptionRelativePath
      ? {
        path: retained.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: retained.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.integration_record, relativePath)) {
    integration = {
      path: relativePath,
      detail: readDirectiveArchitectureIntegrationRecordDetail({
        directiveRoot: input.directiveRoot,
        integrationPath: relativePath,
      }),
    };
    artifactKind = "architecture_integration_record";
    retained = findArchitectureRetentionForResult(
      input.directiveRoot,
      integration.detail.resultRelativePath,
    );
    adoption = integration.detail.adoptionRelativePath
      ? {
        path: integration.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: integration.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.consumption_record, relativePath)) {
    consumption = {
      path: relativePath,
      detail: readDirectiveArchitectureConsumptionRecordDetail({
        directiveRoot: input.directiveRoot,
        consumptionPath: relativePath,
      }),
    };
    artifactKind = "architecture_consumption_record";
    integration = findArchitectureIntegrationForRetention(
      input.directiveRoot,
      consumption.detail.retainedRelativePath,
    );
    retained = consumption.detail.retainedRelativePath
      ? {
        path: consumption.detail.retainedRelativePath,
        detail: readDirectiveArchitectureRetentionDetail({
          directiveRoot: input.directiveRoot,
          retainedPath: consumption.detail.retainedRelativePath,
        }),
      }
      : null;
    adoption = consumption.detail.adoptionRelativePath
      ? {
        path: consumption.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: consumption.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
  } else if (matchesArchitectureDeepTailStagePath(ARCHITECTURE_DEEP_TAIL_STAGE.post_consumption_evaluation, relativePath)) {
    evaluation = {
      path: relativePath,
      detail: readDirectiveArchitecturePostConsumptionEvaluationDetail({
        directiveRoot: input.directiveRoot,
        evaluationPath: relativePath,
      }),
    };
    artifactKind = "architecture_post_consumption_evaluation";
    consumption = evaluation.detail.consumptionRelativePath
      ? {
        path: evaluation.detail.consumptionRelativePath,
        detail: readDirectiveArchitectureConsumptionRecordDetail({
          directiveRoot: input.directiveRoot,
          consumptionPath: evaluation.detail.consumptionRelativePath,
        }),
      }
      : null;
    integration = evaluation.detail.integrationRelativePath
      ? {
        path: evaluation.detail.integrationRelativePath,
        detail: readDirectiveArchitectureIntegrationRecordDetail({
          directiveRoot: input.directiveRoot,
          integrationPath: evaluation.detail.integrationRelativePath,
        }),
      }
      : null;
    retained = evaluation.detail.retainedRelativePath
      ? {
        path: evaluation.detail.retainedRelativePath,
        detail: readDirectiveArchitectureRetentionDetail({
          directiveRoot: input.directiveRoot,
          retainedPath: evaluation.detail.retainedRelativePath,
        }),
      }
      : null;
    adoption = evaluation.detail.adoptionRelativePath
      ? {
        path: evaluation.detail.adoptionRelativePath,
        detail: readDirectiveArchitectureAdoptionDetail({
          directiveRoot: input.directiveRoot,
          adoptionPath: evaluation.detail.adoptionRelativePath,
        }),
      }
      : null;
    if (adoption) {
      ({ result, start, handoff } = readArchitectureUpstreamChainFromAdoption({
        directiveRoot: input.directiveRoot,
        adoptionDetail: adoption.detail,
      }));
      implementationTarget = findArchitectureImplementationTargetForAdoption(
        input.directiveRoot,
        adoption.path,
      );
      implementationResult = implementationTarget
        ? findArchitectureImplementationResultForTarget(input.directiveRoot, implementationTarget.path)
        : null;
    }
    reopenedStart = evaluation.detail.decision === "reopen"
      ? findArchitectureReopenedStartForEvaluation(input.directiveRoot, relativePath)
      : null;
  } else {
    throw new Error(`unsupported Architecture artifact path: ${relativePath}`);
  }

  if (start && start.resultExists && !result) {
    result = readDirectiveArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: start.resultRelativePath,
    });
  }
  if (result && !adoption) {
    adoption = findArchitectureAdoptionForResult(input.directiveRoot, result.resultRelativePath);
  }
  if (adoption && !implementationTarget) {
    implementationTarget = findArchitectureImplementationTargetForAdoption(input.directiveRoot, adoption.path);
  }
  if (implementationTarget && !implementationResult) {
    implementationResult = findArchitectureImplementationResultForTarget(
      input.directiveRoot,
      implementationTarget.path,
    );
  }
  if (implementationResult && !retained) {
    retained = findArchitectureRetentionForResult(input.directiveRoot, implementationResult.path);
  }
  if (retained && !integration) {
    integration = findArchitectureIntegrationForRetention(input.directiveRoot, retained.path);
  }
  if (integration && !consumption) {
    consumption = findArchitectureConsumptionForIntegration(input.directiveRoot, integration.path);
  }
  if (consumption && !evaluation) {
    evaluation = findArchitectureEvaluationForConsumption(input.directiveRoot, consumption.path);
  }
  if (evaluation?.detail.decision === "reopen" && !reopenedStart) {
    reopenedStart = findArchitectureReopenedStartForEvaluation(input.directiveRoot, evaluation.path);
  }

  const candidateId =
    evaluation?.detail.candidateId
    ?? consumption?.detail.candidateId
    ?? integration?.detail.candidateId
    ?? retained?.detail.candidateId
    ?? implementationResult?.detail.candidateId
    ?? implementationTarget?.detail.candidateId
    ?? adoption?.detail.candidateId
    ?? result?.candidateId
    ?? start?.candidateId
    ?? handoff?.candidateId
    ?? null;
  const candidateName =
    evaluation?.detail.candidateName
    ?? consumption?.detail.candidateName
    ?? integration?.detail.candidateName
    ?? retained?.detail.candidateName
    ?? implementationResult?.detail.candidateName
    ?? implementationTarget?.detail.candidateName
    ?? adoption?.detail.candidateName
    ?? result?.candidateName
    ?? start?.candidateName
    ?? handoff?.title
    ?? null;
  const queueEntry = candidateId ? findQueueEntryByCandidateId(input.directiveRoot, candidateId) : null;

  return {
    artifactKind,
    candidateId,
    candidateName,
    result,
    adoption,
    implementationResult,
    consumption,
    evaluation,
    ...buildArchitectureState({
      directiveRoot: input.directiveRoot,
      operatingMode: queueEntry?.operating_mode ?? null,
      handoff,
      start,
      result,
      adoption,
      implementationTarget,
      implementationResult,
      retained,
      integration,
      consumption,
      evaluation,
      reopenedStart,
    }),
  };
}
