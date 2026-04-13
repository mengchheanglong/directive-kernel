import { css } from "lit";

export const baseStyles = css`
  :host {
    --background: oklch(0.12 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.145 0 0);
    --card-emphasis: color-mix(in oklab, var(--card) 94%, white);
    --muted: oklch(0.18 0 0);
    --muted-foreground: oklch(0.68 0 0);
    --border: oklch(0.24 0 0);
    --border-strong: color-mix(in oklab, var(--foreground) 7%, var(--border));
    --accent: oklch(0.18 0 0);
    --accent-soft: color-mix(in oklab, var(--accent) 40%, transparent);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --runtime-accent: color-mix(in oklab, #60a5fa 34%, var(--border));
    --architecture-accent: color-mix(in oklab, #a78bfa 32%, var(--border));
    --discovery-accent: color-mix(in oklab, #34d399 26%, var(--border));
    --host-accent: color-mix(in oklab, #f59e0b 28%, var(--border));
    display: block;
    min-height: 100vh;
    color: var(--foreground);
    background: var(--background);
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

  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  *::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
    background: transparent;
    -webkit-appearance: none;
  }

  *::-webkit-scrollbar-button:start:decrement,
  *::-webkit-scrollbar-button:end:increment,
  *::-webkit-scrollbar-button:vertical:decrement,
  *::-webkit-scrollbar-button:vertical:increment,
  *::-webkit-scrollbar-button:horizontal:decrement,
  *::-webkit-scrollbar-button:horizontal:increment,
  *::-webkit-scrollbar-button:single-button,
  *::-webkit-scrollbar-button:single-button:vertical:decrement,
  *::-webkit-scrollbar-button:single-button:vertical:increment,
  *::-webkit-scrollbar-button:single-button:horizontal:decrement,
  *::-webkit-scrollbar-button:single-button:horizontal:increment {
    display: none;
    width: 0;
    height: 0;
    background: transparent;
    -webkit-appearance: none;
  }

  *::-webkit-scrollbar-track-piece:start,
  *::-webkit-scrollbar-track-piece:end,
  *::-webkit-scrollbar-track-piece:start:decrement,
  *::-webkit-scrollbar-track-piece:end:increment {
    margin: 0;
    background: oklch(0.205 0 0);
  }

  *::-webkit-scrollbar-track {
    background: oklch(0.205 0 0);
  }

  *::-webkit-scrollbar-thumb {
    background: oklch(0.4 0 0);
    border-radius: 4px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: oklch(0.5 0 0);
  }

  *::-webkit-scrollbar-corner {
    background: oklch(0.205 0 0);
  }

  @supports not selector(::-webkit-scrollbar) {
    * {
      scrollbar-width: thin;
      scrollbar-color: oklch(0.4 0 0) oklch(0.205 0 0);
    }
  }

  main {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .app-shell {
    display: grid;
    grid-template-columns: 296px minmax(0, 1fr);
    gap: 0;
    align-items: stretch;
    height: 100vh;
  }

  .shell-main {
    display: grid;
    gap: 0;
    min-width: 0;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
  }

  .content-stack {
    display: grid;
    gap: 24px;
    min-width: 0;
    padding: 22px 26px 34px;
  }

  .content-stack > *,
  .dashboard-column > *,
  .grid > *,
  .simple-stat-grid > *,
  .queue-summary-grid > *,
  .lane-overview-grid > *,
  .lane-case-list > *,
  .decision-entry-list > *,
  .runtime-lane-stack > *,
  .runtime-anchor-list > *,
  .workflow-map > * {
    margin-bottom: 0;
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
    margin: 0;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--card);
    box-shadow: none;
    overflow: hidden;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.55rem;
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .page-chrome {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    margin-bottom: 0;
    padding: 18px 28px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--background);
  }

  .page-chrome h1 {
    margin-bottom: 0;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .page-chrome .muted {
    max-width: 66ch;
    margin-top: 0.35rem;
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .page-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
  }

  .action-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.45rem 0.72rem;
    border: 1px solid var(--border);
    border-radius: 0;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1;
    text-decoration: none;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease;
  }

  .action-link:hover {
    text-decoration: none;
    transform: translateY(-1px);
  }

  .action-link.primary {
    border-color: var(--border-strong);
    background: color-mix(in oklab, var(--foreground) 10%, transparent);
    color: var(--foreground);
  }

  .action-link.secondary {
    background: transparent;
    color: var(--foreground);
  }
`;
