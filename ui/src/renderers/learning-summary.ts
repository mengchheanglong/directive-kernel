import { html } from "lit";

import type { FrontendSnapshot } from "../types";
import { navTo } from "../app-utils";
import { renderQueueTag } from "../components/lane-sections";

export function renderLearningSummary(summary: FrontendSnapshot["learningSummary"]) {
  const gapRadar = summary.gapRadar;
  const earnedAutonomy = summary.earnedAutonomy;

  return html`
    <section class="grid">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h3>Gap Radar</h3>
            <p class="muted">
              ${gapRadar.generatedAt ? `Updated ${gapRadar.generatedAt}` : "No persisted radar report yet"}.
              ${gapRadar.suggestionCount} active suggestion${gapRadar.suggestionCount === 1 ? "" : "s"}.
            </p>
          </div>
          ${renderQueueTag(`${gapRadar.suggestionCount} live`, gapRadar.suggestionCount > 0 ? "warning" : "default")}
        </div>
        ${gapRadar.suggestions.length > 0 ? html`
          <div class="insight-list">
            ${gapRadar.suggestions.map((entry) => html`
              <article class="insight-item">
                <div class="insight-topline">
                  <strong>${entry.targetLaneId}</strong>
                  <span class="simple-row-meta">
                    ${renderQueueTag(entry.confidence, "warning")}
                    ${renderQueueTag(`${entry.evidenceCount} events`, "default")}
                  </span>
                </div>
                <p>${entry.summary}</p>
                <p class="muted">${entry.recommendedChange}</p>
                <p class="muted">Signals: ${entry.signalTokens.join(", ") || "none"} | examples: ${entry.candidateExamples.join(", ") || "n/a"}</p>
              </article>
            `)}
          </div>
        ` : html`<p class="muted">No repeated uncovered gap pressure is visible yet.</p>`}
      </section>
      <section class=${earnedAutonomy.autoApprovedRecentRuns > 0 ? "panel good" : "panel"}>
        <div class="panel-heading">
          <div>
            <h3>Earned Autonomy</h3>
            <p class="muted">
              ${earnedAutonomy.autoApprovedRecentRuns} recent run${earnedAutonomy.autoApprovedRecentRuns === 1 ? "" : "s"} waived an extra manual review gate.
              ${earnedAutonomy.eligibleRouteClassCount} route class${earnedAutonomy.eligibleRouteClassCount === 1 ? "" : "es"} currently qualify.
            </p>
          </div>
          ${renderQueueTag(
            `${earnedAutonomy.autoApprovedRecentRuns} auto-approved`,
            earnedAutonomy.autoApprovedRecentRuns > 0 ? "runtime" : "default",
          )}
        </div>
        ${earnedAutonomy.routeClasses.length > 0 ? html`
          <div class="insight-list">
            ${earnedAutonomy.routeClasses.map((entry) => html`
              <article class="insight-item">
                <div class="insight-topline">
                  <strong>${entry.routeClass}</strong>
                  <span class="simple-row-meta">
                    ${renderQueueTag(`${entry.overallScore}/100`, "runtime")}
                    ${renderQueueTag(`${entry.evidenceCount} evidence`, "default")}
                  </span>
                </div>
                <p>${entry.summary}</p>
                <p class="muted">
                  ${entry.candidateName} (${entry.laneId})
                  |
                  <a
                    href=${`/engine-runs/${encodeURIComponent(entry.runId)}`}
                    @click=${(event: Event) => {
                      event.preventDefault();
                      navTo(`/engine-runs/${encodeURIComponent(entry.runId)}`);
                    }}
                  >
                    Open run
                  </a>
                </p>
              </article>
            `)}
          </div>
        ` : html`<p class="muted">No route classes have enough history to summarize yet.</p>`}
      </section>
    </section>
  `;
}
