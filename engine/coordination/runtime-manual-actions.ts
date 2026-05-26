import {
  normalizeDirectiveApprovalActor,
  requireDirectiveString,
} from "../approval-boundary.ts";
import {
  type AutonomousRuntimePromotionAutomationPolicy,
  buildRuntimePromotionAutomationDryRunReport,
} from "./runtime-promotion-automation.ts";
import {
  type RuntimePromotionRecordRequest,
  evaluatePreHostRuntimePromotionRecordPrerequisites,
  resolveRuntimePromotionRecordPath,
} from "../../runtime/lib/writers/promotion-record-writer.ts";
import {
  resolveDirectiveRuntimePromotionSpecificationPath,
} from "../../runtime/lib/host/promotion-specification.ts";
import type { RuntimeRegistryEntryRequest } from "../../runtime/lib/writers/registry-entry-writer.ts";

const MANUAL_RUNTIME_REGISTRY_POLICY: AutonomousRuntimePromotionAutomationPolicy = {
  autoHostAdapterDescriptor: false,
  autoHostCallableExecution: false,
  autoWriteRegistryEntry: true,
};

function normalizeDatePrefix(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized)
    ? normalized
    : new Date().toISOString().slice(0, 10);
}

function isRepoNativeRuntimeHost(proposedHost: string | null | undefined) {
  const normalized = String(proposedHost ?? "").trim().toLowerCase();
  return normalized.startsWith("directive workspace")
    || normalized.startsWith("directive kernel standalone host")
    || normalized.startsWith("directive kernel web host");
}

export function buildManualRuntimePromotionRecordRequest(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
  rationale: string;
  approvedBy: string;
  promotionDate?: string | null;
}) {
  const approvedBy = normalizeDirectiveApprovalActor(input.approvedBy);
  const rationale = requireDirectiveString(input.rationale, "rationale");
  const prerequisites = evaluatePreHostRuntimePromotionRecordPrerequisites({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });

  if (!prerequisites.readyForPreHostPromotionRecordPreparation) {
    throw new Error(
      `invalid_input: Runtime promotion record prerequisites are incomplete: ${prerequisites.missingPrerequisites.join(", ")}`,
    );
  }

  if (!isRepoNativeRuntimeHost(prerequisites.effectiveProposedHost)) {
    throw new Error(
      `invalid_input: Runtime promotion-seam decisions remain limited to repo-native host targets; got "${prerequisites.effectiveProposedHost ?? "unknown"}"`,
    );
  }

  const promotionDate = normalizeDatePrefix(
    input.promotionDate
    ?? prerequisites.sourcePromotionReadinessPath.split("/").at(-1)?.slice(0, 10)
    ?? null,
  );
  const promotionRecordRelativePath = resolveRuntimePromotionRecordPath({
    candidate_id: prerequisites.candidateId,
    promotion_date: promotionDate,
  });
  const specificationPath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });

  const request = {
    candidate_id: prerequisites.candidateId,
    candidate_name: prerequisites.candidateName,
    promotion_date: promotionDate,
    linked_runtime_record: prerequisites.linkedArtifacts.runtimeRecord.relativePath ?? "",
    target_host:
      prerequisites.effectiveProposedHost
      ?? prerequisites.proposedHost
      ?? "Directive Kernel standalone host (hosts/standalone-host/)",
    target_runtime_surface:
      prerequisites.targetRuntimeSurface ?? "bounded runtime capability review",
    integration_mode: prerequisites.integrationMode ?? "review_only",
    source_intent_artifact: prerequisites.linkedArtifacts.capabilityBoundary.relativePath ?? "",
    compile_contract_artifact:
      prerequisites.compileContractArtifact.relativePath ?? "shared/contracts/runtime-to-host.md",
    runtime_permissions_profile:
      "read-only manual promotion-record preparation only; no registry write, host integration, runtime execution, or automation side effects",
    safe_output_scope: "`runtime/07-promotion-records/` and `runtime/06-promotion-specifications/` only",
    sanitize_policy:
      "manual bounded pre-host promotion record only; no registry acceptance, host integration, runtime execution, or downstream automation",
    proposed_runtime_status: "manual_pre_host_promotion_record_opened",
    proof_path: prerequisites.linkedArtifacts.runtimeProof.relativePath ?? "",
    quality_gate_profile: "manual_pre_host_promotion_guard/v1",
    promotion_profile_family: "bounded_manual_pre_host_promotion",
    proof_shape: "manual_pre_host_promotion_snapshot/v1",
    primary_host_checker: "pnpm run check:pre-host-promotion-record-prerequisites",
    full_text_coverage_threshold: "n/a",
    evidence_binding_threshold: "n/a",
    citation_error_threshold: "n/a",
    observed_full_text_coverage: "n/a",
    observed_evidence_binding: "n/a",
    observed_citation_error_rate: "n/a",
    quality_gate_result: "pass",
    validation_state: "validated_locally",
    quality_gate_fail_reasons: [],
    required_gates: [
      ...prerequisites.requiredGates,
      "pnpm run check:pre-host-promotion-record-prerequisites",
    ],
    validation_result:
      `This promotion record was opened manually from ${input.promotionReadinessPath} after repo-native pre-host prerequisites and promotion specification generation passed. Operator rationale: ${rationale}`,
    rollback_plan:
      `Delete ${promotionRecordRelativePath} and return the case to ${input.promotionReadinessPath}. Promotion specification remains at ${specificationPath}.`,
    owner: "Directive Runtime",
    promotion_decision:
      `approved for one bounded manual promotion-seam review by ${approvedBy}`,
  } satisfies RuntimePromotionRecordRequest;

  return {
    request,
    promotionRecordRelativePath,
  };
}

export function buildManualRuntimeRegistryAcceptanceRequest(input: {
  directiveRoot: string;
  promotionRecordPath: string;
  rationale: string;
  acceptedBy: string;
  acceptedAt?: string | null;
}) {
  const acceptedBy = normalizeDirectiveApprovalActor(input.acceptedBy);
  const rationale = requireDirectiveString(input.rationale, "rationale");
  const acceptedAt = String(input.acceptedAt ?? "").trim() || new Date().toISOString();
  const report = buildRuntimePromotionAutomationDryRunReport({
    directiveRoot: input.directiveRoot,
    promotionRecordPath: input.promotionRecordPath,
    policy: MANUAL_RUNTIME_REGISTRY_POLICY,
    approvedBy: acceptedBy,
    acceptedAt,
  });

  if (!report.automationEligible || !report.registryRequest) {
    throw new Error(`invalid_input: ${report.stopReason}`);
  }

  const request = {
    ...report.registryRequest,
    last_validated_by: "operator-approved Runtime registry acceptance",
    last_validation_date: acceptedAt.slice(0, 10),
    notes: [
      ...(report.registryRequest.notes ?? []),
      `Operator rationale: ${rationale}`,
    ],
    acceptance_gate: report.registryRequest.acceptance_gate
      ? {
        ...report.registryRequest.acceptance_gate,
        accepted_by: acceptedBy,
        accepted_at: acceptedAt,
        notes: [
          ...(report.registryRequest.acceptance_gate.notes ?? []),
          `Operator rationale: ${rationale}`,
        ],
      }
      : null,
  } satisfies RuntimeRegistryEntryRequest;

  return {
    request,
    report,
  };
}
