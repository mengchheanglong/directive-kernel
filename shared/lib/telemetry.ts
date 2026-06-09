export type TelemetryEvent = {
  name: string;
  at: string;
  fields?: Record<string, unknown>;
};

export type TelemetrySnapshot = {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  events: TelemetryEvent[];
};

export interface TelemetrySink {
  counter(name: string, value?: number): void;
  gauge(name: string, value: number): void;
  event(name: string, fields?: Record<string, unknown>): void;
  snapshot(): TelemetrySnapshot;
}

function cloneTelemetryFields(
  fields?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return fields ? { ...fields } : undefined;
}

export function createNoopTelemetry(): TelemetrySink {
  return {
    counter() {},
    gauge() {},
    event() {},
    snapshot() {
      return { counters: {}, gauges: {}, events: [] };
    },
  };
}

export function createInMemoryTelemetry(
  input?: { maxEvents?: number },
): TelemetrySink {
  const maxEvents = input?.maxEvents ?? 100;
  const counters: Record<string, number> = {};
  const gauges: Record<string, number> = {};
  const events: TelemetryEvent[] = [];

  return {
    counter(name: string, value = 1) {
      counters[name] = (counters[name] ?? 0) + value;
    },
    gauge(name: string, value: number) {
      gauges[name] = value;
    },
    event(name: string, fields?: Record<string, unknown>) {
      events.push({
        name,
        at: new Date().toISOString(),
        fields: cloneTelemetryFields(fields),
      });
      while (events.length > maxEvents) {
        events.shift();
      }
    },
    snapshot() {
      return {
        counters: { ...counters },
        gauges: { ...gauges },
        events: events.map((event) => ({
          name: event.name,
          at: event.at,
          fields: cloneTelemetryFields(event.fields),
        })),
      };
    },
  };
}
