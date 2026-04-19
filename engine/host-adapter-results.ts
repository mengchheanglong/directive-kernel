import { normalizeText } from "./engine-source-utils.ts";
import type {
  DirectiveEngineHostAdapter,
  DirectiveEngineProcessSourceResult,
  DirectiveEngineRunRecord,
} from "./types.ts";

export async function collectHostAdapterResults(input: {
  adapters: DirectiveEngineHostAdapter[];
  record: DirectiveEngineRunRecord;
  timeoutMs: number;
  withTimeout: <T>(operation: Promise<T> | T, timeoutMs: number, label: string) => Promise<T>;
}): Promise<DirectiveEngineProcessSourceResult["adapterResults"]> {
  const adapterResults: DirectiveEngineProcessSourceResult["adapterResults"] = [];
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
