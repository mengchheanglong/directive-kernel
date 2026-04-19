/// <reference types="node" />

import {
  createFilesystemDirectiveEngineStore,
  type DirectiveEngineStore,
} from "./storage.ts";
import { assessDirectiveEngineRouting } from "./routing/routing-assessment.ts";
import { createDefaultDirectiveMission } from "./mission/default-mission.ts";
import { normalizeText } from "./engine-source-utils.ts";
import {
  deriveProcessFingerprint,
  readDirectiveEngineProcessFingerprintCacheStats,
  recordMatchesProcessFingerprint,
  resetDirectiveEngineProcessFingerprintCache,
} from "./process-fingerprint.ts";
import { withOperationTimeout } from "./operation-timeout.ts";
import { type DirectiveEngineLaneSet } from "./lane.ts";
import { inferDirectiveEngineSourceType } from "./source-type-inference.ts";
import {
  type DirectiveEngineHostAdapter,
  type DirectiveEngineMinimalSourceInput,
  type DirectiveEngineMissionPreviewChange,
  type DirectiveEngineProcessSourceInput,
  type DirectiveEngineProcessSourceResult,
  type DirectiveEnginePlanProgressUpdate,
  type DirectiveEngineRunRecord,
  type DirectiveEngineRoutingDigestPreview,
} from "./types.ts";
import { deriveDirectivePlanQualitySignal } from "./planning/plan-quality.ts";
import { deriveDirectiveNarrativeActions } from "./routing/source-narrative-threading.ts";
import {
  applyPlanProgressUpdates,
} from "./planning/run-action-api.ts";
import {
  buildDirectiveRunRecord,
  deriveCandidateId,
  deriveMinimalSourceRef,
  prepareProcessSourceInput,
  sanitizeIdSegment,
} from "./process-source-record.ts";
import {
  buildMissionPreviewDigest,
  buildReRouteProcessSourceInput,
} from "./run-record-replay.ts";
import { collectHostAdapterResults } from "./host-adapter-results.ts";

export {
  readDirectiveEngineProcessFingerprintCacheStats,
  resetDirectiveEngineProcessFingerprintCache,
};

export class DirectiveEngine {
  readonly store: DirectiveEngineStore;
  readonly laneSet: DirectiveEngineLaneSet;
  readonly hostAdapters: DirectiveEngineHostAdapter[];
  readonly storeTimeoutMs: number;
  readonly hostAdapterTimeoutMs: number;

  constructor(input: {
    laneSet: DirectiveEngineLaneSet;
    store?: DirectiveEngineStore;
    hostAdapters?: DirectiveEngineHostAdapter[];
    storeTimeoutMs?: number;
    hostAdapterTimeoutMs?: number;
  }) {
    if (!input.laneSet) {
      throw new Error(
        "directive_engine_lane_set_required: construct DirectiveEngine with an explicit lane set",
      );
    }

    this.laneSet = input.laneSet;
    this.store = input.store ?? createFilesystemDirectiveEngineStore();
    this.hostAdapters = [...(input.hostAdapters ?? [])];
    this.storeTimeoutMs = input.storeTimeoutMs ?? 5_000;
    this.hostAdapterTimeoutMs = input.hostAdapterTimeoutMs ?? 5_000;
  }

  private withStoreTimeout<T>(operation: Promise<T> | T, label: string) {
    return withOperationTimeout(operation, this.storeTimeoutMs, label);
  }

  async processMinimalSource(
    input: DirectiveEngineMinimalSourceInput,
  ): Promise<DirectiveEngineProcessSourceResult> {
    const title = normalizeText(input.title);
    if (!title) {
      throw new Error("invalid_input: minimal source title is required");
    }

    const summary = normalizeText(input.summary) || null;
    const sourceRef = normalizeText(input.url) || deriveMinimalSourceRef({
      title,
      summary,
    });

    return this.processSource({
      receivedAt: input.receivedAt,
      mission: input.mission ?? createDefaultDirectiveMission(),
      gaps: input.gaps ?? null,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      source: {
        sourceId: sanitizeIdSegment(title) || null,
        sourceType: inferDirectiveEngineSourceType({
          title,
          url: input.url,
          summary,
        }),
        sourceRef,
        title,
        summary,
      },
    });
  }

  async processSource(
    input: DirectiveEngineProcessSourceInput,
  ): Promise<DirectiveEngineProcessSourceResult> {
    const { receivedAt, mission, source } = prepareProcessSourceInput(input);
    const candidateId = deriveCandidateId(source);
    const processFingerprint = deriveProcessFingerprint({
      source,
      mission,
    });
    const existingRuns = await this.listRuns();
    const duplicateRecord = [...existingRuns]
      .reverse()
      .find((record) => recordMatchesProcessFingerprint({
        record,
        fingerprint: processFingerprint,
      }));
    if (duplicateRecord) {
      return {
        ok: true,
        record: duplicateRecord,
        adapterResults: [],
        deduplicated: true,
        duplicateOfRunId: duplicateRecord.runId,
        duplicateReason: "matching source and mission fingerprint",
      };
    }
    const openGaps = [...(input.gaps ?? [])];
    const corrections = [...(input.corrections ?? [])];
    const routingAssessment = assessDirectiveEngineRouting({
      source,
      mission,
      openGaps,
      corrections,
      policyEvents: [...(input.policyEvents ?? [])],
      existingRuns,
      receivedAt,
    });
    const runRecord = buildDirectiveRunRecord({
      laneSet: this.laneSet,
      source,
      mission,
      openGaps,
      corrections,
      policyEvents: [...(input.policyEvents ?? [])],
      existingRuns,
      receivedAt,
      candidateId,
      routingAssessment,
    });

    await this.withStoreTimeout(this.store.writeRun(runRecord), "store.writeRun");

    const adapterResults = await collectHostAdapterResults({
      adapters: this.hostAdapters,
      record: runRecord,
      timeoutMs: this.hostAdapterTimeoutMs,
      withTimeout: withOperationTimeout,
    });

    return {
      ok: true,
      record: runRecord,
      adapterResults,
    };
  }

  async updatePlanProgress(input: {
    runId: string;
    updates: DirectiveEnginePlanProgressUpdate[];
    at?: string | null;
  }) {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }
    if ((input.updates ?? []).length === 0) {
      throw new Error("invalid_input: at least one plan progress update is required");
    }

    const at = normalizeText(input.at) || new Date().toISOString();
    const structuredPlans = applyPlanProgressUpdates({
      record,
      updates: input.updates,
      at,
    });
    const existingRuns = (await this.listRuns()).filter((entry) => entry.runId !== record.runId);
    const updatedRecord: DirectiveEngineRunRecord = {
      ...record,
      ...structuredPlans,
    };
    updatedRecord.planQualitySignal = deriveDirectivePlanQualitySignal({
      record: updatedRecord,
      existingRuns,
    });
    updatedRecord.narrativeActions = deriveDirectiveNarrativeActions({
      narrativeContext: updatedRecord.routingAssessment.narrativeContext,
      openGaps: updatedRecord.openGaps,
      currentRecord: updatedRecord,
    });

    await this.withStoreTimeout(this.store.updateRun(updatedRecord), "store.updateRun");
    return updatedRecord;
  }

  async reRouteWithAnswers(input: {
    runId: string;
    answers: Record<string, unknown>;
    corrections?: DirectiveEngineProcessSourceInput["corrections"];
    policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
    receivedAt?: string | null;
  }) {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }

    return this.processSource(buildReRouteProcessSourceInput({
      record,
      answers: input.answers,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      receivedAt: input.receivedAt,
    }));
  }

  async previewMissionChange(input: {
    runId: string;
    change: DirectiveEngineMissionPreviewChange;
    corrections?: DirectiveEngineProcessSourceInput["corrections"];
    policyEvents?: DirectiveEngineProcessSourceInput["policyEvents"];
    receivedAt?: string | null;
  }): Promise<DirectiveEngineRoutingDigestPreview> {
    const record = await this.getRun(input.runId);
    if (!record) {
      throw new Error(`not_found: run ${input.runId} does not exist`);
    }

    const existingRuns = (await this.listRuns()).filter((entry) => entry.runId !== record.runId);
    return buildMissionPreviewDigest({
      record,
      change: input.change,
      existingRuns,
      corrections: input.corrections ?? null,
      policyEvents: input.policyEvents ?? null,
      receivedAt: input.receivedAt,
    });
  }

  async getRun(runId: string) {
    return this.withStoreTimeout(this.store.readRun(runId), "store.readRun");
  }

  async listRuns() {
    return this.withStoreTimeout(this.store.listRuns(), "store.listRuns");
  }
}
