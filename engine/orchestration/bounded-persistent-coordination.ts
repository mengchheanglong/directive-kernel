import fs from "node:fs";
import path from "node:path";

import {
  buildReadOnlyLifecycleCoordinationReport,
  type ReadOnlyLifecycleCoordinationBucketId,
  type ReadOnlyLifecycleCoordinationReport,
} from "./read-only-lifecycle-coordination/read-only-lifecycle-coordination.ts";
import { readJson } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import { getDefaultDirectiveWorkspaceRoot } from "../../shared/lib/workspace-root.ts";

// --- Ledger types ---

export type CoordinationLedgerCaseState = {
  candidateId: string;
  bucketId: ReadOnlyLifecycleCoordinationBucketId;
  currentStage: string | null;
};

export type CoordinationLedgerEntry = {
  snapshotAt: string;
  totalLiveCases: number;
  topPressureBucket: ReadOnlyLifecycleCoordinationBucketId | null;
  bucketCounts: Partial<Record<ReadOnlyLifecycleCoordinationBucketId, number>>;
  caseStates: CoordinationLedgerCaseState[];
};

export type CoordinationLedger = {
  version: 1;
  maxEntries: number;
  entries: CoordinationLedgerEntry[];
};

// --- Persistence signal types ---

export type StaleCaseSignal = {
  candidateId: string;
  bucketId: ReadOnlyLifecycleCoordinationBucketId;
  consecutiveChecks: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CadenceDriftSignal = {
  lastCheckAt: string | null;
  currentCheckAt: string;
  hoursSinceLastCheck: number | null;
  cadenceDriftDetected: boolean;
};

export type PersistenceSignals = {
  staleCases: StaleCaseSignal[];
  cadenceDrift: CadenceDriftSignal;
  newCases: string[];
  resolvedCases: string[];
  totalPreviousChecks: number;
};

export type BoundedPersistentCoordinationReport = {
  ok: boolean;
  checkerId: "bounded_persistent_coordination";
  snapshotAt: string;
  mode: "bounded_persistent_coordination";
  guardrails: {
    mutatesQueueOrStateTruth: false;
    autoAdvancesWorkflow: false;
    bypassesApproval: false;
    impliesHostIntegration: false;
    impliesRuntimeExecution: false;
    impliesPromotionAutomation: false;
    onlyWritesOwnLedger: true;
  };
  persistenceSignals: PersistenceSignals;
  upstreamReport: {
    totalLiveCases: number;
    recommendTaskCount: number;
    parkedCount: number;
    stopCount: number;
    topPressureBucket: ReadOnlyLifecycleCoordinationBucketId | null;
  };
  ledgerPath: string;
  ledgerEntryCount: number;
};

// --- Constants ---

const CHECKER_ID = "bounded_persistent_coordination" as const;
const MAX_LEDGER_ENTRIES = 20;
const CADENCE_DRIFT_THRESHOLD_HOURS = 72;
const STALE_CONSECUTIVE_THRESHOLD = 2;

// --- Helpers ---

function getLedgerPath(directiveRoot: string) {
  return path.join(directiveRoot, "control", "state", "coordination-ledger.json");
}

function readLedger(ledgerPath: string): CoordinationLedger {
  if (!fs.existsSync(ledgerPath)) {
    return { version: 1, maxEntries: MAX_LEDGER_ENTRIES, entries: [] };
  }
  return readJson<CoordinationLedger>(ledgerPath);
}

function buildLedgerEntry(
  report: ReadOnlyLifecycleCoordinationReport,
  snapshotAt: string,
): CoordinationLedgerEntry {
  return {
    snapshotAt,
    totalLiveCases: report.summary.totalLiveCases,
    topPressureBucket: report.topCoordinationPressure?.bucketId ?? null,
    bucketCounts: { ...report.summary.bucketCounts },
    caseStates: report.liveCases.map((entry) => ({
      candidateId: entry.candidateId,
      bucketId: entry.bucketId,
      currentStage: entry.currentStage,
    })),
  };
}

function computeStaleCases(
  currentEntry: CoordinationLedgerEntry,
  previousEntries: CoordinationLedgerEntry[],
): StaleCaseSignal[] {
  if (previousEntries.length === 0) return [];

  const staleSignals: StaleCaseSignal[] = [];

  for (const currentCase of currentEntry.caseStates) {
    let consecutiveCount = 1;
    let firstSeenAt = currentEntry.snapshotAt;

    for (let i = previousEntries.length - 1; i >= 0; i--) {
      const prevEntry = previousEntries[i]!;
      const prevCase = prevEntry.caseStates.find(
        (c) => c.candidateId === currentCase.candidateId,
      );
      if (prevCase && prevCase.bucketId === currentCase.bucketId) {
        consecutiveCount++;
        firstSeenAt = prevEntry.snapshotAt;
      } else {
        break;
      }
    }

    if (consecutiveCount >= STALE_CONSECUTIVE_THRESHOLD) {
      staleSignals.push({
        candidateId: currentCase.candidateId,
        bucketId: currentCase.bucketId,
        consecutiveChecks: consecutiveCount,
        firstSeenAt,
        lastSeenAt: currentEntry.snapshotAt,
      });
    }
  }

  return staleSignals.sort((a, b) => b.consecutiveChecks - a.consecutiveChecks);
}

function computeCadenceDrift(
  currentSnapshotAt: string,
  previousEntries: CoordinationLedgerEntry[],
): CadenceDriftSignal {
  if (previousEntries.length === 0) {
    return {
      lastCheckAt: null,
      currentCheckAt: currentSnapshotAt,
      hoursSinceLastCheck: null,
      cadenceDriftDetected: false,
    };
  }

  const lastEntry = previousEntries[previousEntries.length - 1]!;
  const lastTime = new Date(lastEntry.snapshotAt).getTime();
  const currentTime = new Date(currentSnapshotAt).getTime();
  const hoursSince = Math.round(((currentTime - lastTime) / (1000 * 60 * 60)) * 10) / 10;

  return {
    lastCheckAt: lastEntry.snapshotAt,
    currentCheckAt: currentSnapshotAt,
    hoursSinceLastCheck: hoursSince,
    cadenceDriftDetected: hoursSince > CADENCE_DRIFT_THRESHOLD_HOURS,
  };
}

function computeCaseDiff(
  currentEntry: CoordinationLedgerEntry,
  previousEntries: CoordinationLedgerEntry[],
): { newCases: string[]; resolvedCases: string[] } {
  if (previousEntries.length === 0) {
    return {
      newCases: currentEntry.caseStates.map((c) => c.candidateId),
      resolvedCases: [],
    };
  }

  const lastEntry = previousEntries[previousEntries.length - 1]!;
  const previousIds = new Set(lastEntry.caseStates.map((c) => c.candidateId));
  const currentIds = new Set(currentEntry.caseStates.map((c) => c.candidateId));

  return {
    newCases: currentEntry.caseStates
      .filter((c) => !previousIds.has(c.candidateId))
      .map((c) => c.candidateId),
    resolvedCases: lastEntry.caseStates
      .filter((c) => !currentIds.has(c.candidateId))
      .map((c) => c.candidateId),
  };
}

// --- Main functions ---

export function buildBoundedPersistentCoordinationReport(input?: {
  directiveRoot?: string;
  snapshotAt?: string;
  dryRun?: boolean;
}): BoundedPersistentCoordinationReport {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  const snapshotAt = input?.snapshotAt ?? new Date().toISOString();
  const ledgerPath = getLedgerPath(directiveRoot);
  const ledger = readLedger(ledgerPath);

  const lifecycleReport = buildReadOnlyLifecycleCoordinationReport({
    directiveRoot,
    snapshotAt,
  });

  const currentEntry = buildLedgerEntry(lifecycleReport, snapshotAt);
  const previousEntries = ledger.entries;

  const staleCases = computeStaleCases(currentEntry, previousEntries);
  const cadenceDrift = computeCadenceDrift(snapshotAt, previousEntries);
  const caseDiff = computeCaseDiff(currentEntry, previousEntries);

  if (!input?.dryRun) {
    ledger.entries.push(currentEntry);

    if (ledger.entries.length > ledger.maxEntries) {
      ledger.entries = ledger.entries.slice(-ledger.maxEntries);
    }

    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  }

  return {
    ok: true,
    checkerId: CHECKER_ID,
    snapshotAt,
    mode: "bounded_persistent_coordination",
    guardrails: {
      mutatesQueueOrStateTruth: false,
      autoAdvancesWorkflow: false,
      bypassesApproval: false,
      impliesHostIntegration: false,
      impliesRuntimeExecution: false,
      impliesPromotionAutomation: false,
      onlyWritesOwnLedger: true,
    },
    persistenceSignals: {
      staleCases,
      cadenceDrift,
      newCases: caseDiff.newCases,
      resolvedCases: caseDiff.resolvedCases,
      totalPreviousChecks: previousEntries.length,
    },
    upstreamReport: {
      totalLiveCases: lifecycleReport.summary.totalLiveCases,
      recommendTaskCount: lifecycleReport.summary.recommendTaskCount,
      parkedCount: lifecycleReport.summary.parkedCount,
      stopCount: lifecycleReport.summary.stopCount,
      topPressureBucket: lifecycleReport.topCoordinationPressure?.bucketId ?? null,
    },
    ledgerPath: path.relative(directiveRoot, ledgerPath).replace(/\\/g, "/"),
    ledgerEntryCount: input?.dryRun ? previousEntries.length : previousEntries.length + 1,
  };
}

export function readCoordinationLedger(input?: {
  directiveRoot?: string;
}): CoordinationLedger {
  const directiveRoot = normalizeAbsolutePath(input?.directiveRoot || getDefaultDirectiveWorkspaceRoot());
  return readLedger(getLedgerPath(directiveRoot));
}
