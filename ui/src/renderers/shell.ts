import { html, nothing } from "lit";

import type { FrontendOperatorDecisionInboxReport, FrontendSnapshot } from "../app-types";
import { navTo } from "../app-utils";

type ActionTone = "primary" | "secondary";

export type PageChrome = {
  eyebrow: string;
  title: string;
  description: string;
  actions: Array<{
    href: string;
    label: string;
    tone: ActionTone;
  }>;
};

export function renderShellIcon(name: string) {
  switch (name) {
    case "overview":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1.5"></rect>
          <rect x="14" y="4" width="6" height="6" rx="1.5"></rect>
          <rect x="4" y="14" width="6" height="6" rx="1.5"></rect>
          <rect x="14" y="14" width="6" height="6" rx="1.5"></rect>
        </svg>
      `;
    case "workflow":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 6h10"></path>
          <path d="M7 18h10"></path>
          <path d="M12 6v12"></path>
          <circle cx="7" cy="6" r="2"></circle>
          <circle cx="17" cy="6" r="2"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <circle cx="7" cy="18" r="2"></circle>
          <circle cx="17" cy="18" r="2"></circle>
        </svg>
      `;
    case "inbox":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v10H4z"></path>
          <path d="M8 11h8"></path>
          <path d="M9 15h6"></path>
        </svg>
      `;
    case "sources":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 7h12"></path>
          <path d="M6 12h12"></path>
          <path d="M6 17h8"></path>
          <circle cx="4" cy="7" r="1"></circle>
          <circle cx="4" cy="12" r="1"></circle>
          <circle cx="4" cy="17" r="1"></circle>
        </svg>
      `;
    case "discovery":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6"></circle>
          <path d="M12 3v3"></path>
          <path d="M12 18v3"></path>
          <path d="M3 12h3"></path>
          <path d="M18 12h3"></path>
        </svg>
      `;
    case "architecture":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 19h12"></path>
          <path d="M8 19V9"></path>
          <path d="M16 19V9"></path>
          <path d="M4 9h16"></path>
          <path d="M12 5 4 9"></path>
          <path d="m12 5 8 4"></path>
        </svg>
      `;
    case "runtime":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v6"></path>
          <path d="M9 6h6"></path>
          <path d="M5 13h14"></path>
          <path d="M7 13v6"></path>
          <path d="M17 13v6"></path>
          <path d="M7 19h10"></path>
        </svg>
      `;
    case "runs":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 18V9"></path>
          <path d="M12 18V5"></path>
          <path d="M19 18v-6"></path>
        </svg>
      `;
    case "handoffs":
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8h8"></path>
          <path d="m10 4 4 4-4 4"></path>
          <path d="M19 16h-8"></path>
          <path d="m14 12-4 4 4 4"></path>
        </svg>
      `;
    default:
      return html`
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7"></circle>
        </svg>
      `;
  }
}

export function renderActionLink(
  href: string,
  label: string,
  tone: ActionTone = "secondary",
) {
  return html`
    <a
      class=${tone === "primary" ? "action-link primary" : "action-link secondary"}
      href=${href}
      @click=${(event: Event) => {
        event.preventDefault();
        navTo(href);
      }}
    >
      ${label}
    </a>
  `;
}

export function renderSidebarLink(input: {
  current: string;
  href: string;
  label: string;
  caption: string;
  icon: string;
  badge?: string | number | null;
  active: (path: string) => boolean;
}) {
  const active = input.active(input.current);
  return html`
    <a
      class=${active ? "sidebar-link active" : "sidebar-link"}
      href=${input.href}
      title=${input.caption}
      @click=${(event: Event) => {
        event.preventDefault();
        navTo(input.href);
      }}
    >
      <span class="sidebar-link-icon">${renderShellIcon(input.icon)}</span>
      <span class="sidebar-link-body">
        <strong>${input.label}</strong>
      </span>
      ${input.badge == null ? nothing : html`<span class="sidebar-link-badge">${input.badge}</span>`}
    </a>
  `;
}

export function getShellSnapshot(page: any): FrontendSnapshot | null {
  if (!page) return null;
  if (
    page.kind === "home"
    || page.kind === "discovery-lane"
    || page.kind === "architecture-lane"
    || page.kind === "runtime-lane"
    || page.kind === "handoffs"
  ) {
    return page.data as FrontendSnapshot;
  }

  if (page.kind === "workflow-map") {
    return page.snapshot as FrontendSnapshot;
  }

  return null;
}

export function getShellInbox(page: any): FrontendOperatorDecisionInboxReport | null {
  if (!page) return null;
  if (page.kind === "home") {
    return page.inbox as FrontendOperatorDecisionInboxReport;
  }

  if (page.kind === "operator-inbox") {
    return page.data as FrontendOperatorDecisionInboxReport;
  }

  if (page.kind === "workflow-map") {
    return page.inbox as FrontendOperatorDecisionInboxReport;
  }

  return null;
}

export function getPageChrome(current: string): PageChrome {
  if (current === "/") {
    return {
      eyebrow: "",
      title: "Dashboard",
      description: "",
      actions: [],
    };
  }

  if (current === "/queue") {
    return {
      eyebrow: "Discovery surface",
      title: "Sources",
      description:
        "Track the live intake queue, routing posture, downstream pointers, and current legal next steps.",
      actions: [
        { href: "/discovery", label: "Open discovery lane", tone: "primary" },
        { href: "/workflow-map", label: "See workflow map", tone: "secondary" },
      ],
    };
  }

  if (current === "/workflow-map") {
    return {
      eyebrow: "Flow visibility",
      title: "Workflow Map",
      description:
        "A compact source-to-runtime map for live routing, lane heads, and operator decision gates.",
      actions: [
        { href: "/", label: "Back to overview", tone: "secondary" },
        { href: "/operator-inbox", label: "Open inbox", tone: "primary" },
      ],
    };
  }

  if (current === "/operator-inbox") {
    return {
      eyebrow: "Operator coordination",
      title: "Decision Inbox",
      description:
        "Read-only triage over the explicit Discovery, Architecture, and Runtime decisions blocking forward motion.",
      actions: [
        { href: "/workflow-map", label: "View workflow map", tone: "secondary" },
        { href: "/runtime", label: "Open runtime lane", tone: "primary" },
      ],
    };
  }

  if (current === "/discovery") {
    return {
      eyebrow: "Lane surface",
      title: "Discovery",
      description:
        "See intake pressure, routing outcomes, and the explicit handoff boundary before deeper drill-down.",
      actions: [
        { href: "/queue", label: "Open sources", tone: "primary" },
        { href: "/workflow-map", label: "See flow map", tone: "secondary" },
      ],
    };
  }

  if (current === "/architecture") {
    return {
      eyebrow: "Lane surface",
      title: "Architecture",
      description:
        "Monitor live Architecture heads, retained outputs, and recent canonical anchors without breaking lane ownership.",
      actions: [
        { href: "/handoffs", label: "Open handoffs", tone: "secondary" },
        { href: "/workflow-map", label: "See flow map", tone: "primary" },
      ],
    };
  }

  if (current === "/runtime") {
    return {
      eyebrow: "Lane surface",
      title: "Runtime",
      description:
        "Watch active Runtime cases, current blockers, and host-facing capability progression from one place.",
      actions: [
        { href: "/engine-runs", label: "Open engine runs", tone: "secondary" },
        { href: "/workflow-map", label: "See flow map", tone: "primary" },
      ],
    };
  }

  if (current === "/engine-runs" || current.startsWith("/engine-runs/")) {
    return {
      eyebrow: "Execution trace",
      title: "Engine Runs",
      description:
        "Inspect recent routing decisions, proof planning, and downstream lane selection with direct traceability.",
      actions: [
        { href: "/", label: "Back to overview", tone: "secondary" },
        { href: "/workflow-map", label: "Open workflow map", tone: "primary" },
      ],
    };
  }

  if (current === "/handoffs" || current.startsWith("/handoffs/")) {
    return {
      eyebrow: "Downstream continuity",
      title: "Handoffs",
      description:
        "Review bounded Architecture and Runtime continuation stubs before they become lane-native records.",
      actions: [
        { href: "/architecture", label: "Open architecture lane", tone: "secondary" },
        { href: "/runtime", label: "Open runtime lane", tone: "primary" },
      ],
    };
  }

  return {
    eyebrow: "Artifact surface",
    title: "Detail View",
    description:
      "Deep artifact detail, lane-native records, and proof surfaces stay accessible without losing shell context.",
    actions: [
      { href: "/", label: "Back to overview", tone: "secondary" },
      { href: "/queue", label: "Open sources", tone: "primary" },
    ],
  };
}

export function renderSidebar(current: string, page: any) {
  const snapshot = getShellSnapshot(page);
  const inbox = getShellInbox(page);
  const reviewPressure = snapshot
    ? snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length
    : null;

  return html`
    <aside class="sidebar-shell">
      <div class="sidebar-brand">
        <strong>Directive Kernel</strong>
        <span class="muted">Research dashboard</span>
      </div>

      <div class="sidebar-group">
        <div class="sidebar-group-label">Workspace</div>
        ${renderSidebarLink({
          current,
          href: "/",
          label: "Dashboard",
          caption: "Live posture and lane heads",
          icon: "overview",
          active: (path) => path === "/",
        })}
        ${renderSidebarLink({
          current,
          href: "/workflow-map",
          label: "Workflow map",
          caption: "System flow across phases",
          icon: "workflow",
          active: (path) => path === "/workflow-map",
        })}
        ${renderSidebarLink({
          current,
          href: "/operator-inbox",
          label: "Decision inbox",
          caption: "Human review gates and blockers",
          icon: "inbox",
          badge: inbox?.summary.totalActionableEntries || null,
          active: (path) => path === "/operator-inbox",
        })}
      </div>

      <div class="sidebar-group">
        <div class="sidebar-group-label">Lanes</div>
        ${renderSidebarLink({
          current,
          href: "/queue",
          label: "Sources",
          caption: "Queue, routing, and downstream state",
          icon: "sources",
          active: (path) => path === "/queue" || path.startsWith("/discovery-routing-records/"),
        })}
        ${renderSidebarLink({
          current,
          href: "/discovery",
          label: "Discovery",
          caption: "Front-door intake and routing pressure",
          icon: "discovery",
          active: (path) => path === "/discovery",
        })}
        ${renderSidebarLink({
          current,
          href: "/architecture",
          label: "Architecture",
          caption: "Lane heads and retained outputs",
          icon: "architecture",
          active: (path) => path === "/architecture" || path.startsWith("/architecture-"),
        })}
        ${renderSidebarLink({
          current,
          href: "/runtime",
          label: "Runtime",
          caption: "Capability progression and blockers",
          icon: "runtime",
          active: (path) => path === "/runtime" || path.startsWith("/runtime-"),
        })}
      </div>

      <div class="sidebar-group">
        <div class="sidebar-group-label">Trace</div>
        ${renderSidebarLink({
          current,
          href: "/engine-runs",
          label: "Engine runs",
          caption: "Decision traces and proof planning",
          icon: "runs",
          active: (path) => path === "/engine-runs" || path.startsWith("/engine-runs/"),
        })}
        ${renderSidebarLink({
          current,
          href: "/handoffs",
          label: "Handoffs",
          caption: "Bounded downstream continuation",
          icon: "handoffs",
          active: (path) => path === "/handoffs" || path.startsWith("/handoffs/"),
        })}
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-footer-heading">
          <span class="eyebrow">Live posture</span>
          <strong>System pulse</strong>
        </div>
        <div class="sidebar-pulse-grid">
          <div class="sidebar-pulse">
            <span>Sources</span>
            <strong>${snapshot?.queue.totalEntries ?? "-"}</strong>
          </div>
          <div class="sidebar-pulse">
            <span>Decisions</span>
            <strong>${inbox?.summary.totalActionableEntries ?? "-"}</strong>
          </div>
          <div class="sidebar-pulse">
            <span>Pressure</span>
            <strong>${reviewPressure ?? "-"}</strong>
          </div>
          <div class="sidebar-pulse">
            <span>Runtime</span>
            <strong>${snapshot?.runtimeSummary.activeCases.length ?? "-"}</strong>
          </div>
        </div>
        <p class="muted sidebar-footnote">
          This shell stays read-only and lane-aware. Decisions remain explicit, traceable, and bounded by the underlying workflow.
        </p>
      </div>
    </aside>
  `;
}
