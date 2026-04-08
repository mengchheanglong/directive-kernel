import fs from "node:fs";
import path from "node:path";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

import {
  assertRuntimeHostCallableAdapterDescriptor,
  type RuntimeHostCallableAdapterDescriptor,
} from "./runtime-host-callable-adapter-contract.ts";
import type { RuntimeRegistryEntryRequest } from "./runtime-registry-entry-writer.ts";

export const RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION =
  "runtime_registry_acceptance_gate.v1" as const;

export type RuntimeRegistryAcceptanceGateRequest = {
  gate_version?: typeof RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION | null;
  acceptance_state: "accepted";
  accepted_by: string;
  accepted_at: string;
  host_callable_adapter_report_path: string;
  callable_execution_evidence_path?: string | null;
  descriptor_only_registry_status_allowed?: boolean | null;
  notes?: string[] | null;
};

export type RuntimeRegistryAcceptanceGateReport = {
  ok: boolean;
  gateVersion: typeof RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION;
  candidateId: string;
  candidateName: string;
  acceptanceState: "accepted" | "blocked";
  capabilityKind: string | null;
  hostCallableAdapterReportPath: string | null;
  callableExecutionEvidencePath: string | null;
  linkedPromotionRecordPath: string | null;
  promotionSpecificationPath: string | null;
  proofPath: string | null;
  flags: {
    callableThroughHost: boolean | null;
    descriptorCallableOnly: boolean | null;
    runtimeCallableExecution: boolean | null;
    sourceRuntimeExecutionClaimed: boolean | null;
    hostIntegrationClaimed: boolean | null;
    registryAcceptanceClaimedBeforeGate: boolean | null;
    promotionAutomation: boolean | null;
    runtimeInternalsBypassed: boolean | null;
  };
  violations: string[];
};

function toDirectiveRelativePath(directiveRoot: string, filePath: string) {
  const normalized = normalizeAbsolutePath(
    path.isAbsolute(filePath) ? filePath : path.resolve(directiveRoot, filePath),
  );
  const relative = path.relative(directiveRoot, normalized).replace(/\\/g, "/");
  return relative.startsWith("..") ? normalized : relative;
}

function resolveExistingDirectivePath(input: {
  directiveRoot: string;
  candidatePath: string | null | undefined;
  fieldName: string;
  violations: string[];
}) {
  const candidate = String(input.candidatePath ?? "").trim();
  if (!candidate) {
    input.violations.push(`${input.fieldName}:missing`);
    return null;
  }

  const absolutePath = normalizeAbsolutePath(
    path.isAbsolute(candidate)
      ? candidate
      : path.resolve(input.directiveRoot, candidate),
  );
  if (!fs.existsSync(absolutePath)) {
    input.violations.push(`${input.fieldName}:not_found:${candidate}`);
    return null;
  }

  return {
    absolutePath,
    relativePath: toDirectiveRelativePath(input.directiveRoot, absolutePath),
  };
}

function readJsonFile<T>(filePath: string, violations: string[], fieldName: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    violations.push(`${fieldName}:unreadable_json:${(error as Error).message}`);
    return null;
  }
}

function booleanOrNull(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function collectAcceptanceFlagViolations(input: {
  descriptor: RuntimeHostCallableAdapterDescriptor;
  violations: string[];
}) {
  const requiredFlags = [
    "callableThroughHost",
    "descriptorCallableOnly",
    "runtimeCallableExecution",
    "sourceRuntimeExecutionClaimed",
    "hostIntegrationClaimed",
    "registryAcceptanceClaimed",
    "promotionAutomation",
    "runtimeInternalsBypassed",
  ] as const;

  for (const flag of requiredFlags) {
    if (typeof input.descriptor.acceptance[flag] !== "boolean") {
      input.violations.push(`host_callable_adapter.acceptance.${flag}:missing_boolean`);
    }
  }
}

export function evaluateRuntimeRegistryAcceptanceGate(input: {
  directiveRoot: string;
  request: RuntimeRegistryEntryRequest;
}): RuntimeRegistryAcceptanceGateReport {
  const directiveRoot = normalizeAbsolutePath(input.directiveRoot);
  const violations: string[] = [];
  const gate = input.request.acceptance_gate;
  const linkedPromotionRecord = resolveExistingDirectivePath({
    directiveRoot,
    candidatePath: input.request.linked_promotion_record,
    fieldName: "linked_promotion_record",
    violations,
  });
  const proofPath = resolveExistingDirectivePath({
    directiveRoot,
    candidatePath: input.request.proof_path,
    fieldName: "proof_path",
    violations,
  });

  if (!gate) {
    violations.push("acceptance_gate:missing");
  }
  if (gate?.gate_version && gate.gate_version !== RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION) {
    violations.push("acceptance_gate.gate_version:unsupported");
  }
  if (gate?.acceptance_state !== "accepted") {
    violations.push("acceptance_gate.acceptance_state:not_accepted");
  }
  if (!String(gate?.accepted_by ?? "").trim()) {
    violations.push("acceptance_gate.accepted_by:missing");
  }
  if (!String(gate?.accepted_at ?? "").trim()) {
    violations.push("acceptance_gate.accepted_at:missing");
  }
  if (!String(input.request.rollback_path ?? "").trim()) {
    violations.push("rollback_path:missing");
  }

  const hostCallableAdapterReport = resolveExistingDirectivePath({
    directiveRoot,
    candidatePath: gate?.host_callable_adapter_report_path,
    fieldName: "acceptance_gate.host_callable_adapter_report_path",
    violations,
  });
  const hostReport = hostCallableAdapterReport
    ? readJsonFile<{
        hostCallableAdapter?: RuntimeHostCallableAdapterDescriptor;
      }>(
        hostCallableAdapterReport.absolutePath,
        violations,
        "acceptance_gate.host_callable_adapter_report_path",
      )
    : null;
  const descriptor = hostReport?.hostCallableAdapter ?? null;

  if (!descriptor) {
    violations.push("host_callable_adapter:missing");
  } else {
    try {
      assertRuntimeHostCallableAdapterDescriptor(descriptor);
    } catch (error) {
      violations.push(`host_callable_adapter:invalid:${(error as Error).message}`);
    }
    collectAcceptanceFlagViolations({ descriptor, violations });

    if (descriptor.candidateId !== input.request.candidate_id) {
      violations.push("host_callable_adapter.candidateId:mismatch");
    }

    const descriptorPromotionRecordPath =
      descriptor.evidencePaths.promotionRecordPath
        ? toDirectiveRelativePath(directiveRoot, descriptor.evidencePaths.promotionRecordPath)
        : null;
    if (
      linkedPromotionRecord
      && descriptorPromotionRecordPath
      && descriptorPromotionRecordPath !== linkedPromotionRecord.relativePath
    ) {
      violations.push("host_callable_adapter.evidencePaths.promotionRecordPath:mismatch");
    }

    const promotionSpecification = resolveExistingDirectivePath({
      directiveRoot,
      candidatePath: descriptor.evidencePaths.promotionSpecificationPath,
      fieldName: "host_callable_adapter.evidencePaths.promotionSpecificationPath",
      violations,
    });
    const promotionSpecificationJson = promotionSpecification
      ? readJsonFile<{ rollbackPlan?: unknown; candidateId?: unknown }>(
        promotionSpecification.absolutePath,
        violations,
        "host_callable_adapter.evidencePaths.promotionSpecificationPath",
      )
      : null;
    if (!String(promotionSpecificationJson?.rollbackPlan ?? "").trim()) {
      violations.push("promotion_specification.rollbackPlan:missing");
    }
    if (
      promotionSpecificationJson?.candidateId
      && promotionSpecificationJson.candidateId !== input.request.candidate_id
    ) {
      violations.push("promotion_specification.candidateId:mismatch");
    }

    if (
      descriptor.acceptance.descriptorCallableOnly
      && !gate?.descriptor_only_registry_status_allowed
    ) {
      violations.push("descriptor_only_registry_status:policy_not_allowed");
    }

    if (descriptor.acceptance.runtimeCallableExecution) {
      const executionEvidencePath =
        gate?.callable_execution_evidence_path
        ?? descriptor.evidencePaths.executionEvidencePath
        ?? null;
      const executionEvidence = resolveExistingDirectivePath({
        directiveRoot,
        candidatePath: executionEvidencePath,
        fieldName: "acceptance_gate.callable_execution_evidence_path",
        violations,
      });
      const executionRecord = executionEvidence
        ? readJsonFile<{
            capability?: { capabilityId?: unknown };
            invocation?: { ok?: unknown; status?: unknown };
          }>(
          executionEvidence.absolutePath,
          violations,
          "acceptance_gate.callable_execution_evidence_path",
        )
        : null;
      if (executionRecord?.capability?.capabilityId !== input.request.candidate_id) {
        violations.push("callable_execution_evidence.capabilityId:mismatch");
      }
      if (executionRecord?.invocation?.ok !== true) {
        violations.push("callable_execution_evidence.invocation.ok:not_true");
      }
      if (executionRecord?.invocation?.status !== "success") {
        violations.push("callable_execution_evidence.invocation.status:not_success");
      }
    }
  }

  return {
    ok: violations.length === 0,
    gateVersion: RUNTIME_REGISTRY_ACCEPTANCE_GATE_VERSION,
    candidateId: input.request.candidate_id,
    candidateName: input.request.candidate_name,
    acceptanceState: violations.length === 0 ? "accepted" : "blocked",
    capabilityKind: descriptor?.capabilityKind ?? null,
    hostCallableAdapterReportPath: hostCallableAdapterReport?.relativePath ?? null,
    callableExecutionEvidencePath:
      gate?.callable_execution_evidence_path
        ? toDirectiveRelativePath(directiveRoot, gate.callable_execution_evidence_path)
        : descriptor?.evidencePaths.executionEvidencePath ?? null,
    linkedPromotionRecordPath: linkedPromotionRecord?.relativePath ?? null,
    promotionSpecificationPath:
      descriptor?.evidencePaths.promotionSpecificationPath
        ? toDirectiveRelativePath(
          directiveRoot,
          descriptor.evidencePaths.promotionSpecificationPath,
        )
        : null,
    proofPath: proofPath?.relativePath ?? null,
    flags: {
      callableThroughHost: booleanOrNull(descriptor?.acceptance.callableThroughHost),
      descriptorCallableOnly: booleanOrNull(descriptor?.acceptance.descriptorCallableOnly),
      runtimeCallableExecution: booleanOrNull(descriptor?.acceptance.runtimeCallableExecution),
      sourceRuntimeExecutionClaimed:
        booleanOrNull(descriptor?.acceptance.sourceRuntimeExecutionClaimed),
      hostIntegrationClaimed: booleanOrNull(descriptor?.acceptance.hostIntegrationClaimed),
      registryAcceptanceClaimedBeforeGate:
        booleanOrNull(descriptor?.acceptance.registryAcceptanceClaimed),
      promotionAutomation: booleanOrNull(descriptor?.acceptance.promotionAutomation),
      runtimeInternalsBypassed: booleanOrNull(descriptor?.acceptance.runtimeInternalsBypassed),
    },
    violations,
  };
}

export function assertRuntimeRegistryAcceptanceGate(input: {
  directiveRoot: string;
  request: RuntimeRegistryEntryRequest;
}) {
  const report = evaluateRuntimeRegistryAcceptanceGate(input);
  if (!report.ok) {
    throw new Error(
      `runtime_registry_acceptance_gate_failed:${report.violations.join(",")}`,
    );
  }
  return report;
}
