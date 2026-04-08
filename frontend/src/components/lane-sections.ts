import { html, nothing } from "lit";

import type {
  FrontendArchitectureSummaryCase,
  FrontendEngineRunRecord,
  FrontendLaneAnchor,
  FrontendLaneCaseStripInput,
  FrontendQueueEntry,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
} from "../app-types";
import { navTo } from "../app-utils";

type RenderQueueTag = (
  value: string,
  tone?: "default" | "runtime" | "architecture" | "warning",
) => unknown;

type RendererContext = {
  currentHeadLink: (entry: FrontendQueueEntry) => unknown;
};

export function renderQueueTag(
  value: string,
  tone: "default" | "runtime" | "architecture" | "warning" = "default",
) {
  const style = {
    default: "background:#fcf7ee;",
    runtime: "background:#edf4ff; border-color:#b8ccef;",
    architecture: "background:#f5eefc; border-color:#d6c1e8;",
    warning: "background:#fff3da; border-color:#e7c88d;",
  }[tone];
  return html`<span class="pill" style=${style}>${value}</span>`;
}

export function renderQueueStat(label: string, value: number, description: string) {
  return html`
    <section class="queue-highlight">
      <div class="queue-count">${value}</div>
      <h3>${label}</h3>
      <p class="muted">${description}</p>
    </section>
  `;
}

export function renderLaneCaseStrip(
  input: FrontendLaneCaseStripInput,
  renderTag: RenderQueueTag,
) {
  return html`
    <section class=${`lane-case-strip ${input.tone}`}>
      <h3>${input.title}</h3>
      <p>${input.summary}</p>
      ${input.tags.length
        ? html`<div class="hero-meta">
            ${input.tags.map((tag) => renderTag(tag.value, tag.tone))}
          </div>`
        : nothing}
      <div class="lane-case-strip-grid">
        ${input.cards.map((card) => html`
          <section class="lane-case-strip-card">
            <h4>${card.label}</h4>
            <div>${card.value}</div>
          </section>
        `)}
      </div>
      <p class="muted" style="margin-top:12px;">${input.boundaryNote}</p>
      ${input.action
        ? html`<div class="queue-link-list" style="margin-top:12px;">
            <a href=${input.action.href} @click=${(event: Event) => {
              event.preventDefault();
              navTo(input.action?.href || "");
            }}>${input.action.label}</a>
          </div>`
        : nothing}
    </section>
  `;
}

export function renderQueueCard(
  entry: FrontendQueueEntry,
  run: FrontendEngineRunRecord | undefined,
  handoffPath: string | null,
  context: RendererContext,
) {
  const lane = entry.current_head?.artifact_lane ?? entry.routing_target ?? "queue";
  const cardClass = lane === "runtime"
    ? "queue-card runtime"
    : lane === "architecture"
      ? "queue-card architecture"
      : "queue-card monitor";
  const routingTone = entry.routing_target === "runtime"
    ? "runtime"
    : entry.routing_target === "architecture"
      ? "architecture"
      : "default";
  const statusTone = entry.status_effective !== entry.status ? "warning" : "default";
  const integrityTone = entry.integrity_state === "broken" ? "warning" : "default";
  const head = entry.current_head;
  const engineRunHref = run ? `/engine-runs/${encodeURIComponent(run.runId)}` : null;
  const handoffHref = handoffPath ? `/handoffs/view?path=${encodeURIComponent(handoffPath)}` : null;
  const activeHeadLabel = head?.artifact_lane === "runtime"
    ? "Active Runtime head"
    : head?.artifact_lane === "architecture"
      ? "Active Architecture head"
      : "Current live artifact";
  const reviewPressure = entry.review_pressure
    ?? (run?.routingAssessment?.reviewGuidance
      ? {
          guidance_kind: run.routingAssessment.reviewGuidance.guidanceKind,
          summary: run.routingAssessment.reviewGuidance.summary,
          operator_action: run.routingAssessment.reviewGuidance.operatorAction,
          stop_line: run.routingAssessment.reviewGuidance.stopLine,
          routing_confidence: run.routingAssessment.confidence ?? null,
          route_conflict: run.routingAssessment.routeConflict ?? null,
          needs_human_review: run.routingAssessment.needsHumanReview ?? null,
          ambiguity_summary: run.routingAssessment.ambiguitySummary
            ? {
                top_lane_id: run.routingAssessment.ambiguitySummary.topLaneId,
                runner_up_lane_id: run.routingAssessment.ambiguitySummary.runnerUpLaneId,
                score_delta: run.routingAssessment.ambiguitySummary.scoreDelta,
                conflicting_signal_families: [...run.routingAssessment.ambiguitySummary.conflictingSignalFamilies],
                conflicting_lane_ids: [...run.routingAssessment.ambiguitySummary.conflictingLaneIds],
              }
            : null,
        }
      : null);

  return html`
    <article class=${cardClass}>
      <div class="queue-card-header">
        <div>
          <h3 class="queue-card-title">${entry.candidate_name}</h3>
          <div class="queue-card-subtitle mono">${entry.candidate_id}</div>
        </div>
        <div class="queue-tag-row">
          ${renderQueueTag(entry.status_effective, statusTone)}
          ${entry.routing_target ? renderQueueTag(entry.routing_target, routingTone) : nothing}
          ${renderQueueTag(`integrity:${entry.integrity_state ?? "n/a"}`, integrityTone)}
        </div>
      </div>

      <div class="queue-kv-grid">
        <section class="queue-kv">
          <h4>${activeHeadLabel}</h4>
          <div>${context.currentHeadLink(entry)}</div>
          <p class="muted">${head ? `${head.artifact_stage} | ${head.artifact_lane}` : "Not resolved yet."}</p>
        </section>

        <section class="queue-kv">
          <h4>Current case stage</h4>
          <p class="queue-stage">${entry.current_case_stage ?? "n/a"}</p>
        </section>

        <section class="queue-kv">
          <h4>Continue from here</h4>
          <p class="queue-step">${entry.current_case_next_legal_step ?? "No explicit next legal step recorded yet."}</p>
        </section>

        <section class="queue-kv">
          <h4>Review pressure</h4>
          ${reviewPressure
            ? html`
                <p class="queue-step">${reviewPressure.summary}</p>
                <p class="muted">
                  ${reviewPressure.routing_confidence ?? "n/a"} confidence
                  | conflict: ${reviewPressure.route_conflict == null ? "n/a" : reviewPressure.route_conflict ? "yes" : "no"}
                  | review: ${reviewPressure.needs_human_review == null ? "n/a" : reviewPressure.needs_human_review ? "yes" : "no"}
                </p>
                ${reviewPressure.route_conflict && reviewPressure.ambiguity_summary
                  ? html`
                      <p class="muted">
                        Why conflicted: ${reviewPressure.ambiguity_summary.top_lane_id}
                        over ${reviewPressure.ambiguity_summary.runner_up_lane_id ?? "none"}
                        by ${reviewPressure.ambiguity_summary.score_delta}; signals:
                        ${reviewPressure.ambiguity_summary.conflicting_signal_families.join(", ") || "none"}.
                      </p>
                    `
                  : nothing}
              `
            : html`<p class="muted">No elevated review pressure recorded on the linked route.</p>`}
        </section>

        <section class="queue-kv">
          <h4>Downstream stub</h4>
          <div>${handoffHref
            ? html`<a href=${handoffHref} @click=${(event: Event) => {
              event.preventDefault();
              navTo(handoffHref);
            }}>${handoffPath}</a>`
            : html`<span class="muted">No downstream stub recorded.</span>`}</div>
          ${entry.result_record_path && handoffPath !== entry.result_record_path
            ? html`<p class="muted mono">${entry.result_record_path}</p>`
            : nothing}
        </section>
      </div>

      ${entry.status_warning
        ? html`<p class="muted" style="margin-top:12px;">${entry.status_warning}</p>`
        : nothing}

      ${reviewPressure
        ? html`<p class="muted" style="margin-top:12px;">Operator action: ${reviewPressure.operator_action} Stop-line: ${reviewPressure.stop_line}</p>`
        : nothing}

      <div class="queue-actions">
        <div class="queue-link-list">
          ${engineRunHref
            ? html`<a href=${engineRunHref} @click=${(event: Event) => {
              event.preventDefault();
              navTo(engineRunHref);
            }}>Engine run</a>`
            : html`<span class="muted">Engine run unavailable</span>`}
          ${entry.routing_record_path
            ? html`<a href=${`/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path)}`} @click=${(event: Event) => {
              event.preventDefault();
              navTo(`/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path || "")}`);
            }}>Routing record</a>`
            : nothing}
          ${head
            ? html`<a href=${head.view_path} @click=${(event: Event) => {
              event.preventDefault();
              navTo(head.view_path);
            }}>Open current head</a>`
            : nothing}
        </div>
      </div>
    </article>
  `;
}

export function renderRuntimeCaseStrip(
  entry: FrontendRuntimeSummaryCase | FrontendQueueEntry,
  context: RendererContext,
) {
  const head = entry.current_head;
  const blockers = entry.runtime_summary?.promotion_readiness_blockers ?? [];
  const proposedHost = entry.runtime_summary?.proposed_host ?? "n/a";
  const candidateLabel = entry.candidate_name || entry.candidate_id;
  const stageLabel = entry.current_case_stage ?? "runtime state not resolved";
  const seamCopy = entry.runtime_summary
    ? `${candidateLabel} is currently the live Runtime stop for Directive Kernel at ${stageLabel}. This strip reuses the same truth-backed seam context as the detail page, but keeps home, queue, and lane views useful before drill-down.`
    : `${candidateLabel} is currently visible in the Runtime lane for Directive Kernel at ${stageLabel}. This case has not reached promotion-readiness yet, so the lane strip stays limited to the current stage and next legal step.`;
  return renderLaneCaseStrip({
    tone: "runtime",
    title: candidateLabel,
    summary: seamCopy,
    tags: [
      { value: stageLabel, tone: "runtime" },
      { value: proposedHost, tone: "runtime" },
    ],
    cards: [
      {
        label: "Current stage",
        value: html`<p class="seam-value">${stageLabel}</p>`,
      },
      {
        label: "Next legal step",
        value: html`<p>${entry.current_case_next_legal_step ?? "No explicit next legal step recorded."}</p>`,
      },
      {
        label: "Proposed host",
        value: html`<p class="seam-value">${proposedHost}</p>`,
      },
      {
        label: "Blockers",
        value: blockers.length
          ? html`<ul>${blockers.map((blocker) => html`<li><code>${blocker}</code></li>`)}</ul>`
          : html`<p class="muted">${entry.runtime_summary ? "No blockers recorded." : "Blockers are not surfaced before promotion-readiness."}</p>`,
      },
    ],
    boundaryNote: "Directive Kernel web host is the active product surface here. Runtime and Engine still own gating and progression rules, so this strip does not open promotion, implementation, integration, or execution.",
    action: head
      ? {
          href: head.view_path,
          label: "Open Runtime seam review",
        }
      : null,
  }, renderQueueTag);
}

export function renderRuntimeLaneSummary(
  summary: FrontendSnapshot["runtimeSummary"],
  context: RendererContext,
) {
  return html`
    <section class="panel">
      <h2>Runtime lane summary</h2>
      <p class="muted">This read-only section groups active Runtime cases and recent Runtime anchors from canonical Directive Kernel truth. It improves Runtime visibility before drill-down without opening any downstream seam.</p>
      <div class="runtime-lane-grid" style="margin-top:14px;">
        <section class="runtime-lane-stack">
          <div class="queue-highlight">
            <h3>Active Runtime cases</h3>
            <p class="muted">Cases currently routed into the Runtime lane and visible through the product frontend.</p>
          </div>
          ${summary.activeCases.length
            ? summary.activeCases.map((entry) => renderRuntimeCaseStrip(entry, context))
            : html`<div class="queue-empty muted">No active Runtime cases found.</div>`}
        </section>

        <section class="runtime-lane-stack">
          <div class="queue-highlight">
            <h3>Recent Runtime anchors</h3>
            <p class="muted">Canonical Runtime anchors from the shared state resolver. These show the current Runtime stops and linked artifact heads without inventing controls.</p>
          </div>
          <div class="runtime-anchor-list">
            ${summary.recentAnchors.length
              ? summary.recentAnchors.map((anchor) => html`
                  <article class="runtime-anchor-item">
                    <h4>${anchor.candidateName ?? anchor.label}</h4>
                    <p class="muted mono" style="margin-bottom:8px;">${anchor.artifactPath}</p>
                    <p><strong>Current stage:</strong> ${anchor.currentStage}</p>
                    <p style="margin-top:8px;"><strong>Next legal step:</strong> ${anchor.nextLegalStep}</p>
                  </article>
                `)
              : html`<div class="queue-empty muted">No Runtime anchors available.</div>`}
          </div>
        </section>
      </div>
    </section>
  `;
}

export function renderLaneAnchorList(
  title: string,
  description: string,
  anchors: FrontendLaneAnchor[],
) {
  return html`
    <section class="lane-page-stack">
      <div class="queue-highlight">
        <h3>${title}</h3>
        <p class="muted">${description}</p>
      </div>
      <div class="runtime-anchor-list">
        ${anchors.length
          ? anchors.map((anchor) => html`
              <article class="runtime-anchor-item">
                <h4>${anchor.candidateName ?? anchor.label}</h4>
                <p class="muted mono" style="margin-bottom:8px;">${anchor.artifactPath}</p>
                <p><strong>Current stage:</strong> ${anchor.currentStage}</p>
                <p style="margin-top:8px;"><strong>Next legal step:</strong> ${anchor.nextLegalStep}</p>
              </article>
            `)
          : html`<div class="queue-empty muted">No anchors available.</div>`}
      </div>
    </section>
  `;
}

export function renderArchitectureCaseStrip(
  entry: FrontendArchitectureSummaryCase,
  context: RendererContext,
) {
  const head = entry.current_head;
  return renderLaneCaseStrip({
    tone: "architecture",
    title: entry.candidate_name,
    summary: `${entry.candidate_name} remains visible through the Architecture lane as a truth-backed case summary. The frontend shows the current live head and next legal step, while Architecture keeps ownership of downstream legality and progression.`,
    tags: [
      { value: entry.current_case_stage ?? "architecture state not resolved", tone: "architecture" },
      { value: entry.candidate_id, tone: "architecture" },
    ],
    cards: [
      {
        label: "Current stage",
        value: html`<p class="seam-value">${entry.current_case_stage ?? "n/a"}</p>`,
      },
      {
        label: "Next legal step",
        value: html`<p>${entry.current_case_next_legal_step ?? "No explicit next legal step recorded."}</p>`,
      },
      {
        label: "Current head",
        value: head
          ? html`
              <div>${context.currentHeadLink(entry as FrontendQueueEntry)}</div>
              <div class="muted">${head.artifact_stage} | ${head.artifact_lane}</div>
            `
          : html`<p class="muted">Current head not resolved.</p>`,
      },
    ],
    boundaryNote: "Architecture is a real lane with retained outputs and downstream chains. This strip stays read-only and truth-backed rather than reopening closed work from the frontend.",
    action: head
      ? {
          href: head.view_path,
          label: "Open current Architecture head",
        }
      : null,
  }, renderQueueTag);
}

export function renderArchitectureLaneSummary(
  summary: FrontendSnapshot["architectureSummary"],
  context: RendererContext,
) {
  return html`
    <section class="panel">
      <h2>Architecture lane</h2>
      <p class="muted">Architecture is already a real product lane with bounded starts, results, adoption, retention, integration, consumption, and evaluation history. The frontend now surfaces that lane directly instead of hiding it behind artifact-only drill-down.</p>
      <div class="lane-page-grid" style="margin-top:14px;">
        <section class="lane-page-stack">
          <div class="queue-highlight">
            <h3>Current Architecture cases</h3>
            <p class="muted">Recent Architecture-routed cases from queue truth and their current live heads.</p>
          </div>
          <div class="lane-case-list">
            ${summary.activeCases.length
              ? summary.activeCases.map((entry) => renderArchitectureCaseStrip(entry, context))
              : html`<div class="queue-empty muted">No Architecture cases found.</div>`}
          </div>
        </section>
        ${renderLaneAnchorList(
          "Recent Architecture anchors",
          "Canonical Architecture anchors from the shared state resolver. These summarize retained/evaluated Architecture heads without inventing new workflow controls.",
          summary.recentAnchors,
        )}
      </div>
    </section>
  `;
}

export function renderDiscoveryLanePage(snapshot: FrontendSnapshot) {
  const runtimeCount = snapshot.runtimeSummary.activeCases.length;
  const architectureCount = snapshot.architectureSummary.activeCases.length;
  const reviewPressureCount = snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length;
  const conflictedCount = snapshot.queue.entries.filter((entry) => entry.review_pressure?.route_conflict).length;
  return html`
    <section class="panel">
      <h2>Discovery lane</h2>
      <p class="muted">Discovery remains the front door. It owns source submission, queue state, routing records, and explicit downstream approvals into Architecture handoffs or Runtime follow-ups.</p>
      <div class="lane-overview-grid" style="margin-top:14px;">
        <section class="lane-overview-card discovery">
          <h3>Queue</h3>
          <div class="lane-overview-stats">
            <div class="lane-overview-stat"><h4>Total entries</h4><p class="seam-value">${snapshot.queue.totalEntries}</p></div>
            <div class="lane-overview-stat"><h4>Review pressure</h4><p class="seam-value">${reviewPressureCount}</p></div>
          </div>
          <p class="muted">Queue and review-pressure state remain the canonical Discovery operating surfaces before any lane drill-down.</p>
          <div class="lane-actions">
            <a href="/queue" @click=${(event: Event) => { event.preventDefault(); navTo("/queue"); }}>Open queue</a>
            <a href="/handoffs" @click=${(event: Event) => { event.preventDefault(); navTo("/handoffs"); }}>Open handoffs</a>
          </div>
        </section>
        <section class="lane-overview-card discovery">
          <h3>Routing outcomes</h3>
          <div class="lane-overview-stats">
            <div class="lane-overview-stat"><h4>To Architecture</h4><p class="seam-value">${architectureCount}</p></div>
            <div class="lane-overview-stat"><h4>Conflicted routes</h4><p class="seam-value">${conflictedCount}</p></div>
          </div>
          <p class="muted">Discovery stays explicit. It records the route, shows whether it is conflicted, and only then hands off to the next bounded lane surface. Runtime-routed cases currently visible: ${runtimeCount}.</p>
        </section>
      </div>
    </section>
  `;
}

export function renderLaneOverviewCard(input: {
  title: string;
  tone: "discovery" | "architecture" | "runtime";
  description: string;
  primaryLabel: string;
  primaryValue: string | number;
  secondaryLabel: string;
  secondaryValue: string | number;
  tertiary?: string;
  href: string;
}) {
  return html`
    <section class=${`lane-overview-card ${input.tone}`}>
      <h3>${input.title}</h3>
      <p>${input.description}</p>
      <div class="lane-overview-stats">
        <div class="lane-overview-stat">
          <h4>${input.primaryLabel}</h4>
          <p class="seam-value">${input.primaryValue}</p>
        </div>
        <div class="lane-overview-stat">
          <h4>${input.secondaryLabel}</h4>
          <p class="seam-value">${input.secondaryValue}</p>
        </div>
      </div>
      ${input.tertiary ? html`<p class="muted">${input.tertiary}</p>` : nothing}
      <div class="lane-actions">
        <a href=${input.href} @click=${(event: Event) => { event.preventDefault(); navTo(input.href); }}>Open ${input.title}</a>
      </div>
    </section>
  `;
}
