import { describe, it, expect } from "vitest";
import "./legal-next-steps-hint.ts";

describe("LegalNextStepsHint", () => {
  it("renders terminal-state paragraph when steps are empty", () => {
    const el = document.createElement("legal-next-steps-hint") as HTMLElement & {
      steps: unknown[];
    };
    el.steps = [];
    document.body.appendChild(el);
    expect(el.shadowRoot?.querySelector(".terminal")?.textContent).toContain(
      "terminal state",
    );
    document.body.removeChild(el);
  });

  it("renders one block per step with label and cliInvocation", () => {
    const el = document.createElement("legal-next-steps-hint") as HTMLElement & {
      steps: unknown[];
    };
    el.steps = [
      { label: "Approve", cliInvocation: "pnpm run cli approve" },
      { label: "Reject", cliInvocation: "pnpm run cli reject" },
    ];
    document.body.appendChild(el);
    const steps = el.shadowRoot?.querySelectorAll(".step");
    expect(steps?.length).toBe(2);
    expect(steps?.[0]?.textContent).toContain("Approve");
    expect(steps?.[0]?.textContent).toContain("pnpm run cli approve");
    expect(steps?.[1]?.textContent).toContain("Reject");
    expect(steps?.[1]?.textContent).toContain("pnpm run cli reject");
    document.body.removeChild(el);
  });

  it("handles malformed step missing cliInvocation without crashing", () => {
    const el = document.createElement("legal-next-steps-hint") as HTMLElement & {
      steps: unknown[];
    };
    el.steps = [
      { label: "Incomplete step" },
    ];
    document.body.appendChild(el);
    const steps = el.shadowRoot?.querySelectorAll(".step");
    expect(steps?.length).toBe(1);
    expect(steps?.[0]?.textContent).toContain("Incomplete step");
    document.body.removeChild(el);
  });
});
