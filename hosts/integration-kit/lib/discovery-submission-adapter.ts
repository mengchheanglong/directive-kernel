import path from "node:path";
import type { DiscoveryIntakeQueueDocument } from "../../../discovery/lib/discovery-intake-queue-writer.ts";
import type { DiscoverySubmissionRequest } from "../../../discovery/lib/discovery-submission-router.ts";
import type { DiscoveryFastPathRecordRequest } from "../../../discovery/lib/discovery-fast-path-record-writer.ts";
import type { DiscoveryIntakeTransitionRequest } from "../../../discovery/lib/discovery-intake-queue-transition.ts";
import type { DiscoveryRoutingRecordRequest } from "../../../discovery/lib/discovery-routing-record-writer.ts";
import type { DiscoveryCompletionRecordRequest } from "../../../discovery/lib/discovery-completion-record-writer.ts";
import type { DiscoveryIntakeLifecycleSyncRequest } from "../../../discovery/lib/discovery-intake-lifecycle-sync.ts";

// Manual record-shape starter: use this when your host truly needs to author
// queue_only / fast_path / split_case records itself instead of using the
// preferred Engine-backed Discovery front-door starter.
// Replace this bridge with your host's storage/runtime layer.
export type DiscoveryHostStorageBridge = {
  directiveRoot: string;
  readJson<T>(filePath: string): T;
  writeJson(filePath: string, value: unknown): void | Promise<void>;
  writeText(filePath: string, content: string): void | Promise<void>;
  resolveWithinDirectiveRoot(relativePath: string): string;
  listUnresolvedGapIds(): Iterable<string>;
  receivedAt?: string;
};

type SubmitDiscoveryWithHostBridgeOptions = {
  request: DiscoverySubmissionRequest;
  storage: DiscoveryHostStorageBridge;
  dryRun?: boolean;
};

function queuePathFor(storage: DiscoveryHostStorageBridge) {
  return path.resolve(storage.directiveRoot, "discovery", "intake-queue.json");
}

async function loadModule(modulePath: string) {
  return import(modulePath) as Promise<Record<string, unknown>>;
}

function getRequiredFunction<T extends (...args: never[]) => unknown>(
  moduleRecord: Record<string, unknown>,
  exportName: string,
): T {
  const candidate =
    moduleRecord[exportName] ??
    ((moduleRecord.default as Record<string, unknown> | undefined)?.[exportName] ??
      null);
  if (typeof candidate !== "function") {
    throw new Error(`${exportName} is not a function`);
  }
  return candidate as T;
}

export async function submitDiscoveryEntryWithHostBridge(
  input: SubmitDiscoveryWithHostBridgeOptions,
) {
  const intakeQueueWriter = await loadModule(
    "../../../discovery/lib/discovery-intake-queue-writer.ts",
  );
  const submissionRouter = await loadModule(
    "../../../discovery/lib/discovery-submission-router.ts",
  );
  const fastPathRecordWriter = await loadModule(
    "../../../discovery/lib/discovery-fast-path-record-writer.ts",
  );
  const intakeQueueTransition = await loadModule(
    "../../../discovery/lib/discovery-intake-queue-transition.ts",
  );
  const caseRecordWriter = await loadModule(
    "../../../discovery/lib/discovery-case-record-writer.ts",
  );
  const routingRecordWriter = await loadModule(
    "../../../discovery/lib/discovery-routing-record-writer.ts",
  );
  const completionRecordWriter = await loadModule(
    "../../../discovery/lib/discovery-completion-record-writer.ts",
  );
  const intakeLifecycleSync = await loadModule(
    "../../../discovery/lib/discovery-intake-lifecycle-sync.ts",
  );

  const appendDiscoveryIntakeQueueEntry = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-intake-queue-writer.ts").appendDiscoveryIntakeQueueEntry
  >(intakeQueueWriter, "appendDiscoveryIntakeQueueEntry");
  const determineDiscoverySubmissionShape = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-submission-router.ts").determineDiscoverySubmissionShape
  >(submissionRouter, "determineDiscoverySubmissionShape");
  const toDiscoveryIntakeSubmission = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-submission-router.ts").toDiscoveryIntakeSubmission
  >(submissionRouter, "toDiscoveryIntakeSubmission");
  const renderDiscoveryFastPathRecord = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-fast-path-record-writer.ts").renderDiscoveryFastPathRecord
  >(fastPathRecordWriter, "renderDiscoveryFastPathRecord");
  const resolveDiscoveryFastPathRecordPath = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-fast-path-record-writer.ts").resolveDiscoveryFastPathRecordPath
  >(fastPathRecordWriter, "resolveDiscoveryFastPathRecordPath");
  const transitionDiscoveryIntakeQueueEntry = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-intake-queue-transition.ts").transitionDiscoveryIntakeQueueEntry
  >(intakeQueueTransition, "transitionDiscoveryIntakeQueueEntry");
  const renderDiscoveryIntakeRecord = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-case-record-writer.ts").renderDiscoveryIntakeRecord
  >(caseRecordWriter, "renderDiscoveryIntakeRecord");
  const renderDiscoveryTriageRecord = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-case-record-writer.ts").renderDiscoveryTriageRecord
  >(caseRecordWriter, "renderDiscoveryTriageRecord");
  const resolveDiscoveryIntakeRecordPath = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-case-record-writer.ts").resolveDiscoveryIntakeRecordPath
  >(caseRecordWriter, "resolveDiscoveryIntakeRecordPath");
  const resolveDiscoveryTriageRecordPath = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-case-record-writer.ts").resolveDiscoveryTriageRecordPath
  >(caseRecordWriter, "resolveDiscoveryTriageRecordPath");
  const renderDiscoveryRoutingRecord = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-routing-record-writer.ts").renderDiscoveryRoutingRecord
  >(routingRecordWriter, "renderDiscoveryRoutingRecord");
  const resolveDiscoveryRoutingRecordPath = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-routing-record-writer.ts").resolveDiscoveryRoutingRecordPath
  >(routingRecordWriter, "resolveDiscoveryRoutingRecordPath");
  const renderDiscoveryCompletionRecord = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-completion-record-writer.ts").renderDiscoveryCompletionRecord
  >(completionRecordWriter, "renderDiscoveryCompletionRecord");
  const syncDiscoveryIntakeLifecycle = getRequiredFunction<
    typeof import("../../../discovery/lib/discovery-intake-lifecycle-sync.ts").syncDiscoveryIntakeLifecycle
  >(intakeLifecycleSync, "syncDiscoveryIntakeLifecycle");

  const queuePath = queuePathFor(input.storage);
  const queue = input.storage.readJson<DiscoveryIntakeQueueDocument>(queuePath);
  const receivedAt = input.storage.receivedAt || new Date().toISOString().slice(0, 10);
  const queueAppend = appendDiscoveryIntakeQueueEntry({
    queue,
    submission: toDiscoveryIntakeSubmission(input.request),
    receivedAt,
    unresolvedGapIds: input.storage.listUnresolvedGapIds(),
  });
  const shape = determineDiscoverySubmissionShape(input.request);

  if (shape === "queue_only") {
    if (!input.dryRun) {
      await input.storage.writeJson(queuePath, queueAppend.queue);
    }
    return {
      ok: true,
      mode: input.dryRun ? ("dry_run" as const) : ("submitted" as const),
      record_shape: shape,
      queuePath,
      candidate_id: queueAppend.entry.candidate_id,
      status: queueAppend.entry.status,
    };
  }

  if (shape === "fast_path") {
    const fastPath = input.request.fast_path!;
    const fastPathRequest: DiscoveryFastPathRecordRequest = {
      candidate_id: input.request.candidate_id,
      candidate_name: input.request.candidate_name,
      record_date: fastPath.record_date,
      source_type: input.request.source_type ?? "internal-signal",
      source_reference: input.request.source_reference,
      claimed_value: fastPath.claimed_value,
      first_pass_summary: fastPath.first_pass_summary,
      adoption_target: fastPath.adoption_target,
      decision_state: fastPath.decision_state,
      route_destination: fastPath.route_destination,
      why_this_route: fastPath.why_this_route,
      why_not_alternatives: fastPath.why_not_alternatives,
      need_bounded_proof: fastPath.need_bounded_proof,
      next_artifact: fastPath.next_artifact,
      source_location_on_disk: fastPath.source_location_on_disk,
      stack_language: fastPath.stack_language,
      stack_runtime: fastPath.stack_runtime,
      stack_framework: fastPath.stack_framework,
      stack_package_tool: fastPath.stack_package_tool,
      stack_deployment: fastPath.stack_deployment,
      stack_external_dependencies: fastPath.stack_external_dependencies,
      stack_data_model_assumptions: fastPath.stack_data_model_assumptions,
      stack_integration_shape: fastPath.stack_integration_shape,
      compaction_profile: fastPath.compaction_profile,
      compaction_status: fastPath.compaction_status,
      compaction_reason: fastPath.compaction_reason,
      reentry_trigger: fastPath.reentry_trigger,
      review_cadence: fastPath.review_cadence,
      mission_alignment: fastPath.mission_alignment ?? input.request.mission_alignment,
      capability_gap_id: fastPath.capability_gap_id ?? input.request.capability_gap_id,
      gap_worklist_rank: fastPath.gap_worklist_rank,
      output_relative_path: fastPath.output_relative_path,
    };
    const fastPathRecordPath = resolveDiscoveryFastPathRecordPath({
      candidate_id: fastPathRequest.candidate_id,
      record_date: fastPathRequest.record_date,
      output_relative_path: fastPathRequest.output_relative_path,
    });
    const fastPathMarkdown = renderDiscoveryFastPathRecord(fastPathRequest);

    if (!input.dryRun) {
      await input.storage.writeText(
        input.storage.resolveWithinDirectiveRoot(fastPathRecordPath),
        fastPathMarkdown,
      );
      const processingTransition = transitionDiscoveryIntakeQueueEntry({
        queue: queueAppend.queue,
        request: {
          candidate_id: input.request.candidate_id,
          target_status: "processing",
        } satisfies DiscoveryIntakeTransitionRequest,
        transitionDate: fastPath.record_date,
      });
      const routedTransition = transitionDiscoveryIntakeQueueEntry({
        queue: processingTransition.queue,
        request: {
          candidate_id: input.request.candidate_id,
          target_status: "routed",
          routing_target: fastPath.route_destination,
          fast_path_record_path: fastPathRecordPath,
          note_append: `fast-path record created: ${fastPathRecordPath}`,
        } satisfies DiscoveryIntakeTransitionRequest,
        transitionDate: fastPath.record_date,
      });
      await input.storage.writeJson(queuePath, routedTransition.queue);
      return {
        ok: true,
        mode: "submitted" as const,
        record_shape: shape,
        queuePath,
        candidate_id: routedTransition.entry.candidate_id,
        status: routedTransition.entry.status,
        createdPaths: {
          fastPathRecordPath,
        },
      };
    }

    return {
      ok: true,
      mode: "dry_run" as const,
      record_shape: shape,
      queuePath,
      entry: queueAppend.entry,
      computedPaths: {
        fastPathRecordPath,
      },
    };
  }

  const caseRecord = input.request.case_record!;
  const intakeRecordPath = resolveDiscoveryIntakeRecordPath({
    candidate_id: input.request.candidate_id,
    intake_date: caseRecord.intake.intake_date,
    output_relative_path: caseRecord.intake.output_relative_path,
  });
  const triageRecordPath = resolveDiscoveryTriageRecordPath({
    candidate_id: input.request.candidate_id,
    triage_date: caseRecord.triage.triage_date,
    output_relative_path: caseRecord.triage.output_relative_path,
  });
  const intakeMarkdown = renderDiscoveryIntakeRecord({
    candidate_id: input.request.candidate_id,
    candidate_name: input.request.candidate_name,
    intake: {
      ...caseRecord.intake,
      source_type:
        caseRecord.intake.source_type ?? input.request.source_type ?? "internal-signal",
      source_reference:
        caseRecord.intake.source_reference ?? input.request.source_reference,
    },
    linked_triage_record: triageRecordPath,
  });
  const triageMarkdown = renderDiscoveryTriageRecord({
    candidate_id: input.request.candidate_id,
    candidate_name: input.request.candidate_name,
    triage: caseRecord.triage,
    linked_intake_record: intakeRecordPath,
  });
  const routingRequest: DiscoveryRoutingRecordRequest = {
    candidate_id: input.request.candidate_id,
    candidate_name: input.request.candidate_name,
    route_date: caseRecord.routing.route_date,
    source_type: caseRecord.routing.source_type,
    decision_state: caseRecord.routing.decision_state,
    adoption_target: caseRecord.routing.adoption_target,
    route_destination: caseRecord.routing.route_destination,
    why_this_route: caseRecord.routing.why_this_route,
    why_not_alternatives: caseRecord.routing.why_not_alternatives,
    receiving_track_owner: caseRecord.routing.receiving_track_owner,
    required_next_artifact: caseRecord.routing.required_next_artifact,
    linked_intake_record: intakeRecordPath,
    linked_triage_record: triageRecordPath,
    handoff_contract_used: caseRecord.routing.handoff_contract_used,
    reentry_or_promotion_conditions:
      caseRecord.routing.reentry_or_promotion_conditions,
    review_cadence: caseRecord.routing.review_cadence,
    output_relative_path: caseRecord.routing.output_relative_path,
  };
  const routingRecordPath = resolveDiscoveryRoutingRecordPath(routingRequest);
  const routingMarkdown = renderDiscoveryRoutingRecord(routingRequest);
  const completionRequest = caseRecord.completion
    ? ({
        candidate_id: input.request.candidate_id,
        candidate_name: input.request.candidate_name,
        decision_date: caseRecord.completion.decision_date,
        decision_state: caseRecord.completion.decision_state,
        adoption_target: caseRecord.completion.adoption_target,
        route_destination: caseRecord.completion.route_destination,
        rationale: caseRecord.completion.rationale,
        evidence_path: caseRecord.completion.evidence_path,
        validation_method: caseRecord.completion.validation_method,
        rollback_note: caseRecord.completion.rollback_note,
        linked_intake_record: intakeRecordPath,
        linked_routing_record: routingRecordPath,
        output_relative_path: caseRecord.completion.output_relative_path,
        excluded_baggage: caseRecord.completion.excluded_baggage,
        risk_note: caseRecord.completion.risk_note,
        follow_up_owner: caseRecord.completion.follow_up_owner,
        follow_up_path: caseRecord.completion.follow_up_path,
      } satisfies DiscoveryCompletionRecordRequest)
    : null;

  if (!input.dryRun) {
    await input.storage.writeText(
      input.storage.resolveWithinDirectiveRoot(intakeRecordPath),
      intakeMarkdown,
    );
    await input.storage.writeText(
      input.storage.resolveWithinDirectiveRoot(triageRecordPath),
      triageMarkdown,
    );
    await input.storage.writeText(
      input.storage.resolveWithinDirectiveRoot(routingRecordPath),
      routingMarkdown,
    );
    if (completionRequest) {
      await input.storage.writeText(
        input.storage.resolveWithinDirectiveRoot(completionRequest.output_relative_path),
        renderDiscoveryCompletionRecord(completionRequest),
      );
    }

    const lifecycleRequest: DiscoveryIntakeLifecycleSyncRequest = {
      candidate_id: input.request.candidate_id,
      target_phase: completionRequest ? "completed" : "routed",
      routing_target: caseRecord.routing.route_destination,
      fast_path_record_path: intakeRecordPath,
      routing_record_path: routingRecordPath,
      result_record_path: completionRequest?.output_relative_path ?? null,
      note_append: completionRequest
        ? `discovery case records created: ${intakeRecordPath}, ${triageRecordPath}, ${routingRecordPath}, ${completionRequest.output_relative_path}`
        : `discovery case records created: ${intakeRecordPath}, ${triageRecordPath}, ${routingRecordPath}`,
    };
    const lifecycleResult = syncDiscoveryIntakeLifecycle({
      queue: queueAppend.queue,
      request: lifecycleRequest,
      transitionDate: completionRequest
        ? completionRequest.decision_date
        : caseRecord.routing.route_date,
      directiveRoot: input.storage.directiveRoot,
    });
    await input.storage.writeJson(queuePath, lifecycleResult.queue);

    return {
      ok: true,
      mode: "submitted" as const,
      record_shape: shape,
      queuePath,
      candidate_id: lifecycleResult.entry.candidate_id,
      status: lifecycleResult.entry.status,
      appliedStages: lifecycleResult.appliedStages,
      createdPaths: {
        intakeRecordPath,
        triageRecordPath,
        routingRecordPath,
        completionRecordPath: completionRequest?.output_relative_path ?? null,
      },
    };
  }

  return {
    ok: true,
    mode: "dry_run" as const,
    record_shape: shape,
    queuePath,
    entry: queueAppend.entry,
    computedPaths: {
      intakeRecordPath,
      triageRecordPath,
      routingRecordPath,
      completionRecordPath: completionRequest?.output_relative_path ?? null,
    },
  };
}
