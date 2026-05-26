import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DiscoverySubmissionRequest } from "../../discovery/lib/front-door/submission-router.ts";
import { readJson, writeJson } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";
import {
  runFirstHostIntegrationFlow,
  type FirstHostGoalEnvelopeInput,
  type RunFirstHostIntegrationFlowResult,
} from "../integration-kit/lib/first-host-integration.ts";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_SOURCE_RELATIVE_PATH = path.join(
  "..",
  "integration-kit",
  "examples",
  "discovery-submission-front-door.json",
);

export type StandaloneHostTryCommandOptions = {
  outputRoot?: string | null;
  receivedAt?: string | null;
  /** Injection seam used only by tests. */
  sampleSourcePath?: string | null;
};

export type StandaloneHostTryCommandResult = {
  directiveRoot: string;
  directiveGoalPath: string;
  sampleSourcePath: string;
  candidateId: string;
  laneId: string;
  runId: string;
  artifactAbsolutePath: string;
  artifactRelativePath: string;
  flow: RunFirstHostIntegrationFlowResult;
};

type SampleSourceFile = {
  candidate_id: string;
  candidate_name: string;
  source_type?: DiscoverySubmissionRequest["source_type"];
  source_reference: string;
  mission_alignment?: string;
  capability_gap_id?: string | null;
  notes?: string | null;
  primary_adoption_target?: DiscoverySubmissionRequest["primary_adoption_target"];
  contains_workflow_pattern?: boolean | null;
  improves_directive_workspace?: boolean | null;
  workflow_boundary_shape?: DiscoverySubmissionRequest["workflow_boundary_shape"];
};

function buildInlineGoalEnvelope(): FirstHostGoalEnvelopeInput {
  return {
    goalId: "directive-kernel-try",
    goalStatement:
      "Demonstrate the Directive Kernel end-to-end by routing one sample source through Discovery and the engine.",
    whyNow:
      "A new contributor wants to confirm the kernel works on this machine before learning the model.",
    adoptionTarget: "architecture",
    constraints: [
      "stay bounded",
      "keep review explicit",
    ],
    successSignal:
      "One sample source produces a kernel-owned engine run record without manual configuration.",
  };
}

function readSampleSource(filePath: string): SampleSourceFile {
  return readJson<SampleSourceFile>(filePath);
}

export async function runStandaloneHostTryCommand(
  options: StandaloneHostTryCommandOptions = {},
): Promise<StandaloneHostTryCommandResult> {
  const sampleSourcePath = normalizeAbsolutePath(
    options.sampleSourcePath ?? path.resolve(MODULE_DIR, SAMPLE_SOURCE_RELATIVE_PATH),
  );
  if (!fs.existsSync(sampleSourcePath)) {
    throw new Error(
      `Sample source not found at ${sampleSourcePath}. The kernel cannot run the try command without it.`,
    );
  }

  const directiveRoot = normalizeAbsolutePath(
    options.outputRoot ?? path.resolve(os.tmpdir(), `directive-kernel-try-${Date.now()}`),
  );
  fs.mkdirSync(directiveRoot, { recursive: true });

  const goal = buildInlineGoalEnvelope();
  const sample = readSampleSource(sampleSourcePath);

  // The intake queue writer rejects any submission whose capability_gap_id does
  // not appear in the unresolved-gaps set. The sample source declares one, so
  // seed discovery/capability-gaps.json BEFORE runFirstHostIntegrationFlow's
  // prepare step runs. The prepare step only writes the default empty file if
  // capability-gaps.json does not already exist, so this seeded file survives.
  if (sample.capability_gap_id) {
    const capabilityGapsPath = path.join(directiveRoot, "discovery", "capability-gaps.json");
    if (!fs.existsSync(capabilityGapsPath)) {
      const detectedAt = (options.receivedAt ?? new Date().toISOString().slice(0, 10)).trim();
      writeJson(capabilityGapsPath, {
        gaps: [
          {
            gap_id: sample.capability_gap_id,
            description: "Sample capability gap from the kernel try command quickstart.",
            priority: "medium",
            related_mission_objective: goal.goalStatement,
            current_state:
              "The kernel try command needs an unresolved gap to satisfy intake-queue validation.",
            desired_state:
              "The sample source routes through Discovery without manual gap configuration.",
            detected_at: /^\d{4}-\d{2}-\d{2}$/.test(detectedAt)
              ? `${detectedAt}T00:00:00.000Z`
              : detectedAt,
            resolved_at: null,
            resolution_notes: null,
          },
        ],
      });
    }
  }

  const flow = await runFirstHostIntegrationFlow({
    directiveRoot,
    goal,
    source: {
      candidateId: sample.candidate_id,
      candidateName: sample.candidate_name,
      sourceType: sample.source_type,
      sourceReference: sample.source_reference,
      summary:
        sample.mission_alignment
        ?? sample.notes
        ?? "Sample source pack from integration kit.",
      notes: sample.notes ?? null,
      capabilityGapId: sample.capability_gap_id ?? null,
      primaryAdoptionTarget: sample.primary_adoption_target,
      containsWorkflowPattern: sample.contains_workflow_pattern ?? null,
      improvesDirectiveWorkspace: sample.improves_directive_workspace ?? null,
      workflowBoundaryShape: sample.workflow_boundary_shape,
      missionAlignment: sample.mission_alignment ?? null,
    },
    receivedAt: options.receivedAt ?? undefined,
  });

  return {
    directiveRoot,
    directiveGoalPath: normalizeAbsolutePath(path.join(directiveRoot, "DIRECTIVE_GOAL.md")),
    sampleSourcePath,
    candidateId: flow.request.candidate_id,
    laneId: flow.submission.engine.record.selectedLane.laneId,
    runId: flow.submission.engine.record.runId,
    artifactAbsolutePath: flow.submission.engine.recordPath,
    artifactRelativePath: flow.submission.engine.recordRelativePath,
    flow,
  };
}

export function formatTryCommandOutput(
  result: StandaloneHostTryCommandResult,
): string {
  const lines = [
    `Created temp directive root: ${result.directiveRoot}`,
    `Wrote DIRECTIVE_GOAL.md`,
    `Submitted sample source: ${result.candidateId}`,
    `Engine routed to: ${result.laneId}`,
    `Run ID: ${result.runId}`,
    `Artifact: ${result.artifactAbsolutePath}`,
    ``,
    `Next step:`,
    `  pnpm web:serve --directive-root ${result.directiveRoot}`,
  ];
  return lines.join("\n");
}
