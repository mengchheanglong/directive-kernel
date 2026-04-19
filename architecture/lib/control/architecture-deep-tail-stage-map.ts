/**
 * Canonical stage map for the Architecture deep-tail (DEEP-only continuation bundle).
 *
 * This is the single source of truth for:
 *   - stage identifiers
 *   - relative directory paths
 *   - artifact kind labels (as used by dw-state)
 *   - API route segments (as used by host/frontend)
 *   - expected artifact suffixes
 *   - missing-artifact gap patterns
 *
 * All consumers that previously hardcoded "architecture/04-implementation-targets" etc.
 * should migrate to importing from this map instead.
 *
 * This file is purely declarative. It does not read the filesystem or import other modules.
 */

export type ArchitectureDeepTailStageId =
  | "implementation_target"
  | "implementation_result"
  | "retained"
  | "integration_record"
  | "consumption_record"
  | "post_consumption_evaluation";

export type ArchitectureDeepTailStageDefinition = {
  /** Stable identifier for this stage */
  readonly id: ArchitectureDeepTailStageId;
  /** Relative directory under the directive workspace root */
  readonly relativeDir: string;
  /** Canonical physical storage directory under the directive workspace root */
  readonly storageRelativeDir: string;
  /** Path prefix used for startsWith checks (relativeDir + "/") */
  readonly pathPrefix: string;
  /** Canonical physical-storage path prefix used for startsWith checks */
  readonly storagePathPrefix: string;
  /** Artifact kind label as used by DirectiveWorkspaceArtifactKind */
  readonly artifactKind: string;
  /** API route segment (e.g. "architecture-implementation-targets") */
  readonly apiRouteSegment: string;
  /** Expected artifact file suffix */
  readonly artifactSuffix: string;
  /** Gap pattern used in missing-artifact expectations */
  readonly gapPattern: string;
  /** Chain order (04 = 0, 05 = 1, ..., 09 = 5) */
  readonly chainIndex: number;
};

const implementationTarget: ArchitectureDeepTailStageDefinition = {
  id: "implementation_target",
  relativeDir: "architecture/04-implementation-targets",
  storageRelativeDir: "architecture/04-materialization/04-implementation-targets",
  pathPrefix: "architecture/04-implementation-targets/",
  storagePathPrefix: "architecture/04-materialization/04-implementation-targets/",
  artifactKind: "architecture_implementation_target",
  apiRouteSegment: "architecture-implementation-targets",
  artifactSuffix: "-implementation-target.md",
  gapPattern: "architecture/04-implementation-targets/*.md",
  chainIndex: 0,
};

const implementationResult: ArchitectureDeepTailStageDefinition = {
  id: "implementation_result",
  relativeDir: "architecture/05-implementation-results",
  storageRelativeDir: "architecture/04-materialization/05-implementation-results",
  pathPrefix: "architecture/05-implementation-results/",
  storagePathPrefix: "architecture/04-materialization/05-implementation-results/",
  artifactKind: "architecture_implementation_result",
  apiRouteSegment: "architecture-implementation-results",
  artifactSuffix: "-implementation-result.md",
  gapPattern: "architecture/05-implementation-results/*.md",
  chainIndex: 1,
};

const retained: ArchitectureDeepTailStageDefinition = {
  id: "retained",
  relativeDir: "architecture/06-retained",
  storageRelativeDir: "architecture/04-materialization/06-retained",
  pathPrefix: "architecture/06-retained/",
  storagePathPrefix: "architecture/04-materialization/06-retained/",
  artifactKind: "architecture_retained",
  apiRouteSegment: "architecture-retained",
  artifactSuffix: "-retained.md",
  gapPattern: "architecture/06-retained/*.md",
  chainIndex: 2,
};

const integrationRecord: ArchitectureDeepTailStageDefinition = {
  id: "integration_record",
  relativeDir: "architecture/07-integration-records",
  storageRelativeDir: "architecture/04-materialization/07-integration-records",
  pathPrefix: "architecture/07-integration-records/",
  storagePathPrefix: "architecture/04-materialization/07-integration-records/",
  artifactKind: "architecture_integration_record",
  apiRouteSegment: "architecture-integration-records",
  artifactSuffix: "-integration-record.md",
  gapPattern: "architecture/07-integration-records/*.md",
  chainIndex: 3,
};

const consumptionRecord: ArchitectureDeepTailStageDefinition = {
  id: "consumption_record",
  relativeDir: "architecture/08-consumption-records",
  storageRelativeDir: "architecture/04-materialization/08-consumption-records",
  pathPrefix: "architecture/08-consumption-records/",
  storagePathPrefix: "architecture/04-materialization/08-consumption-records/",
  artifactKind: "architecture_consumption_record",
  apiRouteSegment: "architecture-consumption-records",
  artifactSuffix: "-consumption-record.md",
  gapPattern: "architecture/08-consumption-records/*.md",
  chainIndex: 4,
};

const postConsumptionEvaluation: ArchitectureDeepTailStageDefinition = {
  id: "post_consumption_evaluation",
  relativeDir: "architecture/09-post-consumption-evaluations",
  storageRelativeDir: "architecture/04-materialization/09-post-consumption-evaluations",
  pathPrefix: "architecture/09-post-consumption-evaluations/",
  storagePathPrefix: "architecture/04-materialization/09-post-consumption-evaluations/",
  artifactKind: "architecture_post_consumption_evaluation",
  apiRouteSegment: "architecture-post-consumption-evaluations",
  artifactSuffix: "-evaluation.md",
  gapPattern: "architecture/09-post-consumption-evaluations/*.md",
  chainIndex: 5,
};

/**
 * All deep-tail stages in chain order (04 â†’ 09).
 */
export const ARCHITECTURE_DEEP_TAIL_STAGES = [
  implementationTarget,
  implementationResult,
  retained,
  integrationRecord,
  consumptionRecord,
  postConsumptionEvaluation,
] as const;

/**
 * Lookup a deep-tail stage by its stable identifier.
 */
export const ARCHITECTURE_DEEP_TAIL_STAGE: Record<ArchitectureDeepTailStageId, ArchitectureDeepTailStageDefinition> = {
  implementation_target: implementationTarget,
  implementation_result: implementationResult,
  retained,
  integration_record: integrationRecord,
  consumption_record: consumptionRecord,
  post_consumption_evaluation: postConsumptionEvaluation,
};

/**
 * Resolve which deep-tail stage a relative path belongs to, or null if none.
 */
export function resolveArchitectureDeepTailStage(
  relativePath: string,
): ArchitectureDeepTailStageDefinition | null {
  for (const stage of ARCHITECTURE_DEEP_TAIL_STAGES) {
    if (
      relativePath.startsWith(stage.pathPrefix)
      || relativePath.startsWith(stage.storagePathPrefix)
    ) {
      return stage;
    }
  }
  return null;
}

export function matchesArchitectureDeepTailStagePath(
  stage: ArchitectureDeepTailStageDefinition,
  relativePath: string,
) {
  return relativePath.startsWith(stage.pathPrefix) || relativePath.startsWith(stage.storagePathPrefix);
}

