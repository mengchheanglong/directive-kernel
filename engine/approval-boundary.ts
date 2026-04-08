/// <reference types="node" />

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDirectiveWorkspaceState } from "./state/index.ts";

export function normalizeDirectiveWorkspaceRoot(directiveRoot?: string) {
  const root = directiveRoot
    ? path.resolve(directiveRoot)
    : fileURLToPath(new URL("../", import.meta.url));
  return root.replace(/\\/g, "/");
}

export function requireDirectiveString(value: string | null | undefined, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_input: ${fieldName} is required`);
  }
  return value.trim();
}

export function resolveDirectiveWorkspaceRelativePath(
  directiveRoot: string,
  inputPath: string,
  fieldName: string,
) {
  const normalizedInput = requireDirectiveString(inputPath, fieldName).replace(/\\/g, "/");
  const root = path.resolve(directiveRoot);
  const absolutePath = path.isAbsolute(normalizedInput)
    ? path.resolve(normalizedInput)
    : path.resolve(root, normalizedInput);
  const normalizedRootPrefix = `${root}${path.sep}`;

  if (absolutePath !== root && !absolutePath.startsWith(normalizedRootPrefix)) {
    throw new Error(`invalid_input: ${fieldName} must stay within directive-workspace`);
  }

  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

export function requireDirectiveExplicitApproval(input: {
  approved?: boolean;
  action: string;
}) {
  if (input.approved !== true) {
    throw new Error(`invalid_input: explicit approval is required to ${input.action}`);
  }
}

export function normalizeDirectiveApprovalActor(actor: string | null | undefined) {
  return String(actor || "directive-frontend-operator").trim()
    || "directive-frontend-operator";
}

export function requireDirectiveEligibleStatus(input: {
  subject: string;
  currentStatus: string;
  allowedStatuses: string[];
  action: string;
}) {
  if (!input.allowedStatuses.includes(input.currentStatus)) {
    throw new Error(
      `invalid_input: ${input.subject} cannot ${input.action} from current status "${input.currentStatus}"`,
    );
  }
}

export function requireDirectiveIntegrityForOpening(input: {
  directiveRoot: string;
  artifactPath: string;
  subject: string;
}) {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot: input.directiveRoot,
    artifactPath: input.artifactPath,
    includeAnchors: false,
  }).focus;

  if (!resolved || resolved.integrityState !== "ok") {
    throw new Error(
      `invalid_input: ${input.subject} must resolve cleanly through the shared anchor before opening downstream work`,
    );
  }

  return resolved;
}

function directiveStageSelectorMatches(currentStage: string, selector: string) {
  return selector.endsWith(".")
    ? currentStage.startsWith(selector)
    : currentStage === selector;
}

export function isDirectiveCurrentStageEligibleForOpening(input: {
  directiveRoot: string;
  artifactPath: string;
  allowedCurrentStages: string[];
}) {
  try {
    const resolved = requireDirectiveIntegrityForOpening({
      directiveRoot: input.directiveRoot,
      artifactPath: input.artifactPath,
      subject: "opening candidate artifact",
    });
    return input.allowedCurrentStages.some((selector) =>
      directiveStageSelectorMatches(resolved.currentStage, selector)
    );
  } catch {
    return false;
  }
}

export function requireDirectiveCurrentStageForOpening(input: {
  directiveRoot: string;
  artifactPath: string;
  subject: string;
  allowedCurrentStages: string[];
}) {
  const resolved = requireDirectiveIntegrityForOpening(input);
  const allowed = input.allowedCurrentStages.some((selector) =>
    directiveStageSelectorMatches(resolved.currentStage, selector)
  );
  if (!allowed) {
    throw new Error(
      `invalid_input: ${input.subject} cannot open downstream work from a stale artifact because the live current stage is "${resolved.currentStage}" and the current head is "${resolved.currentHead.artifactPath}" (${resolved.currentHead.artifactStage})`,
    );
  }
  return resolved;
}

export function writeDirectiveArtifactIfMissing(input: {
  absolutePath: string;
  content: string;
}) {
  const created = !fs.existsSync(input.absolutePath);
  if (created) {
    fs.mkdirSync(path.dirname(input.absolutePath), { recursive: true });
    fs.writeFileSync(input.absolutePath, input.content, "utf8");
  }
  return created;
}
