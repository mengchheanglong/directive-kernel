import {
  renderRuntimeFollowUpRecord,
  resolveRuntimeFollowUpRecordPath,
  type RuntimeFollowUpRecordRequest,
} from "../../../runtime/lib/runtime-follow-up-record-writer.ts";
import {
  renderRuntimeProofChecklist,
  resolveRuntimeProofChecklistPath,
  resolveRuntimeProofGateSnapshotPath,
  type RuntimeProofBundleRequest,
} from "../../../runtime/lib/runtime-proof-bundle-writer.ts";
import {
  renderRuntimePromotionRecord,
  resolveRuntimePromotionRecordPath,
  type RuntimePromotionRecordRequest,
} from "../../../runtime/lib/runtime-promotion-record-writer.ts";
import {
  assertRuntimeRegistryAcceptanceGate,
} from "../../../runtime/lib/runtime-registry-acceptance-gate.ts";
import {
  renderRuntimeRecord,
  resolveRuntimeRecordPath,
  type RuntimeRecordRequest,
} from "../../../runtime/lib/runtime-record-writer.ts";
import {
  renderRuntimeRegistryEntry,
  resolveRuntimeRegistryEntryPath,
  type RuntimeRegistryEntryRequest,
} from "../../../runtime/lib/runtime-registry-entry-writer.ts";
import {
  renderRuntimeTransformationProof,
  resolveRuntimeTransformationProofPath,
  type RuntimeTransformationProofRequest,
} from "../../../runtime/lib/runtime-transformation-proof-writer.ts";
import {
  renderRuntimeTransformationRecord,
  resolveRuntimeTransformationRecordPath,
  type RuntimeTransformationRecordRequest,
} from "../../../runtime/lib/runtime-transformation-record-writer.ts";

import type { DiscoveryHostStorageBridge } from "../../integration-kit/lib/discovery-submission-adapter.ts";
import {
  assertDirectivePathExists,
  resolveDirectivePathLike,
} from "./shared.ts";

export async function writeStandaloneRuntimeFollowUp(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeFollowUpRecordRequest;
}) {
  const request = {
    ...input.request,
    promotion_contract_path: input.request.promotion_contract_path
      ? resolveDirectivePathLike(input.storage, input.request.promotion_contract_path)
      : input.request.promotion_contract_path,
    reentry_contract_path: input.request.reentry_contract_path
      ? resolveDirectivePathLike(input.storage, input.request.reentry_contract_path)
      : input.request.reentry_contract_path,
    linked_handoff_path: input.request.linked_handoff_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_handoff_path)
      : input.request.linked_handoff_path,
    linked_runtime_record_path: input.request.linked_runtime_record_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_runtime_record_path)
      : input.request.linked_runtime_record_path,
    linked_proof_checklist_path: input.request.linked_proof_checklist_path
      ? resolveDirectivePathLike(
          input.storage,
          input.request.linked_proof_checklist_path,
        )
      : input.request.linked_proof_checklist_path,
    linked_live_proof_path: input.request.linked_live_proof_path
      ? resolveDirectivePathLike(input.storage, input.request.linked_live_proof_path)
      : input.request.linked_live_proof_path,
  } satisfies RuntimeFollowUpRecordRequest;

  const relativePath = resolveRuntimeFollowUpRecordPath({
    candidate_id: request.candidate_id,
    follow_up_date: request.follow_up_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeFollowUpRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeRecordRequest;
}) {
  const request = {
    ...input.request,
    origin_path: resolveDirectivePathLike(input.storage, input.request.origin_path),
    linked_follow_up_record: resolveDirectivePathLike(
      input.storage,
      input.request.linked_follow_up_record,
    ),
    required_proof: resolveDirectivePathLike(
      input.storage,
      input.request.required_proof,
    ),
    supporting_contracts: (input.request.supporting_contracts ?? []).map((value) =>
      resolveDirectivePathLike(input.storage, value)
    ),
  } satisfies RuntimeRecordRequest;

  const relativePath = resolveRuntimeRecordPath({
    candidate_id: request.candidate_id,
    runtime_record_date: request.runtime_record_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeProofBundle(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeProofBundleRequest;
}) {
  const linkedRuntimeRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_runtime_record,
  );
  assertDirectivePathExists(linkedRuntimeRecord, "linked_runtime_record");

  const request = {
    ...input.request,
    linked_runtime_record: linkedRuntimeRecord,
    source_proof_artifacts: (input.request.source_proof_artifacts ?? []).map((value) =>
      resolveDirectivePathLike(input.storage, value)
    ),
  } satisfies RuntimeProofBundleRequest;

  const relativePath = resolveRuntimeProofChecklistPath({
    candidate_id: request.candidate_id,
    proof_date: request.proof_date,
    output_relative_path: request.output_relative_path,
  });
  const gateSnapshotRelativePath = resolveRuntimeProofGateSnapshotPath({
    candidate_id: request.candidate_id,
    proof_date: request.proof_date,
    gate_snapshot_relative_path: request.gate_snapshot_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  const gateSnapshotPath =
    input.storage.resolveWithinDirectiveRoot(gateSnapshotRelativePath);

  await input.storage.writeJson(gateSnapshotPath, request.gate_snapshot);
  await input.storage.writeText(
    absolutePath,
    renderRuntimeProofChecklist({
      request,
      gateSnapshotPath,
    }),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    gateSnapshotPath,
    gateSnapshotRelativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeTransformationProof(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeTransformationProofRequest;
}) {
  const relativePath = resolveRuntimeTransformationProofPath({
    candidate_id: input.request.candidate_id,
    proof_date: input.request.proof_date,
    output_relative_path: input.request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeJson(
    absolutePath,
    renderRuntimeTransformationProof(input.request),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: input.request.candidate_id,
  };
}

export async function writeStandaloneRuntimeTransformationRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeTransformationRecordRequest;
}) {
  const request = {
    ...input.request,
    discovery_intake_path: resolveDirectivePathLike(
      input.storage,
      input.request.discovery_intake_path,
    ),
    baseline_artifact_path: resolveDirectivePathLike(
      input.storage,
      input.request.baseline_artifact_path,
    ),
    result_artifact_path: resolveDirectivePathLike(
      input.storage,
      input.request.result_artifact_path,
    ),
    promotion_record: input.request.promotion_record
      ? resolveDirectivePathLike(input.storage, input.request.promotion_record)
      : input.request.promotion_record,
  } satisfies RuntimeTransformationRecordRequest;

  assertDirectivePathExists(request.baseline_artifact_path, "baseline_artifact_path");
  assertDirectivePathExists(request.result_artifact_path, "result_artifact_path");

  const relativePath = resolveRuntimeTransformationRecordPath({
    candidate_id: request.candidate_id,
    record_date: request.record_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(
    absolutePath,
    renderRuntimeTransformationRecord(request),
  );

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimePromotionRecord(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimePromotionRecordRequest;
}) {
  const linkedRuntimeRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_runtime_record,
  );
  const sourceIntentArtifact = resolveDirectivePathLike(
    input.storage,
    input.request.source_intent_artifact,
  );
  const compileContractArtifact = resolveDirectivePathLike(
    input.storage,
    input.request.compile_contract_artifact,
  );
  const proofPath = resolveDirectivePathLike(input.storage, input.request.proof_path);
  assertDirectivePathExists(linkedRuntimeRecord, "linked_runtime_record");
  assertDirectivePathExists(sourceIntentArtifact, "source_intent_artifact");
  assertDirectivePathExists(proofPath, "proof_path");

  const request = {
    ...input.request,
    linked_runtime_record: linkedRuntimeRecord,
    source_intent_artifact: sourceIntentArtifact,
    compile_contract_artifact: compileContractArtifact,
    proof_path: proofPath,
  } satisfies RuntimePromotionRecordRequest;

  const relativePath = resolveRuntimePromotionRecordPath({
    candidate_id: request.candidate_id,
    promotion_date: request.promotion_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimePromotionRecord(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}

export async function writeStandaloneRuntimeRegistryEntry(input: {
  storage: DiscoveryHostStorageBridge;
  request: RuntimeRegistryEntryRequest;
}) {
  if (input.request.acceptance_gate) {
    assertRuntimeRegistryAcceptanceGate({
      directiveRoot: input.storage.directiveRoot,
      request: input.request,
    });
  }

  const linkedPromotionRecord = resolveDirectivePathLike(
    input.storage,
    input.request.linked_promotion_record,
  );
  const proofPath = resolveDirectivePathLike(input.storage, input.request.proof_path);
  assertDirectivePathExists(linkedPromotionRecord, "linked_promotion_record");
  assertDirectivePathExists(proofPath, "proof_path");

  const request = {
    ...input.request,
  } satisfies RuntimeRegistryEntryRequest;

  const relativePath = resolveRuntimeRegistryEntryPath({
    candidate_id: request.candidate_id,
    registry_date: request.registry_date,
    output_relative_path: request.output_relative_path,
  });
  const absolutePath = input.storage.resolveWithinDirectiveRoot(relativePath);
  await input.storage.writeText(absolutePath, renderRuntimeRegistryEntry(request));

  return {
    ok: true,
    path: absolutePath,
    relativePath,
    candidate_id: request.candidate_id,
  };
}
