/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

import { uniqueStrings } from "./engine-source-utils.ts";
import { extractSourceSignalTokens } from "./routing/routing-correction-ledger.ts";
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

const LEDGER_RELATIVE_PATH = "engine/decision-policy-ledger.json";

function defaultLedger(): DecisionPolicyLedger {
  return {
    schemaVersion: 1,
    events: [],
    suggestions: [],
  };
}

export { compileDecisionPolicySuggestions } from "./decision-policy-ledger-suggestions.ts";

export function resolveDecisionPolicyLedgerPath(directiveRoot: string) {
  return path.resolve(directiveRoot, LEDGER_RELATIVE_PATH).replace(/\\/g, "/");
}

export function readDecisionPolicyLedger(directiveRoot: string): DecisionPolicyLedger {
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

export function appendDecisionPolicyEvent(input: {
  directiveRoot: string;
  event: DecisionPolicyEvent;
}) {
  const ledger = readDecisionPolicyLedger(input.directiveRoot);
  ledger.events.push({
    ...input.event,
    sourceSignalTokens: uniqueStrings(
      input.event.sourceSignalTokens.length > 0
        ? input.event.sourceSignalTokens
        : extractSourceSignalTokens(input.event.rationale),
    ).slice(0, 40),
  });
  ledger.suggestions = compileDecisionPolicySuggestions(ledger.events);

  const ledgerPath = resolveDecisionPolicyLedgerPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

  return {
    ledgerPath,
    ledger,
    suggestions: ledger.suggestions,
  };
}
