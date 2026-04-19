import { html, nothing } from "lit";

import type {
  FrontendOperatorDecisionInboxEntry,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
} from "../types";
import { navTo } from "../app-utils";
import {
  renderArchitectureCaseStrip,
  renderQueueStat,
  renderQueueTag,
} from "../components/lane-sections";
import { renderLearningSummary } from "./learning-summary";
import { renderActionLink } from "./shell";
import { artifactLink, formatDecisionSurface } from "./shared";

type HomeRendererContext = {
  renderRuntimeCaseStrip: (entry: FrontendRuntimeSummaryCase | FrontendQueueEntry) => unknown;
};

function renderOperatorDecisionEntry(entry: FrontendOperatorDecisionInboxEntry) {
  const planStateSummary = entry.planStateSummary ?? null;
  return html`
    <article class=${`decision-entry ${entry.decisionSurface}`}>
      <div class="queue-card-header">
        <div>
          <h3 class="queue-card-title">${entry.candidateName ?? entry.candidateId ?? entry.entryId}</h3>
          <div class="queue-card-subtitle">${entry.entryId}</div>
        </div>
        <div class="queue-tag-row">
          ${renderQueueTag(entry.lane, entry.lane === "runtime" ? "runtime" : entry.lane === "architecture" ? "architecture" : "default")}
          ${renderQueueTag(entry.decisionSurface, "warning")}
        </div>
      </div>
      <div class="queue-kv-grid">
        <div class="queue-kv"><h4>Current stage</h4><p>${entry.currentStage ?? "n/a"}</p></div>
        <div class="queue-kv"><h4>Blocked because</h4><p>${entry.blockReason}</p></div>
        <div class="queue-kv"><h4>Next action</h4><p>${entry.eligibleNextAction}</p></div>
        <div class="queue-kv"><h4>Source artifact</h4><p>${artifactLink(entry.artifactPath)}</p></div>
      </div>
      ${planStateSummary
        ? html`
          <section class="queue-highlight">
            <h4>Executable plan summary</h4>
            <p>
              Run ${planStateSummary.runId} | proof ${planStateSummary.proofState}
              | completion ${planStateSummary.completionRate}%
              | pending ${planStateSummary.pendingActionCount}
              | blocked ${planStateSummary.blockedActionCount}
            </p>
            ${planStateSummary.nextActions.length
              ? html`<ul>${planStateSummary.nextActions.map((action) => html`<li>${action}</li>`)}</ul>`
              : nothing}
          </section>
        `
        : nothing}
      <section class="queue-highlight">
        <h4>Required proof</h4>
        <ul>${entry.requiredProof.map((proof) => html`<li>${proof}</li>`)}</ul>
      </section>
      <section class="queue-highlight">
        <h4>Resolver command or artifact</h4>
        <pre>${entry.resolverCommandOrArtifact}</pre>
      </section>
      ${entry.relatedArtifacts.length
        ? html`<section class="queue-highlight"><h4>Related artifacts</h4><ul>${entry.relatedArtifacts.map((artifact) => html`<li>${artifactLink(artifact)}</li>`)}</ul></section>`
        : nothing}
      <p class="muted">Stop-line: ${entry.stopLine}</p>
    </article>
  `;
}

function renderCompactSourceList(entries: FrontendQueueEntry[]) {
  const rows = entries.slice(0, 8);
  if (!rows.length) {
    return html`<div class="queue-empty muted">No sources have entered Discovery yet.</div>`;
  }

  return html`
    <div class="simple-list">
      ${rows.map((entry) => {
        const href = entry.current_head?.view_path
          ?? (entry.routing_record_path
            ? `/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path)}`
            : "/queue");
        const tone = entry.routing_target === "runtime"
          ? "runtime"
          : entry.routing_target === "architecture"
            ? "architecture"
            : "default";
        return html`
          <a
            class="simple-row"
            href=${href}
            @click=${(event: Event) => {
              event.preventDefault();
              navTo(href);
            }}
          >
            <span class="simple-row-main simple-row-copy">
              <span class="simple-row-kicker">${entry.current_case_stage ?? entry.status_effective ?? entry.status}</span>
              <strong class="simple-row-title">${entry.candidate_name}</strong>
              <span class="simple-row-support">${entry.current_case_next_legal_step ?? "No next legal step recorded yet."}</span>
              <span class="muted mono">${entry.candidate_id}</span>
            </span>
            <span class="simple-row-side">
              <span class="simple-row-meta">
                ${renderQueueTag(entry.status_effective, "default")}
                ${entry.routing_target ? renderQueueTag(entry.routing_target, tone) : nothing}
              </span>
              <span class="simple-row-arrow">Open</span>
            </span>
          </a>
        `;
      })}
    </div>
  `;
}

function renderCompactDecisionList(entries: FrontendOperatorDecisionInboxEntry[]) {
  const rows = entries.slice(0, 5);
  if (!rows.length) {
    return html`<div class="queue-empty muted">No active operator decisions.</div>`;
  }

  return html`
    <div class="simple-list">
      ${rows.map((entry) => html`
        <a
          class="simple-row"
          href="/operator-inbox"
          @click=${(event: Event) => {
            event.preventDefault();
            navTo("/operator-inbox");
          }}
        >
          <span class="simple-row-main simple-row-copy">
            <span class="simple-row-kicker">${formatDecisionSurface(entry.decisionSurface)}</span>
            <strong class="simple-row-title">${entry.candidateName ?? entry.candidateId ?? entry.entryId}</strong>
            <span class="simple-row-support">${entry.blockReason}</span>
            <span class="muted">${entry.eligibleNextAction}</span>
            ${entry.planStateSummary
              ? html`<span class="muted">Proof ${entry.planStateSummary.proofState} | pending ${entry.planStateSummary.pendingActionCount} | next ${entry.planStateSummary.nextActions[0] ?? "n/a"}</span>`
              : nothing}
          </span>
          <span class="simple-row-side">
            <span class="simple-row-meta">
              ${renderQueueTag(entry.lane, entry.lane === "runtime" ? "runtime" : entry.lane === "architecture" ? "architecture" : "default")}
              ${renderQueueTag("review", "warning")}
            </span>
            <span class="simple-row-arrow">Open</span>
          </span>
        </a>
      `)}
    </div>
  `;
}

function renderDashboardFocusCard(input: {
  kicker: string;
  title: string;
  meta: string;
  body: string;
  href: string;
  cta: string;
  badge?: string | number | null;
}) {
  return html`
    <a
      class="dashboard-focus-card"
      href=${input.href}
      @click=${(event: Event) => {
        event.preventDefault();
        navTo(input.href);
      }}
    >
      <div class="dashboard-focus-topline">
        <span class="dashboard-focus-kicker">${input.kicker}</span>
        ${input.badge == null ? nothing : html`<span class="dashboard-focus-badge">${input.badge}</span>`}
      </div>
      <strong class="dashboard-focus-title">${input.title}</strong>
      <span class="dashboard-focus-meta">${input.meta}</span>
      <p class="dashboard-focus-body">${input.body}</p>
      <span class="dashboard-focus-cta">${input.cta}</span>
    </a>
  `;
}

export function renderOperatorDecisionInboxPage(inbox: FrontendOperatorDecisionInboxReport) {
  const missionHealthFeedback = inbox.entries.filter((entry) => entry.decisionSurface === "mission_health_feedback");
  const runtimeHostSelection = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_host_selection");
  const runtimePromotionSeamDecision = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_promotion_seam_decision");
  const runtimeRegistryAcceptance = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_registry_acceptance");
  const architectureMaterialization = inbox.entries.filter((entry) => entry.decisionSurface === "architecture_materialization_due");
  const gapFormalizationReview = inbox.entries.filter((entry) => entry.decisionSurface === "gap_formalization_review");
  const discoveryRoutingReview = inbox.entries.filter((entry) => entry.decisionSurface === "discovery_routing_review");

  const renderGroup = (title: string, description: string, entries: FrontendOperatorDecisionInboxEntry[]) => html`
    <section class="panel">
      <h2>${title}</h2>
      <p class="muted">${description}</p>
      ${entries.length
        ? html`<div class="decision-entry-list">${entries.map((entry) => renderOperatorDecisionEntry(entry))}</div>`
        : html`<div class="queue-empty muted">No actionable entries for this group.</div>`}
    </section>
  `;

  return html`
    <section class="panel">
      <h2>Operator Decision Inbox</h2>
      <p class="muted">Live read-only triage over current Engine, Discovery, Architecture, and Runtime decision gates. This page is API-backed by Engine coordination state; it does not resolve routes, write host-selection artifacts, run host adapters, create Architecture materialization artifacts, or write registry entries.</p>
      <div class="queue-summary-grid">
        ${renderQueueStat("Actionable entries", inbox.summary.totalActionableEntries, "Current Discovery, Architecture, and Runtime decisions requiring explicit operator attention.")}
        ${renderQueueStat("Mission feedback", inbox.summary.missionHealthFeedbackCount, "Mission evolution proposals generated from mission-health pressure and routed into an explicit operator review loop.")}
        ${renderQueueStat("Runtime host selections", inbox.summary.runtimeHostSelectionCount, "Runtime promotion paths blocked on explicit host selection.")}
        ${renderQueueStat("Runtime seam decisions", inbox.summary.runtimePromotionSeamDecisionCount, "Runtime promotion paths ready for explicit manual promotion-seam review.")}
        ${renderQueueStat("Architecture materialization", inbox.summary.architectureMaterializationDueCount, "Architecture adoptions or implementation targets awaiting explicit lane-native materialization.")}
        ${renderQueueStat("Gap formalization", inbox.summary.gapFormalizationReviewCount, "Gap radar suggestions waiting for explicit formalization into the Discovery capability-gap registry.")}
        ${renderQueueStat("Registry acceptance", inbox.summary.runtimeRegistryAcceptanceCount, "Proof-backed Runtime registry decisions requiring explicit acceptance.")}
        ${renderQueueStat("Discovery routing reviews", inbox.summary.discoveryRoutingReviewCount, "Conflicted or non-high-confidence Discovery routes requiring review.")}
      </div>
      <p class="muted">Snapshot: ${inbox.snapshotAt} | version: ${inbox.inboxVersion}</p>
    </section>
    <section class="panel message">
      <h3>Guardrails</h3>
      <p>Read-only: ${String(inbox.guardrails.readOnly)} | mutates workflow state: ${String(inbox.guardrails.mutatesWorkflowState)} | bypasses review: ${String(inbox.guardrails.bypassesReview)} | writes registry entries: ${String(inbox.guardrails.writesRegistryEntries)} | runs host adapters: ${String(inbox.guardrails.runsHostAdapters)}</p>
    </section>
    ${renderGroup("Mission Health Feedback", "Highest-priority mission updates. These entries preview mission evolution before any active-mission change is accepted.", missionHealthFeedback)}
    ${renderGroup("Runtime Host Selection", "Highest-priority review work because it unblocks Runtime promotion paths without claiming execution or registry acceptance.", runtimeHostSelection)}
    ${renderGroup("Runtime Promotion Seam Decision", "Runtime cases with host selection resolved that still require an explicit manual promotion-seam decision.", runtimePromotionSeamDecision)}
    ${renderGroup("Architecture Materialization", "Explicit Architecture due items only: implementation-target creation or implementation-result recording. This group can be empty when Architecture is clean.", architectureMaterialization)}
    ${renderGroup("Gap Formalization", "Gap-radar suggestions that should become explicit Discovery capability gaps through a single approval step.", gapFormalizationReview)}
    ${renderGroup("Runtime Registry Acceptance", "Proof-backed registry acceptance remains explicitly gated and disabled by default.", runtimeRegistryAcceptance)}
    ${renderGroup("Discovery Routing Review", "Discovery remains the front door; conflicted or medium-confidence routes need explicit review before downstream continuation.", discoveryRoutingReview)}
  `;
}

export function renderHomePage(
  snapshot: FrontendSnapshot,
  inbox: FrontendOperatorDecisionInboxReport,
  context: HomeRendererContext,
) {
  const queueLead = snapshot.queue.entries[0] ?? null;
  const runtimePrimary = snapshot.runtimeSummary.activeCases[0] ?? null;
  const architecturePrimary = snapshot.architectureSummary.activeCases[0] ?? null;
  const topDecision = inbox.entries[0] ?? null;
  const queueReviewPressureCount = snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length;
  const queueConflictedCount = snapshot.queue.entries.filter((entry) => entry.review_pressure?.route_conflict).length;

  return html`
    <section class="dashboard-section">
      <div class="dashboard-section-heading">Active Surfaces</div>
      <div class="dashboard-focus-grid">
        ${renderDashboardFocusCard({
          kicker: "Sources",
          title: `${snapshot.queue.totalEntries} queue entries`,
          meta: `${queueReviewPressureCount} under review - ${queueConflictedCount} conflicted`,
          body: queueLead?.current_case_next_legal_step ?? "Discovery is clear. No pending next legal step is exposed right now.",
          href: "/queue",
          cta: "Open sources",
          badge: snapshot.queue.totalEntries,
        })}
        ${renderDashboardFocusCard({
          kicker: "Architecture",
          title: architecturePrimary?.candidate_name ?? "No active architecture head",
          meta: `${snapshot.architectureSummary.activeCases.length} active case${snapshot.architectureSummary.activeCases.length === 1 ? "" : "s"}`,
          body: architecturePrimary?.current_case_next_legal_step ?? "Architecture has no current lane head blocking forward motion.",
          href: "/architecture",
          cta: "Open architecture",
        })}
        ${renderDashboardFocusCard({
          kicker: "Runtime",
          title: runtimePrimary?.candidate_name ?? "No active runtime head",
          meta: runtimePrimary?.runtime_summary?.proposed_host ?? `${snapshot.runtimeSummary.activeCases.length} active runtime case${snapshot.runtimeSummary.activeCases.length === 1 ? "" : "s"}`,
          body: runtimePrimary?.current_case_next_legal_step ?? "Runtime has no current lane head blocking forward motion.",
          href: "/runtime",
          cta: "Open runtime",
        })}
        ${renderDashboardFocusCard({
          kicker: "Decision inbox",
          title: topDecision?.candidateName ?? topDecision?.candidateId ?? "No active blockers",
          meta: `${inbox.summary.totalActionableEntries} actionable decision${inbox.summary.totalActionableEntries === 1 ? "" : "s"}`,
          body: topDecision?.blockReason ?? "The operator inbox is currently clear across Discovery, Architecture, and Runtime.",
          href: "/operator-inbox",
          cta: "Open inbox",
          badge: inbox.summary.totalActionableEntries,
        })}
      </div>
    </section>
    ${snapshot.handoffWarnings?.length ? html`<section class="panel warning"><h3>Handoff artifact warnings</h3><ul>${snapshot.handoffWarnings.map((warning: string) => html`<li>${warning}</li>`)}</ul></section>` : nothing}
    <section class="dashboard-section">
      <div class="dashboard-section-heading">System Metrics</div>
      <section class="simple-stat-grid">
        ${renderQueueStat("Sources", snapshot.queue.totalEntries, "Discovery entries currently tracked.")}
        ${renderQueueStat("Decisions", inbox.summary.totalActionableEntries, "Current operator reviews across lanes.")}
        ${renderQueueStat("Architecture", snapshot.architectureSummary.activeCases.length, "Active Architecture cases.")}
        ${renderQueueStat("Runtime", snapshot.runtimeSummary.activeCases.length, "Active Runtime cases.")}
      </section>
    </section>
    <section class="dashboard-section">
      <div class="dashboard-section-heading">Operations</div>
      <section class="dashboard-grid">
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Recent sources</h3>
                <p class="muted">Latest source entries, their current lane posture, and the next legal move.</p>
              </div>
              ${renderQueueTag("Discovery", "default")}
            </div>
            ${renderCompactSourceList(snapshot.queue.entries)}
            <div class="actions" style="margin-top:12px;">
              ${renderActionLink("/queue", "Open all sources", "secondary")}
            </div>
          </section>
          ${renderLearningSummary(snapshot.learningSummary)}
          ${(runtimePrimary || architecturePrimary)
            ? html`
              <section class="panel">
                <div class="panel-heading">
                  <div>
                    <h3>Live lane heads</h3>
                    <p class="muted">The clearest active entry points into Architecture and Runtime right now.</p>
                  </div>
                </div>
                <div class="lane-head-strip-grid" style="margin-top:14px;">
                  ${runtimePrimary ? context.renderRuntimeCaseStrip(runtimePrimary) : nothing}
                  ${architecturePrimary ? renderArchitectureCaseStrip(architecturePrimary) : nothing}
                </div>
              </section>
            `
            : nothing}
        </section>
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Next decisions</h3>
                <p class="muted">Only active operator work. Each row exposes the blocking reason and the next eligible action.</p>
              </div>
              ${renderQueueTag(`${inbox.summary.totalActionableEntries}`, inbox.summary.totalActionableEntries > 0 ? "warning" : "default")}
            </div>
            ${renderCompactDecisionList(inbox.entries)}
            <div class="actions" style="margin-top:12px;">
              ${renderActionLink("/operator-inbox", "Open inbox", "secondary")}
            </div>
          </section>
          <section class="panel message">
            <div class="panel-heading">
              <div>
                <h3>System posture</h3>
                <p class="muted">A compact read on where manual intervention is most likely to matter next.</p>
              </div>
            </div>
            <div class="status-list">
              <div class="status-row">
                <span>Review pressure</span>
                <strong>${queueReviewPressureCount}</strong>
              </div>
              <div class="status-row">
                <span>Conflicted routes</span>
                <strong>${queueConflictedCount}</strong>
              </div>
              <div class="status-row">
                <span>Architecture heads</span>
                <strong>${snapshot.architectureSummary.activeCases.length}</strong>
              </div>
              <div class="status-row">
                <span>Runtime heads</span>
                <strong>${snapshot.runtimeSummary.activeCases.length}</strong>
              </div>
            </div>
            <p class="muted" style="margin-top:14px;">Clear routes can auto-open one bounded downstream stub. Conflicted or low-confidence routes stay explicit until reviewed.</p>
            <div class="actions" style="margin-top:14px;">
              ${renderActionLink("/discovery", "Open Discovery", "secondary")}
              ${renderActionLink("/architecture", "Open Architecture", "secondary")}
              ${renderActionLink("/runtime", "Open Runtime", "secondary")}
            </div>
          </section>
        </section>
      </section>
    </section>
  `;
}
