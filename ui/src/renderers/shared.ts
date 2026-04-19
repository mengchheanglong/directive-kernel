import { html } from "lit";

import type { FrontendOperatorDecisionInboxEntry, FrontendQueueEntry } from "../types";
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

export function formatDecisionSurface(surface: FrontendOperatorDecisionInboxEntry["decisionSurface"]) {
  return surface.replace(/_/g, " ");
}
