import { css } from "lit";

export const appStyles = css`
  :host {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-emphasis: color-mix(in oklab, var(--card) 84%, black);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --border: oklch(0.269 0 0);
    --border-strong: color-mix(in oklab, var(--foreground) 10%, var(--border));
    --accent: oklch(0.269 0 0);
    --accent-soft: color-mix(in oklab, var(--accent) 72%, transparent);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --runtime-accent: color-mix(in oklab, #60a5fa 34%, var(--border));
    --architecture-accent: color-mix(in oklab, #a78bfa 32%, var(--border));
    --discovery-accent: color-mix(in oklab, #34d399 26%, var(--border));
    --host-accent: color-mix(in oklab, #f59e0b 28%, var(--border));
    display: block;
    min-height: 100vh;
    color: var(--foreground);
    background:
      radial-gradient(circle at top, color-mix(in oklab, var(--accent) 22%, transparent), transparent 34%),
      var(--background);
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  main {
    max-width: 1240px;
    margin: 0 auto;
    padding: 24px 24px 56px;
  }

  h1,
  h2,
  h3,
  h4 {
    margin: 0;
    color: var(--foreground);
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
  }

  .panel {
    margin: 0 0 16px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card) 94%, black);
    box-shadow: none;
    overflow: hidden;
  }

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
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .simple-stat-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    margin: 0 0 16px;
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
    gap: 14px;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card) 90%, black);
    transition: border-color 140ms ease, background 140ms ease;
  }

  .simple-row:hover {
    text-decoration: none;
    border-color: var(--border-strong);
    background: color-mix(in oklab, var(--accent) 42%, var(--card));
  }

  .simple-row-main,
  .workflow-main {
    display: grid;
    gap: 3px;
    min-width: 0;
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
    border-radius: 8px;
    padding: 16px;
    background: color-mix(in oklab, var(--card) 92%, black);
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
    margin: 0 0 12px;
  }

  .queue-card-title {
    font-size: 0.95rem;
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
    border-radius: 8px;
    padding: 12px;
    background: color-mix(in oklab, var(--card-emphasis) 88%, black);
    min-width: 0;
    overflow: hidden;
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

  .queue-stage,
  .seam-value {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.45;
    word-break: break-word;
  }

  .queue-step {
    font-size: 0.875rem;
    line-height: 1.55;
  }

  .queue-actions,
  .workflow-row-detail {
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .form-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .checkbox-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    margin: 12px 0;
  }

  .checkbox-row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card) 90%, black);
    color: var(--foreground);
  }

  .checkbox-row input {
    width: auto;
    margin: 0;
  }

  .queue-count {
    margin-bottom: 6px;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .queue-empty {
    padding: 22px;
    text-align: center;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card) 90%, black);
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
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card-emphasis) 88%, black);
  }

  .workflow-hero-stats strong {
    display: block;
    font-size: 1.25rem;
    line-height: 1;
  }

  .workflow-hero-stats small {
    display: block;
    margin-top: 4px;
    color: var(--muted-foreground);
  }

  .workflow-row {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--card) 90%, black);
    overflow: hidden;
  }

  .workflow-row summary {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    cursor: pointer;
    list-style: none;
    background: color-mix(in oklab, var(--card) 88%, black);
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
    padding: 0.45rem 0.8rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--muted-foreground);
    font-size: 0.875rem;
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

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th,
  td {
    padding: 10px 8px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
  }

  th {
    color: var(--muted-foreground);
    font-weight: 500;
  }

  input,
  textarea,
  select,
  button {
    font: inherit;
  }

  input,
  textarea,
  select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in oklab, var(--background) 92%, black);
    color: var(--foreground);
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: 1px solid color-mix(in oklab, var(--foreground) 24%, transparent);
    border-color: var(--border-strong);
  }

  textarea {
    min-height: 96px;
    resize: vertical;
  }

  button {
    padding: 0.55rem 0.9rem;
    border: 1px solid color-mix(in oklab, var(--foreground) 12%, transparent);
    border-radius: 8px;
    background: var(--primary);
    color: var(--primary-foreground);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  button.secondary {
    border-color: var(--border);
    background: var(--accent);
    color: var(--foreground);
  }

  .row {
    display: grid;
    gap: 8px;
    margin: 0 0 10px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: 0.16rem 0.5rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: color-mix(in oklab, var(--accent) 85%, transparent);
    color: var(--foreground);
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .message {
    background: color-mix(in oklab, var(--accent) 36%, var(--card));
    border-color: var(--border-strong);
  }

  .warning {
    background: color-mix(in oklab, #f59e0b 12%, var(--card));
    border-color: color-mix(in oklab, #f59e0b 28%, var(--border));
  }

  .good {
    background: color-mix(in oklab, #22c55e 10%, var(--card));
    border-color: color-mix(in oklab, #22c55e 24%, var(--border));
  }

  pre {
    padding: 12px;
    border: 1px solid color-mix(in oklab, var(--foreground) 12%, transparent);
    border-radius: 8px;
    background: #1e1e2e;
    color: #cdd6f4;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }

  a {
    color: var(--foreground);
    text-decoration: none;
    text-underline-offset: 0.15em;
  }

  a:hover {
    text-decoration: underline;
    text-decoration-color: color-mix(in oklab, var(--foreground) 55%, transparent);
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }

  .mono {
    font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      "Liberation Mono",
      "Courier New",
      monospace;
    word-break: break-all;
  }

  @media (max-width: 720px) {
    main {
      padding: 16px;
    }

    .shell-header,
    .shell-hero,
    .workflow-hero,
    .simple-row,
    .queue-card-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .simple-row-meta,
    .queue-tag-row,
    .workflow-tags {
      justify-content: flex-start;
    }

    .checkbox-row {
      align-items: flex-start;
    }

    .hero-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .runtime-lane-grid,
    .lane-page-grid {
      grid-template-columns: 1fr;
    }

    .workflow-hero-stats {
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .workflow-row summary {
      align-items: flex-start;
    }
  }
`;
