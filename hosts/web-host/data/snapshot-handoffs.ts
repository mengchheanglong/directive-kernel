import fs from "node:fs";
import path from "node:path";

import { normalizeRelativePath } from "../../../shared/lib/path-normalization.ts";
import {
  readArchitectureHandoffArtifact,
  type ArchitectureHandoffArtifact,
} from "../../../architecture/lib/experiments/handoff-start.ts";
import { resolveDirectiveWorkspaceState } from "../../../engine/state/index.ts";

export type FrontendHandoffStub = {
  kind:
    | "architecture_handoff"
    | "architecture_handoff_invalid"
    | "runtime_follow_up"
    | "runtime_follow_up_legacy"
    | "runtime_handoff_legacy";
  lane: "architecture" | "runtime";
  relativePath: string;
  candidateId: string;
  title: string;
  status: string;
  startRelativePath: string | null;
  warning: string | null;
};

type FrontendHandoffDetailReader = (input: {
  directiveRoot: string;
  relativePath: string;
}) =>
  | { ok: false; error: string; relativePath: string }
  | { ok: true; kind: string; candidateId?: string; title?: string };

export function deriveLegacyRuntimeFollowUpCandidateName(title: string) {
  return title
    .replace(/^CLI-Anything Runtime Follow-up Record:\s*/u, "")
    .replace(/^Runtime Follow-up Record:\s*/u, "")
    .replace(/\s+Runtime Follow-up\s*$/u, "")
    .trim();
}

export function isLegacyRuntimeFollowUpRelativePath(relativePath: string) {
  return relativePath.startsWith("runtime/00-follow-up/")
    && (
      relativePath.endsWith("-runtime-follow-up-record.md")
      || relativePath.endsWith("-runtime-followup.md")
    );
}

export function deriveLegacyRuntimeFollowUpCandidateId(fileNameOrPath: string) {
  return fileNameOrPath
    .replace(/-(runtime-follow-up-record|runtime-followup)\.md$/u, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/u, "");
}

export function extractMarkdownSectionSummary(markdown: string, heading: string) {
  const lines = markdown.split(/\r?\n/);
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (startIndex === -1) {
    return "";
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (!trimmed) {
      continue;
    }
    values.push(trimmed.replace(/^- /u, "").trim());
  }

  return values.join(" ").trim();
}

export function deriveLegacyRuntimeHandoffCandidateName(title: string) {
  return title
    .replace(/^Architecture to Runtime Handoff:\s*/u, "")
    .trim();
}

export function readRuntimeFollowUpStubs(input: {
  directiveRoot: string;
  maxEntries?: number;
  readHandoffDetail: FrontendHandoffDetailReader;
}): FrontendHandoffStub[] {
  const followUpRoot = path.join(input.directiveRoot, "runtime", "00-follow-up");
  if (!fs.existsSync(followUpRoot)) {
    return [];
  }

  return fs
    .readdirSync(followUpRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isLegacyRuntimeFollowUpRelativePath(
      normalizeRelativePath(path.join("runtime", "00-follow-up", entry.name)),
    ))
    .sort((left, right) => right.name.localeCompare(left.name))
    .slice(0, Math.max(1, input.maxEntries ?? 20))
    .map((entry) => {
      const relativePath = normalizeRelativePath(path.join("runtime", "00-follow-up", entry.name));
      try {
        const detail = input.readHandoffDetail({
          directiveRoot: input.directiveRoot,
          relativePath,
        });

        if (detail.ok && detail.kind === "runtime_follow_up") {
          const focus = resolveDirectiveWorkspaceState({
            directiveRoot: input.directiveRoot,
            artifactPath: relativePath,
            includeAnchors: false,
          }).focus;
          const liveFollowUpPending =
            focus
            && focus.lane === "runtime"
            && focus.currentStage.startsWith("runtime.follow_up.")
            && focus.currentHead.artifactPath === relativePath;

          return {
            kind: "runtime_follow_up" as const,
            lane: "runtime" as const,
            relativePath,
            candidateId: detail.candidateId ?? deriveLegacyRuntimeFollowUpCandidateId(entry.name),
            title: detail.title || entry.name,
            status: liveFollowUpPending ? "pending_review" : "progressed_downstream",
            startRelativePath: null,
            warning: liveFollowUpPending
              ? null
              : focus
                ? `Live current head is ${focus.currentHead.artifactStage} at ${focus.currentHead.artifactPath}; do not treat this follow-up artifact as a pending review stub.`
                : "Canonical resolver could not confirm this Runtime follow-up as the live pending-review head.",
          };
        }

        if (detail.ok && detail.kind === "runtime_follow_up_legacy") {
          return {
            kind: "runtime_follow_up_legacy" as const,
            lane: "runtime" as const,
            relativePath,
            candidateId: detail.candidateId ?? deriveLegacyRuntimeFollowUpCandidateId(entry.name),
            title: detail.title || entry.name,
            status: "historical_follow_up",
            startRelativePath: null,
            warning: "Historical Runtime follow-up; inspectable only and not part of the current non-executing Legacy Runtime chain.",
          };
        }

        if (!detail.ok) {
          return {
            kind: "runtime_follow_up" as const,
            lane: "runtime" as const,
            relativePath,
            candidateId: deriveLegacyRuntimeFollowUpCandidateId(entry.name),
            title: entry.name,
            status: "invalid_artifact_state",
            startRelativePath: null,
            warning: detail.error || "Runtime follow-up artifact could not be read.",
          };
        }

        return {
          kind: "runtime_follow_up" as const,
          lane: "runtime" as const,
          relativePath,
          candidateId: deriveLegacyRuntimeFollowUpCandidateId(entry.name),
          title: entry.name,
          status: "invalid_artifact_state",
          startRelativePath: null,
          warning: "Unsupported Runtime follow-up artifact shape.",
        };
      } catch (error) {
        return {
          kind: "runtime_follow_up" as const,
          lane: "runtime" as const,
          relativePath,
          candidateId: deriveLegacyRuntimeFollowUpCandidateId(entry.name),
          title: entry.name,
          status: "invalid_artifact_state",
          startRelativePath: null,
          warning: String((error as Error).message || error),
        };
      }
    });
}

export function readLegacyRuntimeHandoffStubs(input: {
  directiveRoot: string;
  maxEntries?: number;
  readHandoffDetail: FrontendHandoffDetailReader;
}): FrontendHandoffStub[] {
  const handoffRoot = path.join(input.directiveRoot, "runtime", "legacy-handoff");
  if (!fs.existsSync(handoffRoot)) {
    return [];
  }

  return fs
    .readdirSync(handoffRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith("-architecture-to-runtime-handoff.md"))
    .sort((left, right) => right.name.localeCompare(left.name))
    .slice(0, Math.max(1, input.maxEntries ?? 20))
    .flatMap((entry) => {
      const relativePath = normalizeRelativePath(path.join("runtime", "legacy-handoff", entry.name));
      const detail = input.readHandoffDetail({
        directiveRoot: input.directiveRoot,
        relativePath,
      });
      if (!detail.ok || detail.kind !== "runtime_handoff_legacy") {
        return [];
      }

      return [{
        kind: "runtime_handoff_legacy" as const,
        lane: "runtime" as const,
        relativePath,
        candidateId: detail.candidateId ?? entry.name.replace(/-architecture-to-runtime-handoff\.md$/u, ""),
        title: detail.title || entry.name,
        status: "historical_handoff",
        startRelativePath: null,
        warning: "Historical Runtime handoff; inspectable only and not part of the current non-executing Legacy Runtime chain.",
      }];
    });
}

export function readArchitectureHandoffStubs(input: {
  directiveRoot: string;
  maxEntries?: number;
}) {
  const experimentsRoot = path.join(input.directiveRoot, "architecture", "01-experiments");
  const maxEntries = Math.max(1, input.maxEntries ?? 20);
  if (!fs.existsSync(experimentsRoot)) {
    return {
      artifacts: [] as ArchitectureHandoffArtifact[],
      stubs: [] as FrontendHandoffStub[],
      warnings: [] as string[],
    };
  }

  const warnings: string[] = [];
  const artifacts: ArchitectureHandoffArtifact[] = [];
  const stubs = fs
    .readdirSync(experimentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith("-engine-handoff.md"))
    .sort((left, right) => right.name.localeCompare(left.name))
    .slice(0, maxEntries)
    .map((entry) => {
      const relativePath = normalizeRelativePath(path.join("architecture", "01-experiments", entry.name));

      try {
        const handoff = readArchitectureHandoffArtifact({
          directiveRoot: input.directiveRoot,
          handoffPath: relativePath,
        });
        artifacts.push(handoff);
        return {
          kind: "architecture_handoff" as const,
          lane: "architecture" as const,
          relativePath: handoff.handoffRelativePath,
          candidateId: handoff.candidateId,
          title: handoff.title,
          status: handoff.status,
          startRelativePath: handoff.startExists ? handoff.startRelativePath : null,
          warning: null,
        };
      } catch (error) {
        const warning = String((error as Error).message || error);
        warnings.push(`${relativePath}: ${warning}`);
        return {
          kind: "architecture_handoff_invalid" as const,
          lane: "architecture" as const,
          relativePath,
          candidateId: entry.name.replace(/-engine-handoff\.md$/u, ""),
          title: entry.name,
          status: "invalid_artifact",
          startRelativePath: null,
          warning,
        };
      }
    });

  return {
    artifacts,
    stubs,
    warnings,
  };
}
