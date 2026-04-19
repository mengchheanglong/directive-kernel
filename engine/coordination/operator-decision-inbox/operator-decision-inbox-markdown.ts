import type {
  OperatorDecisionInboxEntry,
  OperatorDecisionInboxReport,
} from "./operator-decision-inbox-types.ts";

function markdownText(value: unknown) {
  return String(value ?? "n/a").replaceAll("|", "\\|").trim() || "n/a";
}

function renderMarkdownGroup(input: {
  title: string;
  entries: OperatorDecisionInboxEntry[];
}) {
  const lines = [`## ${input.title}`, ""];
  if (!input.entries.length) {
    lines.push("No actionable entries.", "");
    return lines.join("\n");
  }

  input.entries.forEach((entry, index) => {
    lines.push(`### ${index + 1}. ${markdownText(entry.candidateName ?? entry.candidateId ?? entry.entryId)}`);
    lines.push("");
    lines.push(`- Lane: ${markdownText(entry.lane)}`);
    lines.push(`- Decision surface: ${markdownText(entry.decisionSurface)}`);
    lines.push(`- Current stage: ${markdownText(entry.currentStage)}`);
    lines.push(`- Artifact: \`${markdownText(entry.artifactPath)}\``);
    lines.push(`- Why blocked: ${markdownText(entry.blockReason)}`);
    lines.push(`- Eligible next action: ${markdownText(entry.eligibleNextAction)}`);
    lines.push(`- Stop-line: ${markdownText(entry.stopLine)}`);
    if (entry.planStateSummary) {
      lines.push(
        `- Executable plan: proof=${markdownText(entry.planStateSummary.proofState)}, completion=${entry.planStateSummary.completionRate}%, pending=${entry.planStateSummary.pendingActionCount}, blocked=${entry.planStateSummary.blockedActionCount}, run=${markdownText(entry.planStateSummary.runId)}`,
      );
      if (entry.planStateSummary.nextActions.length) {
        lines.push("- Next executable actions:");
        for (const nextAction of entry.planStateSummary.nextActions) {
          lines.push(`  - ${markdownText(nextAction)}`);
        }
      }
    }
    lines.push("- Required proof:");
    for (const proof of entry.requiredProof.length ? entry.requiredProof : ["n/a"]) {
      lines.push(`  - ${markdownText(proof)}`);
    }
    lines.push("- Resolver command or artifact:");
    lines.push("```text");
    lines.push(String(entry.resolverCommandOrArtifact || "n/a"));
    lines.push("```");
    if (entry.relatedArtifacts.length) {
      lines.push("- Related artifacts:");
      for (const artifact of entry.relatedArtifacts) {
        lines.push(`  - \`${markdownText(artifact)}\``);
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}

export function renderOperatorDecisionInboxMarkdown(report: OperatorDecisionInboxReport) {
  const missionFeedbackEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "mission_health_feedback"
  );
  const runtimeHostSelectionEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_host_selection"
  );
  const runtimeRegistryAcceptanceEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_registry_acceptance"
  );
  const runtimePromotionSeamDecisionEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "runtime_promotion_seam_decision"
  );
  const architectureMaterializationEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "architecture_materialization_due"
  );
  const gapFormalizationEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "gap_formalization_review"
  );
  const discoveryRoutingReviewEntries = report.entries.filter((entry) =>
    entry.decisionSurface === "discovery_routing_review"
  );

  return [
    "# Operator Decision Inbox",
    "",
    `Snapshot: ${report.snapshotAt}`,
    `Version: ${report.inboxVersion}`,
    `Directive root: \`${markdownText(report.directiveRoot)}\``,
    "",
    "## Guardrails",
    "",
    `- Read-only: ${report.guardrails.readOnly}`,
    `- Mutates workflow state: ${report.guardrails.mutatesWorkflowState}`,
    `- Bypasses review: ${report.guardrails.bypassesReview}`,
    `- Writes registry entries: ${report.guardrails.writesRegistryEntries}`,
    `- Runs host adapters: ${report.guardrails.runsHostAdapters}`,
    "",
    "## Summary",
    "",
    `- Total actionable entries: ${report.summary.totalActionableEntries}`,
    `- Mission health feedback decisions: ${report.summary.missionHealthFeedbackCount}`,
    `- Runtime host-selection decisions: ${report.summary.runtimeHostSelectionCount}`,
    `- Runtime promotion-seam decisions: ${report.summary.runtimePromotionSeamDecisionCount}`,
    `- Architecture materialization decisions: ${report.summary.architectureMaterializationDueCount}`,
    `- Gap formalization decisions: ${report.summary.gapFormalizationReviewCount}`,
    `- Runtime registry-acceptance decisions: ${report.summary.runtimeRegistryAcceptanceCount}`,
    `- Discovery routing-review decisions: ${report.summary.discoveryRoutingReviewCount}`,
    "",
    renderMarkdownGroup({
      title: "Mission Health Feedback",
      entries: missionFeedbackEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Host Selection",
      entries: runtimeHostSelectionEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Promotion Seam Decision",
      entries: runtimePromotionSeamDecisionEntries,
    }),
    renderMarkdownGroup({
      title: "Architecture Materialization",
      entries: architectureMaterializationEntries,
    }),
    renderMarkdownGroup({
      title: "Gap Formalization",
      entries: gapFormalizationEntries,
    }),
    renderMarkdownGroup({
      title: "Runtime Registry Acceptance",
      entries: runtimeRegistryAcceptanceEntries,
    }),
    renderMarkdownGroup({
      title: "Discovery Routing Review",
      entries: discoveryRoutingReviewEntries,
    }),
    "## Stop-Line",
    "",
    "This report is read-only. It does not resolve Discovery routes, write Runtime host-selection resolutions, run host adapters, write registry entries, or change automation policy.",
    "",
  ].join("\n");
}
