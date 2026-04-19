import fs from "node:fs";
import path from "node:path";

import { writeJson, writeUtf8 } from "../../../shared/lib/file-io.ts";
import {
  buildDirectiveRuntimePromotionSpecification,
  resolveDirectiveRuntimePromotionSpecificationPath,
} from "../../../runtime/lib/host/runtime-promotion-specification.ts";
import {
  evaluatePreHostRuntimePromotionRecordPrerequisites,
  renderRuntimePromotionRecord,
  resolveRuntimePromotionRecordPath,
} from "../../../runtime/lib/writers/runtime-promotion-record-writer.ts";
import { isDirectiveWorkspaceHost } from "./autonomous-lane-loop-policy.ts";

export function writeAutonomousRuntimePromotionSpecification(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
}) {
  const specification = buildDirectiveRuntimePromotionSpecification({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const specificationRelativePath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const specificationAbsolutePath = path.join(input.directiveRoot, specificationRelativePath);
  const created = !fs.existsSync(specificationAbsolutePath);
  writeJson(specificationAbsolutePath, specification);
  return {
    created,
    specificationRelativePath: specificationRelativePath.replace(/\\/g, "/"),
  };
}

export function writeAutonomousRuntimePromotionRecord(input: {
  directiveRoot: string;
  promotionReadinessPath: string;
  approvedBy: string;
}) {
  const prerequisites = evaluatePreHostRuntimePromotionRecordPrerequisites({
    directiveRoot: input.directiveRoot,
    promotionReadinessPath: input.promotionReadinessPath,
  });

  if (!prerequisites.readyForPreHostPromotionRecordPreparation) {
    return {
      ok: false as const,
      reason: `Runtime promotion record prerequisites are incomplete: ${prerequisites.missingPrerequisites.join(", ")}`,
    };
  }

  if (!isDirectiveWorkspaceHost(prerequisites.effectiveProposedHost)) {
    return {
      ok: false as const,
      reason: "Runtime promotion record auto-open remains limited to Directive Workspace host targets.",
    };
  }

  const promotionDate =
    path.posix.basename(input.promotionReadinessPath).slice(0, 10)
    || new Date().toISOString().slice(0, 10);
  const specificationPath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  const promotionRecordRelativePath = resolveRuntimePromotionRecordPath({
    candidate_id: prerequisites.candidateId,
    promotion_date: promotionDate,
  });
  const promotionRecordAbsolutePath = path.join(input.directiveRoot, promotionRecordRelativePath);
  const created = !fs.existsSync(promotionRecordAbsolutePath);

  const request = {
    candidate_id: prerequisites.candidateId,
    candidate_name: prerequisites.candidateName,
    promotion_date: promotionDate,
    linked_runtime_record: prerequisites.linkedArtifacts.runtimeRecord.relativePath ?? "",
    target_host: prerequisites.effectiveProposedHost ?? prerequisites.proposedHost ?? "Directive Workspace host target",
    target_runtime_surface: prerequisites.targetRuntimeSurface ?? "bounded runtime capability review",
    integration_mode: prerequisites.integrationMode ?? "review_only",
    source_intent_artifact: prerequisites.linkedArtifacts.capabilityBoundary.relativePath ?? "",
    compile_contract_artifact: prerequisites.compileContractArtifact.relativePath ?? "shared/contracts/runtime-to-host.md",
    runtime_permissions_profile: "read-only promotion-record preparation only; no registry write, host integration, runtime execution, or automation side effects",
    safe_output_scope: "`runtime/07-promotion-records/` and `runtime/06-promotion-specifications/` only",
    sanitize_policy: "autonomous bounded pre-host promotion record only; no registry acceptance, host integration, runtime execution, or downstream automation",
    proposed_runtime_status: "autonomous_pre_host_promotion_record_opened",
    proof_path: prerequisites.linkedArtifacts.runtimeProof.relativePath ?? "",
    quality_gate_profile: "autonomous_pre_host_promotion_guard/v1",
    promotion_profile_family: "bounded_autonomous_pre_host_promotion",
    proof_shape: "autonomous_pre_host_promotion_snapshot/v1",
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
      `This promotion record was opened automatically from ${input.promotionReadinessPath} after repo-native pre-host prerequisites and promotion specification generation passed. Registry acceptance, host integration, runtime execution, and promotion automation remain closed.`,
    rollback_plan:
      `Remove ${promotionRecordRelativePath}, regenerate ${specificationPath} if needed, and return the case to ${input.promotionReadinessPath} before any further Runtime step.`,
    owner: "Directive Runtime",
    promotion_decision: "approved for one bounded autonomous pre-host promotion review",
  };

  writeUtf8(promotionRecordAbsolutePath, renderRuntimePromotionRecord(request));

  return {
    ok: true as const,
    created,
    promotionRecordRelativePath: promotionRecordRelativePath.replace(/\\/g, "/"),
  };
}
