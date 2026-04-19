import {
  isLegacyRuntimeFollowUpDeferred,
  zeroLinkedArtifacts,
} from "../shared-state-helpers.ts";
import {
  recordInconsistentLink,
  recordMissingLinkedArtifactIfAbsent,
} from "../../artifact-link-validation.ts";
import type {
  GenericLegacyRuntimeFollowUpArtifact,
  GenericLegacyRuntimeHandoffArtifact,
  GenericLegacyRuntimeLiveFetchGateSnapshotArtifact,
  GenericLegacyRuntimeLiveFetchProofArtifact,
  GenericLegacyRuntimeLivePoolArtifact,
  GenericLegacyRuntimePreconditionDecisionNoteArtifact,
  GenericLegacyRuntimeProofChecklistArtifact,
  GenericLegacyRuntimePromotionRecordArtifact,
  GenericLegacyRuntimeRecordArtifact,
  GenericLegacyRuntimeRegistryArtifact,
  GenericLegacyRuntimeSamplePoolArtifact,
  GenericLegacyRuntimeSliceExecutionArtifact,
  GenericLegacyRuntimeSliceProofArtifact,
  GenericLegacyRuntimeSystemBundleArtifact,
  GenericLegacyRuntimeTransformationProofArtifact,
  GenericLegacyRuntimeTransformationRecordArtifact,
  GenericLegacyRuntimeValidationNoteArtifact,
} from "../runtime-artifact-types.ts";
import { isAcceptedRuntimeRegistryArtifact } from "./runtime-focus-readers.ts";

export function buildLegacyRuntimeFollowUpState(input: {
  directiveRoot: string;
  legacyFollowUp: GenericLegacyRuntimeFollowUpArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  const legacyDeferred = isLegacyRuntimeFollowUpDeferred({
    currentDecisionState: input.legacyFollowUp.currentDecisionState,
    currentStatus: input.legacyFollowUp.currentStatus,
  });

  if (legacyDeferred) {
    if (input.legacyFollowUp.reentryContractPath) {
      recordMissingLinkedArtifactIfAbsent({
        directiveRoot: input.directiveRoot,
        state: { missingExpectedArtifacts, inconsistentLinks },
        relativePath: input.legacyFollowUp.reentryContractPath,
        label: "Runtime re-entry contract",
      });
    } else {
      recordInconsistentLink(
        { missingExpectedArtifacts, inconsistentLinks },
        "missing linked Runtime re-entry contract: re-entry contract path (if deferred) was not recorded",
      );
    }
  }

  return {
    currentStage: legacyDeferred
      ? "runtime.follow_up.legacy_deferred"
      : "runtime.follow_up.legacy_recorded",
    nextLegalStep: legacyDeferred
      ? "No automatic Runtime step is open; this historical deferred Runtime follow-up remains parked unless a new bounded Legacy Runtime re-entry is explicitly opened."
      : "No automatic Runtime step is open; this historical Runtime follow-up remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeHandoffState(input: {
  directiveRoot: string;
  legacyHandoff: GenericLegacyRuntimeHandoffArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Originating Architecture record", input.legacyHandoff.originatingArchitectureRecordPath],
    ["Runtime follow-up", input.legacyHandoff.runtimeFollowUpPath],
    ["Runtime record", input.legacyHandoff.runtimeRecordPath],
    ["Runtime proof artifact", input.legacyHandoff.runtimeProofPath],
    ["Runtime promotion record", input.legacyHandoff.promotionRecordPath],
    ["Runtime registry entry", input.legacyHandoff.registryEntryPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.handoff.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical architecture-to-runtime handoff remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeRegistryState(input: {
  directiveRoot: string;
  legacyRuntimeRegistry: GenericLegacyRuntimeRegistryArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];
  const registryAccepted = isAcceptedRuntimeRegistryArtifact(input.legacyRuntimeRegistry);
  linked.runtimeRegistryEntryPath = input.legacyRuntimeRegistry.registryEntryRelativePath;
  linked.runtimePromotionRecordPath = input.legacyRuntimeRegistry.linkedPromotionRecordPath;
  linked.runtimeHostConsumptionReportPath = input.legacyRuntimeRegistry.proofArtifactPath;

  for (const [label, relativePath] of [
    ["Runtime promotion record", input.legacyRuntimeRegistry.linkedPromotionRecordPath],
    ["Runtime proof artifact", input.legacyRuntimeRegistry.proofArtifactPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: registryAccepted
      ? "runtime.registry.accepted"
      : "runtime.registry.legacy_recorded",
    nextLegalStep:
      registryAccepted
        ? "No automatic Runtime step is open; this Runtime registry entry is manually accepted through a bounded registry gate; promotion automation remains intentionally unopened."
        : "No automatic Runtime step is open; this historical Runtime registry entry remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimePromotionRecordState(input: {
  directiveRoot: string;
  legacyRuntimePromotionRecord: GenericLegacyRuntimePromotionRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimePromotionRecord.linkedRuntimeRecordPath],
    ["Source intent artifact", input.legacyRuntimePromotionRecord.sourceIntentArtifactPath],
    ["Runtime proof artifact", input.legacyRuntimePromotionRecord.proofArtifactPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.promotion_record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime promotion record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeRecordState(input: {
  directiveRoot: string;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Runtime origin path", input.legacyRuntimeRecord.originPath],
    ["Runtime follow-up", input.legacyRuntimeRecord.linkedFollowUpPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeSliceProofState(input: {
  directiveRoot: string;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeSliceProof.linkedRuntimeRecordPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeSliceProof.linkedRuntimeRecordPath],
    ["Runtime execution record", input.legacyRuntimeSliceProof.linkedExecutionRecordPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeSliceProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime slice proof candidate "${input.legacyRuntimeSliceProof.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.slice_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime slice proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeSliceExecutionState(input: {
  directiveRoot: string;
  legacyRuntimeSliceExecution: GenericLegacyRuntimeSliceExecutionArtifact;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeSliceExecution.linkedRuntimeProofPath;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeSliceExecution.linkedRuntimeProofPath,
    label: "Runtime slice proof",
  });

  if (
    input.legacyRuntimeSliceProof
    && input.legacyRuntimeSliceProof.candidateId !== input.legacyRuntimeSliceExecution.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime slice execution candidate "${input.legacyRuntimeSliceExecution.candidateId}" does not match runtime slice proof "${input.legacyRuntimeSliceProof.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.slice_execution.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime slice execution remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeProofChecklistState(input: {
  directiveRoot: string;
  legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
  legacyRuntimeSliceProof: GenericLegacyRuntimeSliceProofArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeProofChecklist.linkedRuntimeRecordPath;
  linked.runtimeProofPath = input.legacyRuntimeProofChecklist.linkedRuntimeProofPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeProofChecklist.linkedRuntimeRecordPath],
    ["Primary Runtime proof", input.legacyRuntimeProofChecklist.linkedRuntimeProofPath],
    ["Supplemental Runtime proof", input.legacyRuntimeProofChecklist.linkedSupplementalProofPath],
    ["Gate snapshot", input.legacyRuntimeProofChecklist.gateSnapshotPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeProofChecklist.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime proof checklist candidate "${input.legacyRuntimeProofChecklist.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeSliceProof
    && input.legacyRuntimeSliceProof.candidateId !== input.legacyRuntimeProofChecklist.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime proof checklist candidate "${input.legacyRuntimeProofChecklist.candidateId}" does not match runtime slice proof "${input.legacyRuntimeSliceProof.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.proof_checklist.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime proof checklist remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeLiveFetchProofState(input: {
  directiveRoot: string;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
  legacyRuntimeProofChecklist: GenericLegacyRuntimeProofChecklistArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath;
  linked.runtimeProofPath = input.legacyRuntimeLiveFetchProof.linkedProofChecklistPath;

  for (const [label, relativePath] of [
    ["Runtime record", input.legacyRuntimeLiveFetchProof.linkedRuntimeRecordPath],
    ["Proof checklist", input.legacyRuntimeLiveFetchProof.linkedProofChecklistPath],
    ["Gate snapshot", input.legacyRuntimeLiveFetchProof.gateSnapshotPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeLiveFetchProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch proof candidate "${input.legacyRuntimeLiveFetchProof.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeProofChecklist
    && input.legacyRuntimeProofChecklist.candidateId !== input.legacyRuntimeLiveFetchProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch proof candidate "${input.legacyRuntimeLiveFetchProof.candidateId}" does not match runtime proof checklist "${input.legacyRuntimeProofChecklist.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.live_fetch_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live-fetch proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeLiveFetchGateSnapshotState(input: {
  directiveRoot: string;
  legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath;
  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof?.linkedRuntimeRecordPath ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLiveFetchGateSnapshot.linkedLiveFetchProofPath,
    label: "Live-fetch proof",
  });

  if (
    input.legacyRuntimeLiveFetchProof
    && input.legacyRuntimeLiveFetchProof.candidateId
      !== input.legacyRuntimeLiveFetchGateSnapshot.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot candidate "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}" does not match live-fetch proof "${input.legacyRuntimeLiveFetchProof.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeLiveFetchProof?.gateSnapshotPath
    && input.legacyRuntimeLiveFetchProof.gateSnapshotPath
      !== input.legacyRuntimeLiveFetchGateSnapshot.gateSnapshotRelativePath
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot "${input.legacyRuntimeLiveFetchGateSnapshot.gateSnapshotRelativePath}" does not match live-fetch proof snapshot "${input.legacyRuntimeLiveFetchProof.gateSnapshotPath}"`,
    );
  }
  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId
      !== input.legacyRuntimeLiveFetchGateSnapshot.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live-fetch gate snapshot candidate "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.live_fetch_gate_snapshot.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live-fetch gate snapshot remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeLivePoolArtifactState(input: {
  directiveRoot: string;
  legacyRuntimeLivePoolArtifact: GenericLegacyRuntimeLivePoolArtifact;
  legacyRuntimeLiveFetchGateSnapshot: GenericLegacyRuntimeLiveFetchGateSnapshotArtifact | null;
  legacyRuntimeLiveFetchProof: GenericLegacyRuntimeLiveFetchProofArtifact | null;
  legacyRuntimeRecord: GenericLegacyRuntimeRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeProofPath = input.legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath;
  linked.runtimeRecordPath = input.legacyRuntimeLiveFetchProof?.linkedRuntimeRecordPath ?? null;

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLivePoolArtifact.linkedGateSnapshotPath,
    label: "Live-fetch gate snapshot",
  });
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeLivePoolArtifact.linkedLiveFetchProofPath,
    label: "Live-fetch proof",
  });

  if (
    input.legacyRuntimeLiveFetchGateSnapshot
    && input.legacyRuntimeLiveFetchGateSnapshot.candidateId
      !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match gate snapshot "${input.legacyRuntimeLiveFetchGateSnapshot.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeLiveFetchProof
    && input.legacyRuntimeLiveFetchProof.candidateId
      !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match live-fetch proof "${input.legacyRuntimeLiveFetchProof.candidateId}"`,
    );
  }
  if (
    input.legacyRuntimeRecord
    && input.legacyRuntimeRecord.candidateId !== input.legacyRuntimeLivePoolArtifact.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `runtime live pool artifact candidate "${input.legacyRuntimeLivePoolArtifact.candidateId}" does not match runtime record "${input.legacyRuntimeRecord.candidateId}"`,
    );
  }

  return {
    currentStage: input.legacyRuntimeLivePoolArtifact.degraded
      ? "runtime.live_degraded_pool.legacy_recorded"
      : "runtime.live_qualified_pool.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime live pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeSamplePoolArtifactState(input: {
  legacyRuntimeSamplePoolArtifact: GenericLegacyRuntimeSamplePoolArtifact;
}) {
  return {
    currentStage: input.legacyRuntimeSamplePoolArtifact.degraded
      ? "runtime.sample_degraded_pool.legacy_recorded"
      : "runtime.sample_qualified_pool.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime sample pool artifact remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeSystemBundleState() {
  return {
    currentStage: "runtime.system_bundle.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime system-bundle note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeValidationNoteState() {
  return {
    currentStage: "runtime.validation_note.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime validation note remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts: [] as string[],
    inconsistentLinks: [] as string[],
    linked: zeroLinkedArtifacts(),
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimePreconditionDecisionNoteState(input: {
  directiveRoot: string;
  legacyRuntimePreconditionDecisionNote: GenericLegacyRuntimePreconditionDecisionNoteArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  linked.runtimeFollowUpPath = input.legacyRuntimePreconditionDecisionNote.linkedFollowUpPath;
  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: linked.runtimeFollowUpPath,
    label: "Runtime follow-up record",
  });

  const currentStage =
    input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_proof"
      ? "runtime.precondition_proof.legacy_recorded"
      : input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_correction"
        ? "runtime.precondition_correction.legacy_recorded"
        : "runtime.host_adapter_decision.legacy_recorded";
  const nextLegalStep =
    input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_proof"
      ? "No automatic Runtime step is open; this historical Runtime CLI precondition proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
      : input.legacyRuntimePreconditionDecisionNote.noteKind === "precondition_correction"
        ? "No automatic Runtime step is open; this historical Runtime precondition correction remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened."
        : "No automatic Runtime step is open; this historical Runtime host-adapter decision remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.";

  return {
    currentStage,
    nextLegalStep,
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeTransformationRecordState(input: {
  directiveRoot: string;
  legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  for (const [label, relativePath] of [
    ["Discovery intake record", input.legacyRuntimeTransformationRecord.discoveryIntakePath],
    ["Transformation baseline artifact", input.legacyRuntimeTransformationRecord.baselineArtifactPath],
    ["Transformation result artifact", input.legacyRuntimeTransformationRecord.resultArtifactPath],
    ["Runtime promotion record", input.legacyRuntimeTransformationRecord.promotionRecordPath],
  ] as const) {
    recordMissingLinkedArtifactIfAbsent({
      directiveRoot: input.directiveRoot,
      state: { missingExpectedArtifacts, inconsistentLinks },
      relativePath,
      label,
    });
  }

  return {
    currentStage: "runtime.transformation_record.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime transformation record remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}

export function buildLegacyRuntimeTransformationProofState(input: {
  directiveRoot: string;
  legacyRuntimeTransformationProof: GenericLegacyRuntimeTransformationProofArtifact;
  legacyRuntimeTransformationRecord: GenericLegacyRuntimeTransformationRecordArtifact | null;
}) {
  const linked = zeroLinkedArtifacts();
  const missingExpectedArtifacts: string[] = [];
  const inconsistentLinks: string[] = [];

  recordMissingLinkedArtifactIfAbsent({
    directiveRoot: input.directiveRoot,
    state: { missingExpectedArtifacts, inconsistentLinks },
    relativePath: input.legacyRuntimeTransformationProof.linkedTransformationRecordPath,
    label: "Transformation record",
  });

  if (
    input.legacyRuntimeTransformationRecord
    && input.legacyRuntimeTransformationRecord.candidateId
      !== input.legacyRuntimeTransformationProof.candidateId
  ) {
    recordInconsistentLink(
      { missingExpectedArtifacts, inconsistentLinks },
      `transformation proof candidate "${input.legacyRuntimeTransformationProof.candidateId}" does not match transformation record "${input.legacyRuntimeTransformationRecord.candidateId}"`,
    );
  }

  return {
    currentStage: "runtime.transformation_proof.legacy_recorded",
    nextLegalStep:
      "No automatic Runtime step is open; this historical Runtime transformation proof remains read-only unless a new bounded Legacy Runtime re-entry is explicitly opened.",
    missingExpectedArtifacts,
    inconsistentLinks,
    linked,
    intentionallyUnbuiltDownstreamStages: [
      "runtime execution",
      "host integration",
      "callable implementation",
      "host-facing promotion",
      "promotion automation",
    ],
  };
}
