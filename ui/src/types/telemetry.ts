export type FrontendTelemetryEvent = {
  name: string;
  at: string;
  fields?: Record<string, unknown>;
};

export type FrontendTelemetrySnapshot = {
  $schema?: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  events: FrontendTelemetryEvent[];
};

export type FrontendRuntimeStatus = {
  $schema?: string;
  ok: true;
  storage: {
    activeRunRecords?: number;
    archivedRunRecords?: number;
    activeLedgerBytes?: number;
    rotatedLedgerBytes?: number;
    rotatedLedgerSegments?: number;
  };
};
