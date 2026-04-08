import fs from "node:fs";
import path from "node:path";

import { resolveDirectiveWorkspaceRelativePath } from "../../engine/approval-boundary.ts";
import { requireDirectiveString } from "../../engine/approval-boundary.ts";

export function normalizeRuntimeOpenerRelativePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

export function readRuntimeOpenerUtf8(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

export function readRuntimeOpenerJson<T>(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function extractRuntimeOpenerOptionalBulletValue(markdown: string, label: string) {
  const prefix = `- ${label}:`;
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(prefix));
  if (!line) {
    return null;
  }

  return line
    .trim()
    .replace(prefix, "")
    .trim()
    .replace(/^`|`$/g, "");
}

export function extractRuntimeOpenerMarkdownTitle(markdown: string, subject: string) {
  return requireDirectiveString(
    markdown
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("# "))
      ?.replace(/^# /, ""),
    subject,
  );
}

export function extractRuntimeOpenerRequiredBulletValue(
  markdown: string,
  label: string,
  missingMessage: string,
) {
  const prefix = `- ${label}:`;
  const line = markdown
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(prefix));
  if (!line) {
    throw new Error(missingMessage);
  }

  return line
    .trim()
    .replace(prefix, "")
    .trim()
    .replace(/^`|`$/g, "");
}

export function extractRuntimeOpenerBulletList(
  markdown: string,
  label: string,
  options?: { missingMessage?: string },
) {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((entry) => entry.trim() === `- ${label}:`);
  if (startIndex === -1) {
    if (options?.missingMessage) {
      throw new Error(options.missingMessage);
    }
    return [] as string[];
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("  - ")) {
      break;
    }
    const normalized = line.replace(/^  - /, "").trim().replace(/^`|`$/g, "");
    if (normalized) {
      values.push(normalized);
    }
  }
  return values;
}

export function readDirectiveRuntimeRoutingBackfillCompat(input: {
  directiveRoot: string;
  routingPath: string;
  extractRequiredBulletValue: (markdown: string, label: string) => string;
}) {
  const routingRelativePath = resolveDirectiveWorkspaceRelativePath(
    input.directiveRoot,
    input.routingPath,
    "routingPath",
  );
  const routingAbsolutePath = path.resolve(input.directiveRoot, routingRelativePath).replace(/\\/g, "/");
  const content = readRuntimeOpenerUtf8(routingAbsolutePath);

  return {
    sourceType: input.extractRequiredBulletValue(content, "Source type"),
    linkedIntakeRecord: input.extractRequiredBulletValue(content, "Linked intake record"),
    linkedTriageRecord: extractRuntimeOpenerOptionalBulletValue(content, "Linked triage record"),
    routingRelativePath,
    engineRunRecordPath: null,
    engineRunReportPath: null,
  };
}

export function readDirectiveRuntimeRoutingBackfillCompatWithDecisionState(input: {
  directiveRoot: string;
  routingPath: string;
  extractRequiredBulletValue: (markdown: string, label: string) => string;
}) {
  const routing = readDirectiveRuntimeRoutingBackfillCompat(input);
  const content = readRuntimeOpenerUtf8(
    path.resolve(input.directiveRoot, routing.routingRelativePath).replace(/\\/g, "/"),
  );

  return {
    ...routing,
    decisionState: input.extractRequiredBulletValue(content, "Decision state"),
  };
}
