import type {
  DirectiveEngineRunRecord,
  DirectiveEngineSourceItem,
} from "./types.ts";

export function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function clampInt(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function parseTimestamp(value: string | null | undefined) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function flattenSourceText(source: DirectiveEngineSourceItem) {
  return [
    source.title,
    source.summary ?? "",
    source.sourceRef,
    source.missionAlignmentHint ?? "",
    source.capabilityGapId ?? "",
    source.primaryAdoptionTarget ?? "",
    ...(source.notes ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

export function countTokenOverlap(left: string[], right: Iterable<string>) {
  const rightSet = new Set(right);
  let count = 0;
  for (const token of left) {
    if (rightSet.has(token)) {
      count += 1;
    }
  }
  return count;
}

export function findSharedTokens(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((token) => rightSet.has(token));
}

export function uniqueStrings(
  values: Array<string | null | undefined>,
  normalize?: (value: string) => string,
) {
  const normalizeFn = normalize ?? ((value: string) => value.trim());
  return Array.from(
    new Set(
      values
        .map((value) => normalizeFn(String(value ?? "")))
        .filter(Boolean),
    ),
  );
}

export function isSuccessfulRun(run: DirectiveEngineRunRecord) {
  return run.decision.requiresHumanApproval === false
    && run.decision.decisionState !== "hold_in_discovery";
}

export function isStalledRun(run: DirectiveEngineRunRecord) {
  return run.decision.requiresHumanApproval === true
    || run.decision.decisionState === "hold_in_discovery";
}
