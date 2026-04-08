import fs from "node:fs";
import path from "node:path";

import { readJson } from "../../shared/lib/file-io.ts";
import { normalizeRelativePath } from "../../shared/lib/path-normalization.ts";

import { resolveDirectiveWorkspaceState } from "../state/index.ts";
import {
  RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION,
  assertRuntimeRegistryAcceptanceGate,
} from "../../runtime/lib/runtime-registry-acceptance-gate.ts";
import {
  classifyRuntimeAutomationEligibility,
  RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
  type RuntimeAutomationEligibilityClass,
} from "../../runtime/lib/runtime-automation-eligibility-policy.ts";
import type { RuntimeHostCallableAdapterDescriptor } from "../../runtime/lib/runtime-host-callable-adapter-contract.ts";
import {
  renderRuntimeRegistryEntry,
  type RuntimeRegistryEntryRequest,
} from "../../runtime/lib/runtime-registry-entry-writer.ts";

export type DirectiveAutonomousRuntimePromotionAutomationPolicy = {
  autoHostAdapterDescriptor: boolean;
  autoHostCallableExecution: boolean;
  autoWriteRegistryEntry: boolean;
};

export type DirectiveRuntimePromotionAutomationGateStatus =
  | "pass"
  | "blocked"
  | "disabled"
  | "not_applicable";

export type DirectiveRuntimePromotionAutomationGate = {
  id: string;
  status: DirectiveRuntimePromotionAutomationGateStatus;
  reason: string;
};

export type DirectiveRuntimePromotionAutomationDryRunReport = {
  ok: true;
  candidateId: string | null;
  candidateName: string | null;
  promotionRecordPath: string;
  currentStage: string | null;
  currentHeadPath: string | null;
  existingRegistryEntryPath: string | null;
  eligibilityPolicyVersion: typeof RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION;
  candidateClass: RuntimeAutomationEligibilityClass;
  eligibilityReasons: string[];
  evidenceEligible: boolean;
  automationEligible: boolean;
  wouldWriteRegistryEntry: boolean;
  policy: DirectiveAutonomousRuntimePromotionAutomationPolicy;
  hostCallableAdapterReportPath: string | null;
  callableExecutionEvidencePath: string | null;
  registryRequest: RuntimeRegistryEntryRequest | null;
  gates: DirectiveRuntimePromotionAutomationGate[];
  stopReason: string;
};

function resolveDirectivePath(input: {
  directiveRoot: string;
  relativePath: string | null | undefined;
}) {
  const relativePath = String(input.relativePath ?? "").trim();
  if (!relativePath) return null;
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(input.directiveRoot, relativePath);
  return {
    absolutePath,
    relativePath: normalizeRelativePath(
      path.isAbsolute(relativePath)
        ? path.relative(input.directiveRoot, absolutePath)
        : relativePath,
    ),
  };
}



function readHostCallableAdapter(input: {
  directiveRoot: string;
  reportPath: string | null | undefined;
}) {
  const resolved = resolveDirectivePath({
    directiveRoot: input.directiveRoot,
    relativePath: input.reportPath,
  });
  if (!resolved || !fs.existsSync(resolved.absolutePath)) {
    return {
      reportPath: resolved?.relativePath ?? null,
      descriptor: null as RuntimeHostCallableAdapterDescriptor | null,
      missing: true,
    };
  }

  const report = readJson<{
    hostCallableAdapter?: RuntimeHostCallableAdapterDescriptor;
  }>(resolved.absolutePath);

  return {
    reportPath: resolved.relativePath,
    descriptor: report.hostCallableAdapter ?? null,
    missing: false,
  };
}

function findCallableExecutionEvidenceForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = String(input.candidateId ?? "").trim();
  if (!candidateId) return null;
  const executionsDir = path.join(input.directiveRoot, "runtime", "callable-executions");
  if (!fs.existsSync(executionsDir)) return null;

  return fs
    .readdirSync(executionsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join("runtime", "callable-executions", entry.name).replace(/\\/g, "/"))
    .sort()
    .find((relativePath) => {
      try {
        const record = readJson<{
          capability?: { capabilityId?: unknown };
          invocation?: { ok?: unknown; status?: unknown };
        }>(path.join(input.directiveRoot, relativePath));
        return record.capability?.capabilityId === candidateId
          && record.invocation?.ok === true
          && record.invocation?.status === "success";
      } catch {
        return false;
      }
    }) ?? null;
}

function buildRegistryRequest(input: {
  candidateId: string;
  candidateName: string;
  promotionRecordPath: string;
  proposedHost: string | null;
  hostCallableAdapterReportPath: string;
  descriptor: RuntimeHostCallableAdapterDescriptor;
  callableExecutionEvidencePath: string;
  approvedBy: string;
  acceptedAt: string;
}) {
  const registryDate = input.acceptedAt.slice(0, 10);
  return {
    candidate_id: input.candidateId,
    candidate_name: input.candidateName,
    registry_date: registryDate,
    linked_promotion_record: input.promotionRecordPath,
    host: input.proposedHost ?? input.descriptor.hostName,
    runtime_surface: input.descriptor.callableSurface,
    runtime_status: "registry.accepted_policy_gated_runtime_callable_execution",
    proof_path: input.hostCallableAdapterReportPath,
    last_validated_by: "policy-gated autonomous Runtime registry acceptance dry-run",
    last_validation_date: registryDate,
    active_risks: [
      "Registry acceptance is policy-gated and limited to candidates with runtime_callable_execution evidence.",
      "Descriptor-only candidates, imported-source execution claims, and promotion automation remain blocked.",
    ],
    rollback_path:
      `Delete runtime/08-registry/${registryDate}-${input.candidateId}-registry-entry.md and return the case to ${input.promotionRecordPath}.`,
    notes: [
      "Accepted through runtime_registry_acceptance_gate.v1 after promotion record, promotion specification, host adapter report, and callable execution evidence were verified.",
      "This policy-gated path does not automate host adapter creation, host callable execution, imported-source execution, or future candidate registry acceptance.",
    ],
    acceptance_gate: {
      gate_version: RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION,
      acceptance_state: "accepted",
      accepted_by: input.approvedBy,
      accepted_at: input.acceptedAt,
      host_callable_adapter_report_path: input.hostCallableAdapterReportPath,
      callable_execution_evidence_path: input.callableExecutionEvidencePath,
      descriptor_only_registry_status_allowed: false,
      notes: [
        "Policy-gated registry write is allowed only because runtime_callable_execution evidence is already present.",
      ],
    },
    output_relative_path:
      `runtime/08-registry/${registryDate}-${input.candidateId}-registry-entry.md`,
  } satisfies RuntimeRegistryEntryRequest;
}

function summarizeStopReason(input: {
  evidenceEligible: boolean;
  automationEligible: boolean;
  existingRegistryEntryPath: string | null;
  gates: DirectiveRuntimePromotionAutomationGate[];
}) {
  if (input.existingRegistryEntryPath) {
    return `Runtime registry automation is not needed; accepted registry entry already exists at ${input.existingRegistryEntryPath}.`;
  }
  if (input.automationEligible) {
    return "Runtime registry automation is eligible; all policy and evidence gates pass.";
  }
  const blocked = input.gates.find((gate) => gate.status === "blocked");
  if (!input.evidenceEligible && blocked) {
    return `Runtime registry automation is blocked: ${blocked.reason}`;
  }
  const disabled = input.gates.find((gate) => gate.status === "disabled");
  if (disabled) {
    return `Runtime registry automation is disabled by policy: ${disabled.reason}`;
  }
  if (blocked) {
    return `Runtime registry automation is blocked: ${blocked.reason}`;
  }
  return input.evidenceEligible
    ? "Runtime registry automation has evidence but policy is not open."
    : "Runtime registry automation is not evidence-eligible.";
}

export function buildDirectiveRuntimePromotionAutomationDryRunReport(input: {
  directiveRoot: string;
  promotionRecordPath: string;
  policy: DirectiveAutonomousRuntimePromotionAutomationPolicy;
  approvedBy: string;
  acceptedAt?: string;
}): DirectiveRuntimePromotionAutomationDryRunReport {
  const promotionRecordPath = normalizeRelativePath(input.promotionRecordPath);
  const focus = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: promotionRecordPath,
    includeAnchors: false,
  }).focus;
  const gates: DirectiveRuntimePromotionAutomationGate[] = [];
  const candidateId = focus?.candidateId ?? null;
  const candidateName = focus?.candidateName ?? null;
  const existingRegistryEntryPath = focus?.linkedArtifacts.runtimeRegistryEntryPath ?? null;

  if (focus?.currentStage !== "runtime.promotion_record.opened") {
    gates.push({
      id: "runtime.promotion_record.opened",
      status: "blocked",
      reason:
        `current stage is ${focus?.currentStage ?? "unknown"}, not runtime.promotion_record.opened`,
    });
  } else {
    gates.push({
      id: "runtime.promotion_record.opened",
      status: "pass",
      reason: "promotion record is open",
    });
  }

  if (existingRegistryEntryPath) {
    gates.push({
      id: "registry.not_already_accepted",
      status: "blocked",
      reason: `accepted registry entry already exists at ${existingRegistryEntryPath}`,
    });
  } else {
    gates.push({
      id: "registry.not_already_accepted",
      status: "pass",
      reason: "no accepted gated registry entry is linked",
    });
  }

  const hostReport = readHostCallableAdapter({
    directiveRoot: input.directiveRoot,
    reportPath: focus?.linkedArtifacts.runtimeHostConsumptionReportPath,
  });
  const eligibility = classifyRuntimeAutomationEligibility({
    descriptor: hostReport.descriptor,
  });
  if (!hostReport.descriptor) {
    gates.push({
      id: "host_adapter_report",
      status: input.policy.autoHostAdapterDescriptor ? "blocked" : "disabled",
      reason: input.policy.autoHostAdapterDescriptor
        ? "host adapter descriptor report is missing and no generic descriptor writer exists for this candidate"
        : "host adapter descriptor automation is disabled and no report exists",
    });
  } else {
    gates.push({
      id: "host_adapter_report",
      status: "pass",
      reason: `host adapter report exists at ${hostReport.reportPath}`,
    });
  }

  if (eligibility.registryAcceptanceAllowed) {
    gates.push({
      id: "runtime_automation_eligibility_policy",
      status: "pass",
      reason:
        `${eligibility.policyVersion} classifies candidate as ${eligibility.candidateClass}`,
    });
  } else {
    gates.push({
      id: "runtime_automation_eligibility_policy",
      status: "blocked",
      reason:
        `${eligibility.policyVersion} classifies candidate as ${eligibility.candidateClass}: ${eligibility.reasons.join(" ")}`,
    });
  }

  if (hostReport.descriptor?.acceptance.descriptorCallableOnly) {
    gates.push({
      id: "descriptor_only_not_source_execution",
      status: "blocked",
      reason: "descriptor-only host callable cannot be treated as runtime/source execution for registry automation",
    });
  } else if (hostReport.descriptor) {
    gates.push({
      id: "descriptor_only_not_source_execution",
      status: "pass",
      reason: "host adapter is not descriptor-only",
    });
  } else {
    gates.push({
      id: "descriptor_only_not_source_execution",
      status: "not_applicable",
      reason: "host adapter descriptor is unavailable",
    });
  }

  const callableExecutionEvidencePath =
    hostReport.descriptor?.acceptance.runtimeCallableExecution
      ? hostReport.descriptor.evidencePaths.executionEvidencePath
        ?? findCallableExecutionEvidenceForCandidate({
          directiveRoot: input.directiveRoot,
          candidateId,
        })
      : null;
  if (hostReport.descriptor?.acceptance.runtimeCallableExecution) {
    if (callableExecutionEvidencePath) {
      gates.push({
        id: "callable_execution_evidence",
        status: "pass",
        reason: `successful callable execution evidence exists at ${callableExecutionEvidencePath}`,
      });
    } else {
      gates.push({
        id: "callable_execution_evidence",
        status: input.policy.autoHostCallableExecution ? "blocked" : "disabled",
        reason: input.policy.autoHostCallableExecution
          ? "callable execution evidence is missing and no generic host callable runner exists for this candidate"
          : "host callable execution automation is disabled and no execution evidence exists",
      });
    }
  } else {
    gates.push({
      id: "callable_execution_evidence",
      status: hostReport.descriptor ? "blocked" : "not_applicable",
      reason: hostReport.descriptor
        ? "host adapter does not claim runtime callable execution"
        : "host adapter descriptor is unavailable",
    });
  }

  if (input.policy.autoWriteRegistryEntry) {
    gates.push({
      id: "policy.autoWriteRegistryEntry",
      status: "pass",
      reason: "registry write automation is enabled by policy",
    });
  } else {
    gates.push({
      id: "policy.autoWriteRegistryEntry",
      status: "disabled",
      reason: "registry write automation is disabled by policy",
    });
  }

  const evidenceEligible = gates.every((gate) =>
    gate.status === "pass"
    || gate.id === "policy.autoWriteRegistryEntry"
  );
  const automationEligible = evidenceEligible && input.policy.autoWriteRegistryEntry;
  const registryRequest =
    automationEligible && candidateId && candidateName && hostReport.reportPath
    && hostReport.descriptor && callableExecutionEvidencePath
      ? buildRegistryRequest({
        candidateId,
        candidateName,
        promotionRecordPath,
        proposedHost: focus?.runtime?.proposedHost ?? null,
        hostCallableAdapterReportPath: hostReport.reportPath,
        descriptor: hostReport.descriptor,
        callableExecutionEvidencePath,
        approvedBy: input.approvedBy,
        acceptedAt: input.acceptedAt ?? new Date().toISOString(),
      })
      : null;
  const stopReason = summarizeStopReason({
    evidenceEligible,
    automationEligible,
    existingRegistryEntryPath,
    gates,
  });

  return {
    ok: true,
    candidateId,
    candidateName,
    promotionRecordPath,
    currentStage: focus?.currentStage ?? null,
    currentHeadPath: focus?.currentHead.artifactPath ?? null,
    existingRegistryEntryPath,
    eligibilityPolicyVersion: eligibility.policyVersion,
    candidateClass: eligibility.candidateClass,
    eligibilityReasons: [...eligibility.reasons],
    evidenceEligible,
    automationEligible,
    wouldWriteRegistryEntry: Boolean(registryRequest),
    policy: { ...input.policy },
    hostCallableAdapterReportPath: hostReport.reportPath,
    callableExecutionEvidencePath,
    registryRequest,
    gates,
    stopReason,
  };
}

export function writeDirectiveRuntimeRegistryEntryFromAutomationReport(input: {
  directiveRoot: string;
  report: DirectiveRuntimePromotionAutomationDryRunReport;
}) {
  if (!input.report.automationEligible || !input.report.registryRequest) {
    throw new Error(`runtime_registry_automation_not_eligible:${input.report.stopReason}`);
  }
  assertRuntimeRegistryAcceptanceGate({
    directiveRoot: input.directiveRoot,
    request: input.report.registryRequest,
  });

  const relativePath =
    input.report.registryRequest.output_relative_path
    ?? `runtime/08-registry/${input.report.registryRequest.registry_date}-${input.report.registryRequest.candidate_id}-registry-entry.md`;
  const absolutePath = path.join(input.directiveRoot, relativePath);
  const created = !fs.existsSync(absolutePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, renderRuntimeRegistryEntry(input.report.registryRequest), "utf8");

  return {
    created,
    registryEntryRelativePath: normalizeRelativePath(relativePath),
  };
}
