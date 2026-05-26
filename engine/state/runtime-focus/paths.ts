import fs from "node:fs";
import path from "node:path";

import { resolveDirectiveRuntimePromotionSpecificationPath } from "../../../runtime/lib/host/promotion-specification.ts";
import { resolveRuntimeHostSelectionResolutionPath } from "../../../runtime/lib/host/selection-resolution.ts";
import {
  normalizeRelativePath,
  readGenericLegacyRuntimeRegistryArtifact,
} from "../shared-state-helpers.ts";
import { fileExistsInDirectiveWorkspace } from "../../artifact-link-validation.ts";
import { isAcceptedRuntimeRegistryArtifact } from "./readers.ts";

export function inferRuntimeRuntimeCapabilityBoundaryPathFromProof(input: {
  directiveRoot: string;
  runtimeProofRelativePath: string | null | undefined;
}) {
  if (!input.runtimeProofRelativePath) {
    return null;
  }
  if (
    !input.runtimeProofRelativePath.startsWith("runtime/03-proof/")
    || !input.runtimeProofRelativePath.endsWith("-proof.md")
  ) {
    return null;
  }

  const candidatePath = normalizeRelativePath(
    input.runtimeProofRelativePath
      .replace(/^runtime\/03-proof\//u, "runtime/04-capability-boundaries/")
      .replace(/-proof\.md$/u, "-runtime-capability-boundary.md"),
  );

  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

export function inferRuntimePromotionReadinessPathFromCapabilityBoundary(input: {
  directiveRoot: string;
  capabilityBoundaryPath: string | null | undefined;
}) {
  if (!input.capabilityBoundaryPath) {
    return null;
  }
  if (
    !input.capabilityBoundaryPath.startsWith("runtime/04-capability-boundaries/")
    || !input.capabilityBoundaryPath.endsWith("-runtime-capability-boundary.md")
  ) {
    return null;
  }

  const candidatePath = normalizeRelativePath(
    input.capabilityBoundaryPath
      .replace(/^runtime\/04-capability-boundaries\//u, "runtime/05-promotion-readiness/")
      .replace(/-runtime-capability-boundary\.md$/u, "-promotion-readiness.md"),
  );

  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

export function inferRuntimePromotionSpecificationPathFromPromotionReadiness(input: {
  directiveRoot: string;
  promotionReadinessPath: string | null | undefined;
}) {
  if (!input.promotionReadinessPath) {
    return null;
  }
  if (
    !input.promotionReadinessPath.startsWith("runtime/05-promotion-readiness/")
    || !input.promotionReadinessPath.endsWith("-promotion-readiness.md")
  ) {
    return null;
  }

  const candidatePath = resolveDirectiveRuntimePromotionSpecificationPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

export function inferRuntimeHostSelectionResolutionPath(input: {
  directiveRoot: string;
  promotionReadinessPath: string | null | undefined;
}) {
  if (!input.promotionReadinessPath) {
    return null;
  }
  if (
    !input.promotionReadinessPath.includes("promotion-readiness")
    || !input.promotionReadinessPath.endsWith("-promotion-readiness.md")
  ) {
    return null;
  }

  const candidatePath = resolveRuntimeHostSelectionResolutionPath({
    promotionReadinessPath: input.promotionReadinessPath,
  });
  return fileExistsInDirectiveWorkspace(input.directiveRoot, candidatePath) ? candidatePath : null;
}

export function findRuntimePromotionReadinessPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const promotionReadinessDir = path.join(input.directiveRoot, "runtime", "05-promotion-readiness");
  if (!fs.existsSync(promotionReadinessDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(promotionReadinessDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-promotion-readiness.md`)
    )
    .map((entry) => path.join("runtime", "05-promotion-readiness", entry.name).replace(/\\/g, "/"))
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

export function findRuntimePromotionRecordPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const promotionRecordDir = path.join(input.directiveRoot, "runtime", "07-promotion-records");
  if (!fs.existsSync(promotionRecordDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(promotionRecordDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-promotion-record.md`)
    )
    .map((entry) => path.join("runtime", "07-promotion-records", entry.name).replace(/\\/g, "/"))
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

export function findRuntimeRegistryEntryPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const registryDir = path.join(input.directiveRoot, "runtime", "08-registry");
  if (!fs.existsSync(registryDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(registryDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-registry-entry.md`)
    )
    .map((entry) => path.join("runtime", "08-registry", entry.name).replace(/\\/g, "/"))
    .filter((relativePath) => {
      try {
        return isAcceptedRuntimeRegistryArtifact(
          readGenericLegacyRuntimeRegistryArtifact({
            directiveRoot: input.directiveRoot,
            registryEntryPath: relativePath,
          }),
        );
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}

export function findRuntimeStandaloneHostConsumptionReportPathForCandidate(input: {
  directiveRoot: string;
  candidateId: string | null | undefined;
}) {
  const candidateId = input.candidateId?.trim();
  if (!candidateId) {
    return null;
  }

  const reportDir = path.join(
    input.directiveRoot,
    "runtime",
    "standalone-host",
    "host-consumption",
  );
  if (!fs.existsSync(reportDir)) {
    return null;
  }

  const matches = fs
    .readdirSync(reportDir, { withFileTypes: true })
    .filter((entry) =>
      entry.isFile() && entry.name.endsWith(`-${candidateId}-host-consumption-report.json`)
    )
    .map((entry) =>
      path.join("runtime", "standalone-host", "host-consumption", entry.name).replace(/\\/g, "/")
    )
    .sort((left, right) => left.localeCompare(right));

  return matches.at(-1) ?? null;
}
