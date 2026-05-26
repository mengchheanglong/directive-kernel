import { normalizeText } from "../source-utils.ts";
import type {
  EngineExecutablePlanAction,
  EngineExecutablePlanActionOwner,
  EngineExecutablePlanState,
  EnginePlanItem,
  EnginePlanProgressUpdate,
  EnginePrimaryAdoptionTarget,
  EngineRunRecord,
  EngineStructuredAdaptationPlan,
  EngineStructuredExtractionPlan,
  EngineStructuredImprovementPlan,
  EngineStructuredProofPlan,
  EngineWorkflowBoundaryShape,
} from "../types.ts";

function normalizeOptionalBoolean(value: unknown) {
  if (value === true || value === false) {
    return value;
  }
  return null;
}

function normalizePrimaryAdoptionTarget(
  value: unknown,
): EnginePrimaryAdoptionTarget | null {
  if (value === "discovery" || value === "architecture" || value === "runtime") {
    return value;
  }
  return null;
}

function normalizeWorkflowBoundaryShape(
  value: unknown,
): EngineWorkflowBoundaryShape | null {
  if (value === "bounded_protocol" || value === "iterative_loop") {
    return value;
  }
  return null;
}

function toPlanItem(value: string): EnginePlanItem {
  return {
    value,
    status: "pending",
    completedAt: null,
  };
}

function completionRate(items: EnginePlanItem[]) {
  if (items.length === 0) {
    return 0;
  }
  const completedCount = items.filter((item) => item.status === "completed").length;
  return Math.round((completedCount / items.length) * 100);
}

function completionRateFromStatuses(
  statuses: Array<EnginePlanItem["status"]>,
) {
  if (statuses.length === 0) {
    return 0;
  }
  const completedCount = statuses.filter((status) => status === "completed").length;
  return Math.round((completedCount / statuses.length) * 100);
}

function buildStructuredExtractionPlan(
  extractionPlan: EngineRunRecord["extractionPlan"],
): EngineStructuredExtractionPlan {
  const extractedValue = extractionPlan.extractedValue.map(toPlanItem);
  const excludedBaggage = extractionPlan.excludedBaggage.map(toPlanItem);
  return {
    extractedValue,
    excludedBaggage,
    completionRate: completionRate([...extractedValue, ...excludedBaggage]),
  };
}

function buildStructuredAdaptationPlan(
  adaptationPlan: EngineRunRecord["adaptationPlan"],
): EngineStructuredAdaptationPlan {
  const directiveOwnedForm = toPlanItem(adaptationPlan.directiveOwnedForm);
  const adaptedValue = adaptationPlan.adaptedValue.map(toPlanItem);
  return {
    directiveOwnedForm,
    adaptedValue,
    completionRate: completionRate([directiveOwnedForm, ...adaptedValue]),
  };
}

function buildStructuredImprovementPlan(
  improvementPlan: EngineRunRecord["improvementPlan"],
): EngineStructuredImprovementPlan {
  const intendedDelta = toPlanItem(improvementPlan.intendedDelta);
  const improvementGoals = improvementPlan.improvementGoals.map(toPlanItem);
  return {
    improvementGoals,
    intendedDelta,
    completionRate: completionRate([intendedDelta, ...improvementGoals]),
  };
}

function buildStructuredProofPlan(
  proofPlan: EngineRunRecord["proofPlan"],
): EngineStructuredProofPlan {
  const objective = toPlanItem(proofPlan.objective);
  const requiredEvidence = proofPlan.requiredEvidence.map(toPlanItem);
  const requiredGates = proofPlan.requiredGates.map(toPlanItem);
  const rollbackPrompt = toPlanItem(proofPlan.rollbackPrompt);
  return {
    proofKind: proofPlan.proofKind,
    objective,
    requiredEvidence,
    requiredGates,
    rollbackPrompt,
    completionRate: completionRate([
      objective,
      rollbackPrompt,
      ...requiredEvidence,
      ...requiredGates,
    ]),
  };
}

function buildActionId(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  index?: number | null;
}) {
  return input.index === null || input.index === undefined
    ? `${input.plan}:${input.itemType}`
    : `${input.plan}:${input.itemType}:${input.index}`;
}

function mapActionOwner(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
}): EngineExecutablePlanActionOwner {
  if (input.plan === "proof" && (
    input.itemType === "requiredEvidence"
    || input.itemType === "requiredGates"
  )) {
    return "operator";
  }
  return "engine";
}

function mapEvidenceStatus(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  status: EnginePlanItem["status"];
}): EngineExecutablePlanAction["evidenceStatus"] {
  if (input.plan !== "proof" || input.itemType !== "requiredEvidence") {
    return "not_needed";
  }
  if (input.status === "completed" || input.status === "skipped") {
    return "gathered";
  }
  if (input.status === "in_progress") {
    return "gathering";
  }
  return "pending";
}

function mapGateStatus(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  status: EnginePlanItem["status"];
}): EngineExecutablePlanAction["gateStatus"] {
  if (input.plan !== "proof" || input.itemType !== "requiredGates") {
    return "not_needed";
  }
  if (input.status === "completed" || input.status === "skipped") {
    return "passed";
  }
  if (input.status === "in_progress") {
    return "reviewing";
  }
  return "pending";
}

function buildActionDetail(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  value: string;
}) {
  switch (input.plan) {
    case "extraction":
      return input.itemType === "excludedBaggage"
        ? `Confirm this baggage stays excluded from downstream planning: ${input.value}`
        : `Extract and preserve this value signal for downstream work: ${input.value}`;
    case "adaptation":
      return input.itemType === "directiveOwnedForm"
        ? `Translate the source into one directive-owned form: ${input.value}`
        : `Adapt the source signal into a directive-owned output: ${input.value}`;
    case "improvement":
      return input.itemType === "intendedDelta"
        ? `Anchor the bounded delta the engine intends to produce: ${input.value}`
        : `Advance this improvement goal through a bounded change: ${input.value}`;
    case "proof":
      if (input.itemType === "objective") {
        return `Define the proof objective that governs the bounded change: ${input.value}`;
      }
      if (input.itemType === "requiredEvidence") {
        return `Gather explicit evidence for the proof boundary: ${input.value}`;
      }
      if (input.itemType === "requiredGates") {
        return `Pass the explicit review gate before proving the change: ${input.value}`;
      }
      return `Record the rollback boundary for this proof plan: ${input.value}`;
  }
}

function buildCompletionCriteria(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  value: string;
}) {
  switch (input.plan) {
    case "extraction":
      return [
        `The extracted signal is recorded explicitly: ${input.value}`,
        "Downstream plans can reference this signal without re-reading the source.",
      ];
    case "adaptation":
      return [
        `The directive-owned representation is recorded explicitly: ${input.value}`,
        "The adapted output is ready for bounded improvement planning.",
      ];
    case "improvement":
      return [
        `The intended improvement delta is explicit and bounded: ${input.value}`,
        "The next proof/action step can be reviewed without inferring hidden scope.",
      ];
    case "proof":
      if (input.itemType === "requiredEvidence") {
        return [
          `Concrete evidence is gathered or intentionally waived: ${input.value}`,
          "The proof boundary can cite the evidence directly.",
        ];
      }
      if (input.itemType === "requiredGates") {
        return [
          `The explicit review gate is passed or intentionally waived: ${input.value}`,
          "The proof remains bounded after gate review.",
        ];
      }
      return [
        `The proof planning artifact is explicit: ${input.value}`,
        "The proof boundary can advance without implicit assumptions.",
      ];
  }
}

function buildPlanAction(input: {
  plan: EngineExecutablePlanAction["plan"];
  itemType: string;
  itemIndex?: number | null;
  item: EnginePlanItem;
  blockedByActionIds: string[];
}): EngineExecutablePlanAction {
  return {
    actionId: buildActionId({
      plan: input.plan,
      itemType: input.itemType,
      index: input.itemIndex,
    }),
    plan: input.plan,
    itemType: input.itemType,
    itemIndex: input.itemIndex ?? null,
    title: input.item.value,
    detail: buildActionDetail({
      plan: input.plan,
      itemType: input.itemType,
      value: input.item.value,
    }),
    owner: mapActionOwner({
      plan: input.plan,
      itemType: input.itemType,
    }),
    status: input.item.status,
    completedAt: input.item.completedAt,
    blockedByActionIds: input.blockedByActionIds,
    completionCriteria: buildCompletionCriteria({
      plan: input.plan,
      itemType: input.itemType,
      value: input.item.value,
    }),
    evidenceStatus: mapEvidenceStatus({
      plan: input.plan,
      itemType: input.itemType,
      status: input.item.status,
    }),
    gateStatus: mapGateStatus({
      plan: input.plan,
      itemType: input.itemType,
      status: input.item.status,
    }),
  };
}

function deriveNextActionIds(actions: EngineExecutablePlanAction[]) {
  const completedIds = new Set(
    actions
      .filter((action) => action.status === "completed" || action.status === "skipped")
      .map((action) => action.actionId),
  );
  return actions
    .filter((action) => action.status === "pending" || action.status === "in_progress")
    .filter((action) => action.blockedByActionIds.every((id) => completedIds.has(id)))
    .map((action) => action.actionId);
}

function deriveBlockedActionIds(actions: EngineExecutablePlanAction[]) {
  const completedIds = new Set(
    actions
      .filter((action) => action.status === "completed" || action.status === "skipped")
      .map((action) => action.actionId),
  );
  return actions
    .filter((action) => action.status === "pending" || action.status === "in_progress")
    .filter((action) => action.blockedByActionIds.some((id) => !completedIds.has(id)))
    .map((action) => action.actionId);
}

function deriveProofState(actions: EngineExecutablePlanAction[]) {
  const proofActions = actions.filter((action) => action.plan === "proof");
  const objective = proofActions.find((action) => action.itemType === "objective") ?? null;
  const evidenceActions = proofActions.filter((action) => action.itemType === "requiredEvidence");
  const gateActions = proofActions.filter((action) => action.itemType === "requiredGates");

  const outstandingEvidenceActionIds = evidenceActions
    .filter((action) => action.status !== "completed" && action.status !== "skipped")
    .map((action) => action.actionId);
  const outstandingGateActionIds = gateActions
    .filter((action) => action.status !== "completed" && action.status !== "skipped")
    .map((action) => action.actionId);

  const objectiveState =
    objective?.status === "completed" || objective?.status === "skipped"
      ? "defined"
      : "pending";
  const evidenceState =
    evidenceActions.length === 0
      ? "not_needed"
      : outstandingEvidenceActionIds.length === 0
        ? "evidence_gathered"
        : evidenceActions.some((action) => action.status === "in_progress")
          ? "evidence_gathering"
          : "evidence_pending";
  const gateState =
    gateActions.length === 0
      ? "not_needed"
      : outstandingGateActionIds.length === 0
        ? "gate_passed"
        : gateActions.some((action) => action.status === "in_progress")
          ? "gate_review"
          : "gate_pending";
  const finalState =
    objectiveState === "defined"
      && (evidenceState === "not_needed" || evidenceState === "evidence_gathered")
      && (gateState === "not_needed" || gateState === "gate_passed")
      ? "proved"
      : objectiveState === "defined"
        && (evidenceState === "evidence_gathered" || gateState === "gate_passed")
        ? "proof_ready"
        : "proof_pending";

  return {
    objectiveState,
    evidenceState,
    gateState,
    finalState,
    outstandingEvidenceActionIds,
    outstandingGateActionIds,
  } satisfies EngineExecutablePlanState["proofState"];
}

function buildExecutablePlanState(input: {
  structuredExtractionPlan: EngineStructuredExtractionPlan;
  structuredAdaptationPlan: EngineStructuredAdaptationPlan;
  structuredImprovementPlan: EngineStructuredImprovementPlan;
  structuredProofPlan: EngineStructuredProofPlan;
}): EngineExecutablePlanState {
  const extractionActionIds = [
    ...input.structuredExtractionPlan.extractedValue.map((_, index) =>
      buildActionId({ plan: "extraction", itemType: "extractedValue", index })),
    ...input.structuredExtractionPlan.excludedBaggage.map((_, index) =>
      buildActionId({ plan: "extraction", itemType: "excludedBaggage", index })),
  ];
  const directiveOwnedFormActionId = buildActionId({
    plan: "adaptation",
    itemType: "directiveOwnedForm",
  });
  const adaptationActionIds = [
    directiveOwnedFormActionId,
    ...input.structuredAdaptationPlan.adaptedValue.map((_, index) =>
      buildActionId({ plan: "adaptation", itemType: "adaptedValue", index })),
  ];
  const intendedDeltaActionId = buildActionId({
    plan: "improvement",
    itemType: "intendedDelta",
  });
  const improvementActionIds = [
    intendedDeltaActionId,
    ...input.structuredImprovementPlan.improvementGoals.map((_, index) =>
      buildActionId({ plan: "improvement", itemType: "improvementGoals", index })),
  ];
  const proofObjectiveActionId = buildActionId({
    plan: "proof",
    itemType: "objective",
  });

  const actions: EngineExecutablePlanAction[] = [
    ...input.structuredExtractionPlan.extractedValue.map((item, index) =>
      buildPlanAction({
        plan: "extraction",
        itemType: "extractedValue",
        itemIndex: index,
        item,
        blockedByActionIds: [],
      })),
    ...input.structuredExtractionPlan.excludedBaggage.map((item, index) =>
      buildPlanAction({
        plan: "extraction",
        itemType: "excludedBaggage",
        itemIndex: index,
        item,
        blockedByActionIds: [],
      })),
    buildPlanAction({
      plan: "adaptation",
      itemType: "directiveOwnedForm",
      item: input.structuredAdaptationPlan.directiveOwnedForm,
      blockedByActionIds: extractionActionIds,
    }),
    ...input.structuredAdaptationPlan.adaptedValue.map((item, index) =>
      buildPlanAction({
        plan: "adaptation",
        itemType: "adaptedValue",
        itemIndex: index,
        item,
        blockedByActionIds: [directiveOwnedFormActionId],
      })),
    buildPlanAction({
      plan: "improvement",
      itemType: "intendedDelta",
      item: input.structuredImprovementPlan.intendedDelta,
      blockedByActionIds: adaptationActionIds,
    }),
    ...input.structuredImprovementPlan.improvementGoals.map((item, index) =>
      buildPlanAction({
        plan: "improvement",
        itemType: "improvementGoals",
        itemIndex: index,
        item,
        blockedByActionIds: [intendedDeltaActionId],
      })),
    buildPlanAction({
      plan: "proof",
      itemType: "objective",
      item: input.structuredProofPlan.objective,
      blockedByActionIds: improvementActionIds,
    }),
    ...input.structuredProofPlan.requiredEvidence.map((item, index) =>
      buildPlanAction({
        plan: "proof",
        itemType: "requiredEvidence",
        itemIndex: index,
        item,
        blockedByActionIds: [proofObjectiveActionId],
      })),
    ...input.structuredProofPlan.requiredGates.map((item, index) =>
      buildPlanAction({
        plan: "proof",
        itemType: "requiredGates",
        itemIndex: index,
        item,
        blockedByActionIds: [proofObjectiveActionId],
      })),
    buildPlanAction({
      plan: "proof",
      itemType: "rollbackPrompt",
      item: input.structuredProofPlan.rollbackPrompt,
      blockedByActionIds: [proofObjectiveActionId],
    }),
  ];

  const nextActionIds = deriveNextActionIds(actions);
  const blockedActionIds = deriveBlockedActionIds(actions);

  return {
    version: 1,
    actions,
    nextActionIds,
    blockedActionIds,
    completionRate: completionRateFromStatuses(actions.map((action) => action.status)),
    proofState: deriveProofState(actions),
    rationale: [
      "Executable plan state mirrors the structured plans as explicit tracked actions.",
      "Dependencies flow extraction -> adaptation -> improvement -> proof.",
      "Proof readiness is derived from explicit evidence and gate action completion.",
    ],
  };
}

function normalizeCompletedAtForStatus(input: {
  status: EnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
}) {
  if (input.status === "completed") {
    return normalizeText(input.completedAt) || input.fallbackAt;
  }
  return null;
}

function applyPlanItemStatusUpdate(input: {
  item: EnginePlanItem;
  status: EnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
}) {
  return {
    ...input.item,
    status: input.status,
    completedAt: normalizeCompletedAtForStatus({
      status: input.status,
      completedAt: input.completedAt,
      fallbackAt: input.fallbackAt,
    }),
  } satisfies EnginePlanItem;
}

function updateIndexedPlanItems(input: {
  items: EnginePlanItem[];
  index: number;
  status: EnginePlanItem["status"];
  completedAt?: string | null;
  fallbackAt: string;
  label: string;
}) {
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= input.items.length) {
    throw new Error(`invalid_input: ${input.label} index ${input.index} is out of range`);
  }
  return input.items.map((item, index) =>
    index === input.index
      ? applyPlanItemStatusUpdate({
        item,
        status: input.status,
        completedAt: input.completedAt,
        fallbackAt: input.fallbackAt,
      })
      : item
  );
}

function normalizeStructuredPlans(record: EngineRunRecord) {
  return {
    structuredExtractionPlan:
      record.structuredExtractionPlan ?? buildStructuredExtractionPlan(record.extractionPlan),
    structuredAdaptationPlan:
      record.structuredAdaptationPlan ?? buildStructuredAdaptationPlan(record.adaptationPlan),
    structuredImprovementPlan:
      record.structuredImprovementPlan ?? buildStructuredImprovementPlan(record.improvementPlan),
    structuredProofPlan:
      record.structuredProofPlan ?? buildStructuredProofPlan(record.proofPlan),
  };
}

function applyPlanProgressUpdates(input: {
  record: EngineRunRecord;
  updates: EnginePlanProgressUpdate[];
  at: string;
}) {
  let {
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
  } = normalizeStructuredPlans(input.record);

  for (const update of input.updates) {
    switch (update.plan) {
      case "extraction":
        structuredExtractionPlan = {
          ...structuredExtractionPlan,
          [update.itemType]: updateIndexedPlanItems({
            items: structuredExtractionPlan[update.itemType],
            index: update.index,
            status: update.status,
            completedAt: update.completedAt,
            fallbackAt: input.at,
            label: `structuredExtractionPlan.${update.itemType}`,
          }),
        };
        structuredExtractionPlan = {
          ...structuredExtractionPlan,
          completionRate: completionRate([
            ...structuredExtractionPlan.extractedValue,
            ...structuredExtractionPlan.excludedBaggage,
          ]),
        };
        break;
      case "adaptation":
        if (update.itemType === "directiveOwnedForm") {
          structuredAdaptationPlan = {
            ...structuredAdaptationPlan,
            directiveOwnedForm: applyPlanItemStatusUpdate({
              item: structuredAdaptationPlan.directiveOwnedForm,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else {
          structuredAdaptationPlan = {
            ...structuredAdaptationPlan,
            adaptedValue: updateIndexedPlanItems({
              items: structuredAdaptationPlan.adaptedValue,
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: "structuredAdaptationPlan.adaptedValue",
            }),
          };
        }
        structuredAdaptationPlan = {
          ...structuredAdaptationPlan,
          completionRate: completionRate([
            structuredAdaptationPlan.directiveOwnedForm,
            ...structuredAdaptationPlan.adaptedValue,
          ]),
        };
        break;
      case "improvement":
        if (update.itemType === "intendedDelta") {
          structuredImprovementPlan = {
            ...structuredImprovementPlan,
            intendedDelta: applyPlanItemStatusUpdate({
              item: structuredImprovementPlan.intendedDelta,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else {
          structuredImprovementPlan = {
            ...structuredImprovementPlan,
            improvementGoals: updateIndexedPlanItems({
              items: structuredImprovementPlan.improvementGoals,
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: "structuredImprovementPlan.improvementGoals",
            }),
          };
        }
        structuredImprovementPlan = {
          ...structuredImprovementPlan,
          completionRate: completionRate([
            structuredImprovementPlan.intendedDelta,
            ...structuredImprovementPlan.improvementGoals,
          ]),
        };
        break;
      case "proof":
        if (update.itemType === "objective" || update.itemType === "rollbackPrompt") {
          structuredProofPlan = {
            ...structuredProofPlan,
            [update.itemType]: applyPlanItemStatusUpdate({
              item: structuredProofPlan[update.itemType],
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
            }),
          };
        } else if (update.itemType === "requiredEvidence" || update.itemType === "requiredGates") {
          structuredProofPlan = {
            ...structuredProofPlan,
            [update.itemType]: updateIndexedPlanItems({
              items: structuredProofPlan[update.itemType],
              index: update.index,
              status: update.status,
              completedAt: update.completedAt,
              fallbackAt: input.at,
              label: `structuredProofPlan.${update.itemType}`,
            }),
          };
        }
        structuredProofPlan = {
          ...structuredProofPlan,
          completionRate: completionRate([
            structuredProofPlan.objective,
            structuredProofPlan.rollbackPrompt,
            ...structuredProofPlan.requiredEvidence,
            ...structuredProofPlan.requiredGates,
          ]),
        };
        break;
    }
  }

  const executablePlanState = buildExecutablePlanState({
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
  });

  return {
    structuredExtractionPlan,
    structuredAdaptationPlan,
    structuredImprovementPlan,
    structuredProofPlan,
    executablePlanState,
  };
}

function buildProcessSourceInputFromRecord(record: EngineRunRecord) {
  return {
    source: { ...record.source },
    mission: {
      missionId: record.mission.missionId,
      currentObjective: record.mission.currentObjective,
      usefulnessSignals: [...record.mission.usefulnessSignals],
      capabilityLanes: [...record.mission.capabilityLanes],
      constraints: [...record.mission.constraints],
      successSignal: record.mission.successSignal,
      adoptionTarget: record.mission.adoptionTarget,
      activeMissionMarkdown: record.mission.activeMissionMarkdown,
    },
    gaps: [...record.openGaps],
    receivedAt: record.receivedAt,
  };
}

function applyStructuredAnswersToRecordInput(input: {
  recordInput: ReturnType<typeof buildProcessSourceInputFromRecord>;
  answers: Record<string, unknown>;
}) {
  const next = {
    ...input.recordInput,
    source: { ...input.recordInput.source },
    mission: { ...input.recordInput.mission },
  };

  for (const [field, value] of Object.entries(input.answers)) {
    switch (field) {
      case "source.primaryAdoptionTarget":
        next.source.primaryAdoptionTarget = normalizePrimaryAdoptionTarget(value);
        break;
      case "source.containsExecutableCode":
        next.source.containsExecutableCode = normalizeOptionalBoolean(value);
        break;
      case "source.containsWorkflowPattern":
        next.source.containsWorkflowPattern = normalizeOptionalBoolean(value);
        break;
      case "source.improvesDirectiveWorkspace":
        next.source.improvesDirectiveWorkspace = normalizeOptionalBoolean(value);
        break;
      case "source.workflowBoundaryShape":
        next.source.workflowBoundaryShape = normalizeWorkflowBoundaryShape(value);
        break;
      case "source.capabilityGapId":
        next.source.capabilityGapId = normalizeText(value) || null;
        break;
      case "source.missionAlignmentHint":
        next.source.missionAlignmentHint = normalizeText(value) || null;
        break;
      case "mission.currentObjective":
        next.mission.currentObjective = normalizeText(value) || next.mission.currentObjective;
        break;
      case "mission.usefulnessSignals":
        next.mission.usefulnessSignals = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.usefulnessSignals;
        break;
      case "mission.capabilityLanes":
        next.mission.capabilityLanes = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.capabilityLanes;
        break;
      case "mission.constraints":
        next.mission.constraints = Array.isArray(value)
          ? value.map((item) => normalizeText(item)).filter(Boolean)
          : next.mission.constraints;
        break;
      case "mission.successSignal":
        next.mission.successSignal = normalizeText(value) || null;
        break;
      case "mission.adoptionTarget":
        next.mission.adoptionTarget = normalizeText(value) || null;
        break;
    }
  }

  return next;
}

export {
  applyPlanProgressUpdates,
  applyStructuredAnswersToRecordInput,
  buildExecutablePlanState,
  buildProcessSourceInputFromRecord,
  buildStructuredAdaptationPlan,
  buildStructuredExtractionPlan,
  buildStructuredImprovementPlan,
  buildStructuredProofPlan,
};
