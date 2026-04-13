import { css } from "lit";

export const surfaceStyles = css`
  .shell-header {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
    padding: 18px 20px;
    background:
      linear-gradient(180deg, color-mix(in oklab, var(--accent) 28%, transparent), transparent 65%),
      color-mix(in oklab, var(--card) 92%, black);
  }

  .shell-header h1 {
    margin-bottom: 4px;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .shell-nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .shell-hero,
  .workflow-hero {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-start;
    padding: 18px 20px;
    border-color: var(--border-strong);
    background:
      linear-gradient(180deg, color-mix(in oklab, var(--foreground) 3%, transparent), transparent 75%),
      color-mix(in oklab, var(--card) 94%, black);
  }

  .workflow-hero {
    margin-bottom: 16px;
  }

  .shell-hero h2,
  .workflow-hero h2 {
    margin-bottom: 6px;
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.25;
  }

  .grid,
  .lane-overview-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .simple-stat-grid {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    margin: 0;
  }

  .simple-list,
  .queue-card-list,
  .lane-case-list,
  .decision-entry-list,
  .runtime-lane-stack,
  .runtime-anchor-list,
  .workflow-map,
  .workflow-row-list,
  .link-stack {
    display: grid;
    gap: 12px;
  }

  .simple-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--card);
    transition: border-color 140ms ease, background 140ms ease;
  }

  .simple-row:hover {
    text-decoration: none;
    border-color: var(--border-strong);
    background: color-mix(in oklab, var(--foreground) 5%, var(--card));
  }

  .simple-row-main,
  .workflow-main {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .simple-row-copy {
    gap: 3px;
  }

  .simple-row-kicker {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .simple-row-title {
    font-size: 0.8125rem;
    line-height: 1.3;
  }

  .simple-row-support {
    color: color-mix(in oklab, var(--foreground) 78%, var(--muted-foreground));
    font-size: 0.71875rem;
    line-height: 1.45;
  }

  .simple-row-main strong,
  .simple-row-main span,
  .workflow-main strong,
  .workflow-main span {
    overflow-wrap: anywhere;
  }

  .simple-row-meta,
  .queue-tag-row,
  .workflow-tags,
  .hero-meta,
  .queue-link-list,
  .actions,
  .lane-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .simple-row-meta,
  .queue-tag-row,
  .workflow-tags {
    justify-content: flex-end;
  }

  .simple-row-side {
    display: grid;
    gap: 8px;
    justify-items: end;
    flex: none;
    min-width: 124px;
  }

  .simple-row-arrow {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .queue-summary-grid,
  .queue-kv-grid,
  .lane-case-strip-grid,
  .seam-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .queue-card,
  .lane-case-strip,
  .lane-overview-card,
  .decision-entry,
  .workflow-group,
  .hero {
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 14px;
    background: var(--card);
    min-width: 0;
    overflow: hidden;
  }

  .queue-card.runtime,
  .lane-case-strip.runtime,
  .lane-overview-card.runtime,
  .decision-entry.runtime_host_selection,
  .decision-entry.runtime_promotion_seam_decision,
  .decision-entry.runtime_registry_acceptance,
  .workflow-row.runtime {
    border-left: 3px solid var(--runtime-accent);
  }

  .queue-card.architecture,
  .lane-case-strip.architecture,
  .lane-overview-card.architecture,
  .decision-entry.architecture_materialization_due,
  .workflow-row.architecture {
    border-left: 3px solid var(--architecture-accent);
  }

  .lane-overview-card.discovery,
  .workflow-row.discovery,
  .decision-entry.discovery_routing_review {
    border-left: 3px solid var(--discovery-accent);
  }

  .queue-card.monitor,
  .workflow-row.host {
    border-left: 3px solid var(--host-accent);
  }

  .queue-card-header,
  .workflow-group-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin: 0 0 10px;
  }

  .queue-card-title {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .queue-card-subtitle,
  .workflow-hero p,
  label,
  .muted {
    color: var(--muted-foreground);
  }

  .queue-card-subtitle,
  label,
  .muted {
    font-size: 0.75rem;
  }

  .queue-card-subtitle,
  .queue-stage,
  .queue-step,
  .seam-value,
  .pill {
    overflow-wrap: anywhere;
  }

  .queue-kv,
  .lane-case-strip-card,
  .runtime-anchor-item,
  .lane-overview-stat,
  .workflow-detail-grid div,
  .seam-card,
  .queue-highlight {
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 12px;
    background: var(--card);
    min-width: 0;
    overflow: hidden;
  }

  .dashboard-section {
    display: grid;
    gap: 14px;
  }

  .dashboard-section-heading {
    color: color-mix(in oklab, var(--foreground) 84%, var(--muted-foreground));
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dashboard-focus-grid {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .dashboard-focus-card {
    display: grid;
    grid-template-rows: auto auto auto 1fr auto;
    gap: 10px;
    min-height: 204px;
    padding: 14px;
    border: 1px solid var(--border);
    background: var(--card);
    color: inherit;
    text-decoration: none;
    transition: border-color 140ms ease, background 140ms ease;
  }

  .dashboard-focus-card:hover {
    border-color: var(--border-strong);
    background: color-mix(in oklab, var(--foreground) 4%, var(--card));
    text-decoration: none;
  }

  .dashboard-focus-topline {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }

  .dashboard-focus-kicker {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dashboard-focus-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.45rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .dashboard-focus-title {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .dashboard-focus-meta,
  .dashboard-focus-cta {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    line-height: 1.45;
  }

  .dashboard-focus-body {
    color: color-mix(in oklab, var(--foreground) 92%, var(--muted-foreground));
    font-size: 0.8125rem;
    line-height: 1.55;
  }

  .panel-heading,
  .insight-topline,
  .hero-band {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .panel-heading {
    margin-bottom: 12px;
  }

  .insight-list {
    display: grid;
    gap: 8px;
  }

  .insight-item {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card-emphasis) 92%, black);
  }

  .hero-band {
    gap: 14px;
    margin-bottom: 0;
    padding: 16px;
    border-radius: 8px;
    background:
      radial-gradient(circle at top right, color-mix(in oklab, var(--foreground) 3%, transparent), transparent 34%),
      linear-gradient(180deg, color-mix(in oklab, var(--accent) 22%, transparent), transparent 72%),
      color-mix(in oklab, var(--card) 96%, black);
  }

  .hero-band-copy,
  .hero-band-aside,
  .dashboard-column {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .hero-band-copy {
    flex: 1 1 auto;
  }

  .hero-band-copy h2 {
    max-width: 14ch;
    font-size: 1.625rem;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }

  .hero-band-copy p {
    max-width: 66ch;
    font-size: 0.875rem;
  }

  .hero-band-aside {
    width: min(360px, 100%);
    flex: none;
  }

  .hero-band-card {
    display: grid;
    gap: 6px;
    padding: 12px;
    border: 1px solid color-mix(in oklab, var(--foreground) 10%, var(--border));
    border-radius: 8px;
    background: color-mix(in oklab, var(--card-emphasis) 92%, black);
  }

  .hero-band-card strong {
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .dashboard-grid {
    display: grid;
    gap: 20px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .status-list {
    display: grid;
    gap: 8px;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--card);
    font-size: 0.75rem;
  }

  .status-row span {
    color: var(--muted-foreground);
  }

  .status-row strong {
    font-size: 0.8125rem;
    font-weight: 700;
  }

  .queue-kv h4,
  .lane-case-strip-card h4,
  .lane-overview-stat h4,
  .workflow-detail-grid h4 {
    margin-bottom: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .queue-kv p,
  .queue-highlight p,
  .lane-overview-card p,
  .runtime-anchor-item p,
  .seam-card p {
    margin: 0;
  }

  .queue-highlight h3,
  .queue-highlight h4 {
    margin-bottom: 8px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .queue-stage,
  .seam-value {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.45;
    word-break: break-word;
  }

  .queue-step {
    font-size: 0.8125rem;
    line-height: 1.55;
  }

  .queue-actions,
  .workflow-row-detail {
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .queue-count {
    margin-bottom: 12px;
    font-size: 2.05rem;
    font-weight: 700;
    line-height: 1;
  }

  .simple-stat-grid .queue-highlight {
    min-height: 136px;
    padding: 16px 18px;
  }

  .simple-stat-grid .queue-highlight p {
    max-width: 20ch;
    font-size: 0.78125rem;
    line-height: 1.55;
  }

  .queue-empty {
    padding: 18px;
    text-align: center;
    border: 1px dashed var(--border-strong);
    border-radius: 0;
    background: var(--card);
  }

  .runtime-lane-grid,
  .lane-page-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: 1.15fr 0.85fr;
    align-items: start;
  }

  .lane-overview-stats,
  .workflow-hero-stats,
  .workflow-detail-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .workflow-hero-stats {
    min-width: 220px;
  }

  .workflow-hero-stats span {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: color-mix(in oklab, var(--card-emphasis) 92%, black);
  }

  .workflow-hero-stats strong {
    display: block;
    font-size: 1rem;
    line-height: 1;
  }

  .workflow-hero-stats small {
    display: block;
    margin-top: 4px;
    color: var(--muted-foreground);
  }

  .workflow-row {
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--card);
    overflow: hidden;
  }

  .workflow-row summary {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    list-style: none;
    background: var(--card);
  }

  .workflow-row summary::-webkit-details-marker {
    display: none;
  }

  .workflow-row summary::before {
    content: "+";
    font-weight: 700;
    color: var(--muted-foreground);
  }

  .workflow-row[open] summary::before {
    content: "-";
  }

  .nav {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.72rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }

  .nav:hover {
    background: var(--accent-soft);
    border-color: var(--border);
    color: var(--foreground);
    text-decoration: none;
  }

  .nav.active {
    background: var(--accent);
    border-color: var(--border-strong);
    color: var(--foreground);
  }
`;
