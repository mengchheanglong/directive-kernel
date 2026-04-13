import { html } from "lit";

import type { FrontendOperatorDecisionInboxEntry, FrontendQueueEntry } from "../app-types";
import { navTo } from "../app-utils";

export function artifactLink(pathValue: string | null | undefined) {
  if (!pathValue) {
    return html`<span class="muted">n/a</span>`;
  }

  const href = `/artifacts?path=${encodeURIComponent(pathValue)}`;
  return html`
    <a
      href=${href}
      @click=${(event: Event) => {
        event.preventDefault();
        navTo(href);
      }}
    >
      ${pathValue}
    </a>
  `;
}

export function currentHeadLink(entry: FrontendQueueEntry) {
  const head = entry.current_head;
  if (!head) {
    return html`<span class="muted">n/a</span>`;
  }

  return html`
    <a
      href=${head.view_path}
      @click=${(event: Event) => {
        event.preventDefault();
        navTo(head.view_path);
      }}
    >
      ${head.artifact_path}
    </a>
  `;
}

export function currentHeadSummary(entry: FrontendQueueEntry) {
  const head = entry.current_head;
  if (!head) {
    return html`<span class="muted">not resolved yet</span>`;
  }

  return html`
    <div>${currentHeadLink(entry)}</div>
    <div class="muted">${head.artifact_stage} | ${head.artifact_lane}</div>
  `;
}

export function formatDecisionSurface(surface: FrontendOperatorDecisionInboxEntry["decisionSurface"]) {
  return surface.replace(/_/g, " ");
}
