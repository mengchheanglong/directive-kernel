# Design Document

## Overview

This is a small UI polish + documentation spec, not a feature build. The deliverables are:

1. The Mutation_Coverage_Audit Markdown file (one-shot research artifact).
2. A locked decision recorded in `Fix_Plan.md` (read-only dashboard now; workbench deferred).
3. The dashboard rename + Mutation_Boundary_Note banner.
4. The Operator_CLI_Doc.
5. A new Lit component `<legal-next-steps-hint>` and three renderer extensions that mount it.
6. One integration test asserting zero mutation paths in the rendered HTML.

The total surface is roughly: 1 new audit doc, 1 new doc page, 1 new Lit component (~80 lines), 3 renderer touch-ups, 1 README banner, copy changes in 4 docs, 1 integration test, 1 Fix_Plan note, 1 stub directory.

## Architecture

```
   ui/src/main.ts (existing)
        │
        ▼
   ui/src/views/dashboard-shell.ts
        │  ┌─ renders Mutation_Boundary_Note (new banner block)
        │  ├─ existing route view
        │  └─ artifact renderer
        ▼
   ui/src/renderers/<artifact-type>.ts (existing, extended)
        │
        ▼
   ui/src/components/legal-next-steps-hint.ts (new)
        renders allowedNextSteps[] as prose + CLI code blocks
```

## Components and Interfaces

### `ui/src/components/legal-next-steps-hint.ts` (new)

```ts
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface AllowedNextStep {
  label: string;          // "Approve the route"
  cliInvocation: string;  // "pnpm run standalone:cli discovery-route-approve --routing-record-path ..."
  docsAnchor?: string;    // "#approve-route"
}

@customElement("legal-next-steps-hint")
export class LegalNextStepsHint extends LitElement {
  @property({ type: Array }) steps: AllowedNextStep[] = [];

  static styles = css`
    :host { display: block; padding: 0.5rem 0; }
    .terminal { color: var(--muted, #888); font-style: italic; }
    .step { margin: 0.5rem 0; }
    pre { background: var(--code-bg, #f5f5f5); padding: 0.5rem; overflow-x: auto; }
  `;

  render() {
    if (!this.steps?.length) {
      return html`<p class="terminal">This artifact is in a terminal state; no further operator action is required.</p>`;
    }
    return html`
      <h4>Allowed next steps</h4>
      ${this.steps.map((s) => html`
        <div class="step">
          <p>${s.label}</p>
          <pre>${s.cliInvocation}</pre>
          ${s.docsAnchor ? html`<a href="/docs/operator-cli.md${s.docsAnchor}">Documentation →</a>` : null}
        </div>
      `)}
    `;
  }
}
```

### Renderer extensions

For each of `discovery-routing-record`, `runtime-follow-up`, `architecture-adoption-decision` renderers (paths under `ui/src/renderers/`), add a final `<legal-next-steps-hint .steps=${this.deriveSteps(artifact)}></legal-next-steps-hint>` mount point.

`deriveSteps(artifact)` is a per-renderer helper that maps the artifact's state into the `AllowedNextStep[]` shape. Implementation reads `artifact.allowedNextSteps` (post-F4 rename) and joins it with a per-step CLI invocation table baked into the renderer module.

### `Mutation_Boundary_Note` banner

Static markup at the top of `dashboard-shell.ts` (or whatever the main view is named):

```html
<aside class="mutation-boundary-note">
  This is a read-only view. State mutations live in the CLI:
  <code>pnpm run standalone:cli &lt;subcommand&gt;</code>.
  See <a href="/docs/operator-cli.md">the operator CLI reference</a> for the canonical operator surface.
</aside>
```

### Operator_CLI_Doc structure

```
# Directive Operator CLI

This is the canonical operator mutation surface. The Operator Dashboard is read-only.

## Submit a source
```
pnpm run standalone:cli discovery-submit --directive-root <root> --input-json-path <path>
```

## Approve a route
... etc.
```

One section per Operator_Action. Each section:
- one-sentence purpose
- full CLI command pattern with all flags
- one realistic example
- link to the underlying contract

### Mutation_Coverage_Audit structure

```
# UI Mutation Coverage Audit

| Action | Web-host endpoint | CLI subcommand | Workbench value |
|---|---|---|---|
| Submit source | POST /api/discovery/submissions | discovery-submit | High — the most-frequent mutation; saves form context |
| Approve route | POST /api/discovery/routing/approve | discovery-route-approve | Medium — already simple from CLI |
| ... | ... | ... | ... |

## Decision (locked)
Ship Operator_Dashboard now. Defer the workbench until concrete operator demand exists.

## Workbench scope estimate (deferred)
- ~6 Lit form components
- ~4 mutation flows that need optimistic UI
- ~1 error-toast subsystem
- estimated 2–3 weeks of UI work
```

## Data Models

No new data models. The renderer extension reads existing `allowedNextSteps` from the artifact's JSON.

## Correctness Properties

None. The work is documentation + UI polish + one read-only assertion.

## Error Handling

`<legal-next-steps-hint>` with malformed `steps` (missing fields) should render a defensive fallback rather than crash. Wrap each step's render in a try/catch in development; in production, drop malformed entries silently with a `console.warn`.

## Testing Strategy

### Unit tests

`ui/src/components/legal-next-steps-hint.test.ts` — Lit component test using `@open-wc/testing` or a Vitest+jsdom stub. Asserts: empty steps renders the terminal message; non-empty steps renders one block per step with `label`, `cliInvocation`, and conditional anchor.

### Integration tests

`tests/integration/dashboard-readonly-surface.test.ts` — boots web host, fetches `/`, parses HTML, asserts:
- no `<form method="POST">` or any case variant
- no inline `onclick` that contains `fetch.*method.*post` literal
- the Mutation_Boundary_Note text appears in the body

## Wave Plan

| Wave | Scope | Checkpoint |
|---|---|---|
| 1 | Mutation_Coverage_Audit + Workbench_Deferred_Note + F8_Workbench_Spec_Stub + Fix_Plan F8 update | typecheck + test |
| 2 | Operator_Dashboard rename + Mutation_Boundary_Note banner + dashboard `<title>` | typecheck + test + build |
| 3 | Operator_CLI_Doc | typecheck + test + check:contracts |
| 4 | `<legal-next-steps-hint>` Lit component + renderer extensions for the three artifact types | typecheck + test (incl. the new component test) + check:build |
| 5 | dashboard-readonly-surface integration test + final verification | full gate green |

## Open Questions

- Should the Legal_Next_Steps_Hint also list the *un*-allowed next steps (with explanations of why they're blocked)? Out of scope — that's an Improvement Plan item; this spec only surfaces the allowed set.
- Does the dashboard need a "go to CLI" copy button? Defer; trivial follow-up if operators ask for it.
