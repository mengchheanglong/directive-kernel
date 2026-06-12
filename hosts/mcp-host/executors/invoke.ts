/**
 * MCP Executor: invoke_capability
 *
 * Trust-gated capability invocation through the MCP surface.
 *
 * Gate order:
 *  1. Verification: the capability must have harness-verified evidence (exit 0).
 *     If not, refuse with a structured reason listing the verification status.
 *  2. Earned Autonomy: if the operator does not have autoApprovalEligible
 *     status for the relevant route class, require operator_confirmation_id.
 *  3. Execute: run the capability, record outcome.
 *
 * Every invocation outcome appends to the decision-policy ledger.
 */

import fs from "node:fs";
import path from "node:path";

import { listDirectiveRuntimeCallableCapabilities } from "../../../runtime/core/callable-execution.ts";
import type { RuntimeCallableExecutionInput } from "../../../runtime/core/callable-execution.ts";
import {
  readValidatedEvidence,
  verificationFromEvidence,
} from "../../../shared/lib/execution-evidence.ts";
import { readDecisionPolicyLedger, appendDecisionPolicyEvent } from "../../../engine/decision-policy-ledger.ts";
import { deriveEngineEarnedAutonomyAssessment } from "../../../engine/routing/earned-autonomy.ts";
import type { ToolExecutor } from "../types.ts";
import type { EngineSourceItem, EngineRoutingConfidence } from "../../../engine/types.ts";

// ── Trust gate ─────────────────────────────────────────────────────

interface TrustGateResult {
  allowed: boolean;
  reason: string;
  requiresOperatorConfirmation: boolean;
  autoApprovalEligible: boolean;
  verification: string;
}

function evaluateTrustGate(input: {
  capabilityId: string;
  directiveRoot: string;
  operatorConfirmationId?: string;
}): TrustGateResult {
  const callableExecutionsDir = path.join(input.directiveRoot, "runtime", "callable-executions");

  // Gate 1: Verification check
  const evidence = readValidatedEvidence(input.capabilityId, callableExecutionsDir);
  const verification = evidence ? verificationFromEvidence(evidence) : "placeholder";

  if (verification !== "verified") {
    return {
      allowed: false,
      reason: `Capability "${input.capabilityId}" is not verified (status: ${verification}). Only harness-verified capabilities with exit code 0 may be invoked. Run: npx tsx scripts/execution-harness.ts ${input.capabilityId}`,
      requiresOperatorConfirmation: true,
      autoApprovalEligible: false,
      verification,
    };
  }

  // Gate 2: Earned Autonomy check
  const ledger = readDecisionPolicyLedger(input.directiveRoot, { lookback: "all" });
  const policyEvents = ledger.events.filter((e) => e.source === "discovery_routing_review");

  // Build a minimal synthetic source for autonomy assessment
  const syntheticSource: EngineSourceItem = {
    sourceType: "internal-signal",
    sourceRef: `cap-invoke-${input.capabilityId}`,
    title: `Capability invocation: ${input.capabilityId}`,
    summary: `Operator requesting invocation of capability ${input.capabilityId}`,
    sourceId: `cap-invoke-${input.capabilityId}`,
  };

  const recommendedLaneId = "runtime";
  const confidence: EngineRoutingConfidence = "medium";

  const autonomy = deriveEngineEarnedAutonomyAssessment({
    source: syntheticSource,
    recommendedLaneId,
    recommendedRecordShape: "fast_path",
    confidence,
    routeConflict: false,
    baseNeedsHumanReview: true,
    existingRuns: [],
    policyEvents,
    corrections: [],
  });

  const autoApprovalEligible = autonomy.autoApprovalEligible;

  // If not auto-approve eligible and no confirmation provided, require it
  if (!autoApprovalEligible && !input.operatorConfirmationId) {
    return {
      allowed: false,
      reason: `Operator has not earned autonomy for this route class (score: ${autonomy.overallScore}/100). ` +
        `Evidence count: ${autonomy.evidenceCount}. Provide operator_confirmation_id from the decision inbox to proceed.`,
      requiresOperatorConfirmation: true,
      autoApprovalEligible: false,
      verification,
    };
  }

  return {
    allowed: true,
    reason: autoApprovalEligible
      ? `Auto-approved (earned autonomy score: ${autonomy.overallScore}/100, verification: ${verification})`
      : `Operator-confirmed (confirmation: ${input.operatorConfirmationId}, verification: ${verification})`,
    requiresOperatorConfirmation: false,
    autoApprovalEligible,
    verification,
  };
}

// ── Executor ───────────────────────────────────────────────────────

export function buildInvokeExecutors(options: { directiveRoot: string }): Record<string, ToolExecutor> {
  const invokeCapability: ToolExecutor = async (args: Record<string, unknown>) => {
    const capabilityId = String(args.capability_id ?? "").trim();
    if (!capabilityId) {
      return { error: "capability_id is required" };
    }

    const trustedArgs = args as {
      capability_id: string;
      params?: Record<string, unknown>;
      operator_confirmation_id?: string;
    };

    // Trust gate
    const gate = evaluateTrustGate({
      capabilityId,
      directiveRoot: options.directiveRoot,
      operatorConfirmationId: trustedArgs.operator_confirmation_id,
    });

    if (!gate.allowed) {
      return {
        ok: false,
        error: gate.reason,
        requires_operator_confirmation: gate.requiresOperatorConfirmation,
        verification: gate.verification,
        auto_approval_eligible: gate.autoApprovalEligible,
      };
    }

    // Look up capability
    const descriptors = listDirectiveRuntimeCallableCapabilities();
    const descriptor = descriptors.find((d) => d.capabilityId === capabilityId);

    if (!descriptor) {
      // Record failed invocation in ledger
      appendDecisionPolicyEvent({
        directiveRoot: options.directiveRoot,
        event: {
          recordedAt: new Date().toISOString(),
          source: "capability_invocation",
          candidateId: capabilityId,
          rationale: `Capability "${capabilityId}" not found in known callable capabilities. Available: ${descriptors.map((d) => d.capabilityId).join(", ")}`,
          sourceSignalTokens: [capabilityId, "not_found"],
        },
      });

      return {
        ok: false,
        error: `Capability "${capabilityId}" not found. Available capabilities: ${descriptors.map((d) => d.capabilityId).join(", ")}`,
        verification: gate.verification,
      };
    }

    // Execute capability
    const startTime = Date.now();
    try {
      const { runDirectiveRuntimeCallableExecution } = await import(
        "../../../runtime/core/callable-execution.ts"
      );

      const execInput: RuntimeCallableExecutionInput = {
        directiveRoot: options.directiveRoot,
        capabilityId,
        tool: descriptor.tools.length > 0 ? descriptor.tools[0] : capabilityId,
        input: trustedArgs.params ?? {},
        allowExternalFetches: true,
      };

      const result = await runDirectiveRuntimeCallableExecution(execInput);

      const durationMs = Date.now() - startTime;

      // Record successful invocation in ledger
      appendDecisionPolicyEvent({
        directiveRoot: options.directiveRoot,
        event: {
          recordedAt: new Date().toISOString(),
          source: "capability_invocation",
          candidateId: capabilityId,
          rationale: `Capability "${capabilityId}" invoked successfully (${result.rawResult.status}, ${durationMs}ms). Tool: ${result.rawResult.tool}`,
          sourceSignalTokens: [capabilityId, "success", result.rawResult.status],
        },
      });

      const rawResult = result.rawResult;
      return {
        ok: true,
        capability_id: capabilityId,
        status: rawResult.status,
        tool: rawResult.tool,
        duration_ms: durationMs,
        result: typeof rawResult.result === "string" && rawResult.result.length < 2000
          ? rawResult.result
          : typeof rawResult.result === "string"
            ? rawResult.result.slice(0, 2000) + "..."
            : JSON.stringify(rawResult.result).slice(0, 2000),
        gate: {
          verification: gate.verification,
          auto_approval_eligible: gate.autoApprovalEligible,
        },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);

      // Record failed invocation in ledger
      appendDecisionPolicyEvent({
        directiveRoot: options.directiveRoot,
        event: {
          recordedAt: new Date().toISOString(),
          source: "capability_invocation",
          candidateId: capabilityId,
          rationale: `Capability "${capabilityId}" invocation failed (${durationMs}ms): ${message}`,
          sourceSignalTokens: [capabilityId, "failure"],
        },
      });

      return {
        ok: false,
        error: message,
        capability_id: capabilityId,
        duration_ms: durationMs,
        verification: gate.verification,
      };
    }
  };

  return {
    invoke_capability: invokeCapability,
  };
}
