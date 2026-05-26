import {
  formatIterativeControlSignals,
  formatStructuralProcessStages,
  resolveControlSignalProfile,
  resolveStructuralProcessStages,
} from "./lane-planning-helpers.ts";
import type {
  EngineAdaptationPlan,
  EngineAnalysis,
  EngineCandidate,
  EngineDecision,
  EngineEvent,
  EngineExtractionPlan,
  EngineImprovementPlan,
  EngineIntegrationProposal,
  EngineProofPlan,
  EngineReportPlan,
} from "../types.ts";
import type { EngineLanePlanningInput } from "../lane.ts";

function buildSourceAnalysis(
  input: {
    planningInput: EngineLanePlanningInput;
    usefulnessRationale: string;
  },
): EngineAnalysis {
  const structuralProcessStages = resolveStructuralProcessStages(
    input.planningInput.source,
  );
  const controlSignalProfile = resolveControlSignalProfile(
    input.planningInput.source,
  );
  const structuralStageSummary = structuralProcessStages.length >= 2
    ? `Structural stages detected: ${formatStructuralProcessStages(structuralProcessStages)}.`
    : null;
  const controlSignalSummary = controlSignalProfile
    ? controlSignalProfile.framing === "iterative_loop"
      ? `Loop-control signals detected: ${formatIterativeControlSignals(controlSignalProfile.signals)}.`
      : `Bounded control/evidence signals detected: ${formatIterativeControlSignals(controlSignalProfile.signals)}.`
    : null;
  const derivedSummaries = [structuralStageSummary, controlSignalSummary].filter(Boolean);

  return {
    missionFitSummary:
      derivedSummaries.length > 0
        ? `${input.planningInput.source.summary || `Assess ${input.planningInput.source.title || input.planningInput.candidateId} against mission "${input.planningInput.mission.currentObjective}".`} ${derivedSummaries.join(" ")}`
        : input.planningInput.source.summary
          || `Assess ${input.planningInput.source.title || input.planningInput.candidateId} against mission "${input.planningInput.mission.currentObjective}".`,
    primaryAdoptionQuestion:
      structuralProcessStages.length >= 2
        ? `Which parts of the ${formatStructuralProcessStages(structuralProcessStages)} stage pattern belong to Engine-owned workflow structure, and which parts should stay out of Architecture until a different adoption target is proven?`
        : controlSignalProfile?.framing === "iterative_loop"
          ? `Which explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries belong to Engine-owned loop discipline, and which parts should stay out of Architecture until a different adoption target is proven?`
          : controlSignalProfile
            ? `Which explicit ${formatIterativeControlSignals(controlSignalProfile.signals)} boundaries belong to Engine-owned control and evidence discipline, and which parts should stay out of Architecture until a different adoption target is proven?`
            : "What is the primary adoption target of the extracted value?",
    matchedCapabilityGapId: input.planningInput.routingAssessment.matchedGapId,
    usefulnessRationale: input.usefulnessRationale,
    rationale: [
      ...input.planningInput.routingAssessment.rationale,
      ...(structuralStageSummary
        ? [
            `${structuralStageSummary} Preserve those stage boundaries during Architecture adaptation instead of flattening them into one generic mechanism.`,
          ]
        : []),
      ...(controlSignalSummary
        ? [
            controlSignalProfile?.framing === "iterative_loop"
              ? `${controlSignalSummary} Preserve those bounded loop-control boundaries during Architecture adaptation instead of flattening them into one generic workflow heuristic.`
              : `${controlSignalSummary} Preserve those bounded control and evidence boundaries during Architecture adaptation instead of flattening them into one generic workflow heuristic.`,
          ]
        : []),
    ],
  };
}

function buildEvents(input: {
  receivedAt: string;
  analysis: EngineAnalysis;
  candidate: EngineCandidate;
  extractionPlan: EngineExtractionPlan;
  adaptationPlan: EngineAdaptationPlan;
  improvementPlan: EngineImprovementPlan;
  proofPlan: EngineProofPlan;
  decision: EngineDecision;
  integrationProposal: EngineIntegrationProposal;
  reportPlan: EngineReportPlan;
}): EngineEvent[] {
  return [
    {
      type: "source_ingested",
      at: input.receivedAt,
      summary: `Source captured for candidate ${input.candidate.candidateId}.`,
    },
    {
      type: "source_analyzed",
      at: input.receivedAt,
      summary: `${input.analysis.missionFitSummary} Usefulness rationale: ${input.analysis.usefulnessRationale}`,
    },
    {
      type: "candidate_routed",
      at: input.receivedAt,
      summary:
        `Candidate routed to ${input.candidate.recommendedLaneId} with usefulness level ${input.candidate.usefulnessLevel}. ${input.analysis.usefulnessRationale}`,
    },
    {
      type: "value_extracted",
      at: input.receivedAt,
      summary: `Extracted ${input.extractionPlan.extractedValue.length} value signals and excluded ${input.extractionPlan.excludedBaggage.length} baggage signals.`,
    },
    {
      type: "value_adapted",
      at: input.receivedAt,
      summary: input.adaptationPlan.directiveOwnedForm,
    },
    {
      type: "value_improved",
      at: input.receivedAt,
      summary: input.improvementPlan.intendedDelta,
    },
    {
      type: "proof_planned",
      at: input.receivedAt,
      summary: `Proof plan ${input.proofPlan.proofKind} prepared.`,
    },
    {
      type: "decision_recorded",
      at: input.receivedAt,
      summary: input.decision.summary,
    },
    {
      type: "integration_proposed",
      at: input.receivedAt,
      summary: `Integration proposal targets ${input.integrationProposal.targetLaneId} via ${input.integrationProposal.handoffArtifactFamily}.`,
    },
    {
      type: "report_planned",
      at: input.receivedAt,
      summary: input.reportPlan.summary,
    },
  ];
}

export {
  buildEvents,
  buildSourceAnalysis,
};
