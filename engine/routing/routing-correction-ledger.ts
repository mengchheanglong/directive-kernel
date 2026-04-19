/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";

export type RoutingCorrectionEntry = {
  correctedAt: string;
  candidateId: string;
  sourceType: string;
  originalLaneId: string;
  correctedLaneId: string;
  reason: string;
  /** Lowercased keywords extracted from the source at correction time. */
  sourceSignalTokens: string[];
};

export type RoutingCorrectionLedger = {
  schemaVersion: 1;
  corrections: RoutingCorrectionEntry[];
};

const LEDGER_RELATIVE_PATH = "engine/routing-corrections.json";
const SOURCE_SIGNAL_TOKEN_CACHE_LIMIT = 512;

const sourceSignalTokenCache = new Map<string, string[]>();
const sourceSignalTokenCacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
};

function defaultLedger(): RoutingCorrectionLedger {
  return { schemaVersion: 1, corrections: [] };
}

function rememberSourceSignalTokens(sourceText: string, tokens: string[]) {
  if (sourceSignalTokenCache.has(sourceText)) {
    sourceSignalTokenCache.delete(sourceText);
  }
  sourceSignalTokenCache.set(sourceText, tokens);
  if (sourceSignalTokenCache.size <= SOURCE_SIGNAL_TOKEN_CACHE_LIMIT) {
    return;
  }
  const oldestKey = sourceSignalTokenCache.keys().next().value;
  if (oldestKey) {
    sourceSignalTokenCache.delete(oldestKey);
    sourceSignalTokenCacheStats.evictions += 1;
  }
}

export function resolveRoutingCorrectionLedgerPath(directiveRoot: string) {
  return path.resolve(directiveRoot, LEDGER_RELATIVE_PATH).replace(/\\/g, "/");
}

export function readRoutingCorrectionLedger(
  directiveRoot: string,
): RoutingCorrectionLedger {
  const ledgerPath = resolveRoutingCorrectionLedgerPath(directiveRoot);
  if (!fs.existsSync(ledgerPath)) {
    return defaultLedger();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    if (
      raw
      && typeof raw === "object"
      && Array.isArray(raw.corrections)
    ) {
      return raw as RoutingCorrectionLedger;
    }
    return defaultLedger();
  } catch {
    return defaultLedger();
  }
}

export function appendRoutingCorrection(input: {
  directiveRoot: string;
  entry: RoutingCorrectionEntry;
}) {
  const ledger = readRoutingCorrectionLedger(input.directiveRoot);
  ledger.corrections.push(input.entry);

  const ledgerPath = resolveRoutingCorrectionLedgerPath(input.directiveRoot);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

export function readSourceSignalTokenCacheStats() {
  return {
    hits: sourceSignalTokenCacheStats.hits,
    misses: sourceSignalTokenCacheStats.misses,
    evictions: sourceSignalTokenCacheStats.evictions,
    size: sourceSignalTokenCache.size,
    limit: SOURCE_SIGNAL_TOKEN_CACHE_LIMIT,
  };
}

export function resetSourceSignalTokenCache(input?: {
  clearCache?: boolean;
}) {
  sourceSignalTokenCacheStats.hits = 0;
  sourceSignalTokenCacheStats.misses = 0;
  sourceSignalTokenCacheStats.evictions = 0;
  if (input?.clearCache) {
    sourceSignalTokenCache.clear();
  }
}

/**
 * Given the current source text and the correction ledger, derive lane score
 * adjustments based on past operator corrections for similar sources.
 *
 * The approach is deliberately conservative:
 * - Each matching correction adds +2 to the corrected lane and -1 to the
 *   original lane (clamped to 0).
 * - A correction "matches" when >= 3 of its sourceSignalTokens appear in the
 *   current source text.
 * - Total adjustment per lane is capped at ±6 to prevent a handful of
 *   corrections from overwhelming keyword/metadata signals.
 */
export function deriveRoutingCorrectionAdjustments(input: {
  sourceText: string;
  corrections: RoutingCorrectionEntry[];
}): Record<string, number> {
  const adjustments: Record<string, number> = {};
  const lowered = input.sourceText.toLowerCase();

  for (const correction of input.corrections) {
    const hits = correction.sourceSignalTokens.filter(
      (token) => lowered.includes(token),
    ).length;

    if (hits < 3) {
      continue;
    }

    adjustments[correction.correctedLaneId] =
      (adjustments[correction.correctedLaneId] ?? 0) + 2;
    adjustments[correction.originalLaneId] =
      (adjustments[correction.originalLaneId] ?? 0) - 1;
  }

  const CAP = 6;
  for (const laneId of Object.keys(adjustments)) {
    adjustments[laneId] = Math.max(-CAP, Math.min(CAP, adjustments[laneId]));
  }

  return adjustments;
}

/**
 * Extract lowercased signal tokens from source text for storage in a
 * correction entry. These tokens are later compared against future source
 * text to find similar sources.
 */
export function extractSourceSignalTokens(sourceText: string): string[] {
  const cached = sourceSignalTokenCache.get(sourceText);
  if (cached) {
    sourceSignalTokenCacheStats.hits += 1;
    sourceSignalTokenCache.delete(sourceText);
    sourceSignalTokenCache.set(sourceText, cached);
    return cached.slice();
  }

  sourceSignalTokenCacheStats.misses += 1;
  const tokens = Array.from(
    new Set(
      sourceText
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  ).slice(0, 40);
  rememberSourceSignalTokens(sourceText, tokens);
  return tokens.slice();
}
