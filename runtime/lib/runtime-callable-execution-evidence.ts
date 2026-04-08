import fs from "node:fs";
import path from "node:path";

import type { DirectiveRuntimeCallableExecutionRecord } from "../../runtime/core/callable-execution.ts";
import { readJson } from "../../shared/lib/file-io.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

export type RuntimeCallableExecutionStatusCount = {
  status: DirectiveRuntimeCallableExecutionRecord["invocation"]["status"];
  count: number;
};

export type RuntimeCallableExecutionCapabilityEvidence = {
  capabilityId: string;
  title: string;
  form: string;
  executionCount: number;
  successCount: number;
  nonSuccessCount: number;
  averageDurationMs: number;
  latestExecutionAt: string | null;
  tools: string[];
  statuses: RuntimeCallableExecutionStatusCount[];
};

export type RuntimeCallableExecutionFailurePattern = {
  executionId: string;
  executionAt: string;
  capabilityId: string;
  tool: string;
  status: DirectiveRuntimeCallableExecutionRecord["invocation"]["status"];
  durationMs: number;
  recordPath: string;
  resultPreview: string | null;
};

export type RuntimeCallableExecutionEvidenceReport = {
  ok: true;
  checkerId: "runtime_callable_execution_evidence";
  snapshotAt: string;
  evidenceRoot: string;
  totalExecutionRecords: number;
  capabilityCount: number;
  successCount: number;
  nonSuccessCount: number;
  averageDurationMs: number | null;
  latestExecutionAt: string | null;
  statusCounts: RuntimeCallableExecutionStatusCount[];
  capabilities: RuntimeCallableExecutionCapabilityEvidence[];
  failurePatterns: RuntimeCallableExecutionFailurePattern[];
  records: Array<{
    executionId: string;
    executionAt: string;
    capabilityId: string;
    tool: string;
    status: DirectiveRuntimeCallableExecutionRecord["invocation"]["status"];
    ok: boolean;
    durationMs: number;
    recordPath: string;
    reportPath: string;
  }>;
};

type CapabilityAccumulator = {
  capabilityId: string;
  title: string;
  form: string;
  executionCount: number;
  successCount: number;
  nonSuccessCount: number;
  totalDurationMs: number;
  latestExecutionAt: string | null;
  tools: Set<string>;
  statuses: Map<DirectiveRuntimeCallableExecutionRecord["invocation"]["status"], number>;
};

function normalizeRelativeDirectivePath(directiveRoot: string, filePath: string) {
  return path.relative(directiveRoot, filePath).replace(/\\/g, "/");
}

function isExecutionRecord(value: unknown): value is DirectiveRuntimeCallableExecutionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const capability = record.capability as Record<string, unknown> | undefined;
  const invocation = record.invocation as Record<string, unknown> | undefined;
  const metadata = record.metadata as Record<string, unknown> | undefined;
  const artifacts = record.artifacts as Record<string, unknown> | undefined;

  return (
    record.version === "bounded_callable_execution_record/v1"
    && typeof record.executionId === "string"
    && typeof record.executionAt === "string"
    && typeof capability?.capabilityId === "string"
    && typeof capability?.title === "string"
    && typeof capability?.form === "string"
    && typeof invocation?.tool === "string"
    && typeof invocation?.status === "string"
    && typeof invocation?.ok === "boolean"
    && typeof metadata?.durationMs === "number"
    && typeof artifacts?.recordPath === "string"
    && typeof artifacts?.reportPath === "string"
  );
}

function toStatusCounts(
  counts: Map<DirectiveRuntimeCallableExecutionRecord["invocation"]["status"], number>,
) {
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([status, count]) => ({ status, count }));
}

function maybeIso(dateStr: string) {
  return Number.isNaN(new Date(dateStr).getTime()) ? null : dateStr;
}

function updateLatest(current: string | null, candidate: string) {
  const normalized = maybeIso(candidate);
  if (!normalized) {
    return current;
  }
  if (!current) {
    return normalized;
  }
  return normalized.localeCompare(current) > 0 ? normalized : current;
}

export function buildRuntimeCallableExecutionEvidenceReport(options: {
  directiveRoot: string;
}): RuntimeCallableExecutionEvidenceReport {
  const directiveRoot = normalizeAbsolutePath(options.directiveRoot);
  const evidenceRoot = normalizeAbsolutePath(
    path.resolve(directiveRoot, "runtime", "callable-executions"),
  );

  const files = fs.existsSync(evidenceRoot)
    ? fs
        .readdirSync(evidenceRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .sort((left, right) => left.name.localeCompare(right.name))
    : [];

  const capabilityAccumulators = new Map<string, CapabilityAccumulator>();
  const statusCounts = new Map<DirectiveRuntimeCallableExecutionRecord["invocation"]["status"], number>();
  const failurePatterns: RuntimeCallableExecutionFailurePattern[] = [];
  const records: RuntimeCallableExecutionEvidenceReport["records"] = [];
  let totalDurationMs = 0;
  let successCount = 0;
  let latestExecutionAt: string | null = null;

  for (const file of files) {
    const absolutePath = normalizeAbsolutePath(path.join(evidenceRoot, file.name));
    const parsed = readJson<unknown>(absolutePath);
    if (!isExecutionRecord(parsed)) {
      continue;
    }

    latestExecutionAt = updateLatest(latestExecutionAt, parsed.executionAt);
    totalDurationMs += parsed.metadata.durationMs;
    if (parsed.invocation.ok) {
      successCount += 1;
    }

    statusCounts.set(
      parsed.invocation.status,
      (statusCounts.get(parsed.invocation.status) ?? 0) + 1,
    );

    if (!capabilityAccumulators.has(parsed.capability.capabilityId)) {
      capabilityAccumulators.set(parsed.capability.capabilityId, {
        capabilityId: parsed.capability.capabilityId,
        title: parsed.capability.title,
        form: parsed.capability.form,
        executionCount: 0,
        successCount: 0,
        nonSuccessCount: 0,
        totalDurationMs: 0,
        latestExecutionAt: null,
        tools: new Set<string>(),
        statuses: new Map(),
      });
    }

    const capability = capabilityAccumulators.get(parsed.capability.capabilityId)!;
    capability.executionCount += 1;
    capability.totalDurationMs += parsed.metadata.durationMs;
    capability.latestExecutionAt = updateLatest(capability.latestExecutionAt, parsed.executionAt);
    capability.tools.add(parsed.invocation.tool);
    capability.statuses.set(
      parsed.invocation.status,
      (capability.statuses.get(parsed.invocation.status) ?? 0) + 1,
    );
    if (parsed.invocation.ok) {
      capability.successCount += 1;
    } else {
      capability.nonSuccessCount += 1;
      failurePatterns.push({
        executionId: parsed.executionId,
        executionAt: parsed.executionAt,
        capabilityId: parsed.capability.capabilityId,
        tool: parsed.invocation.tool,
        status: parsed.invocation.status,
        durationMs: parsed.metadata.durationMs,
        recordPath: parsed.artifacts.recordPath,
        resultPreview: parsed.resultSummary.preview,
      });
    }

    records.push({
      executionId: parsed.executionId,
      executionAt: parsed.executionAt,
      capabilityId: parsed.capability.capabilityId,
      tool: parsed.invocation.tool,
      status: parsed.invocation.status,
      ok: parsed.invocation.ok,
      durationMs: parsed.metadata.durationMs,
      recordPath: normalizeRelativeDirectivePath(directiveRoot, absolutePath),
      reportPath: parsed.artifacts.reportPath,
    });
  }

  const capabilities = [...capabilityAccumulators.values()]
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId))
    .map((capability) => ({
      capabilityId: capability.capabilityId,
      title: capability.title,
      form: capability.form,
      executionCount: capability.executionCount,
      successCount: capability.successCount,
      nonSuccessCount: capability.nonSuccessCount,
      averageDurationMs: capability.executionCount > 0
        ? Math.round((capability.totalDurationMs / capability.executionCount) * 10) / 10
        : 0,
      latestExecutionAt: capability.latestExecutionAt,
      tools: [...capability.tools].sort((left, right) => left.localeCompare(right)),
      statuses: toStatusCounts(capability.statuses),
    }));

  failurePatterns.sort((left, right) => left.executionAt.localeCompare(right.executionAt));
  records.sort((left, right) => left.executionAt.localeCompare(right.executionAt));

  return {
    ok: true,
    checkerId: "runtime_callable_execution_evidence",
    snapshotAt: new Date().toISOString(),
    evidenceRoot: normalizeRelativeDirectivePath(directiveRoot, evidenceRoot),
    totalExecutionRecords: records.length,
    capabilityCount: capabilities.length,
    successCount,
    nonSuccessCount: records.length - successCount,
    averageDurationMs: records.length > 0
      ? Math.round((totalDurationMs / records.length) * 10) / 10
      : null,
    latestExecutionAt,
    statusCounts: toStatusCounts(statusCounts),
    capabilities,
    failurePatterns,
    records,
  };
}
