import { describe, expect, it } from "vitest";
import { createInMemoryTelemetry, createNoopTelemetry } from "../../shared/lib/telemetry.ts";

describe("createNoopTelemetry", () => {
  it("returns empty snapshot", () => {
    const sink = createNoopTelemetry();
    const snap = sink.snapshot();
    expect(snap.counters).toEqual({});
    expect(snap.gauges).toEqual({});
    expect(snap.events).toEqual([]);
  });

  it("does not throw on any operation", () => {
    const sink = createNoopTelemetry();
    expect(() => sink.counter("test")).not.toThrow();
    expect(() => sink.gauge("test", 42)).not.toThrow();
    expect(() => sink.event("test", { key: "value" })).not.toThrow();
    expect(sink.snapshot()).toEqual({ counters: {}, gauges: {}, events: [] });
  });
});

describe("createInMemoryTelemetry counters", () => {
  it("increments by 1 by default", () => {
    const sink = createInMemoryTelemetry();
    sink.counter("hits");
    sink.counter("hits");
    expect(sink.snapshot().counters).toEqual({ hits: 2 });
  });

  it("increments by explicit value", () => {
    const sink = createInMemoryTelemetry();
    sink.counter("hits", 5);
    sink.counter("hits", 3);
    expect(sink.snapshot().counters).toEqual({ hits: 8 });
  });

  it("starts at 0 for unset counters", () => {
    const sink = createInMemoryTelemetry();
    // snapshot before any counter call
    expect(sink.snapshot().counters).toEqual({});
  });
});

describe("createInMemoryTelemetry gauges", () => {
  it("stores latest value", () => {
    const sink = createInMemoryTelemetry();
    sink.gauge("memory_mb", 100);
    sink.gauge("memory_mb", 200);
    expect(sink.snapshot().gauges).toEqual({ memory_mb: 200 });
  });
});

describe("createInMemoryTelemetry events", () => {
  it("records events with name, at, and optional fields", () => {
    const sink = createInMemoryTelemetry();
    sink.event("submission_started", { candidateId: "c1" });
    const snap = sink.snapshot();
    expect(snap.events.length).toBe(1);
    expect(snap.events[0].name).toBe("submission_started");
    expect(snap.events[0].at).toBeTruthy();
    expect(snap.events[0].fields).toEqual({ candidateId: "c1" });
  });

  it("honors maxEvents and evicts oldest", () => {
    const sink = createInMemoryTelemetry({ maxEvents: 3 });
    sink.event("e1");
    sink.event("e2");
    sink.event("e3");
    sink.event("e4");
    const snap = sink.snapshot();
    expect(snap.events.length).toBe(3);
    expect(snap.events[0].name).toBe("e2");
    expect(snap.events[2].name).toBe("e4");
  });

  it("defaults maxEvents to 100", () => {
    const sink = createInMemoryTelemetry();
    for (let i = 0; i < 150; i++) sink.event(`e${i}`);
    expect(sink.snapshot().events.length).toBe(100);
  });
});

describe("snapshot immutability", () => {
  it("mutation of snapshot does not mutate sink state", () => {
    const sink = createInMemoryTelemetry();
    sink.counter("hits", 5);
    sink.gauge("cpu", 80);
    sink.event("start", { phase: "boot" });

    const snap = sink.snapshot();
    snap.counters.hits = 999;
    snap.gauges.cpu = 0;
    if (snap.events[0]?.fields) {
      snap.events[0].fields.phase = "mutated";
    }
    snap.events.pop();

    const snap2 = sink.snapshot();
    expect(snap2.counters.hits).toBe(5);
    expect(snap2.gauges.cpu).toBe(80);
    expect(snap2.events.length).toBe(1);
    expect(snap2.events[0]?.fields).toEqual({ phase: "boot" });
  });
});
