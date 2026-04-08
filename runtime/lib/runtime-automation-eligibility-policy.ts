import type {
  RuntimeHostCallableAdapterDescriptor,
} from "./runtime-host-callable-adapter-contract.ts";

export const RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION =
  "runtime_automation_eligibility_policy.v1" as const;

export type RuntimeAutomationEligibilityClass =
  | "descriptor_only"
  | "directive_owned_callable"
  | "source_derived_callable"
  | "external_app_execution"
  | "unsupported";

export type RuntimeAutomationEligibilityDecision = {
  policyVersion: typeof RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION;
  candidateClass: RuntimeAutomationEligibilityClass;
  hostIntegrationAllowed: boolean;
  hostCallableExecutionAllowed: boolean;
  registryAcceptanceAllowed: boolean;
  automationAllowed: boolean;
  externalAppExecutionAllowed: boolean;
  requiredEvidence: string[];
  reasons: string[];
  stopLine: string;
};

function hasSourceDerivedSignal(descriptor: RuntimeHostCallableAdapterDescriptor) {
  const signalText = [
    descriptor.adapterId,
    descriptor.callableSurface,
    descriptor.stopLine,
    descriptor.proof.primaryChecker,
    ...descriptor.proof.supportingCheckers,
  ].join(" ").toLowerCase();

  return signalText.includes("source-pack")
    || signalText.includes("source_pack")
    || signalText.includes("source-derived")
    || signalText.includes("derived behavior")
    || signalText.includes("derived execution");
}

export function classifyRuntimeAutomationEligibility(input: {
  descriptor?: RuntimeHostCallableAdapterDescriptor | null;
}): RuntimeAutomationEligibilityDecision {
  const descriptor = input.descriptor ?? null;

  if (!descriptor) {
    return {
      policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
      candidateClass: "unsupported",
      hostIntegrationAllowed: false,
      hostCallableExecutionAllowed: false,
      registryAcceptanceAllowed: false,
      automationAllowed: false,
      externalAppExecutionAllowed: false,
      requiredEvidence: ["host callable adapter descriptor"],
      reasons: ["No host callable adapter descriptor is available for this candidate."],
      stopLine:
        "Unsupported candidates require explicit review or a candidate-specific adapter before any host, execution, registry, or automation claim.",
    };
  }

  if (descriptor.acceptance.sourceRuntimeExecutionClaimed) {
    return {
      policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
      candidateClass: "external_app_execution",
      hostIntegrationAllowed: false,
      hostCallableExecutionAllowed: false,
      registryAcceptanceAllowed: false,
      automationAllowed: false,
      externalAppExecutionAllowed: false,
      requiredEvidence: [
        "explicit external app execution approval",
        "isolation and rollback proof",
        "schema-bound invocation contract",
      ],
      reasons: [
        "External app execution is never eligible for default automation.",
        "The current host callable adapter contract does not allow arbitrary imported-source app execution claims.",
      ],
      stopLine:
        "External app execution requires explicit approved isolation and schema-bound execution proof; it cannot be inferred from a host adapter descriptor.",
    };
  }

  if (
    descriptor.capabilityKind === "descriptor_callable"
    || descriptor.acceptance.descriptorCallableOnly
  ) {
    return {
      policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
      candidateClass: "descriptor_only",
      hostIntegrationAllowed: false,
      hostCallableExecutionAllowed: true,
      registryAcceptanceAllowed: false,
      automationAllowed: false,
      externalAppExecutionAllowed: false,
      requiredEvidence: [
        "promotion record",
        "promotion specification",
        "host descriptor callable proof",
      ],
      reasons: [
        "Descriptor-only candidates may expose read-only host surfaces.",
        "Descriptor-only candidates cannot be treated as runtime/source execution or registry-accepted capabilities by default.",
      ],
      stopLine:
        "Descriptor-only candidates remain inspectable host surfaces; runtime execution, registry acceptance, and promotion automation remain blocked.",
    };
  }

  if (
    descriptor.capabilityKind === "runtime_callable_execution"
    && descriptor.acceptance.runtimeCallableExecution
    && hasSourceDerivedSignal(descriptor)
  ) {
    return {
      policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
      candidateClass: "source_derived_callable",
      hostIntegrationAllowed: true,
      hostCallableExecutionAllowed: true,
      registryAcceptanceAllowed: true,
      automationAllowed: true,
      externalAppExecutionAllowed: false,
      requiredEvidence: [
        "promotion record",
        "promotion specification",
        "host adapter proof",
        "Runtime callable execution evidence",
        "rollback path",
      ],
      reasons: [
        "The callable executes Directive-owned behavior derived from a source.",
        "This does not claim that the imported external app itself is executing.",
      ],
      stopLine:
        "Source-derived callable automation is eligible only with Runtime-owned execution evidence; arbitrary external app execution remains blocked.",
    };
  }

  if (
    descriptor.capabilityKind === "runtime_callable_execution"
    && descriptor.acceptance.runtimeCallableExecution
  ) {
    return {
      policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
      candidateClass: "directive_owned_callable",
      hostIntegrationAllowed: Boolean(descriptor.acceptance.hostIntegrationClaimed),
      hostCallableExecutionAllowed: true,
      registryAcceptanceAllowed: true,
      automationAllowed: true,
      externalAppExecutionAllowed: false,
      requiredEvidence: [
        "promotion record",
        "promotion specification",
        "host adapter proof",
        "Runtime callable execution evidence",
        "rollback path",
      ],
      reasons: [
        "The callable executes through a Runtime-owned callable surface.",
        "No imported-source app execution is claimed.",
      ],
      stopLine:
        "Directive-owned callable automation is eligible only when proof gates pass; external app execution remains blocked.",
    };
  }

  return {
    policyVersion: RUNTIME_AUTOMATION_ELIGIBILITY_POLICY_VERSION,
    candidateClass: "unsupported",
    hostIntegrationAllowed: false,
    hostCallableExecutionAllowed: false,
    registryAcceptanceAllowed: false,
    automationAllowed: false,
    externalAppExecutionAllowed: false,
    requiredEvidence: ["supported host callable adapter classification"],
    reasons: ["The host callable adapter descriptor does not match a supported automation class."],
    stopLine:
      "Unsupported candidates require review before any host, execution, registry, or automation claim.",
  };
}
