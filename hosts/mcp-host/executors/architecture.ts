import type { ToolRegistryOptions, ToolExecutorMap } from "../types.ts";

import { startDirectiveArchitectureFromHandoff } from "../../../architecture/lib/experiments/handoff-start.ts";
import {
  closeArchitectureBoundedStart,
  closeArchitectureNoteHandoff,
  continueArchitectureFromBoundedResult,
} from "../../../architecture/lib/experiments/closeout.ts";
import type { ArchitectureValueShape } from "../../../architecture/lib/adoption/resolution.ts";
import { adoptDirectiveArchitectureResult } from "../../../architecture/lib/adoption/result-adoption.ts";
import { createDirectiveArchitectureImplementationTarget } from "../../../architecture/lib/materialization/implementation-target.ts";
import { createDirectiveArchitectureImplementationResult } from "../../../architecture/lib/materialization/implementation-result.ts";
import { confirmDirectiveArchitectureRetention } from "../../../architecture/lib/materialization/retention.ts";
import { createDirectiveArchitectureIntegrationRecord } from "../../../architecture/lib/materialization/integration-record.ts";
import { recordDirectiveArchitectureConsumption } from "../../../architecture/lib/materialization/consumption-record.ts";
import { evaluateDirectiveArchitectureConsumption } from "../../../architecture/lib/materialization/post-consumption-evaluation.ts";
import { reopenDirectiveArchitectureFromEvaluation } from "../../../architecture/lib/experiments/reopen-from-evaluation.ts";

const MCP_OPERATOR_ACTOR = "mcp-operator";

/** Coerce an unknown value to string | null | undefined. */
function optionalString(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return v as null | undefined;
  const s = String(v).trim();
  return s || null;
}

/** Coerce an unknown value to string[] | null | undefined. */
function optionalStringArray(v: unknown): string[] | null | undefined {
  if (v === null || v === undefined) return v as null | undefined;
  if (Array.isArray(v)) return v.map(String);
  return null;
}

/** Coerce an unknown value to boolean | undefined. */
function optionalBoolean(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  return Boolean(v);
}

export function buildArchitectureExecutors(options: ToolRegistryOptions): ToolExecutorMap {
  return {
    /** Start a new Architecture bounded experiment from a handoff artifact. */
    architecture_handoff_start: async (args: Record<string, unknown>) => {
      return startDirectiveArchitectureFromHandoff({
        directiveRoot: options.directiveRoot,
        handoffPath: String(args.handoffPath ?? ""),
        startedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Close out a bounded Architecture start experiment with results. */
    architecture_bounded_closeout: async (args: Record<string, unknown>) => {
      return closeArchitectureBoundedStart({
        directiveRoot: options.directiveRoot,
        startPath: String(args.startPath ?? ""),
        resultSummary: String(args.resultSummary ?? ""),
        primaryEvidencePath: optionalString(args.primaryEvidencePath),
        transformedArtifactsProduced: optionalStringArray(args.transformedArtifactsProduced),
        nextDecision: args.nextDecision as "needs-more-evidence" | "adopt" | "defer" | "reject" | undefined,
        valueShape: args.valueShape as ArchitectureValueShape | undefined,
        adaptationQuality: args.adaptationQuality as "strong" | "adequate" | "weak" | "skipped" | undefined,
        improvementQuality: args.improvementQuality as "strong" | "adequate" | "weak" | "skipped" | undefined,
        proofExecuted: optionalBoolean(args.proofExecuted),
        targetArtifactClarified: optionalBoolean(args.targetArtifactClarified),
        deltaEvidencePresent: optionalBoolean(args.deltaEvidencePresent),
        noUnresolvedBaggage: optionalBoolean(args.noUnresolvedBaggage),
        productArtifactMaterialized: optionalBoolean(args.productArtifactMaterialized),
        closedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Close out a NOTE-mode Architecture handoff directly without a bounded start. */
    architecture_note_handoff_closeout: async (args: Record<string, unknown>) => {
      return closeArchitectureNoteHandoff({
        directiveRoot: options.directiveRoot,
        handoffPath: String(args.handoffPath ?? ""),
        resultSummary: String(args.resultSummary ?? ""),
        primaryEvidencePath: optionalString(args.primaryEvidencePath),
        transformedArtifactsProduced: optionalStringArray(args.transformedArtifactsProduced),
        nextDecision: args.nextDecision as "needs-more-evidence" | "adopt" | "defer" | "reject" | undefined,
        valueShape: args.valueShape as ArchitectureValueShape | undefined,
        adaptationQuality: args.adaptationQuality as "strong" | "adequate" | "weak" | "skipped" | undefined,
        improvementQuality: args.improvementQuality as "strong" | "adequate" | "weak" | "skipped" | undefined,
        proofExecuted: optionalBoolean(args.proofExecuted),
        targetArtifactClarified: optionalBoolean(args.targetArtifactClarified),
        deltaEvidencePresent: optionalBoolean(args.deltaEvidencePresent),
        noUnresolvedBaggage: optionalBoolean(args.noUnresolvedBaggage),
        productArtifactMaterialized: optionalBoolean(args.productArtifactMaterialized),
        closedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Continue a new Architecture bounded start from a stay_experimental result. */
    architecture_bounded_continuation: async (args: Record<string, unknown>) => {
      return continueArchitectureFromBoundedResult({
        directiveRoot: options.directiveRoot,
        resultPath: String(args.resultPath ?? ""),
        continuedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Adopt an Architecture bounded result into an adoption artifact. */
    architecture_adopt_result: async (args: Record<string, unknown>) => {
      return adoptDirectiveArchitectureResult({
        directiveRoot: options.directiveRoot,
        resultPath: String(args.resultPath ?? ""),
        adoptedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Create a bounded implementation target from an adopted Architecture artifact. */
    architecture_create_implementation_target: async (args: Record<string, unknown>) => {
      return createDirectiveArchitectureImplementationTarget({
        directiveRoot: options.directiveRoot,
        adoptionPath: String(args.adoptionPath ?? ""),
        selectedBoundedSlice: optionalStringArray(args.selectedBoundedSlice),
        mechanicalSuccessCriteria: optionalStringArray(args.mechanicalSuccessCriteria),
        explicitLimitations: optionalStringArray(args.explicitLimitations),
        createdBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Record the result of executing a bounded implementation target. */
    architecture_create_implementation_result: async (args: Record<string, unknown>) => {
      return createDirectiveArchitectureImplementationResult({
        directiveRoot: options.directiveRoot,
        targetPath: String(args.targetPath ?? ""),
        resultSummary: String(args.resultSummary ?? ""),
        outcome: args.outcome as "success" | "failure" | undefined,
        deviations: optionalString(args.deviations),
        evidence: optionalString(args.evidence),
        validationResult: optionalString(args.validationResult),
        rollbackNote: optionalString(args.rollbackNote),
        completedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Confirm retention of a completed implementation result. */
    architecture_confirm_retention: async (args: Record<string, unknown>) => {
      return confirmDirectiveArchitectureRetention({
        directiveRoot: options.directiveRoot,
        resultPath: String(args.resultPath ?? ""),
        usefulnessAssessment: optionalString(args.usefulnessAssessment),
        stabilityLevel: args.stabilityLevel as "stable" | "bounded-stable" | "provisional" | undefined,
        reuseScope: optionalString(args.reuseScope),
        confirmationDecision: optionalString(args.confirmationDecision),
        rollbackBoundary: optionalString(args.rollbackBoundary),
        confirmedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Create an integration record from a retained implementation result. */
    architecture_create_integration_record: async (args: Record<string, unknown>) => {
      return createDirectiveArchitectureIntegrationRecord({
        directiveRoot: options.directiveRoot,
        retainedPath: String(args.retainedPath ?? ""),
        integrationTargetSurface: optionalString(args.integrationTargetSurface),
        readinessSummary: optionalString(args.readinessSummary),
        expectedEffect: optionalString(args.expectedEffect),
        validationBoundary: optionalString(args.validationBoundary),
        integrationDecision: optionalString(args.integrationDecision),
        rollbackBoundary: optionalString(args.rollbackBoundary),
        createdBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Record the consumption of an integrated Architecture artifact. */
    architecture_record_consumption: async (args: Record<string, unknown>) => {
      return recordDirectiveArchitectureConsumption({
        directiveRoot: options.directiveRoot,
        integrationPath: String(args.integrationPath ?? ""),
        appliedSurface: optionalString(args.appliedSurface),
        applicationSummary: optionalString(args.applicationSummary),
        observedEffect: optionalString(args.observedEffect),
        validationResult: optionalString(args.validationResult),
        outcome: args.outcome as "success" | "failure" | undefined,
        rollbackNote: optionalString(args.rollbackNote),
        recordedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Evaluate a consumption record and decide whether to keep or reopen. */
    architecture_evaluate_consumption: async (args: Record<string, unknown>) => {
      return evaluateDirectiveArchitectureConsumption({
        directiveRoot: options.directiveRoot,
        consumptionPath: String(args.consumptionPath ?? ""),
        decision: args.decision as "keep" | "reopen" | undefined,
        rationale: optionalString(args.rationale),
        observedStability: optionalString(args.observedStability),
        retainedUsefulnessAssessment: optionalString(args.retainedUsefulnessAssessment),
        nextBoundedAction: optionalString(args.nextBoundedAction),
        rollbackNote: optionalString(args.rollbackNote),
        evaluatedBy: MCP_OPERATOR_ACTOR,
      });
    },

    /** Reopen a new Architecture bounded start from a post-consumption evaluation. */
    architecture_reopen_from_evaluation: async (args: Record<string, unknown>) => {
      return reopenDirectiveArchitectureFromEvaluation({
        directiveRoot: options.directiveRoot,
        evaluationPath: String(args.evaluationPath ?? ""),
        reopenedBy: MCP_OPERATOR_ACTOR,
      });
    },
  };
}
