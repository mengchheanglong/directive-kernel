import { css } from "lit";

export const sidebarStyles = css`
  .sidebar-shell {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    height: 100vh;
    padding: 18px 12px 24px;
    border-right: 1px solid var(--border);
    background: var(--background);
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .sidebar-brand {
    display: grid;
    gap: 4px;
    align-items: flex-start;
    padding: 0 12px 14px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-brand strong {
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .sidebar-brand .muted {
    font-size: 0.71875rem;
  }

  .sidebar-group {
    display: grid;
    gap: 4px;
  }

  .sidebar-group-label {
    padding: 0 14px;
    color: var(--muted-foreground);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sidebar-link {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    color: inherit;
    text-decoration: none;
    transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
  }

  .sidebar-link:hover {
    background: color-mix(in oklab, var(--foreground) 6%, transparent);
    border-color: transparent;
    text-decoration: none;
    transform: none;
  }

  .sidebar-link.active {
    background: color-mix(in oklab, var(--foreground) 12%, transparent);
    border-color: transparent;
  }

  .sidebar-link-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 18px;
    height: 18px;
    background: transparent;
  }

  .sidebar-link-icon svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sidebar-link-body {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
  }

  .sidebar-link-body strong {
    font-size: 0.84375rem;
    font-weight: 600;
    line-height: 1.25;
  }

  .sidebar-link-body span {
    display: none;
  }

  .sidebar-link-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.4rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: color-mix(in oklab, var(--foreground) 8%, transparent);
    font-size: 0.625rem;
    font-weight: 600;
    line-height: 1;
  }

  .sidebar-footer {
    display: grid;
    gap: 6px;
    margin-top: auto;
    padding: 14px 12px 0;
    border-top: 1px solid var(--border);
  }

  .sidebar-footer-heading strong {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }

  .sidebar-footer-heading .eyebrow {
    margin-bottom: 0.25rem;
  }

  .sidebar-pulse-grid {
    display: grid;
    gap: 2px;
    grid-template-columns: 1fr;
  }

  .sidebar-pulse {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .sidebar-pulse span {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    text-transform: none;
    letter-spacing: 0;
  }

  .sidebar-pulse strong {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1;
  }

  .sidebar-footnote {
    display: none;
  }
`;
