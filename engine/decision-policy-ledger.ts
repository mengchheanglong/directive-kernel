/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { uniqueStrings } from "./source-utils.ts";
import { extractSourceSignalTokens } from "./routing/correction-ledger.ts";
import {
  compileDecisionPolicySuggestions,
} from "./decision-policy-ledger-suggestions.ts";

export type {
  DecisionPolicyEvent,
  DecisionPolicyLedger,
  DecisionPolicySuggestion,
} from "./decision-policy-ledger-types.ts";
import type {
  DecisionPolicyEvent,
  DecisionPolicyLedger,
} from "./decision-policy-ledger-types.ts";

const LEDGER_JSON_RELATIVE_PATH = "engine/decision-policy-ledger.json";
const LEDGER_JSONL_RELATIVE_PATH = "engine/decision-policy-ledger.jsonl";

type LedgerCacheEntry = {
  mtimeMs: number;
  ledger: DecisionPolicyLedger;
};

let jsonlCache: LedgerCacheEntry | null = null;

function defaultLedger(): DecisionPolicyLedger {
  return {
    schemaVersion: 1,
    events: [],
    suggestions: [],
  };
}

export { compileDecisionPolicySuggestions } from "./decision-policy-ledger-suggestions.ts";

export function resolveDecisionPolicyLedgerPath(directiveRoot: string) {
  return path.resolve(directiveRoot, LEDGER_JSON_RELATIVE_PATH).replace(/\\/g, "/");
}

export function resolveDecisionPolicyLedgerJsonlPath(directiveRoot: string) {
  return path.resolve(directiveRoot, LEDGER_JSONL_RELATIVE_PATH).replace(/\\/g, "/");
}

function readDecisionPolicyLedgerFromJson(directiveRoot: string): DecisionPolicyLedger {
  const ledgerPath = resolveDecisionPolicyLedgerPath(directiveRoot);
  if (!fs.existsSync(ledgerPath)) {
    return defaultLedger();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    if (
      raw
      && typeof raw === "object"
      && Array.isArray(raw.events)
      && Array.isArray(raw.suggestions)
    ) {
      return raw as DecisionPolicyLedger;
    }
    return defaultLedger();
  } catch {
    return defaultLedger();
  }
}

function readDecisionPolicyEventsFromJsonl(jsonlPath: string): DecisionPolicyEvent[] {
  const content = fs.readFileSync(jsonlPath, "utf8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const events: DecisionPolicyEvent[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && typeof parsed.recordedAt === "string") {
        events.push(parsed as DecisionPolicyEvent);
      }
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

export function readDecisionPolicyLedger(directiveRoot: string): DecisionPolicyLedger {
  const jsonlPath = resolveDecisionPolicyLedgerJsonlPath(directiveRoot);

  if (fs.existsSync(jsonlPath)) {
    try {
      const stat = fs.statSync(jsonlPath);
      if (jsonlCache !== null && jsonlCache.mtimeMs === stat.mtimeMs) {
        return jsonlCache.ledger;
      }

      const events = readDecisionPolicyEventsFromJsonl(jsonlPath);
      const suggestions = compileDecisionPolicySuggestions(events);
      const ledger: DecisionPolicyLedger = { schemaVersion: 1, events, suggestions };

      jsonlCache = { mtimeMs: stat.mtimeMs, ledger };
      return ledger;
    } catch {
      jsonlCache = null;
      return readDecisionPolicyLedgerFromJson(directiveRoot);
    }
  }

  return readDecisionPolicyLedgerFromJson(directiveRoot);
}

export function appendDecisionPolicyEvent(input: {
  directiveRoot: string;
  event: DecisionPolicyEvent;
}) {
  const normalizedEvent: DecisionPolicyEvent = {
    ...input.event,
    sourceSignalTokens: uniqueStrings(
      input.event.sourceSignalTokens.length > 0
        ? input.event.sourceSignalTokens
        : extractSourceSignalTokens(input.event.rationale),
    ).slice(0, 40),
  };

  const jsonlPath = resolveDecisionPolicyLedgerJsonlPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(jsonlPath), { recursive: true });
  fs.appendFileSync(jsonlPath, `${JSON.stringify(normalizedEvent)}\n`, "utf8");

  jsonlCache = null;

  const ledger = readDecisionPolicyLedger(input.directiveRoot);

  return {
    ledgerPath: resolveDecisionPolicyLedgerPath(input.directiveRoot),
    ledger,
    suggestions: ledger.suggestions,
  };
}

export function regenerateDecisionPolicyLedgerJson(directiveRoot: string) {
  const jsonlPath = resolveDecisionPolicyLedgerJsonlPath(directiveRoot);
  if (!fs.existsSync(jsonlPath)) {
    return;
  }

  const events = readDecisionPolicyEventsFromJsonl(jsonlPath);
  const suggestions = compileDecisionPolicySuggestions(events);
  const ledger: DecisionPolicyLedger = { schemaVersion: 1, events, suggestions };

  const jsonPath = resolveDecisionPolicyLedgerPath(directiveRoot);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}
