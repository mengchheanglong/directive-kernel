import type { DirectiveEngineMissionInput } from "./types.ts";

export function createDefaultDirectiveMission(): DirectiveEngineMissionInput {
  return {
    missionId: "default-directive-mission",
    currentObjective:
      "Evaluate incoming sources, preserve bounded ownership, and route them to the clearest Discovery, Architecture, or Runtime lane.",
    usefulnessSignals: [
      "Prefer Discovery when the source still needs clearer ownership or more explicit follow-up evidence.",
      "Prefer Architecture when the source improves directive workspace logic, routing, evaluation, or workflow boundaries.",
      "Prefer Runtime when the source yields repeated executable value, behavior-preserving transformation, or reusable operational capability.",
    ],
    capabilityLanes: [
      "discovery",
      "architecture",
      "runtime",
    ],
    constraints: [
      "Keep review explicit until the route is clearly bounded.",
      "Stay reversible and keep rollback boundaries visible.",
      "Keep the next change to one bounded slice.",
    ],
    successSignal:
      "Each source lands in the clearest lane with one explicit next step and no avoidable routing ambiguity.",
    adoptionTarget: null,
  };
}
