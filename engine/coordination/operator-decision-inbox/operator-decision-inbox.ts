import { normalizeAbsolutePath } from "../../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../../shared/lib/workspace-root.ts";
import {
  buildArchitectureMaterializationEntries,
  buildDiscoveryRoutingReviewEntries,
  buildGapFormalizationInboxEntries,
  buildMissionFeedbackInboxEntries,
  buildRuntimeHostSelectionEntries,
  buildRuntimeRegistryAcceptanceEntries,
  sortInboxEntries,
} from "./operator-decision-inbox-builders.ts";
import {
  buildLatestPlanStateSummaryByCandidateId,
} from "./operator-decision-inbox-plan-state.ts";

export {
  OPERATOR_DECISION_INBOX_VERSION,
  type OperatorDecisionInboxEntry,
  type OperatorDecisionInboxLane,
  type OperatorDecisionInboxReport,
} from "./operator-decision-inbox-types.ts";
export { renderOperatorDecisionInboxMarkdown } from "./operator-decision-inbox-markdown.ts";
import {
  OPERATOR_DECISION_INBOX_VERSION,
  type OperatorDecisionInboxReport,
} from "./operator-decision-inbox-types.ts";

export function buildOperatorDecisionInboxReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
}): OperatorDecisionInboxReport {
  const directiveRoot = normalizeAbsolutePath(
    input?.directiveRoot || getDefaultDirectiveWorkspaceRoot(),
  );
  const planStateSummaryByCandidateId =
    buildLatestPlanStateSummaryByCandidateId(directiveRoot);
  const entries = [
    ...buildMissionFeedbackInboxEntries(directiveRoot),
    ...buildDiscoveryRoutingReviewEntries(
      directiveRoot,
      planStateSummaryByCandidateId,
    ),
    ...buildArchitectureMaterializationEntries(
      directiveRoot,
      planStateSummaryByCandidateId,
    ),
    ...buildGapFormalizationInboxEntries(directiveRoot),
    ...buildRuntimeHostSelectionEntries(
      directiveRoot,
      planStateSummaryByCandidateId,
    ),
    ...buildRuntimeRegistryAcceptanceEntries(
      directiveRoot,
      planStateSummaryByCandidateId,
    ),
  ].sort(sortInboxEntries);

  return {
    ok: true,
    inboxVersion: OPERATOR_DECISION_INBOX_VERSION,
    snapshotAt: input?.snapshotAt ?? new Date().toISOString(),
    directiveRoot,
    guardrails: {
      readOnly: true,
      mutatesWorkflowState: false,
      bypassesReview: false,
      writesRegistryEntries: false,
      runsHostAdapters: false,
    },
    summary: {
      totalActionableEntries: entries.length,
      missionHealthFeedbackCount: entries.filter((entry) =>
        entry.decisionSurface === "mission_health_feedback"
      ).length,
      discoveryRoutingReviewCount: entries.filter((entry) =>
        entry.decisionSurface === "discovery_routing_review"
      ).length,
      architectureMaterializationDueCount: entries.filter((entry) =>
        entry.decisionSurface === "architecture_materialization_due"
      ).length,
      gapFormalizationReviewCount: entries.filter((entry) =>
        entry.decisionSurface === "gap_formalization_review"
      ).length,
      runtimeHostSelectionCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_host_selection"
      ).length,
      runtimePromotionSeamDecisionCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_promotion_seam_decision"
      ).length,
      runtimeRegistryAcceptanceCount: entries.filter((entry) =>
        entry.decisionSurface === "runtime_registry_acceptance"
      ).length,
    },
    entries,
  };
}
