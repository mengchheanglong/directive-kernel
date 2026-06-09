import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveRuntimeHostSelectionAction,
} from "../../ui/src/page-actions.ts";

const originalFetch = globalThis.fetch;
const OriginalFormData = globalThis.FormData;

type MockForm = { __fields: Record<string, string> };

function buildForm(fields: Record<string, string>): HTMLFormElement {
  return { __fields: fields } as unknown as HTMLFormElement;
}

class MockFormData {
  private readonly fields: Record<string, string>;

  constructor(form: HTMLFormElement) {
    this.fields = (form as unknown as MockForm).__fields ?? {};
  }

  get(name: string) {
    return this.fields[name] ?? null;
  }

  entries() {
    return Object.entries(this.fields)[Symbol.iterator]();
  }
}

describe("ui page actions", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.FormData = OriginalFormData;
    vi.restoreAllMocks();
  });

  it("posts runtime host selection to the shipped route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    globalThis.FormData = MockFormData as unknown as typeof FormData;

    const form = buildForm({
      decision: "select_standalone",
      rationale: "Use the standalone host for this bounded Runtime surface.",
      resolved_confidence: "high",
    });

    await resolveRuntimeHostSelectionAction(
      form,
      "runtime/03-promotion-ready/example-promotion-readiness.md",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];

    expect(url).toBe("/api/runtime/selection-resolutions");
    expect(init.method).toBe("POST");
  });
});
