import fs from "node:fs";
import path from "node:path";

import type {
  EngineCapabilityGap,
  EngineMissionContext,
  EngineProcessSourceInput,
} from "../../engine/index.ts";
import { resolveMissionContext } from "../../engine/mission/context.ts";

export function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeUtf8(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

export function buildArchitectureGap(): EngineCapabilityGap {
  return {
    gapId: "gap-arch-routing-clarity",
    description: "Architecture routing clarity and bounded workflow ownership",
    priority: "high",
    relatedMissionObjective: "Improve directive workspace routing workflow architecture boundaries",
    currentState: "Clear architecture candidates still require extra manual routing work",
    desiredState: "High-signal architecture candidates auto-open one bounded downstream stub",
    detectedAt: "2026-04-10T00:00:00.000Z",
  };
}

export function buildArchitectureMission(): EngineMissionContext {
  return resolveMissionContext({
    missionId: "hardening-smoke",
    currentObjective: "Improve directive workspace routing workflow architecture boundaries",
    usefulnessSignals: [
      "prefer engine routing and workflow improvements when the source upgrades directive workspace judgment",
      "prefer bounded architecture ownership for sources that improve directive workspace itself",
    ],
    capabilityLanes: [
      "architecture",
      "discovery",
      "runtime",
    ],
    constraints: [
      "keep review explicit",
      "stay reversible",
      "keep the next change bounded",
    ],
    successSignal: "One bounded routing improvement is materially clearer than before.",
    adoptionTarget: "architecture",
  });
}

export function buildRecurringArchitecturePolicyEvents() {
  return [
    {
      recordedAt: "2026-04-10T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "autonomy-a",
      sourceType: "workflow-writeup",
      decision: "confirm_architecture",
      originalLaneId: "architecture",
      resolvedLaneId: "architecture",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
      rationale: "Architecture workflow routing case cleared after bounded review.",
    },
    {
      recordedAt: "2026-04-11T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "autonomy-b",
      sourceType: "workflow-writeup",
      decision: "confirm_architecture",
      originalLaneId: "architecture",
      resolvedLaneId: "architecture",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["workflow", "architecture", "routing", "engine"],
      rationale: "Architecture workflow routing case cleared after bounded review.",
    },
  ];
}

export function buildRecurringRuntimePolicyEvents() {
  return [
    {
      recordedAt: "2026-04-10T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "runtime-a",
      sourceType: "technical-essay",
      decision: "confirm_runtime",
      originalLaneId: "runtime",
      resolvedLaneId: "runtime",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["runtime", "automation", "performance", "reliability"],
      rationale: "Runtime automation case cleared after bounded review.",
    },
    {
      recordedAt: "2026-04-11T00:00:00.000Z",
      source: "discovery_routing_review" as const,
      candidateId: "runtime-b",
      sourceType: "technical-essay",
      decision: "confirm_runtime",
      originalLaneId: "runtime",
      resolvedLaneId: "runtime",
      originalConfidence: "medium",
      resolvedConfidence: "high",
      originalNeedsHumanReview: true,
      resolvedNeedsHumanReview: false,
      matchedGapId: null,
      missionSpecificityWarning: null,
      goalCopilotWarnings: [],
      followUpRequestedFields: ["source.capabilityGapId"],
      sourceSignalTokens: ["runtime", "automation", "performance", "reliability"],
      rationale: "Runtime automation case cleared after bounded review.",
    },
  ];
}

export function buildArchitectureSourceInput(): EngineProcessSourceInput {
  return {
    receivedAt: "2026-04-10T00:00:00.000Z",
    mission: buildArchitectureMission(),
    gaps: [buildArchitectureGap()],
    source: {
      sourceId: "architecture-auto-open",
      sourceType: "workflow-writeup",
      sourceRef: "https://example.com/architecture-auto-open",
      title: "Architecture Auto-Open Workflow",
      summary: "Improve directive workspace routing workflow architecture boundaries with explicit gates.",
      missionAlignmentHint: "Improve directive workspace routing workflow architecture boundaries",
      capabilityGapId: "gap-arch-routing-clarity",
      primaryAdoptionTarget: "architecture",
      containsWorkflowPattern: true,
      improvesDirectiveWorkspace: true,
      workflowBoundaryShape: "bounded_protocol",
      notes: [
        "Preserve architecture workflow boundaries.",
      ],
    },
  };
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
