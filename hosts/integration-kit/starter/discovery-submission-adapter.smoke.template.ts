import os from "node:os";
import path from "node:path";

import {
  submitDiscoveryEntryWithHostBridge,
  type DiscoveryHostStorageBridge,
} from "./discovery-submission-adapter.template.ts";
import { createFilesystemDiscoveryHostStorageBridge } from "./discovery-host-storage-bridge.filesystem.template.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/front-door/submission-router.ts";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const starterQueueOnlyRequest: DiscoverySubmissionRequest = {
  candidate_id: "dw-starter-queue-only",
  candidate_name: "Starter Queue-Only Candidate",
  source_type: "internal-signal",
  source_reference: "host://starter/queue-only",
  mission_alignment: "Tests the lowest-friction Discovery entry path in a host adapter.",
  capability_gap_id: null,
  notes: "Starter smoke request for queue-only mode.",
  record_shape: "queue_only",
};

const starterFastPathRequest: DiscoverySubmissionRequest = {
  candidate_id: "dw-starter-fast-path",
  candidate_name: "Starter Fast-Path Candidate",
  source_type: "github-repo",
  source_reference: "https://example.com/starter-fast-path",
  mission_alignment: "Tests bounded routing plus record creation from a host adapter.",
  capability_gap_id: null,
  notes: "Starter smoke request for fast-path mode.",
  record_shape: "fast_path",
  fast_path: {
    record_date: "2026-03-22",
    claimed_value: "Produces a reusable bounded capability with a clear next artifact.",
    first_pass_summary: "Suitable for a fast-path Discovery write in a third-party host.",
    adoption_target: "runtime",
    decision_state: "adopt",
    route_destination: "runtime",
    why_this_route: "Primary value is a reusable runtime lane.",
    why_not_alternatives: "Architecture-only treatment would miss the runtime objective.",
    need_bounded_proof: "Need a bounded proof artifact before promotion.",
    next_artifact: "runtime/00-follow-up/2026-03-22-starter-fast-path-runtime-follow-up-record.md",
  },
};

const starterSplitCaseRequest: DiscoverySubmissionRequest = {
  candidate_id: "dw-starter-split-case",
  candidate_name: "Starter Split-Case Candidate",
  source_type: "paper",
  source_reference: "https://example.com/starter-split-case",
  mission_alignment: "Tests full Discovery intake, triage, and routing generation in a host adapter.",
  capability_gap_id: null,
  notes: "Starter smoke request for split-case mode.",
  record_shape: "split_case",
  case_record: {
    intake: {
      intake_date: "2026-03-22",
      source_type: "paper",
      source_reference: "https://example.com/starter-split-case",
      submitted_by: "starter-host",
      why_it_entered_the_system: "Candidate appears relevant enough for full Discovery treatment.",
      claimed_value: "Potentially improves Directive Workspace operating logic.",
      initial_relevance_to_workspace: "High mission relevance with unclear final runtime form.",
      suspected_adoption_target: "architecture",
    },
    triage: {
      triage_date: "2026-03-22",
      first_pass_summary: "Likely structural value with bounded extraction risk.",
      problem_it_appears_to_solve: "Improves future source adaptation or verification quality.",
      extractable_value_hypothesis: "Durable internal mechanism can become product-owned operating code.",
      routing_recommendation: "Route to Architecture for bounded mechanism extraction.",
      proposed_adoption_target: "architecture",
      stack_shape_summary: "Source is conceptual rather than runtime-ready.",
      boilerplate_vs_product_boundary: "Keep mechanism, exclude presentation baggage.",
      suggested_decision_state: "adopt",
      fit_to_current_direction: "Supports self-improving source adaptation.",
      reusability_across_surfaces: "Likely reusable across Discovery and Architecture.",
      operational_risk: "Low runtime risk because no immediate runtime promotion is proposed.",
      integration_cost: "Moderate bounded extraction effort.",
      can_current_gates_validate_safely: "yes",
      immediate_risks: "Need to avoid source-specific baggage.",
      missing_evidence: "Need one bounded experiment note.",
      next_action: "Create an Architecture experiment record.",
    },
    routing: {
      route_date: "2026-03-22",
      source_type: "paper",
      decision_state: "adopt",
      adoption_target: "architecture",
      route_destination: "architecture",
      why_this_route: "Primary value is reusable internal operating logic.",
      why_not_alternatives: "Runtime would be premature without runtime justification.",
      receiving_track_owner: "directive-workspace",
      required_next_artifact: "architecture/01-experiments/2026-03-22-starter-split-case-slice-01.md",
    },
  },
};

export type DiscoveryStarterSmokeResult = {
  ok: true;
  queueStatuses: Record<string, string>;
  textArtifactPaths: string[];
  jsonArtifactPaths: string[];
};

async function submitStarterRequest(
  bridge: DiscoveryHostStorageBridge,
  request: DiscoverySubmissionRequest,
) {
  return submitDiscoveryEntryWithHostBridge({
    storage: bridge,
    request,
    dryRun: false,
  });
}

export async function runDiscoveryStarterSmoke(): Promise<DiscoveryStarterSmokeResult> {
  const harness = createFilesystemDiscoveryHostStorageBridge({
    directiveRoot: path.resolve(
      os.tmpdir(),
      `directive-workspace-host-starter-${Date.now()}`,
    ),
    receivedAt: "2026-03-22",
    unresolvedGapIds: ["gap-example-starter"],
  });

  const queueOnlyResult = await submitStarterRequest(
    harness.bridge,
    starterQueueOnlyRequest,
  );
  const fastPathResult = await submitStarterRequest(
    harness.bridge,
    starterFastPathRequest,
  );
  const splitCaseResult = await submitStarterRequest(
    harness.bridge,
    starterSplitCaseRequest,
  );

  assertCondition(queueOnlyResult.status === "pending", "queue-only submission must stay pending");
  assertCondition(fastPathResult.status === "routed", "fast-path submission must route immediately");
  assertCondition(splitCaseResult.status === "routed", "split-case submission must route immediately");

  const queue = harness.readQueue() as {
    entries?: Array<{ candidate_id?: string; status?: string }>;
  };
  const entries = queue.entries ?? [];
  const queueStatuses = Object.fromEntries(
    entries
      .filter((entry) => typeof entry.candidate_id === "string")
      .map((entry) => [entry.candidate_id as string, entry.status ?? "unknown"]),
  );

  assertCondition(
    queueStatuses["dw-starter-queue-only"] === "pending",
    "starter smoke must preserve queue-only pending status",
  );
  assertCondition(
    queueStatuses["dw-starter-fast-path"] === "routed",
    "starter smoke must preserve fast-path routed status",
  );
  assertCondition(
    queueStatuses["dw-starter-split-case"] === "routed",
    "starter smoke must preserve split-case routed status",
  );

  const textArtifactPaths = harness.listTextArtifactPaths();
  assertCondition(
    textArtifactPaths.length >= 4,
    "starter smoke must create fast-path plus split-case text artifacts",
  );

  return {
    ok: true,
    queueStatuses,
    textArtifactPaths,
    jsonArtifactPaths: harness.listJsonArtifactPaths(),
  };
}

