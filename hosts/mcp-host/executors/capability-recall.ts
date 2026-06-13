/**
 * MCP Executors: find_capability + report_outcome
 */

import fs from "node:fs";
import path from "node:path";

import { appendDecisionPolicyEvent } from "../../../engine/decision-policy-ledger.ts";
import { deriveCapabilityTrust } from "../../../engine/routing/capability-trust.ts";
import { readRuntimeCapabilityManifest } from "../../../runtime/core/capability-registry.ts";
import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import { deriveCapabilityReliability } from "../../../runtime/lib/projections/capability-reliability.ts";
import type { ToolExecutor } from "../types.ts";

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "in", "for", "on", "with", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "i", "me", "my",
  "we", "our", "you", "your", "it", "its", "this", "that", "can", "how",
  "what", "when", "where", "which", "who", "do", "does", "did", "will",
]);

type StructuredCapabilityOutcome = {
  capability_id: string;
  outcome: "success" | "partial" | "failure" | "contract_failure";
  task_description: string;
  duration_ms?: number;
  cost_estimate?: string;
  error_class?: string;
  operator_notes?: string;
  reported_by: string;
  reported_at: string;
};

let capabilityOutcomeSchemaValidator:
  | (((payload: Record<string, unknown>) => boolean) & { errors?: Array<{ instancePath?: string; message?: string | null }> | null })
  | null = null;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function semanticMatch(query: string, capabilityText: string): number {
  const queryTokens = new Set(tokenize(query));
  const capTokens = tokenize(capabilityText);
  if (queryTokens.size === 0 || capTokens.length === 0) return 0;
  const matches = capTokens.filter((token) => queryTokens.has(token)).length;
  return matches / queryTokens.size;
}

interface CapabilityRecallResult {
  capabilityId: string;
  displayName: string;
  description: string;
  verification: string;
  contract: string;
  entryClass: string;
  projectionReady: boolean;
  notUsableReason?: string;
  whenToUse?: string;
  failureModes?: string[];
  matchScore: number;
  reliability: number;
  freshness: number;
  trustAutoApproval: boolean;
  rankScore: number;
  outcomeCount: number;
  lastInvokedAt: string | null;
  outcomeTags: string[];
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeOptionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

async function getCapabilityOutcomeValidator() {
  if (capabilityOutcomeSchemaValidator) {
    return capabilityOutcomeSchemaValidator;
  }

  const schemaPath = path.resolve(process.cwd(), "shared/schemas/capability-outcome.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const addFormats = (await import("ajv-formats")).default;
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  capabilityOutcomeSchemaValidator = ajv.compile(schema);
  return capabilityOutcomeSchemaValidator;
}

async function validateStructuredOutcome(
  payload: StructuredCapabilityOutcome,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validator = await getCapabilityOutcomeValidator();
  const valid = validator(payload as unknown as Record<string, unknown>);
  if (valid) {
    return { ok: true };
  }

  const details = (validator.errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  return {
    ok: false,
    error: `structured outcome validation failed: ${details || "unknown schema error"}`,
  };
}

function buildStructuredOutcome(args: Record<string, unknown>): StructuredCapabilityOutcome {
  const capabilityId = String(args.capability_id ?? "").trim();
  const outcome = String(args.outcome ?? "").trim() as StructuredCapabilityOutcome["outcome"];
  const legacyDescription = normalizeOptionalString(args.description);
  const taskDescription = normalizeOptionalString(args.task_description) ?? legacyDescription ?? "";
  const operatorNotes = normalizeOptionalString(args.operator_notes) ?? legacyDescription;
  const reportedAt = normalizeOptionalString(args.reported_at) ?? new Date().toISOString();
  const reportedBy = normalizeOptionalString(args.reported_by) ?? "operator";

  return {
    capability_id: capabilityId,
    outcome,
    task_description: taskDescription,
    reported_by: reportedBy,
    reported_at: reportedAt,
    ...(normalizeOptionalNonNegativeInteger(args.duration_ms) !== undefined
      ? { duration_ms: normalizeOptionalNonNegativeInteger(args.duration_ms) }
      : {}),
    ...(normalizeOptionalString(args.cost_estimate)
      ? { cost_estimate: normalizeOptionalString(args.cost_estimate) }
      : {}),
    ...(normalizeOptionalString(args.error_class)
      ? { error_class: normalizeOptionalString(args.error_class) }
      : {}),
    ...(operatorNotes ? { operator_notes: operatorNotes } : {}),
  };
}

function buildOutcomeRationale(payload: StructuredCapabilityOutcome): string {
  const parts = [
    `Capability "${payload.capability_id}" outcome: ${payload.outcome}.`,
    `Task: ${payload.task_description}.`,
  ];

  if (payload.operator_notes) {
    parts.push(`Notes: ${payload.operator_notes}.`);
  }
  if (payload.error_class) {
    parts.push(`Error class: ${payload.error_class}.`);
  }
  if (payload.duration_ms !== undefined) {
    parts.push(`Duration: ${payload.duration_ms}ms.`);
  }
  if (payload.cost_estimate) {
    parts.push(`Cost: ${payload.cost_estimate}.`);
  }
  parts.push(`Reported by ${payload.reported_by} at ${payload.reported_at}.`);

  return parts.join(" ");
}

function buildOutcomeTokens(payload: StructuredCapabilityOutcome): string[] {
  return [
    payload.capability_id,
    `outcome_${payload.outcome}`,
    payload.outcome,
    ...tokenize(payload.task_description).slice(0, 12),
    ...(payload.operator_notes ? tokenize(payload.operator_notes).slice(0, 8) : []),
    ...(payload.error_class ? [`error_${payload.error_class.toLowerCase()}`] : []),
    `reported_by_${payload.reported_by.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
  ];
}

function rankCapabilities(
  query: string,
  directiveRoot: string,
  includeCandidates = false,
): CapabilityRecallResult[] {
  const capabilities = listRuntimeCapabilityMetadata(directiveRoot);
  const candidates = includeCandidates
    ? capabilities
    : capabilities.filter((capability) => capability.projectionReady);

  return candidates
    .map((capability) => {
      const manifest = readRuntimeCapabilityManifest({ id: capability.id });
      const capabilityText = [
        capability.displayName,
        capability.description,
        manifest?.description ?? "",
        capability.whenToUse ?? "",
      ].join(" ");

      const matchScore = semanticMatch(query, capabilityText);
      const reliability = deriveCapabilityReliability(capability.id, directiveRoot);
      const trust = deriveCapabilityTrust(capability.id, directiveRoot);
      const projectionMultiplier = capability.projectionReady ? 1.0 : 0.3;
      const trustMultiplier = trust.autoApprovalEligible ? 1.0 : 0.6;
      const rankScore = projectionMultiplier
        * matchScore
        * (0.5 + 0.5 * reliability.reliability)
        * (0.75 + 0.25 * reliability.freshness)
        * trustMultiplier;

      return {
        capabilityId: capability.id,
        displayName: capability.displayName,
        description: capability.description,
        verification: capability.verification,
        contract: capability.contract,
        entryClass: capability.entryClass,
        projectionReady: capability.projectionReady,
        ...(capability.notUsableReason ? { notUsableReason: capability.notUsableReason } : {}),
        ...(capability.whenToUse ? { whenToUse: capability.whenToUse } : {}),
        ...(capability.failureModes ? { failureModes: capability.failureModes } : {}),
        matchScore: Math.round(matchScore * 1000) / 1000,
        reliability: Math.round(reliability.reliability * 1000) / 1000,
        freshness: Math.round(reliability.freshness * 1000) / 1000,
        trustAutoApproval: trust.autoApprovalEligible,
        rankScore: Math.round(rankScore * 10000) / 10000,
        outcomeCount: reliability.outcomeCount,
        lastInvokedAt: reliability.lastReportedAt,
        outcomeTags: reliability.outcomeTags,
      };
    })
    .filter((result) => result.matchScore > 0 || result.outcomeCount > 0)
    .sort((a, b) => b.rankScore - a.rankScore);
}

export function buildCapabilityRecallExecutors(options: {
  directiveRoot: string;
}): Record<string, ToolExecutor> {
  const findCapability: ToolExecutor = async (args: Record<string, unknown>) => {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return { ok: false, error: "query is required", results: [] };
    }

    const includeCandidates = args.include_candidates === true;
    const results = rankCapabilities(query, options.directiveRoot, includeCandidates);

    return {
      ok: true,
      query,
      includeCandidates,
      results: results.slice(0, 10),
      totalCount: results.length,
    };
  };

  const reportOutcome: ToolExecutor = async (args: Record<string, unknown>) => {
    const payload = buildStructuredOutcome(args);
    const validation = await validateStructuredOutcome(payload);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    const rationale = buildOutcomeRationale(payload);
    const sourceSignalTokens = buildOutcomeTokens(payload);

    appendDecisionPolicyEvent({
      directiveRoot: options.directiveRoot,
      event: {
        recordedAt: payload.reported_at,
        source: "capability_outcome",
        candidateId: payload.capability_id,
        rationale,
        sourceSignalTokens,
        capabilityOutcome: {
          outcome: payload.outcome,
          taskDescription: payload.task_description,
          reportedBy: payload.reported_by,
          reportedAt: payload.reported_at,
          ...(payload.duration_ms !== undefined ? { durationMs: payload.duration_ms } : {}),
          ...(payload.cost_estimate ? { costEstimate: payload.cost_estimate } : {}),
          ...(payload.error_class ? { errorClass: payload.error_class } : {}),
          ...(payload.operator_notes ? { operatorNotes: payload.operator_notes } : {}),
        },
      },
    });

    return {
      ok: true,
      capability_id: payload.capability_id,
      outcome: payload.outcome,
      recorded_at: payload.reported_at,
      task_description: payload.task_description,
    };
  };

  return {
    find_capability: findCapability,
    report_outcome: reportOutcome,
  };
}
