/// <reference types="node" />

import * as fs from "node:fs";
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
  activePath: string;
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

type Lookback = "active-only" | "all" | { sinceMonth: string };

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

export function readDecisionPolicyLedger(
  directiveRoot: string,
  opts: { lookback?: Lookback } = {},
): DecisionPolicyLedger {
  const lookback = opts.lookback ?? "active-only";
  const dir = path.join(directiveRoot, "engine");
  const activePath = path.join(dir, "decision-policy-ledger.jsonl");

  const segments: string[] = [];
  if (lookback !== "active-only") {
    const all = fs.readdirSync(dir)
      .filter((f) => /^decision-policy-ledger\.\d{4}-\d{2}\.jsonl$/.test(f))
      .sort();
    if (lookback === "all") {
      segments.push(...all.map((f) => path.join(dir, f)));
    } else {
      const since = lookback.sinceMonth;
      segments.push(...all
        .filter((f) => f.replace("decision-policy-ledger.", "").replace(".jsonl", "") >= since)
        .map((f) => path.join(dir, f))
      );
    }
  }
  if (fs.existsSync(activePath)) segments.push(activePath);

  if (lookback === "active-only" && segments.length === 1 && segments[0] === activePath) {
    try {
      const stat = fs.statSync(activePath);
      if (jsonlCache !== null && jsonlCache.activePath === activePath && jsonlCache.mtimeMs === stat.mtimeMs) {
        return jsonlCache.ledger;
      }

      const events = readDecisionPolicyEventsFromJsonl(activePath);
      const suggestions = compileDecisionPolicySuggestions(events);
      const ledger: DecisionPolicyLedger = { schemaVersion: 1, events, suggestions };

      jsonlCache = { activePath, mtimeMs: stat.mtimeMs, ledger };
      return ledger;
    } catch {
      jsonlCache = null;
      return readDecisionPolicyLedgerFromJson(directiveRoot);
    }
  }

  const events: DecisionPolicyEvent[] = [];
  for (const segPath of segments) {
    let content: string;
    try { content = fs.readFileSync(segPath, "utf8"); } catch { continue; }
    const lines = content.split("\n").filter(Boolean);
    for (const line of lines) {
      try { events.push(JSON.parse(line)); } catch { /* skip torn line */ }
    }
  }

  if (events.length > 0) {
    const suggestions = compileDecisionPolicySuggestions(events);
    return { schemaVersion: 1, events, suggestions };
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
