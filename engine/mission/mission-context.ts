import {
  type DirectiveEngineMissionContext,
  type DirectiveEngineMissionInput,
} from "../types.ts";
import { normalizeText } from "../engine-source-utils.ts";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSectionBody(markdown: string, heading: string) {
  const pattern = new RegExp(
    `^## ${escapeRegex(heading)}\\r?\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`,
    "m",
  );
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function parseMissionMarkdown(markdown: string) {
  const currentObjective = (
    getSectionBody(markdown, "Current Objective")
    || getSectionBody(markdown, "Goal Statement")
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  const usefulnessSignals = getSectionBody(
    markdown,
    "What Usefulness Means Under This Objective",
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const capabilityLanes = getSectionBody(markdown, "Capability Lanes That Matter Most")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const constraints = getSectionBody(markdown, "Constraints")
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line));
  const successSignal = getSectionBody(markdown, "Success Signal")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line))
    .join(" ");
  const adoptionTarget = getSectionBody(markdown, "Adoption Target")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/not provided/i.test(line))
    .join(" ");

  return {
    currentObjective,
    usefulnessSignals,
    capabilityLanes,
    constraints,
    successSignal,
    adoptionTarget,
  };
}

function buildMissionMarkdown(input: DirectiveEngineMissionInput) {
  const objective =
    normalizeText(input.currentObjective) || "Mission objective not provided.";
  const usefulnessSignals = (input.usefulnessSignals ?? []).filter(Boolean);
  const capabilityLanes = (input.capabilityLanes ?? []).filter(Boolean);
  const constraints = (input.constraints ?? []).filter(Boolean);
  const successSignal = normalizeText(input.successSignal);
  const adoptionTarget = normalizeText(input.adoptionTarget);

  return [
    "# Active Mission",
    "",
    "## Current Objective",
    "",
    objective,
    "",
    "## Adoption Target",
    "",
    adoptionTarget || "Adoption target not provided.",
    "",
    "## What Usefulness Means Under This Objective",
    "",
    ...(usefulnessSignals.length > 0
      ? usefulnessSignals.map((signal) => `- ${signal}`)
      : ["- Mission usefulness signals not provided."]),
    "",
    "## Capability Lanes That Matter Most",
    "",
    ...(capabilityLanes.length > 0
      ? capabilityLanes.map((lane, index) => `${index + 1}. ${lane}`)
      : ["1. Capability lanes not provided."]),
    "",
    "## Constraints",
    "",
    ...(constraints.length > 0
      ? constraints.map((constraint) => `- ${constraint}`)
      : ["- Constraints not provided."]),
    "",
    "## Success Signal",
    "",
    successSignal || "Success signal not provided.",
  ].join("\n");
}

export function resolveMissionContext(
  input: DirectiveEngineMissionInput,
): DirectiveEngineMissionContext {
  const activeMissionMarkdown =
    normalizeText(input.activeMissionMarkdown) || buildMissionMarkdown(input);
  const parsed = parseMissionMarkdown(activeMissionMarkdown);

  return {
    missionId: normalizeText(input.missionId) || null,
    currentObjective:
      normalizeText(input.currentObjective) || parsed.currentObjective,
    usefulnessSignals:
      (input.usefulnessSignals ?? []).filter(Boolean).length > 0
        ? (input.usefulnessSignals ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.usefulnessSignals,
    capabilityLanes:
      (input.capabilityLanes ?? []).filter(Boolean).length > 0
        ? (input.capabilityLanes ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.capabilityLanes,
    constraints:
      (input.constraints ?? []).filter(Boolean).length > 0
        ? (input.constraints ?? []).map((value) => normalizeText(value)).filter(Boolean)
        : parsed.constraints,
    successSignal:
      normalizeText(input.successSignal) || parsed.successSignal || null,
    adoptionTarget:
      normalizeText(input.adoptionTarget) || parsed.adoptionTarget || null,
    activeMissionMarkdown,
  };
}
