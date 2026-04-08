import fs from "node:fs";
import path from "node:path";
import { readUtf8 } from "./file-io.ts";
import { normalizeAbsolutePath } from "./path-normalization.ts";
import { resolveDirectiveWorkspaceRoot } from "./workspace-root.ts";

export const DIRECTIVE_GOAL_FILENAME = "DIRECTIVE_GOAL.md";

export type DirectiveGoalEnvelope = {
  goalId: string;
  goalStatement: string;
  whyNow: string;
  adoptionTarget: string;
  constraints: string[];
  successSignal: string;
  sourcePath: string;
  rawMarkdown: string;
};

export type ResolvedDirectiveGoalEnvelope =
  | {
      ok: true;
      source: "directive_goal_md";
      path: string;
      goal: DirectiveGoalEnvelope;
    }
  | {
      ok: false;
      source: "missing_or_invalid_directive_goal";
      path: string;
      reason: string;
      fallbackMode: "per_request_goal_input";
      missingFields: string[];
    };

type DirectiveGoalTemplateOptions = {
  goalId?: string;
  goalStatement?: string;
  whyNow?: string;
  adoptionTarget?: string;
  constraints?: string[];
  successSignal?: string;
};

export function resolveDirectiveGoalFilePath(directiveRoot?: string) {
  return normalizeAbsolutePath(
    path.resolve(resolveDirectiveWorkspaceRoot(directiveRoot), DIRECTIVE_GOAL_FILENAME),
  );
}

export function renderDirectiveGoalTemplate(
  options: DirectiveGoalTemplateOptions = {},
) {
  const constraints = options.constraints ?? [
    "stay bounded",
    "keep review explicit",
  ];

  return `# Directive Goal

Keep the current host-project goal here.

Directive Kernel should read this file as the human-facing goal source of truth, then normalize it into the goal envelope described in \`shared/contracts/directive-kernel-goal-input.md\`.

If this file is missing, hosts should fall back to per-request goal input and keep Discovery review-first or queue-only until a stable goal resolver exists.

## Goal ID

${options.goalId ?? "project-current-goal"}

## Goal Statement

${options.goalStatement ?? "Improve the host project's active product direction with one bounded useful capability or one bounded engine improvement."}

## Why Now

${options.whyNow ?? "Current delivery pressure or an explicit operator request makes this goal worth pursuing now."}

## Adoption Target

${options.adoptionTarget ?? "runtime"}

## Constraints

${constraints.map((item) => `- ${item}`).join("\n")}

## Success Signal

${options.successSignal ?? "One bounded result is materially clearer, more reusable, or more adoptable than before without weakening review discipline."}
`;
}

function extractSection(markdown: string, heading: string) {
  const lines = markdown.split(/\r?\n/u);
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);

  if (startIndex === -1) {
    return "";
  }

  const body: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) {
      break;
    }
    body.push(line);
  }

  return body.join("\n").trim();
}

function parseConstraintList(sectionBody: string) {
  return sectionBody
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /u, "").trim())
    .filter((line) => line.length > 0);
}

export function parseDirectiveGoalMarkdown(
  markdown: string,
  sourcePath = DIRECTIVE_GOAL_FILENAME,
): ResolvedDirectiveGoalEnvelope {
  const goalId = extractSection(markdown, "Goal ID");
  const goalStatement = extractSection(markdown, "Goal Statement");
  const whyNow = extractSection(markdown, "Why Now");
  const adoptionTarget = extractSection(markdown, "Adoption Target");
  const constraints = parseConstraintList(extractSection(markdown, "Constraints"));
  const successSignal = extractSection(markdown, "Success Signal");

  const missingFields = [
    goalId ? null : "Goal ID",
    goalStatement ? null : "Goal Statement",
    whyNow ? null : "Why Now",
    adoptionTarget ? null : "Adoption Target",
    constraints.length > 0 ? null : "Constraints",
    successSignal ? null : "Success Signal",
  ].filter((entry): entry is string => Boolean(entry));

  if (missingFields.length > 0) {
    return {
      ok: false,
      source: "missing_or_invalid_directive_goal",
      path: sourcePath,
      reason: `DIRECTIVE_GOAL.md is missing required sections: ${missingFields.join(", ")}`,
      fallbackMode: "per_request_goal_input",
      missingFields,
    };
  }

  return {
    ok: true,
    source: "directive_goal_md",
    path: sourcePath,
    goal: {
      goalId,
      goalStatement,
      whyNow,
      adoptionTarget,
      constraints,
      successSignal,
      sourcePath,
      rawMarkdown: markdown,
    },
  };
}

export function readDirectiveGoalEnvelope(
  directiveRoot?: string,
): ResolvedDirectiveGoalEnvelope {
  const goalPath = resolveDirectiveGoalFilePath(directiveRoot);
  if (!fs.existsSync(goalPath)) {
    return {
      ok: false,
      source: "missing_or_invalid_directive_goal",
      path: goalPath,
      reason:
        "DIRECTIVE_GOAL.md does not exist. Fall back to per-request goal input and keep Discovery review-first or queue-only until a stable goal resolver exists.",
      fallbackMode: "per_request_goal_input",
      missingFields: ["DIRECTIVE_GOAL.md"],
    };
  }

  return parseDirectiveGoalMarkdown(readUtf8(goalPath), goalPath);
}
