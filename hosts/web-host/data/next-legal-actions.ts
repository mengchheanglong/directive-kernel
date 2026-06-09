export type NextLegalAction = {
  name: string;
  label: string;
  requiresApproval: boolean;
  source: "nextLegalStep";
};

/**
 * Project a `nextLegalStep` string into structured next-legal-action hints.
 * Returns an empty array for falsy input or text beginning with "No automatic".
 */
export function projectNextLegalActions(
  nextLegalStep: string | null | undefined,
): NextLegalAction[] {
  if (!nextLegalStep) return [];
  const text = nextLegalStep.trim();
  if (!text) return [];
  const lower = text.toLowerCase();
  if (lower.startsWith("no automatic")) return [];
  const actions: NextLegalAction[] = [];

  if (lower.includes("follow-up")) {
    actions.push({
      name: "runtime_open_follow_up",
      label: "Open runtime follow-up",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  }

  if (lower.includes("promotion-readiness")) {
    actions.push({
      name: "runtime_open_promotion_readiness",
      label: "Open promotion readiness",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  }

  if (lower.includes("proof")) {
    actions.push({
      name: "runtime_open_proof",
      label: "Open runtime proof",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  }

  if (lower.includes("confirm retention")) {
    actions.push({
      name: "architecture_confirm_retention",
      label: "Confirm retention",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  }

  if (lower.includes("record consumption")) {
    actions.push({
      name: "architecture_record_consumption",
      label: "Record consumption",
      requiresApproval: true,
      source: "nextLegalStep",
    });
  }

  return actions;
}
