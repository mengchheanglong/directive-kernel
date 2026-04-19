import { html } from "lit";

import type {
  FrontendArchitectureSummaryCase,
  FrontendEngineRunRecord,
  FrontendLaneAnchor,
  FrontendOperatorDecisionInboxEntry,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
} from "../types";
import { artifactPathToViewPath, navTo } from "../app-utils";
import { renderQueueTag } from "../components/lane-sections";
import { renderLearningSummary } from "./learning-summary";
import { artifactLink } from "./shared";

function workflowDecisionForCandidate(
  inbox: FrontendOperatorDecisionInboxReport,
  candidateId: string | null | undefined,
) {
  if (!candidateId) {
    return null;
  }

  return inbox.entries.find((entry) => entry.candidateId === candidateId) ?? null;
}

function summarizeRunPlanState(run: FrontendEngineRunRecord) {
  const state = run.executablePlanState;
  if (!state?.actions?.length) {
    return null;
  }

  const nextActions = state.nextActionIds
    .map((actionId) => state.actions.find((action) => action.actionId === actionId)?.title ?? null)
    .filter((title): title is string => Boolean(title));

  return {
    proofState: state.proofState.finalState,
    completionRate: state.completionRate,
    pendingActionCount: state.actions.filter((action) =>
      action.status !== "completed" && action.status !== "skipped"
    ).length,
    blockedActionCount: state.blockedActionIds.length,
    nextActions,
  };
}

function renderWorkflowMapRow(input: {
  lane: "research" | "discovery" | "architecture" | "runtime" | "host";
  title: string;
  stage: string | null | undefined;
  nextStep: string | null | undefined;
  artifactPath?: string | null;
  actionHref?: string | null;
  actionLabel?: string;
  decision?: FrontendOperatorDecisionInboxEntry | null;
  meta?: string | null;
}) {
  const decision = input.decision ?? null;
  const tone = input.lane === "runtime"
    ? "runtime"
    : input.lane === "architecture"
      ? "architecture"
      : "default";
  const status = decision ? "decision needed" : input.stage ?? "live";
  const decisionPlanState = decision?.planStateSummary ?? null;
  const planMeta = decisionPlanState
    ? `proof ${decisionPlanState.proofState} | ${decisionPlanState.pendingActionCount} pending | ${decisionPlanState.blockedActionCount} blocked`
    : null;
  const decisionGate = decision
    ? `${decision.decisionSurface}: ${decision.blockReason}${planMeta ? ` (${planMeta})` : ""}`
    : "none currently surfaced";

  return html`
    <details class=${`workflow-row ${input.lane}`}>
      <summary>
        <span class="workflow-main">
          <strong>${input.title}</strong>
          <span class="muted">${input.stage ?? "stage not resolved"}</span>
        </span>
        <span class="workflow-tags">
          ${renderQueueTag(input.lane, tone)}
          ${decision ? renderQueueTag("decision", "warning") : renderQueueTag("live", "default")}
        </span>
      </summary>
      <div class="workflow-row-detail">
        <div class="workflow-detail-grid">
          <div><h4>Status</h4><p>${status}</p></div>
          <div><h4>Next legal step</h4><p>${input.nextStep ?? "n/a"}</p></div>
          <div><h4>Current artifact</h4><p>${input.artifactPath ? artifactLink(input.artifactPath) : html`<span class="muted">n/a</span>`}</p></div>
          <div><h4>Decision gate</h4><p>${decisionGate}</p></div>
        </div>
        ${input.meta ? html`<p class="muted">${input.meta}</p>` : null}
        ${decisionPlanState?.nextActions.length
          ? html`<p class="muted">Next executable actions: ${decisionPlanState.nextActions.join(" | ")}</p>`
          : null}
        <div class="actions">
          ${input.actionHref
            ? html`
              <a
                href=${input.actionHref}
                @click=${(event: Event) => {
                  event.preventDefault();
                  navTo(input.actionHref || "");
                }}
              >
                ${input.actionLabel ?? "Open detail"}
              </a>
            `
            : null}
          ${decision
            ? html`
              <a
                href="/operator-inbox"
                @click=${(event: Event) => {
                  event.preventDefault();
                  navTo("/operator-inbox");
                }}
              >
                Open inbox decision
              </a>
            `
            : null}
        </div>
      </div>
    </details>
  `;
}

function renderWorkflowMapGroup(input: {
  title: string;
  description: string;
  rows: unknown[];
  renderRow: (row: any) => unknown;
}) {
  return html`
    <section class="workflow-group">
      <div class="workflow-group-heading">
        <div>
          <h2>${input.title}</h2>
          <p class="muted">${input.description}</p>
        </div>
        <span class="pill">${input.rows.length}</span>
      </div>
      ${input.rows.length
        ? html`<div class="workflow-row-list">${input.rows.map((row) => input.renderRow(row))}</div>`
        : html`<div class="queue-empty muted">No live rows in this phase.</div>`}
    </section>
  `;
}

export function renderWorkflowMapPage(
  snapshot: FrontendSnapshot,
  inbox: FrontendOperatorDecisionInboxReport,
) {
  const recentRuns = (snapshot.engineRuns.recentRuns || []).slice(0, 6);
  const discoveryRows = (snapshot.queue.entries || []).slice(0, 12);
  const architectureRows = [
    ...(snapshot.architectureSummary.activeCases || []),
    ...(snapshot.architectureSummary.recentAnchors || []),
  ].slice(0, 8);
  const runtimeRows = [
    ...(snapshot.runtimeSummary.activeCases || []),
    ...(snapshot.runtimeSummary.recentAnchors || []),
  ].slice(0, 8);
  const hostRows = (snapshot.runtimeSummary.activeCases || [])
    .filter((entry) => (entry.current_case_stage || "").includes("registry") || (entry.current_case_stage || "").includes("promotion_record"))
    .slice(0, 8);

  return html`
    <section class="workflow-hero">
      <div>
        <h2>Workflow Map</h2>
        <p>Live source-to-usefulness map. Rows stay compact; open a row for detail.</p>
      </div>
      <div class="workflow-hero-stats">
        <span><strong>${snapshot.queue.totalEntries}</strong><small>Discovery</small></span>
        <span><strong>${snapshot.architectureSummary.activeCases.length}</strong><small>Architecture</small></span>
        <span><strong>${snapshot.runtimeSummary.activeCases.length}</strong><small>Runtime</small></span>
        <span><strong>${inbox.summary.totalActionableEntries}</strong><small>Decisions</small></span>
      </div>
    </section>
    ${renderLearningSummary(snapshot.learningSummary)}
    <section class="workflow-map">
      ${renderWorkflowMapGroup({
        title: "Research Engine / Engine Runs",
        description: "Recent live analysis and routing records before lane handoff.",
        rows: recentRuns,
        renderRow: (run: { record: FrontendEngineRunRecord }) => {
          const planState = summarizeRunPlanState(run.record);
          const nextStep = planState?.nextActions[0]
            ?? run.record.reportPlan?.summary
            ?? `Integrate via ${run.record.integrationProposal?.integrationMode ?? "n/a"}`;
          const metaParts = [
            `Usefulness: ${run.record.candidate.usefulnessLevel}`,
            `proof kind: ${run.record.proofPlan?.proofKind ?? "n/a"}`,
          ];
          if (planState) {
            metaParts.push(
              `proof state: ${planState.proofState}`,
              `completion: ${planState.completionRate}%`,
              `pending actions: ${planState.pendingActionCount}`,
            );
          }

          return renderWorkflowMapRow({
            lane: "research",
            title: run.record.candidate.candidateName,
            stage: `engine.route.${run.record.selectedLane.laneId}`,
            nextStep,
            artifactPath: null,
            actionHref: `/engine-runs/${encodeURIComponent(run.record.runId)}`,
            actionLabel: "Open run",
            decision: workflowDecisionForCandidate(inbox, run.record.candidate.candidateId),
            meta: metaParts.join("; "),
          });
        },
      })}
      ${renderWorkflowMapGroup({
        title: "Discovery",
        description: "Front-door intake, routing, review pressure, and current downstream pointer.",
        rows: discoveryRows,
        renderRow: (entry: FrontendQueueEntry) => renderWorkflowMapRow({
          lane: "discovery",
          title: entry.candidate_name,
          stage: entry.current_case_stage ?? entry.status_effective ?? entry.status,
          nextStep: entry.current_case_next_legal_step,
          artifactPath: entry.current_head?.artifact_path ?? entry.result_record_path ?? entry.routing_record_path,
          actionHref: entry.current_head?.view_path ?? (entry.routing_record_path ? `/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path)}` : null),
          actionLabel: "Open current artifact",
          decision: workflowDecisionForCandidate(inbox, entry.candidate_id),
          meta: `Route: ${entry.routing_target ?? "n/a"}; integrity: ${entry.integrity_state ?? "n/a"}`,
        }),
      })}
      ${renderWorkflowMapGroup({
        title: "Architecture",
        description: "Engine-improvement lane heads and materialization due items when they exist.",
        rows: architectureRows,
        renderRow: (entry: FrontendArchitectureSummaryCase | FrontendLaneAnchor) => renderWorkflowMapRow({
          lane: "architecture",
          title: "label" in entry ? entry.label : entry.candidate_name,
          stage: "currentStage" in entry ? entry.currentStage : entry.current_case_stage,
          nextStep: "nextLegalStep" in entry ? entry.nextLegalStep : entry.current_case_next_legal_step,
          artifactPath: "artifactPath" in entry ? entry.artifactPath : entry.current_head?.artifact_path,
          actionHref: "artifactPath" in entry ? artifactPathToViewPath(entry.artifactPath) : entry.current_head?.view_path,
          actionLabel: "Open Architecture detail",
          decision: workflowDecisionForCandidate(inbox, "candidateId" in entry ? entry.candidateId : entry.candidate_id),
          meta: "Architecture rows are live lane heads or recent canonical anchors, not static roadmap items.",
        }),
      })}
      ${renderWorkflowMapGroup({
        title: "Runtime",
        description: "Reusable capability conversion, proof, promotion, and parked host-selection work.",
        rows: runtimeRows,
        renderRow: (entry: FrontendRuntimeSummaryCase | FrontendLaneAnchor) => renderWorkflowMapRow({
          lane: "runtime",
          title: "label" in entry ? entry.label : entry.candidate_name,
          stage: "currentStage" in entry ? entry.currentStage : entry.current_case_stage,
          nextStep: "nextLegalStep" in entry ? entry.nextLegalStep : entry.current_case_next_legal_step,
          artifactPath: "artifactPath" in entry ? entry.artifactPath : entry.current_head?.artifact_path,
          actionHref: "artifactPath" in entry ? artifactPathToViewPath(entry.artifactPath) : entry.current_head?.view_path,
          actionLabel: "Open Runtime detail",
          decision: workflowDecisionForCandidate(inbox, "candidateId" in entry ? entry.candidateId : entry.candidate_id),
          meta: "runtime_summary" in entry ? `Proposed host: ${entry.runtime_summary?.proposed_host ?? "n/a"}` : "Runtime canonical anchor.",
        }),
      })}
      ${renderWorkflowMapGroup({
        title: "Registry / Host",
        description: "Host-backed or registry-adjacent Runtime heads; still read-only here.",
        rows: hostRows,
        renderRow: (entry: FrontendRuntimeSummaryCase) => renderWorkflowMapRow({
          lane: "host",
          title: entry.candidate_name,
          stage: entry.current_case_stage,
          nextStep: entry.current_case_next_legal_step,
          artifactPath: entry.current_head?.artifact_path,
          actionHref: entry.current_head?.view_path,
          actionLabel: "Open host/runtime artifact",
          decision: workflowDecisionForCandidate(inbox, entry.candidate_id),
          meta: `Proposed host: ${entry.runtime_summary?.proposed_host ?? "n/a"}`,
        }),
      })}
    </section>
  `;
}
