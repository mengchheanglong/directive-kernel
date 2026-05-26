import { normalizeText } from "./source-utils.ts";
import type {
  EngineHostAdapter,
  EngineProcessSourceResult,
  EngineRunRecord,
} from "./types.ts";

export async function collectHostAdapterResults(input: {
  adapters: EngineHostAdapter[];
  record: EngineRunRecord;
  timeoutMs: number;
  withTimeout: <T>(operation: Promise<T> | T, timeoutMs: number, label: string) => Promise<T>;
}): Promise<EngineProcessSourceResult["adapterResults"]> {
  const adapterResults: EngineProcessSourceResult["adapterResults"] = [];
  for (const adapter of input.adapters) {
    try {
      const adapterResult = adapter.onRunRecorded
        ? await input.withTimeout(
          adapter.onRunRecorded(input.record),
          input.timeoutMs,
          `hostAdapter:${adapter.id}:onRunRecorded`,
        )
        : undefined;
      adapterResults.push({
        adapterId: adapter.id,
        accepted: adapterResult?.accepted ?? true,
        note: normalizeText(adapterResult?.note) || null,
      });
    } catch (adapterError) {
      adapterResults.push({
        adapterId: adapter.id,
        accepted: false,
        note: `adapter error: ${adapterError instanceof Error ? adapterError.message : String(adapterError)}`,
      });
    }
  }
  return adapterResults;
}
