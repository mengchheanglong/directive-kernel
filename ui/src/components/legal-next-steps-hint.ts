import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

export interface AllowedNextStep {
  label: string;
  cliInvocation: string;
  docsAnchor?: string;
}

@customElement("legal-next-steps-hint")
export class LegalNextStepsHint extends LitElement {
  steps: AllowedNextStep[] = [];

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
          ${s.docsAnchor ? html`<a href="/docs/operator-cli.md${s.docsAnchor}">Documentation &rarr;</a>` : null}
        </div>
      `)}
    `;
  }
}
