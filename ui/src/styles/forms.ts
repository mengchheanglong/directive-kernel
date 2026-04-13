import { css } from "lit";

export const formStyles = css`
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
    border-radius: 6px;
    background: color-mix(in oklab, var(--card) 94%, black);
    color: var(--foreground);
  }

  .checkbox-row input {
    width: auto;
    margin: 0;
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
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
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
    padding: 0.5rem 0.82rem;
    border: 1px solid color-mix(in oklab, var(--foreground) 12%, transparent);
    border-radius: 6px;
    background: var(--primary);
    color: var(--primary-foreground);
    font-size: 0.8125rem;
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
    padding: 0.12rem 0.45rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: color-mix(in oklab, var(--foreground) 90%, var(--muted-foreground));
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
    border-radius: 6px;
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
      padding: 0;
      height: auto;
      min-height: 100vh;
      overflow: visible;
    }

    .app-shell,
    .dashboard-grid,
    .dashboard-focus-grid,
    .simple-stat-grid {
      grid-template-columns: 1fr;
    }

    .app-shell,
    .shell-main {
      height: auto;
      min-height: 0;
    }

    .sidebar-shell {
      position: static;
      top: auto;
      height: auto;
      padding: 16px 12px;
      border-right: none;
      border-bottom: 1px solid var(--border);
      scrollbar-gutter: auto;
    }

    .shell-main {
      overflow: visible;
      scrollbar-gutter: auto;
    }

    .page-chrome,
    .shell-header,
    .shell-hero,
    .workflow-hero,
    .simple-row,
    .queue-card-header,
    .panel-heading,
    .insight-topline,
    .hero-band {
      flex-direction: column;
      align-items: flex-start;
    }

    .page-actions,
    .simple-row-meta,
    .queue-tag-row,
    .workflow-tags {
      justify-content: flex-start;
    }

    .page-actions,
    .simple-row-side {
      width: 100%;
      justify-items: start;
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

    .sidebar-pulse-grid,
    .workflow-hero-stats {
      width: 100%;
      grid-template-columns: 1fr;
    }

    .hero-band-copy h2 {
      font-size: 1.375rem;
    }

    .content-stack {
      padding: 20px 16px 28px;
    }

    .workflow-row summary {
      align-items: flex-start;
    }
  }
`;
