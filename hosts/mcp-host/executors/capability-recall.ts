/**
 * MCP Executors: find_capability + report_outcome
 *
 * find_capability: Search for capabilities matching a natural-language query.
 *   Ranks by: projection-ready status × semantic token match × reliability
 *   × freshness × trust.
 *
 *   Default: only returns projection-ready capabilities (Hermes-usable).
 *   include_candidates=true: also returns candidates, clearly labeled as
 *   not-usable with entryClass, projectionReady=false, and notUsableReason.
 *
 * report_outcome: Record operator feedback after using a capability.
 */

import fs from "node:fs";
import path from "node:path";
import { listRuntimeCapabilityMetadata } from "../../../runtime/core/capability-registry.ts";
import { readRuntimeCapabilityManifest } from "../../../runtime/core/capability-registry.ts";
import { deriveCapabilityTrust } from "../../../engine/routing/capability-trust.ts";
import { deriveCapabilityReliability } from "../../../runtime/lib/projections/capability-reliability.ts";
import { appendDecisionPolicyEvent } from "../../../engine/decision-policy-ledger.ts";
import type { ToolExecutor } from "../types.ts";

// ── Semantic tokenizer ─────────────────────────────────────────
// Lightweight: extract alphanumeric tokens, lowercase, remove stopwords.

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "in", "for", "on", "with", "and", "or",
  "is", "are", "was", "were", "be", "been", "being", "i", "me", "my",
  "we", "our", "you", "your", "it", "its", "this", "that", "can", "how",
  "what", "when", "where", "which", "who", "do", "does", "did", "will",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function semanticMatch(query: string, capabilityText: string): number {
  const queryTokens = new Set(tokenize(query));
  const capTokens = tokenize(capabilityText);
  if (queryTokens.size === 0 || capTokens.length === 0) return 0;
  const matches = capTokens.filter((t) => queryTokens.has(t)).length;
  return matches / queryTokens.size; // Jaccard-like ratio
}

// ── Ranking ────────────────────────────────────────────────────

interface CapabilityRecallResult {
  capabilityId: string;
  displayName: string;
  description: string;
  verification: string;
  contract: string;
  /** Entry class from Jarvis capability kernel: verified_capability, candidate, placeholder, etc. */
  entryClass: string;
  /** Whether this capability is ready for Hermes projection. */
  projectionReady: boolean;
  /** If not projectionReady, the reason why. */
  notUsableReason?: string;
  /** When Hermes should use this capability. */
  whenToUse?: string;
  /** Known failure modes for this capability. */
  failureModes?: string[];
  /** Semantic match score 0–1 */
  matchScore: number;
  /** Reliability score 0–1 (Laplace-smoothed from outcomes) */
  reliability: number;
  /** Freshness 0–1 (exponential decay over 30 days) */
  freshness: number;
  /** Trust gate: auto-approve eligible or not */
  trustAutoApproval: boolean;
  /** Combined rank score */
  rankScore: number;
  /** Outcome summary from ledger */
  outcomeCount: number;
  lastInvokedAt: string | null;
  /** Tags from outcome descriptions */
  outcomeTags: string[];
}

function rankCapabilities(
  query: string,
  directiveRoot: string,
  includeCandidates = false,
): CapabilityRecallResult[] {
  const capabilities = listRuntimeCapabilityMetadata(directiveRoot);

  // Default: only projection-ready (Hermes-usable) capabilities
  // include_candidates=true: also include non-projection-ready with demotion
  const candidates = includeCandidates
    ? capabilities
    : capabilities.filter((c) => c.projectionReady);

  return candidates
    .map((cap) => {
      const manifest = readRuntimeCapabilityManifest({ id: cap.id });
      const capabilityText = [
        cap.displayName,
        cap.description,
        manifest?.description ?? "",
        cap.whenToUse ?? "",
      ].join(" ");

      const matchScore = semanticMatch(query, capabilityText);
      const reliability = deriveCapabilityReliability(cap.id, directiveRoot);
      const trust = deriveCapabilityTrust(cap.id, directiveRoot);

      // Projection-ready multiplier: 1.0 for ready, 0.3 for non-ready candidates
      // This ensures non-usable entries are always demoted far below usable ones
      const projectionMultiplier = cap.projectionReady ? 1.0 : 0.3;

      // rank = projection × match × (0.5 + 0.5 × reliability) × (0.75 + 0.25 × freshness)
      // × (trust.autoApprovalEligible ? 1.0 : 0.6)
      const trustMultiplier = trust.autoApprovalEligible ? 1.0 : 0.6;
      const rankScore = projectionMultiplier
        * matchScore
        * (0.5 + 0.5 * reliability.reliability)
        * (0.75 + 0.25 * reliability.freshness)
        * trustMultiplier;

      return {
        capabilityId: cap.id,
        displayName: cap.displayName,
        description: cap.description,
        verification: cap.verification,
        contract: cap.contract,
        entryClass: cap.entryClass,
        projectionReady: cap.projectionReady,
        ...(cap.notUsableReason ? { notUsableReason: cap.notUsableReason } : {}),
        ...(cap.whenToUse ? { whenToUse: cap.whenToUse } : {}),
        ...(cap.failureModes ? { failureModes: cap.failureModes } : {}),
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
    .filter((r) => r.matchScore > 0 || r.outcomeCount > 0) // Must have some relevance
    .sort((a, b) => b.rankScore - a.rankScore); // projectionReady naturally sorts first due to multiplier
}

// ── Executors ──────────────────────────────────────────────────

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
    const capabilityId = String(args.capability_id ?? "").trim();
    const outcome = String(args.outcome ?? "").trim();
    const description = String(args.description ?? "").trim();

    if (!capabilityId) {
      return { ok: false, error: "capability_id is required" };
    }
    if (!outcome || !["success", "failure", "partial"].includes(outcome)) {
      return { ok: false, error: "outcome must be success, failure, or partial" };
    }

    // Tokenize description for signal tokens
    const signalTokens = tokenize(description).slice(0, 20);
    signalTokens.push(outcome);

    const rationale = outcome === "success"
      ? `Capability "${capabilityId}" outcome: success. ${description || "No details provided."}`
      : outcome === "partial"
        ? `Capability "${capabilityId}" outcome: partial_success. ${description || "No details provided."}`
        : `Capability "${capabilityId}" outcome: failure. ${description || "No details provided."}`;

    appendDecisionPolicyEvent({
      directiveRoot: options.directiveRoot,
      event: {
        recordedAt: new Date().toISOString(),
        source: "capability_outcome",
        candidateId: capabilityId,
        rationale,
        sourceSignalTokens: signalTokens,
      },
    });

    return {
      ok: true,
      capability_id: capabilityId,
      outcome,
      recorded_at: new Date().toISOString(),
    };
  };

  return {
    find_capability: findCapability,
    report_outcome: reportOutcome,
  };
}
