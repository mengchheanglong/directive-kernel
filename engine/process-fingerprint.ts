import crypto from "node:crypto";
import type {
  DirectiveEngineMissionContext,
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "./types.ts";

function normalizeFingerprintText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

let processFingerprintCache = new WeakMap<DirectiveEngineRunRecord, string>();
const processFingerprintCacheStats = {
  hits: 0,
  misses: 0,
};

export function readDirectiveEngineProcessFingerprintCacheStats() {
  return {
    hits: processFingerprintCacheStats.hits,
    misses: processFingerprintCacheStats.misses,
  };
}

export function resetDirectiveEngineProcessFingerprintCache(input?: {
  clearCache?: boolean;
}) {
  processFingerprintCacheStats.hits = 0;
  processFingerprintCacheStats.misses = 0;
  if (input?.clearCache) {
    processFingerprintCache = new WeakMap<DirectiveEngineRunRecord, string>();
  }
}

export function deriveProcessFingerprint(input: {
  source: DirectiveEngineSourceItem;
  mission: DirectiveEngineMissionContext;
}) {
  return crypto.createHash("sha256").update(JSON.stringify({
    sourceType: input.source.sourceType,
    sourceRef: normalizeFingerprintText(input.source.sourceRef),
    summary: normalizeFingerprintText(input.source.summary),
    missionAlignmentHint: normalizeFingerprintText(input.source.missionAlignmentHint),
    capabilityGapId: normalizeFingerprintText(input.source.capabilityGapId),
    primaryAdoptionTarget: input.source.primaryAdoptionTarget ?? null,
    containsExecutableCode: input.source.containsExecutableCode ?? null,
    containsWorkflowPattern: input.source.containsWorkflowPattern ?? null,
    improvesDirectiveWorkspace: input.source.improvesDirectiveWorkspace ?? null,
    workflowBoundaryShape: input.source.workflowBoundaryShape ?? null,
    missionId: normalizeFingerprintText(input.mission.missionId),
    currentObjective: normalizeFingerprintText(input.mission.currentObjective),
    usefulnessSignals: input.mission.usefulnessSignals.map((value) => normalizeFingerprintText(value)),
    capabilityLanes: input.mission.capabilityLanes.map((value) => normalizeFingerprintText(value)),
    constraints: input.mission.constraints.map((value) => normalizeFingerprintText(value)),
    successSignal: normalizeFingerprintText(input.mission.successSignal),
    adoptionTarget: normalizeFingerprintText(input.mission.adoptionTarget),
  })).digest("hex");
}

export function recordMatchesProcessFingerprint(input: {
  record: DirectiveEngineRunRecord;
  fingerprint: string;
}) {
  const cachedFingerprint = processFingerprintCache.get(input.record);
  if (cachedFingerprint) {
    processFingerprintCacheStats.hits += 1;
    return cachedFingerprint === input.fingerprint;
  }
  processFingerprintCacheStats.misses += 1;
  const derivedFingerprint = deriveProcessFingerprint({
    source: input.record.source,
    mission: input.record.mission,
  });
  processFingerprintCache.set(input.record, derivedFingerprint);
  return derivedFingerprint === input.fingerprint;
}
