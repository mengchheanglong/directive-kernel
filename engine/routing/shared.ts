function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function deriveRecommendedLane(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return (Object.entries(laneScores).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "discovery") as "discovery" | "architecture" | "runtime";
}

function rankLaneScores(
  laneScores: Record<"discovery" | "architecture" | "runtime", number>,
) {
  return Object.entries(laneScores)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    }) as Array<["discovery" | "architecture" | "runtime", number]>;
}

export {
  clampInt,
  deriveRecommendedLane,
  rankLaneScores,
};
