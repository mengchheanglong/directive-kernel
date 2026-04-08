import fs from "node:fs";
import path from "node:path";

import {
  normalizePath,
  prepareDirectiveArchitectureDeepTailWrite,
  requiredString,
  readDirectiveArchitectureDeepTailDetailArtifact,
  resolveDirectiveRelativePath,
  resolveDirectiveWorkspaceRoot,
  writeDirectiveArchitectureDeepTailArtifact,
} from "./architecture-deep-tail-artifact-helpers.ts";
import {
  loadDirectiveArchitectureAdoptionDecisionArtifact,
} from "./architecture-adoption-decision-store.ts";
import type {
  ArchitectureArtifactType,
  ArchitectureUsefulnessLevel,
} from "./architecture-adoption-resolution.ts";
import {
  readDirectiveArchitectureBoundedResultArtifact,
} from "./architecture-bounded-closeout.ts";
import {
  readDirectiveArchitectureAdoptionDetail,
} from "./architecture-result-adoption.ts";
import { ARCHITECTURE_DEEP_TAIL_STAGE } from "./architecture-deep-tail-stage-map.ts";
import { resolveDirectiveWorkspaceArtifactAbsolutePath } from "../../shared/lib/directive-workspace-artifact-storage.ts";

type ImplementationTargetSourceContext = {
  objective: string;
  resultSummary: string;
  boundedScope: string[];
  inputs: string[];
  validationGates: string[];
  sourceResultRelativePath: string;
  sourceStartRelativePath: string | null;
  handoffStubPath: string;
  engineRunRecordPath: string;
  engineRunReportPath: string;
  discoveryRoutingRecordPath: string;
  legacyAdoptionFallback: boolean;
};

type ImplementationTargetDecisionEnvelopeContext = {
  decisionFormat: string;
  completionStatus: string;
  verificationMethod: string;
  verificationResult: string;
  runtimeThresholdCheck: string;
  adoptionVerdict: string;
  readinessPassed: boolean;
  failedReadinessChecks: string[];
  runtimeHandoffRequired: boolean;
  runtimeHandoffRationale: string;
  artifactPath: string;
  primaryEvidencePath: string;
  selfImprovementCategory: string;
  selfImprovementVerificationMethod: string;
  selfImprovementVerificationResult: string;
};

export type CreateDirectiveArchitectureImplementationTargetInput = {
  adoptionPath: string;
  directiveRoot?: string;
  createdBy?: string | null;
  selectedBoundedSlice?: string[] | null;
  mechanicalSuccessCriteria?: string[] | null;
  explicitLimitations?: string[] | null;
};

export type DirectiveArchitectureImplementationTargetResult = {
  ok: true;
  created: boolean;
  snapshotAt: string;
  directiveRoot: string;
  adoptionRelativePath: string;
  adoptionAbsolutePath: string;
  targetRelativePath: string;
  targetAbsolutePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  artifactType: ArchitectureArtifactType;
  finalStatus: string;
};

export type DirectiveArchitectureImplementationTargetDetail = {
  directiveRoot: string;
  targetRelativePath: string;
  targetAbsolutePath: string;
  adoptionRelativePath: string;
  adoptionAbsolutePath: string;
  decisionRelativePath: string;
  sourceResultRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  artifactType: ArchitectureArtifactType;
  finalStatus: string;
  sourceDecisionFormat: string;
  sourceCompletionStatus: string;
  sourceVerificationMethod: string;
  sourceVerificationResult: string;
  sourceRuntimeThresholdCheck: string;
  sourceAdoptionVerdict: string;
  sourceReadinessPassed: boolean;
  sourceFailedReadinessChecks: string[];
  sourceRuntimeHandoffRequired: boolean;
  sourceRuntimeHandoffRationale: string;
  sourceArtifactPath: string;
  sourcePrimaryEvidencePath: string;
  sourceSelfImprovementCategory: string;
  sourceSelfImprovementVerificationMethod: string;
  sourceSelfImprovementVerificationResult: string;
  objective: string;
  expectedOutcome: string;
  selectedBoundedSlice: string[];
  mechanicalSuccessCriteria: string[];
  explicitLimitations: string[];
  content: string;
};

function optionalStringList(values: string[] | null | undefined) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function renderBulletList(items: string[], fallback: string) {
  if (items.length === 0) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatYesNo(value: boolean) {
  return value ? "yes" : "no";
}

function appendUnique(items: string[], value: string) {
  return items.includes(value) ? items : [...items, value];
}

function extractSectionBullets(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`));
  if (!match) {
    return [] as string[];
  }

  return match[1]
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /u, "").trim())
    .filter((line) => line.length > 0);
}

function extractSectionBody(content: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`## ${escapedHeading}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`));
  if (!match) {
    return "";
  }

  return match[1].trim();
}

function resolveImplementationTargetRelativePath(adoptionRelativePath: string) {
  const fileName = path.posix.basename(adoptionRelativePath);
  let targetName = fileName;
  if (fileName.endsWith("-adopted-planned-next.md")) {
    targetName = fileName.replace(/-adopted-planned-next\.md$/u, "-implementation-target.md");
  } else if (fileName.endsWith("-adopted.md")) {
    targetName = fileName.replace(/-adopted\.md$/u, "-implementation-target.md");
  } else {
    throw new Error("invalid_input: adoptionPath must point to an adopted Architecture artifact");
  }

  return path.posix.join(ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target.relativeDir, targetName);
}

export function readDirectiveArchitectureImplementationTargetPathForAdoption(input: {
  directiveRoot: string;
  adoptionRelativePath: string;
}) {
  const directiveRoot = resolveDirectiveWorkspaceRoot(input.directiveRoot);
  const adoptionRelativePath = resolveDirectiveRelativePath(
    directiveRoot,
    input.adoptionRelativePath,
  );
  const targetRelativePath = resolveImplementationTargetRelativePath(adoptionRelativePath);
  const targetAbsolutePath = resolveDirectiveWorkspaceArtifactAbsolutePath({
    directiveRoot,
    relativePath: targetRelativePath,
    mode: "read",
  });

  return fs.existsSync(targetAbsolutePath) ? targetRelativePath : null;
}

function mapArtifactTypeToBuildTarget(artifactType: ArchitectureArtifactType) {
  switch (artifactType) {
    case "engine-code":
      return "one Directive-owned engine-code implementation slice";
    case "shared-lib":
      return "one Directive-owned legacy shared-lib implementation slice";
    case "reference-pattern":
      return "one Directive-owned legacy reference-pattern implementation slice";
    case "doctrine-update":
      return "one Directive-owned doctrine update slice";
    case "policy":
      return "one Directive-owned policy implementation slice";
    case "schema":
      return "one Directive-owned schema implementation slice";
    case "contract":
      return "one Directive-owned contract implementation slice";
    case "template":
      return "one Directive-owned template implementation slice";
    default:
      return "one Directive-owned Architecture implementation slice";
  }
}

function mapArtifactTypeToLegacyReuseTarget(artifactType: ArchitectureArtifactType) {
  switch (artifactType) {
    case "engine-code":
      return "one bounded reuse of the adopted engine code";
    case "shared-lib":
      return "one bounded reuse of the adopted legacy shared-lib artifact";
    case "reference-pattern":
      return "one bounded reuse of the adopted legacy reference-pattern artifact";
    case "doctrine-update":
      return "one bounded reuse of the adopted operating rule";
    case "policy":
      return "one bounded reuse of the adopted policy";
    case "schema":
      return "one bounded reuse of the adopted schema";
    case "contract":
      return "one bounded reuse of the adopted contract";
    case "template":
      return "one bounded reuse of the adopted template";
    default:
      return "one bounded reuse of the adopted Architecture value";
  }
}

function extractObjectiveFromAdoption(content: string) {
  return content.match(/- Objective retained: (.+)$/m)?.[1]?.trim()
    || "";
}

function extractRollbackFromAdoption(content: string) {
  return content.match(/- Rollback: (.+)$/m)?.[1]?.trim()
    || "";
}

function resolveLegacyImplementationTargetContext(input: {
  adoptionDetail: ReturnType<typeof readDirectiveArchitectureAdoptionDetail>;
  artifactType: ArchitectureArtifactType;
  artifactPath: string;
  sourceAnalysisRef?: string;
  adaptationDecisionRef?: string;
  primaryEvidencePath?: string;
}): ImplementationTargetSourceContext {
  const whatWasExtracted = extractSectionBullets(input.adoptionDetail.content, "What was extracted");
  const excludedBaggage = extractSectionBullets(input.adoptionDetail.content, "What was excluded as baggage");
  const whyAdopted = extractSectionBody(input.adoptionDetail.content, "Why adopted");
  const resultSummary = whyAdopted
    || `Reuse ${mapArtifactTypeToLegacyReuseTarget(input.artifactType)} in one bounded Architecture slice so the retained mechanism stops depending on prose-only recall.`;
  const retainedMechanismSummary = whatWasExtracted.length > 0
    ? `Retained mechanism focus: ${whatWasExtracted.join("; ")}`
    : `Retained product artifact: \`${input.artifactPath}\``;
  const inputs = [
    `Primary adopted product artifact: \`${input.artifactPath}\``,
    retainedMechanismSummary,
  ];

  if (input.primaryEvidencePath) {
    inputs.push(`Primary evidence path: \`${input.primaryEvidencePath}\``);
  }
  if (input.sourceAnalysisRef) {
    inputs.push(`Source analysis reference: \`${input.sourceAnalysisRef}\``);
  }
  if (input.adaptationDecisionRef) {
    inputs.push(`Adaptation decision reference: \`${input.adaptationDecisionRef}\``);
  }
  if (excludedBaggage.length > 0) {
    inputs.push(`Keep excluded baggage out of scope: ${excludedBaggage.join("; ")}`);
  }

  return {
    objective: `Materialize ${mapArtifactTypeToLegacyReuseTarget(input.artifactType)} inside one live Directive Architecture path.`,
    resultSummary,
    boundedScope: [
      "Keep this to one bounded Directive-owned implementation slice.",
      "Consume the adopted value directly instead of re-deriving it from source prose or host-local logic.",
      "Do not add runtime execution, host integration, or Runtime reopening from this target.",
    ],
    inputs,
    validationGates: [
      "decision_review",
      "ownership_boundary_check",
      "artifact_evidence_continuity_check",
    ],
    sourceResultRelativePath: "",
    sourceStartRelativePath: "",
    handoffStubPath: "",
    engineRunRecordPath: "",
    engineRunReportPath: "",
    discoveryRoutingRecordPath: "",
    legacyAdoptionFallback: true,
  };
}

function resolveImplementationTargetSourceContext(input: {
  directiveRoot: string;
  adoptionDetail: ReturnType<typeof readDirectiveArchitectureAdoptionDetail>;
  artifactType: ArchitectureArtifactType;
  artifactPath: string;
  sourceAnalysisRef?: string;
  adaptationDecisionRef?: string;
  primaryEvidencePath?: string;
}): ImplementationTargetSourceContext {
  if (input.adoptionDetail.sourceResultRelativePath) {
    const sourceResult = readDirectiveArchitectureBoundedResultArtifact({
      directiveRoot: input.directiveRoot,
      resultPath: input.adoptionDetail.sourceResultRelativePath,
    });

    return {
      objective: extractObjectiveFromAdoption(input.adoptionDetail.content) || sourceResult.objective,
      resultSummary: sourceResult.resultSummary,
      boundedScope: sourceResult.boundedScope,
      inputs: sourceResult.inputs,
      validationGates: sourceResult.validationGates,
      sourceResultRelativePath: input.adoptionDetail.sourceResultRelativePath,
      sourceStartRelativePath: sourceResult.startRelativePath,
      handoffStubPath: sourceResult.handoffStubPath,
      engineRunRecordPath: sourceResult.engineRunRecordPath,
      engineRunReportPath: sourceResult.engineRunReportPath,
      discoveryRoutingRecordPath: sourceResult.discoveryRoutingRecordPath,
      legacyAdoptionFallback: false,
    };
  }

  return resolveLegacyImplementationTargetContext({
    adoptionDetail: input.adoptionDetail,
    artifactType: input.artifactType,
    artifactPath: input.artifactPath,
    sourceAnalysisRef: input.sourceAnalysisRef,
    adaptationDecisionRef: input.adaptationDecisionRef,
    primaryEvidencePath: input.primaryEvidencePath,
  });
}

function resolveImplementationTargetDecisionEnvelopeContext(input: {
  adoptionDecision: ReturnType<typeof loadDirectiveArchitectureAdoptionDecisionArtifact>;
}) : ImplementationTargetDecisionEnvelopeContext {
  const artifact = input.adoptionDecision.artifact;
  const failedReadinessChecks = Object.entries(artifact.readiness_check)
    .filter(([, passed]) => passed === false)
    .map(([check]) => check);
  return {
    decisionFormat: artifact.decision_format,
    completionStatus: artifact.decision.completion_status || "not_recorded",
    verificationMethod:
      artifact.self_improvement?.verification_method || "not_recorded",
    verificationResult:
      artifact.self_improvement?.verification_result || "not_recorded",
    runtimeThresholdCheck:
      artifact.decision.runtime_threshold_check || "not_recorded",
    adoptionVerdict: artifact.decision.verdict,
    readinessPassed: failedReadinessChecks.length === 0,
    failedReadinessChecks,
    runtimeHandoffRequired: artifact.runtime_handoff?.required ?? false,
    runtimeHandoffRationale: artifact.runtime_handoff?.rationale || "",
    artifactPath: artifact.artifact_path,
    primaryEvidencePath: artifact.primary_evidence_path || "",
    selfImprovementCategory: artifact.self_improvement?.category || "",
    selfImprovementVerificationMethod:
      artifact.self_improvement?.verification_method || "not_recorded",
    selfImprovementVerificationResult:
      artifact.self_improvement?.verification_result || "not_recorded",
  };
}

function renderImplementationTargetMarkdown(input: {
  snapshotAt: string;
  createdBy: string;
  targetRelativePath: string;
  adoptionRelativePath: string;
  decisionRelativePath: string;
  candidateId: string;
  candidateName: string;
  usefulnessLevel: ArchitectureUsefulnessLevel;
  artifactType: ArchitectureArtifactType;
  finalStatus: string;
  sourceDecisionFormat: string;
  sourceCompletionStatus: string;
  sourceVerificationMethod: string;
  sourceVerificationResult: string;
  sourceRuntimeThresholdCheck: string;
  sourceAdoptionVerdict: string;
  sourceReadinessPassed: boolean;
  sourceFailedReadinessChecks: string[];
  sourceRuntimeHandoffRequired: boolean;
  sourceRuntimeHandoffRationale: string;
  sourceArtifactPath: string;
  sourcePrimaryEvidencePath: string;
  sourceSelfImprovementCategory: string;
  sourceSelfImprovementVerificationMethod: string;
  sourceSelfImprovementVerificationResult: string;
  objective: string;
  resultSummary: string;
  boundedScope: string[];
  inputs: string[];
  validationGates: string[];
  selectedBoundedSlice: string[];
  mechanicalSuccessCriteria: string[];
  explicitLimitations: string[];
  rollback: string;
  sourceResultRelativePath: string;
  sourceStartRelativePath: string | null;
  handoffStubPath: string;
  engineRunRecordPath: string;
  engineRunReportPath: string;
  discoveryRoutingRecordPath: string;
  legacyAdoptionFallback: boolean;
}) {
  const expectedTarget = mapArtifactTypeToBuildTarget(input.artifactType);
  const boundedScope = renderBulletList(
    input.boundedScope,
    "Keep this to one bounded Directive-owned implementation slice.",
  );
  const selectedBoundedSlice = renderBulletList(
    input.selectedBoundedSlice,
    "Select one bounded tactical slice from the adopted value and record it explicitly before treating the target as complete.",
  );
  const mechanicalSuccessCriteria = renderBulletList(
    input.mechanicalSuccessCriteria.length > 0
      ? input.mechanicalSuccessCriteria
      : [
          ...input.validationGates.map(
            (gate) => `Satisfy validation gate \`${gate}\` and record the corresponding evidence in the implementation result.`,
          ),
          "Keep the completed slice aligned with the adopted artifact and paired decision artifact.",
          "Keep the completed slice bounded and explicit rather than implying automation or downstream execution.",
        ],
    "Record one mechanical success criterion before implementation begins.",
  );
  const explicitLimitations = renderBulletList(
    input.explicitLimitations.length > 0
      ? input.explicitLimitations
      : [
          "Stay within one bounded Architecture-owned implementation slice.",
          "Do not add runtime execution, host integration, or Runtime handoff from this target.",
          "If the slice proves too broad or unclear, stop and reopen the target instead of broadening the implementation.",
        ],
    "Keep limitations explicit and bounded.",
  );
  const inputs = [
    ...input.inputs.map((item) => `- ${item}`),
    `- Adopted artifact: \`${input.adoptionRelativePath}\``,
    `- Adoption decision artifact: \`${input.decisionRelativePath}\``,
    ...(input.sourceResultRelativePath
      ? [`- Source bounded result artifact: \`${input.sourceResultRelativePath}\``]
      : ["- Source bounded result artifact: not retained in this legacy adopted slice."]),
    ...(input.sourceStartRelativePath
      ? [`- Source bounded start artifact: \`${input.sourceStartRelativePath}\``]
      : []),
    ...(input.handoffStubPath ? [`- Handoff stub: \`${input.handoffStubPath}\``] : []),
    ...(input.engineRunRecordPath ? [`- Engine run record: \`${input.engineRunRecordPath}\``] : []),
    ...(input.engineRunReportPath ? [`- Engine run report: \`${input.engineRunReportPath}\``] : []),
    ...(input.discoveryRoutingRecordPath
      ? [`- Discovery routing record: \`${input.discoveryRoutingRecordPath}\``]
      : []),
  ].join("\n");
  const validation = input.validationGates.length > 0
    ? input.validationGates.map((item) => `- \`${item}\``).join("\n")
    : "- `decision_review`";
  const failedReadinessChecks = renderBulletList(
    input.sourceFailedReadinessChecks,
    "none",
  );

  return [
    `# Implementation Target: ${input.candidateName} (${input.snapshotAt.slice(0, 10)})`,
    "",
    "## target",
    `- Candidate id: \`${input.candidateId}\``,
    `- Candidate name: ${input.candidateName}`,
    `- Source adoption artifact: \`${input.adoptionRelativePath}\``,
    `- Paired adoption decision artifact: \`${input.decisionRelativePath}\``,
    ...(input.sourceResultRelativePath
      ? [`- Source bounded result artifact: \`${input.sourceResultRelativePath}\``]
      : ["- Source bounded result artifact: not retained in this legacy adopted slice."]),
    `- Usefulness level: \`${input.usefulnessLevel}\``,
    `- Artifact type intent: \`${input.artifactType}\``,
    `- Final adoption status: \`${input.finalStatus}\``,
    `- Target approval: \`${input.createdBy}\``,
    "",
    "## objective (what to build)",
    `- Build target: ${expectedTarget}.`,
    `- Objective retained: ${input.objective}`,
    `- Materialization basis: ${input.resultSummary}`,
    "",
    "## source decision envelope",
    `- Decision format: \`${input.sourceDecisionFormat}\``,
    `- Source completion status: \`${input.sourceCompletionStatus}\``,
    `- Source verification method: \`${input.sourceVerificationMethod}\``,
    `- Source verification result: \`${input.sourceVerificationResult}\``,
    `- Source runtime threshold check: ${input.sourceRuntimeThresholdCheck}`,
    "",
    "## source adoption resolution",
    `- Source verdict: \`${input.sourceAdoptionVerdict}\``,
    `- Source readiness passed: ${formatYesNo(input.sourceReadinessPassed)}`,
    `- Source Runtime handoff required: ${formatYesNo(input.sourceRuntimeHandoffRequired)}`,
    `- Source Runtime handoff rationale: ${input.sourceRuntimeHandoffRationale || "none recorded"}`,
    `- Source artifact path: \`${input.sourceArtifactPath}\``,
    `- Source primary evidence path: ${input.sourcePrimaryEvidencePath ? `\`${input.sourcePrimaryEvidencePath}\`` : "not recorded"}`,
    `- Source self-improvement category: ${input.sourceSelfImprovementCategory ? `\`${input.sourceSelfImprovementCategory}\`` : "not recorded"}`,
    `- Source self-improvement verification method: \`${input.sourceSelfImprovementVerificationMethod}\``,
    `- Source self-improvement verification result: \`${input.sourceSelfImprovementVerificationResult}\``,
    "",
    "### failed readiness checks",
    failedReadinessChecks,
    "",
    "## selected tactical slice",
    selectedBoundedSlice,
    "",
    "## mechanical success criteria",
    mechanicalSuccessCriteria,
    "",
    "## explicit limitations",
    explicitLimitations,
    "",
    "## scope (bounded)",
    boundedScope,
    "",
    "## inputs",
    inputs,
    "",
    "## constraints",
    "- Preserve explicit human review before any downstream execution or host integration.",
    "- Stay Architecture-owned only; do not hand off to Runtime from this target.",
    "- Do not execute or mutate product code from this target artifact alone.",
    `- Rollback boundary: ${input.rollback || "Return to the adopted artifact if this target is not the right bounded slice."}`,
    "",
    "## validation approach",
    validation,
    ...(input.legacyAdoptionFallback
      ? ["- This legacy adopted slice does not retain a bounded-result/start/run chain, so validate against the adopted artifact, paired decision, and retained product artifact directly."]
      : []),
    "- Confirm the implementation target still matches the adopted artifact and paired decision artifact.",
    "- Confirm the target remains one bounded slice and does not imply execution automation.",
    "",
    "## expected outcome",
    `- One explicit Architecture implementation target that defines ${expectedTarget} without reconstructing the adoption chain by hand.`,
    "- No execution is triggered from this artifact.",
    `- The new target is now retained at \`${input.targetRelativePath}\`.`,
    "",
  ].join("\n");
}

export function createDirectiveArchitectureImplementationTarget(
  input: CreateDirectiveArchitectureImplementationTargetInput,
): DirectiveArchitectureImplementationTargetResult {
  const writePreparation = prepareDirectiveArchitectureDeepTailWrite({
    directiveRoot: input.directiveRoot,
    sourcePath: input.adoptionPath,
    sourceFieldName: "adoptionPath",
    resolveTargetRelativePath: resolveImplementationTargetRelativePath,
    actor: input.createdBy,
  });
  const directiveRoot = writePreparation.directiveRoot;
  const adoptionRelativePath = writePreparation.sourceRelativePath;
  const adoptionDetail = readDirectiveArchitectureAdoptionDetail({
    directiveRoot,
    adoptionPath: adoptionRelativePath,
  });
  const adoptionDecision = loadDirectiveArchitectureAdoptionDecisionArtifact({
    directiveRoot,
    recordRelativePath: adoptionRelativePath,
  });

  const targetRelativePath = writePreparation.targetRelativePath;
  const targetAbsolutePath = writePreparation.targetAbsolutePath;
  const createdBy = writePreparation.actor;
  const snapshotAt = writePreparation.snapshotAt;
  const created = writePreparation.created;
  const sourceContext = resolveImplementationTargetSourceContext({
    directiveRoot,
    adoptionDetail,
    artifactType: adoptionDecision.artifact.artifact_type,
    artifactPath: adoptionDecision.artifact.artifact_path,
    sourceAnalysisRef: adoptionDecision.artifact.source_analysis_ref,
    adaptationDecisionRef: adoptionDecision.artifact.adaptation_decision_ref,
    primaryEvidencePath: adoptionDecision.artifact.primary_evidence_path,
  });
  const decisionEnvelopeContext = resolveImplementationTargetDecisionEnvelopeContext({
    adoptionDecision,
  });
  const objective = extractObjectiveFromAdoption(adoptionDetail.content) || sourceContext.objective;
  const rollback = extractRollbackFromAdoption(adoptionDetail.content);
  const validationGates = appendUnique(
    sourceContext.validationGates,
    "decision_envelope_continuity_check",
  );

  const markdown = renderImplementationTargetMarkdown({
    snapshotAt,
    createdBy,
    targetRelativePath,
    adoptionRelativePath,
    decisionRelativePath: adoptionDetail.decisionRelativePath,
    candidateId: adoptionDetail.candidateId,
    candidateName: adoptionDetail.candidateName,
    usefulnessLevel: adoptionDetail.usefulnessLevel,
    artifactType: adoptionDecision.artifact.artifact_type,
    finalStatus: adoptionDetail.finalStatus,
    sourceDecisionFormat: decisionEnvelopeContext.decisionFormat,
    sourceCompletionStatus: decisionEnvelopeContext.completionStatus,
    sourceVerificationMethod: decisionEnvelopeContext.verificationMethod,
    sourceVerificationResult: decisionEnvelopeContext.verificationResult,
    sourceRuntimeThresholdCheck: decisionEnvelopeContext.runtimeThresholdCheck,
    sourceAdoptionVerdict: decisionEnvelopeContext.adoptionVerdict,
    sourceReadinessPassed: decisionEnvelopeContext.readinessPassed,
    sourceFailedReadinessChecks: decisionEnvelopeContext.failedReadinessChecks,
    sourceRuntimeHandoffRequired: decisionEnvelopeContext.runtimeHandoffRequired,
    sourceRuntimeHandoffRationale: decisionEnvelopeContext.runtimeHandoffRationale,
    sourceArtifactPath: decisionEnvelopeContext.artifactPath,
    sourcePrimaryEvidencePath: decisionEnvelopeContext.primaryEvidencePath,
    sourceSelfImprovementCategory: decisionEnvelopeContext.selfImprovementCategory,
    sourceSelfImprovementVerificationMethod: decisionEnvelopeContext.selfImprovementVerificationMethod,
    sourceSelfImprovementVerificationResult: decisionEnvelopeContext.selfImprovementVerificationResult,
    objective,
    resultSummary: sourceContext.resultSummary,
    boundedScope: sourceContext.boundedScope,
    inputs: sourceContext.inputs,
    validationGates,
    selectedBoundedSlice: optionalStringList(input.selectedBoundedSlice),
    mechanicalSuccessCriteria: optionalStringList(input.mechanicalSuccessCriteria),
    explicitLimitations: optionalStringList(input.explicitLimitations),
    rollback,
    sourceResultRelativePath: sourceContext.sourceResultRelativePath,
    sourceStartRelativePath: sourceContext.sourceStartRelativePath,
    handoffStubPath: sourceContext.handoffStubPath,
    engineRunRecordPath: sourceContext.engineRunRecordPath,
    engineRunReportPath: sourceContext.engineRunReportPath,
    discoveryRoutingRecordPath: sourceContext.discoveryRoutingRecordPath,
    legacyAdoptionFallback: sourceContext.legacyAdoptionFallback,
  });

  writeDirectiveArchitectureDeepTailArtifact({
    directiveRoot,
    stageId: "implementation_target",
    sourceRelativePath: adoptionRelativePath,
    targetRelativePath,
    targetAbsolutePath,
    markdown,
  });

  return {
    ok: true,
    created,
    snapshotAt,
    directiveRoot,
    adoptionRelativePath,
    adoptionAbsolutePath: adoptionDetail.adoptedAbsolutePath,
    targetRelativePath,
    targetAbsolutePath,
    sourceResultRelativePath: sourceContext.sourceResultRelativePath,
    candidateId: adoptionDetail.candidateId,
    candidateName: adoptionDetail.candidateName,
    usefulnessLevel: adoptionDetail.usefulnessLevel,
    artifactType: adoptionDecision.artifact.artifact_type,
    finalStatus: adoptionDetail.finalStatus,
  };
}

export function readDirectiveArchitectureImplementationTargetDetail(input: {
  targetPath: string;
  directiveRoot?: string;
}): DirectiveArchitectureImplementationTargetDetail {
  const targetArtifact = readDirectiveArchitectureDeepTailDetailArtifact({
    directiveRoot: input.directiveRoot,
    artifactPath: input.targetPath,
    stage: ARCHITECTURE_DEEP_TAIL_STAGE.implementation_target,
    fieldName: "targetPath",
  });
  const directiveRoot = targetArtifact.directiveRoot;
  const targetRelativePath = targetArtifact.relativePath;
  const targetAbsolutePath = targetArtifact.absolutePath;
  const content = targetArtifact.content;
  const adoptionRelativePath = content.match(/- Source adoption artifact: `([^`]+)`/)?.[1] || "";
  const decisionRelativePath = content.match(/- Paired adoption decision artifact: `([^`]+)`/)?.[1] || "";
  const sourceResultRelativePath = content.match(/- Source bounded result artifact: `([^`]+)`/)?.[1] || "";
  const candidateId = content.match(/- Candidate id: `([^`]+)`/)?.[1] || "";
  const candidateName = content.match(/- Candidate name: (.+)$/m)?.[1]?.trim() || candidateId;
  const usefulnessLevel = (content.match(/- Usefulness level: `([^`]+)`/)?.[1] || "") as ArchitectureUsefulnessLevel;
  const artifactType = (content.match(/- Artifact type intent: `([^`]+)`/)?.[1] || "") as ArchitectureArtifactType;
  const finalStatus = content.match(/- Final adoption status: `([^`]+)`/)?.[1] || "";
  const sourceDecisionFormat = content.match(/- Decision format: `([^`]+)`/)?.[1] || "";
  const sourceCompletionStatus = content.match(/- Source completion status: `([^`]+)`/)?.[1] || "";
  const sourceVerificationMethod = content.match(/- Source verification method: `([^`]+)`/)?.[1] || "";
  const sourceVerificationResult = content.match(/- Source verification result: `([^`]+)`/)?.[1] || "";
  const sourceRuntimeThresholdCheck = content.match(/- Source runtime threshold check: (.+)$/m)?.[1]?.trim() || "";
  const sourceAdoptionVerdict = content.match(/- Source verdict: `([^`]+)`/)?.[1] || "";
  const sourceReadinessPassed = (content.match(/- Source readiness passed: (.+)$/m)?.[1]?.trim() || "") === "yes";
  const sourceRuntimeHandoffRequired = (content.match(/- Source Runtime handoff required: (.+)$/m)?.[1]?.trim() || "") === "yes";
  const sourceRuntimeHandoffRationale = content.match(/- Source Runtime handoff rationale: (.+)$/m)?.[1]?.trim() || "";
  const sourceArtifactPath = content.match(/- Source artifact path: `([^`]+)`/)?.[1] || "";
  const sourcePrimaryEvidencePath = content.match(/- Source primary evidence path: `([^`]+)`/)?.[1] || "";
  const sourceSelfImprovementCategory = content.match(/- Source self-improvement category: `([^`]+)`/)?.[1] || "";
  const sourceSelfImprovementVerificationMethod = content.match(/- Source self-improvement verification method: `([^`]+)`/)?.[1] || "";
  const sourceSelfImprovementVerificationResult = content.match(/- Source self-improvement verification result: `([^`]+)`/)?.[1] || "";
  const objective = content.match(/- Objective retained: (.+)$/m)?.[1]?.trim() || "";
  const expectedOutcome = content.match(/- One explicit Architecture implementation target that defines (.+) without reconstructing the adoption chain by hand\./m)?.[1]?.trim()
    || "";
  const sourceFailedReadinessChecks = extractSectionBullets(content, "failed readiness checks");
  const selectedBoundedSlice = extractSectionBullets(content, "selected tactical slice");
  const mechanicalSuccessCriteria = extractSectionBullets(content, "mechanical success criteria");
  const explicitLimitations = extractSectionBullets(content, "explicit limitations");

  return {
    directiveRoot,
    targetRelativePath,
    targetAbsolutePath,
    adoptionRelativePath,
    adoptionAbsolutePath: adoptionRelativePath
      ? normalizePath(path.join(directiveRoot, adoptionRelativePath))
      : "",
    decisionRelativePath,
    sourceResultRelativePath,
    candidateId,
    candidateName,
    usefulnessLevel,
    artifactType,
    finalStatus,
    sourceDecisionFormat,
    sourceCompletionStatus,
    sourceVerificationMethod,
    sourceVerificationResult,
    sourceRuntimeThresholdCheck,
    sourceAdoptionVerdict,
    sourceReadinessPassed,
    sourceFailedReadinessChecks,
    sourceRuntimeHandoffRequired,
    sourceRuntimeHandoffRationale,
    sourceArtifactPath,
    sourcePrimaryEvidencePath,
    sourceSelfImprovementCategory,
    sourceSelfImprovementVerificationMethod,
    sourceSelfImprovementVerificationResult,
    objective,
    expectedOutcome,
    selectedBoundedSlice,
    mechanicalSuccessCriteria,
    explicitLimitations,
    content,
  };
}
