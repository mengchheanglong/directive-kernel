import { html, nothing } from "lit";

import type {
  FrontendMissionFeedbackPreview,
  FrontendOperatorDecisionInboxEntry,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendRuntimeStatus,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
  FrontendTelemetrySnapshot,
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
  currentHeadLink: (entry: FrontendQueueEntry) => unknown;
};

type OperatorInboxRendererContext = {
  resolveDiscoveryRoutingReview: (
    form: HTMLFormElement,
    routingRecordPath: string,
  ) => Promise<void>;
  resolveRuntimeHostSelection: (
    form: HTMLFormElement,
    promotionReadinessPath: string,
  ) => Promise<void>;
  resolveRuntimePromotionSeamDecision: (
    form: HTMLFormElement,
    promotionReadinessPath: string,
  ) => Promise<void>;
  acceptRuntimeRegistryAcceptance: (
    form: HTMLFormElement,
    promotionRecordPath: string,
  ) => Promise<void>;
  missionFeedbackPreviews: Record<string, FrontendMissionFeedbackPreview | undefined>;
  approveGapFormalization: (form: HTMLFormElement, formalizationId: string) => Promise<void>;
  previewMissionFeedback: (feedbackId: string) => Promise<void>;
  rejectGapFormalization: (form: HTMLFormElement, formalizationId: string) => Promise<void>;
  approveMissionFeedback: (form: HTMLFormElement, feedbackId: string) => Promise<void>;
  rejectMissionFeedback: (form: HTMLFormElement, feedbackId: string) => Promise<void>;
};

function renderMissionFeedbackPreview(preview: FrontendMissionFeedbackPreview) {
  const eligibleRuns = preview.preview.affectedRuns.filter((run) => run.eligible);
  const cascadeKinds = [...new Set(
    eligibleRuns
      .map((run) => run.eligibilityKind)
      .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind)),
  )];
  return html`
    <section class="queue-highlight warning">
      <h4>Mission evolution preview</h4>
      <p>
        Analyzed ${preview.preview.summary.totalRunsAnalyzed} runs |
        affected ${preview.preview.summary.totalAffected} |
        eligible for cascade ${preview.preview.summary.eligibleForCascade}
      </p>
      <p class="muted">
        Improved ${preview.preview.summary.improvedCount} |
        unchanged ${preview.preview.summary.unchangedCount} |
        degraded ${preview.preview.summary.degradedCount}
      </p>
      <div class="queue-kv-grid">
        <div class="queue-kv">
          <h4>Current objective</h4>
          <p>${preview.preview.currentMission.currentObjective}</p>
        </div>
        <div class="queue-kv">
          <h4>Proposed objective</h4>
          <p>${preview.preview.proposedMission.currentObjective}</p>
        </div>
      </div>
      ${preview.feedback.suggestedMissionDelta.constraints?.length
        ? html`<p class="muted">Proposed constraints: ${preview.feedback.suggestedMissionDelta.constraints.join(" | ")}</p>`
        : nothing}
      ${preview.feedback.suggestedMissionDelta.usefulnessSignals?.length
        ? html`<p class="muted">Proposed usefulness signals: ${preview.feedback.suggestedMissionDelta.usefulnessSignals.join(" | ")}</p>`
        : nothing}
      ${preview.feedback.suggestedMissionDelta.capabilityLanes?.length
        ? html`<p class="muted">Proposed lane priorities: ${preview.feedback.suggestedMissionDelta.capabilityLanes.join(" | ")}</p>`
        : nothing}
      ${preview.feedback.suggestedMissionDelta.successSignal
        ? html`<p class="muted">Proposed success signal: ${preview.feedback.suggestedMissionDelta.successSignal}</p>`
        : nothing}
      ${preview.feedback.suggestedMissionDelta.adoptionTarget
        ? html`<p class="muted">Proposed adoption target: ${preview.feedback.suggestedMissionDelta.adoptionTarget}</p>`
        : nothing}
      ${eligibleRuns.length
        ? html`
          <div class="row">
            <label>Eligible cascade candidates</label>
            <div class="muted">Select only the reroute candidates you explicitly want included. The UI respects the bounded 10-run limit.</div>
            ${eligibleRuns.map((run) => html`
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  name=${`approved_run_id:${run.eligibilityKind}`}
                  value=${run.runId}
                />
                <span>
                  ${run.runId} | ${run.currentLane}/${run.currentConfidence} -> ${run.projectedLane}/${run.projectedConfidence}
                  <span class="muted">(${run.eligibilityKind}; ${run.reason})</span>
                </span>
              </label>
            `)}
          </div>
          <div class="row">
            <label>cascade scope</label>
            <select name="cascade_scope">
              <option value="none">none</option>
              ${cascadeKinds.map((kind) => html`<option value=${kind}>${kind}</option>`)}
            </select>
          </div>
        `
        : html`
          <input type="hidden" name="cascade_scope" value="none" />
          <p class="muted">No current runs are eligible for bounded cascade under this mission delta.</p>
        `}
    </section>
  `;
}

function renderMissionFeedbackActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  const feedbackId = entry.missionFeedbackId;
  if (!feedbackId) {
    return nothing;
  }
  const preview = context.missionFeedbackPreviews[feedbackId];
  return html`
    <section class="queue-highlight">
      <h4>Mission feedback actions</h4>
      <p class="muted">Preview first, then approve or reject with explicit rationale. Mission updates remain bounded and auditable.</p>
      ${preview
        ? html`
          <form @submit=${async (event: SubmitEvent) => {
            event.preventDefault();
            await context.approveMissionFeedback(event.currentTarget as HTMLFormElement, feedbackId);
          }}>
            ${renderMissionFeedbackPreview(preview)}
            <div class="row">
              <label>approval rationale</label>
              <textarea name="rationale">Approve this mission evolution because it sharpens bounded intent without widening the active scope.</textarea>
            </div>
            <div class="actions" style="margin-top:12px;">
              <button type="submit">Approve Mission Evolution</button>
            </div>
          </form>
          <form @submit=${async (event: SubmitEvent) => {
            event.preventDefault();
            await context.rejectMissionFeedback(event.currentTarget as HTMLFormElement, feedbackId);
          }}>
            <div class="row">
              <label>rejection rationale</label>
              <textarea name="rationale">Reject this mission evolution because the current mission should remain unchanged until better evidence arrives.</textarea>
            </div>
            <div class="actions" style="margin-top:12px;">
              <button type="submit">Reject Mission Evolution</button>
            </div>
          </form>
        `
        : html`
          <div class="actions" style="margin-top:12px;">
            <button @click=${async () => { await context.previewMissionFeedback(feedbackId); }}>Preview Mission Impact</button>
          </div>
        `}
    </section>
  `;
}

function renderGapFormalizationActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  const formalizationId = entry.gapFormalizationId;
  if (!formalizationId) {
    return nothing;
  }

  return html`
    <section class="queue-highlight">
      <h4>Gap formalization actions</h4>
      <p class="muted">Approve to write a formal capability gap and refresh the Discovery worklist, or reject with explicit rationale.</p>
      <form @submit=${async (event: SubmitEvent) => {
        event.preventDefault();
        await context.approveGapFormalization(event.currentTarget as HTMLFormElement, formalizationId);
      }}>
        <div class="row">
          <label>priority</label>
          <select name="priority">
            <option value="high" ?selected=${entry.gapFormalizationPriorityHint === "high"}>high</option>
            <option value="medium" ?selected=${entry.gapFormalizationPriorityHint !== "high" && entry.gapFormalizationPriorityHint !== "low"}>medium</option>
            <option value="low" ?selected=${entry.gapFormalizationPriorityHint === "low"}>low</option>
          </select>
        </div>
        <div class="row">
          <label>approval rationale</label>
          <textarea name="rationale">Approve this gap formalization because the repeated radar signal deserves an explicit tracked Discovery objective.</textarea>
        </div>
        <div class="actions" style="margin-top:12px;">
          <button type="submit">Approve Gap Formalization</button>
        </div>
      </form>
      <form @submit=${async (event: SubmitEvent) => {
        event.preventDefault();
        await context.rejectGapFormalization(event.currentTarget as HTMLFormElement, formalizationId);
      }}>
        <div class="row">
          <label>rejection rationale</label>
          <textarea name="rationale">Reject this gap formalization because the current radar evidence is not yet strong enough to create a tracked gap.</textarea>
        </div>
        <div class="actions" style="margin-top:12px;">
          <button type="submit">Reject Gap Formalization</button>
        </div>
      </form>
    </section>
  `;
}

function renderDiscoveryRoutingReviewActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  const defaultDecision = entry.defaultDecision ?? "defer";

  return html`
    <section class="queue-highlight">
      <h4>Discovery routing review actions</h4>
      <p class="muted">Record an explicit review resolution first. Downstream lane opening remains a separate explicit step after the Discovery review artifact exists.</p>
      <form @submit=${async (event: SubmitEvent) => {
        event.preventDefault();
        await context.resolveDiscoveryRoutingReview(
          event.currentTarget as HTMLFormElement,
          entry.artifactPath,
        );
      }}>
        <div class="row">
          <label>decision</label>
          <select name="decision">
            <option value="confirm_architecture" ?selected=${defaultDecision === "confirm_architecture"}>confirm_architecture</option>
            <option value="confirm_runtime" ?selected=${defaultDecision === "confirm_runtime"}>confirm_runtime</option>
            <option value="redirect_to_architecture">redirect_to_architecture</option>
            <option value="redirect_to_runtime">redirect_to_runtime</option>
            <option value="reject">reject</option>
            <option value="defer" ?selected=${defaultDecision === "defer"}>defer</option>
          </select>
        </div>
        <div class="row">
          <label>resolved confidence</label>
          <select name="resolved_confidence">
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </div>
        <div class="row">
          <label>review rationale</label>
          <textarea name="rationale">Record the explicit Discovery routing resolution and preserve the original routing record unchanged.</textarea>
        </div>
        <div class="actions" style="margin-top:12px;">
          <button type="submit">Record Discovery Review Resolution</button>
        </div>
      </form>
    </section>
  `;
}

function renderRuntimeHostSelectionActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  const defaultDecision = entry.defaultDecision ?? "select_standalone";
  return html`
    <section class="queue-highlight">
      <h4>Runtime host-selection actions</h4>
      <p class="muted">Record one explicit host-selection resolution first. Promotion, execution, and registry acceptance remain separate explicit Runtime steps after host selection is resolved.</p>
      <form @submit=${async (event: SubmitEvent) => {
        event.preventDefault();
        await context.resolveRuntimeHostSelection(
          event.currentTarget as HTMLFormElement,
          entry.artifactPath,
        );
      }}>
        <div class="row">
          <label>decision</label>
          <select name="decision">
            <option value="select_standalone" ?selected=${defaultDecision === "select_standalone"}>select_standalone</option>
            <option value="select_web" ?selected=${defaultDecision === "select_web"}>select_web</option>
            <option value="confirm_inferred" ?selected=${defaultDecision === "confirm_inferred"}>confirm_inferred</option>
            <option value="override" ?selected=${defaultDecision === "override"}>override</option>
            <option value="defer" ?selected=${defaultDecision === "defer"}>defer</option>
          </select>
        </div>
        <div class="row">
          <label>custom host (only for override)</label>
          <input
            type="text"
            name="selected_host"
            placeholder="Directive Kernel standalone host (hosts/standalone-host/)"
          />
        </div>
        <div class="row">
          <label>resolved confidence</label>
          <select name="resolved_confidence">
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </div>
        <div class="row">
          <label>review rationale</label>
          <textarea name="rationale">Record the explicit repo-native host target and preserve the original promotion-readiness artifact unchanged.</textarea>
        </div>
        <div class="actions" style="margin-top:12px;">
          <button type="submit">Record Runtime Host Selection</button>
        </div>
      </form>
    </section>
  `;
}

function renderRationaleOnlyActionSection(input: {
  title: string;
  body: string;
  buttonLabel: string;
  defaultRationale: string;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
}) {
  return html`
    <section class="queue-highlight">
      <h4>${input.title}</h4>
      <p class="muted">${input.body}</p>
      <form @submit=${async (event: SubmitEvent) => {
        event.preventDefault();
        await input.onSubmit(event.currentTarget as HTMLFormElement);
      }}>
        <div class="row">
          <label>rationale</label>
          <textarea name="rationale">${input.defaultRationale}</textarea>
        </div>
        <div class="actions" style="margin-top:12px;">
          <button type="submit">${input.buttonLabel}</button>
        </div>
      </form>
    </section>
  `;
}

function renderRuntimePromotionSeamActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  return renderRationaleOnlyActionSection({
    title: "Runtime promotion-seam actions",
    body:
      "Open exactly one bounded manual promotion record from the existing repo-native prerequisites. Registry acceptance, host execution, and broader automation remain separate explicit Runtime steps.",
    buttonLabel: "Open Runtime Promotion Record",
    defaultRationale:
      "Open one bounded manual Runtime promotion record because host selection and pre-host evidence are already explicit.",
    onSubmit: (form) => context.resolveRuntimePromotionSeamDecision(form, entry.artifactPath),
  });
}

function renderRuntimeRegistryAcceptanceActions(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
  return renderRationaleOnlyActionSection({
    title: "Runtime registry-acceptance actions",
    body:
      "Write the gated registry entry only if the promotion record, host adapter proof, and callable execution evidence already satisfy the acceptance gate.",
    buttonLabel: "Write Runtime Registry Entry",
    defaultRationale:
      "Accept this Runtime candidate into the registry because the bounded host adapter proof and callable execution evidence already pass the explicit acceptance gate.",
    onSubmit: (form) => context.acceptRuntimeRegistryAcceptance(form, entry.artifactPath),
  });
}

function renderOperatorDecisionEntry(
  entry: FrontendOperatorDecisionInboxEntry,
  context: OperatorInboxRendererContext,
) {
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
        <div class="queue-kv"><h4>Action id</h4><p>${entry.actionId}</p></div>
        <div class="queue-kv"><h4>Action posture</h4><p>${entry.actionExecutable ? "executable" : "advisory only"}</p></div>
        <div class="queue-kv"><h4>Default decision</h4><p>${entry.defaultDecision ?? "n/a"}</p></div>
        <div class="queue-kv"><h4>Priority hint</h4><p>${entry.priorityHint ?? "n/a"}</p></div>
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
      ${entry.decisionSurface === "mission_health_feedback"
        ? renderMissionFeedbackActions(entry, context)
        : nothing}
      ${entry.decisionSurface === "gap_formalization_review"
        ? renderGapFormalizationActions(entry, context)
        : nothing}
      ${entry.decisionSurface === "discovery_routing_review"
        ? renderDiscoveryRoutingReviewActions(entry, context)
        : nothing}
      ${entry.decisionSurface === "runtime_host_selection"
        ? renderRuntimeHostSelectionActions(entry, context)
        : nothing}
      ${entry.decisionSurface === "runtime_promotion_seam_decision"
        ? renderRuntimePromotionSeamActions(entry, context)
        : nothing}
      ${entry.decisionSurface === "runtime_registry_acceptance"
        ? renderRuntimeRegistryAcceptanceActions(entry, context)
        : nothing}
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

export function renderOperatorDecisionInboxPage(
  inbox: FrontendOperatorDecisionInboxReport,
  context: OperatorInboxRendererContext,
) {
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
        ? html`<div class="decision-entry-list">${entries.map((entry) => renderOperatorDecisionEntry(entry, context))}</div>`
        : html`<div class="queue-empty muted">No actionable entries for this group.</div>`}
    </section>
  `;

  return html`
    <section class="panel">
      <h2>Operator Decision Inbox</h2>
      <p class="muted">Live triage over current Engine, Discovery, Architecture, and Runtime decision gates. Mission evolution, gap formalization, Discovery routing review, Runtime host selection, Runtime promotion seams, proof-backed Runtime registry acceptance, and lane-native Architecture continuation all remain explicit, bounded, and executable here through the same kernel mutation surface.</p>
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
  telemetry: FrontendTelemetrySnapshot,
  runtimeStatus: FrontendRuntimeStatus,
  context: HomeRendererContext,
) {
  const queueLead = snapshot.queue.entries[0] ?? null;
  const runtimePrimary = snapshot.runtimeSummary.activeCases[0] ?? null;
  const architecturePrimary = snapshot.architectureSummary.activeCases[0] ?? null;
  const topDecision = inbox.entries[0] ?? null;
  const queueReviewPressureCount = snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length;
  const queueConflictedCount = snapshot.queue.entries.filter((entry) => entry.review_pressure?.route_conflict).length;
  const totalApiRequests = telemetry.counters["web_host.api_requests_total"] ?? 0;
  const totalApiErrors = telemetry.counters["web_host.api_errors_total"] ?? 0;
  const lastRequestDurationMs = telemetry.gauges["web_host.last_request_duration_ms"] ?? 0;
  const activeRunRecords = runtimeStatus.storage.activeRunRecords ?? 0;
  const archivedRunRecords = runtimeStatus.storage.archivedRunRecords ?? 0;

  return html`
      <aside style="background: #f5f5f5; padding: 0.5rem; border-left: 3px solid #888;">
        This workbench stays bounded, not passive. High-value operator mutations are executable here through the same kernel routes the CLI uses.
        See <a href="/docs/operator-cli.md">the operator CLI reference</a> for the parallel command surface and exact subcommand shapes.
      </aside>
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
        ${renderDashboardFocusCard({
          kicker: "Observability",
          title: `${totalApiRequests} API request${totalApiRequests === 1 ? "" : "s"}`,
          meta: `${totalApiErrors} error${totalApiErrors === 1 ? "" : "s"} - ${lastRequestDurationMs.toFixed(0)} ms last request`,
          body: `${activeRunRecords} active run record${activeRunRecords === 1 ? "" : "s"} | ${archivedRunRecords} archived`,
          href: "/telemetry",
          cta: "Open telemetry",
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
        ${renderQueueStat("API requests", totalApiRequests, "Observed web-host API requests during this process lifetime.")}
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
                  ${architecturePrimary
                    ? renderArchitectureCaseStrip(architecturePrimary, {
                        currentHeadLink: context.currentHeadLink,
                      })
                    : nothing}
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

function formatTelemetryLabel(value: string) {
  return value.replace(/[._]/g, " ");
}

function renderRecentTelemetryEvents(telemetry: FrontendTelemetrySnapshot) {
  const recentEvents = telemetry.events.slice(-8).reverse();
  if (!recentEvents.length) {
    return html`<div class="queue-empty muted">No telemetry events have been recorded yet.</div>`;
  }

  return html`
    <div class="simple-list">
      ${recentEvents.map((event) => html`
        <div class="simple-row">
          <span class="simple-row-main simple-row-copy">
            <span class="simple-row-kicker">${event.at}</span>
            <strong class="simple-row-title">${formatTelemetryLabel(event.name)}</strong>
            <span class="simple-row-support">${JSON.stringify(event.fields ?? {})}</span>
          </span>
        </div>
      `)}
    </div>
  `;
}

function renderCounterRows(record: Record<string, number>, limit: number) {
  const entries = Object.entries(record)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
  if (!entries.length) {
    return html`<div class="queue-empty muted">No counters recorded yet.</div>`;
  }

  return html`
    <div class="status-list">
      ${entries.map(([name, value]) => html`
        <div class="status-row">
          <span>${formatTelemetryLabel(name)}</span>
          <strong>${value}</strong>
        </div>
      `)}
    </div>
  `;
}

function renderGaugeRows(record: Record<string, number>, limit: number) {
  const entries = Object.entries(record)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(0, limit);
  if (!entries.length) {
    return html`<div class="queue-empty muted">No gauges recorded yet.</div>`;
  }

  return html`
    <div class="status-list">
      ${entries.map(([name, value]) => html`
        <div class="status-row">
          <span>${formatTelemetryLabel(name)}</span>
          <strong>${value.toFixed(0)}</strong>
        </div>
      `)}
    </div>
  `;
}

export function renderTelemetryPage(input: {
  telemetry: FrontendTelemetrySnapshot;
  runtimeStatus: FrontendRuntimeStatus;
  snapshot: FrontendSnapshot;
  inbox: FrontendOperatorDecisionInboxReport;
}) {
  const { telemetry, runtimeStatus, snapshot, inbox } = input;
  const writeRequests = telemetry.counters["api.write_requests_total"] ?? 0;
  const readRequests = telemetry.counters["api.read_requests_total"] ?? 0;
  const totalApiRequests = telemetry.counters["web_host.api_requests_total"] ?? 0;
  const totalErrors = telemetry.counters["web_host.api_errors_total"] ?? 0;
  const activeRunRecords = runtimeStatus.storage.activeRunRecords ?? 0;
  const archivedRunRecords = runtimeStatus.storage.archivedRunRecords ?? 0;
  const activeLedgerBytes = runtimeStatus.storage.activeLedgerBytes ?? 0;
  const rotatedLedgerSegments = runtimeStatus.storage.rotatedLedgerSegments ?? 0;

  return html`
    <section class="panel message">
      <h2>Host observability</h2>
      <p class="muted">
        This surface stays process-local and bounded. It exposes request counts, recent kernel-facing events,
        and storage pressure without coupling Directive Kernel to an external telemetry vendor.
      </p>
      <div class="queue-summary-grid">
        ${renderQueueStat("API requests", totalApiRequests, "Observed GET and POST requests handled by this web-host process.")}
        ${renderQueueStat("Read requests", readRequests, "Read operations matched through the API manifest route table.")}
        ${renderQueueStat("Write requests", writeRequests, "Mutation operations observed through the same route table.")}
        ${renderQueueStat("API errors", totalErrors, "Observed 4xx/5xx responses emitted by API handlers.")}
        ${renderQueueStat("Active run records", activeRunRecords, "Current run records under runtime/host-artifacts/engine-runs.")}
        ${renderQueueStat("Archived run records", archivedRunRecords, "Archived run records under archive/yyyy/mm buckets.")}
        ${renderQueueStat("Inbox decisions", inbox.summary.totalActionableEntries, "Current bounded operator decisions that may drive future write activity.")}
        ${renderQueueStat("Queue entries", snapshot.queue.totalEntries, "Current Discovery source pressure against this directive root.")}
      </div>
    </section>
    <section class="dashboard-section">
      <div class="dashboard-section-heading">Storage pressure</div>
      <section class="dashboard-grid">
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Runtime storage</h3>
                <p class="muted">Storage summary comes from the same maintenance surface used by archive and ledger rotation commands.</p>
              </div>
            </div>
            <div class="status-list">
              <div class="status-row">
                <span>Active run records</span>
                <strong>${activeRunRecords}</strong>
              </div>
              <div class="status-row">
                <span>Archived run records</span>
                <strong>${archivedRunRecords}</strong>
              </div>
              <div class="status-row">
                <span>Active ledger bytes</span>
                <strong>${activeLedgerBytes}</strong>
              </div>
              <div class="status-row">
                <span>Rotated ledger segments</span>
                <strong>${rotatedLedgerSegments}</strong>
              </div>
            </div>
          </section>
        </section>
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Recent events</h3>
                <p class="muted">Write operations and selected high-value reads are recorded as bounded process-local events.</p>
              </div>
            </div>
            ${renderRecentTelemetryEvents(telemetry)}
          </section>
        </section>
      </section>
    </section>
    <section class="dashboard-section">
      <div class="dashboard-section-heading">Live counters</div>
      <section class="dashboard-grid">
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Top counters</h3>
                <p class="muted">Highest-volume counters recorded by the in-memory sink.</p>
              </div>
            </div>
            ${renderCounterRows(telemetry.counters, 12)}
          </section>
        </section>
        <section class="dashboard-column">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h3>Current gauges</h3>
                <p class="muted">Last-observed duration and operation-level gauges.</p>
              </div>
            </div>
            ${renderGaugeRows(telemetry.gauges, 12)}
          </section>
        </section>
      </section>
    </section>
  `;
}
