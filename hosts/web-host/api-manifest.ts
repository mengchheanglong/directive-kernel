import fs from "node:fs";
import path from "node:path";
import { ARCHITECTURE_DEEP_TAIL_STAGES } from "../../architecture/lib/control/materialization-tail-stage-map.ts";

export const API_MANIFEST_SCHEMA_PATH = "shared/schemas/api-manifest.schema.json";
const SHARED_SCHEMA_PREFIX = "shared/schemas/";

export type OperationEntry = {
  name: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  input_schema?: string;
  output_schema?: string;
  side_effects?: string[];
  prerequisites?: string[];
  allowed_after?: string[];
};

export type CapabilityEntry = {
  id: string;
  metadata?: {
    displayName?: string;
    description?: string;
    domain?: string;
  };
  inputSchema?: string;
  outputSchema?: string;
};

export type ApiManifest = {
  $schema: string;
  operations: OperationEntry[];
  capabilities: CapabilityEntry[];
  schema_index: Record<string, string>;
};

function op(
  method: "GET" | "POST",
  name: string,
  pathValue: string,
  summary: string,
  extra: Omit<OperationEntry, "method" | "name" | "path" | "summary"> = {},
): OperationEntry {
  return {
    method,
    name,
    path: pathValue,
    summary,
    ...extra,
  };
}

const STATIC_ROUTE_TABLE: OperationEntry[] = [
  op("GET", "manifest_get", "/api/manifest", "Read the kernel API operation catalog.", {
    output_schema: API_MANIFEST_SCHEMA_PATH,
  }),
  op("GET", "telemetry_snapshot_get", "/api/telemetry/snapshot", "Read the current in-memory web-host telemetry snapshot.", {
    output_schema: "shared/schemas/telemetry-snapshot.response.schema.json",
  }),
  op("GET", "federation_snapshot_get", "/api/federation/snapshot", "Read a read-only aggregate snapshot across configured remote directive roots.", {
    output_schema: "shared/schemas/federation-snapshot.response.schema.json",
  }),
  op("GET", "runtime_status", "/api/runtime/status", "Read storage and maintenance status for the directive root.", {
    output_schema: "shared/schemas/runtime-status.response.schema.json",
  }),
  op("GET", "runtime_capabilities_list", "/api/runtime/capabilities", "List runtime capability metadata exposed by the kernel registry.", {
    output_schema: "shared/schemas/runtime-capabilities.response.schema.json",
  }),
  op("GET", "snapshot_get", "/api/snapshot", "Read the current dashboard snapshot of queue, runs, and handoffs.", {
    output_schema: "shared/schemas/snapshot.response.schema.json",
  }),
  op("GET", "explain_get", "/api/explain", "Read a derived explanation for one engine run by run id.", {
    output_schema: "shared/schemas/run-explanation.response.schema.json",
  }),
  op("GET", "glossary_get", "/api/glossary", "Read canonical Directive Kernel glossary terms.", {
    output_schema: "shared/schemas/glossary.response.schema.json",
  }),
  op("GET", "schema_get", "/api/schemas/:schemaName", "Read one JSON schema file served from shared/schemas."),
  op("GET", "operator_decision_inbox_get", "/api/operator-decision-inbox", "Read pending operator-facing review and approval work.", {
    output_schema: "shared/schemas/operator-decision-inbox.response.schema.json",
  }),
  op("GET", "mission_feedback_list", "/api/mission/feedback", "List pending mission feedback entries.", {
    output_schema: "shared/schemas/mission-feedback-list.response.schema.json",
  }),
  op("GET", "mission_history_list", "/api/mission/history", "List mission evolution history.", {
    output_schema: "shared/schemas/mission-evolution-history.response.schema.json",
  }),
  op("GET", "gaps_pending_list", "/api/gaps/pending", "List pending capability-gap formalization candidates.", {
    output_schema: "shared/schemas/gap-formalization-list.response.schema.json",
  }),
  op("GET", "engine_runs_list", "/api/engine-runs", "List recent engine runs from the workspace snapshot.", {
    output_schema: "shared/schemas/engine-runs-overview.response.schema.json",
  }),
  op("GET", "engine_run_get", "/api/engine-runs/:runId", "Read one engine run detail by run id.", {
    output_schema: "shared/schemas/engine-run-detail.response.schema.json",
  }),
  op("POST", "engine_run_plan_progress", "/api/engine-runs/:runId/plan-progress", "Update plan-progress state on an engine run.", {
    side_effects: ["writes engine run record"],
    prerequisites: ["engine run exists"],
  }),
  op("POST", "engine_run_reroute", "/api/engine-runs/:runId/reroute", "Re-run routing for an engine run with operator answers.", {
    side_effects: ["writes engine run record", "writes routing assessment"],
    prerequisites: ["engine run exists", "answers payload present"],
  }),
  op("POST", "engine_run_replay", "/api/engine-runs/:runId/replay", "Replay one engine run non-persistently with optional answer or mission overrides.", {
    input_schema: "shared/schemas/engine-run-replay-request.schema.json",
    output_schema: "shared/schemas/engine-run-replay.response.schema.json",
    prerequisites: ["engine run exists"],
  }),
  op("GET", "queue_list", "/api/queue", "List queue entries from the current workspace snapshot.", {
    output_schema: "shared/schemas/queue-overview.response.schema.json",
  }),
  op("GET", "queue_entry_get", "/api/queue-entry", "Read one queue entry by candidate id.", {
    output_schema: "shared/schemas/queue-entry.response.schema.json",
  }),
  op("GET", "discovery_routing_record_detail_get", "/api/discovery-routing-records/detail", "Read one discovery routing record detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "handoffs_list", "/api/handoffs", "List handoff stubs from the current workspace snapshot.", {
    output_schema: "shared/schemas/handoff-stubs.response.schema.json",
  }),
  op("GET", "handoff_detail_get", "/api/handoffs/detail", "Read one handoff detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "runtime_record_detail_get", "/api/runtime-records/detail", "Read one runtime record detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "runtime_proof_detail_get", "/api/runtime-proofs/detail", "Read one runtime proof detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "runtime_runtime_capability_boundary_detail_get", "/api/runtime-runtime-capability-boundaries/detail", "Read one runtime capability-boundary detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "runtime_promotion_readiness_detail_get", "/api/runtime-promotion-readiness/detail", "Read one runtime promotion-readiness detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "architecture_start_detail_get", "/api/architecture-starts/detail", "Read one architecture start detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "architecture_result_detail_get", "/api/architecture-results/detail", "Read one architecture result detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "architecture_adoption_detail_get", "/api/architecture-adoptions/detail", "Read one architecture adoption detail by relative path.", {
    output_schema: "shared/schemas/artifact-detail.response.schema.json",
  }),
  op("GET", "artifact_text_get", "/api/artifacts", "Read raw artifact text by relative path.", {
    output_schema: "shared/schemas/artifact-text.response.schema.json",
  }),
  op("POST", "discovery_submit", "/api/discovery/submissions", "Submit a source through the Discovery front door for routing.", {
    input_schema: "shared/schemas/discovery-submission-request.schema.json",
    side_effects: ["writes intake record", "writes routing record", "may write engine run record"],
    prerequisites: ["directive root initialized", "goal envelope present"],
    allowed_after: ["engine_run_reroute", "discovery_open_route", "discovery_resolve_routing_review"],
  }),
  op("POST", "mission_preview", "/api/mission/preview", "Preview the effect of a mission feedback entry.", {
    prerequisites: ["mission feedback entry exists"],
  }),
  op("POST", "mission_approve", "/api/mission/approve", "Approve a mission feedback entry and write a new mission evolution.", {
    side_effects: ["writes mission evolution record", "may update engine runs through bounded cascade"],
    prerequisites: ["mission feedback entry exists", "operator rationale present"],
  }),
  op("POST", "mission_reject", "/api/mission/reject", "Reject a mission feedback entry.", {
    side_effects: ["writes mission feedback resolution"],
    prerequisites: ["mission feedback entry exists", "operator rationale present"],
  }),
  op("POST", "mission_revert", "/api/mission/revert", "Revert to the previous mission evolution.", {
    side_effects: ["writes mission evolution record"],
    prerequisites: ["mission history exists", "operator rationale present"],
  }),
  op("POST", "gaps_approve", "/api/gaps/approve", "Approve a gap formalization candidate and refresh the gap worklist.", {
    side_effects: ["writes gap formalization record", "writes capability gap entry", "writes discovery gap worklist"],
    prerequisites: ["formalization candidate exists", "operator rationale present"],
  }),
  op("POST", "gaps_reject", "/api/gaps/reject", "Reject a gap formalization candidate.", {
    side_effects: ["writes gap formalization record"],
    prerequisites: ["formalization candidate exists", "operator rationale present"],
  }),
  op("POST", "discovery_front_door", "/api/discovery/front-door", "Submit a source through the front-door helper without the UI submission wrapper.", {
    input_schema: "shared/schemas/discovery-submission-request.schema.json",
    side_effects: ["writes intake record", "writes routing record"],
    prerequisites: ["directive root initialized", "goal envelope present"],
  }),
  op("POST", "discovery_open_route", "/api/discovery/open-route", "Open a reviewed discovery route into its downstream lane.", {
    side_effects: ["writes downstream lane artifact"],
    prerequisites: ["routing path exists", "review approval satisfied"],
    allowed_after: ["runtime_open_follow_up", "architecture_handoff_start"],
  }),
  op("POST", "discovery_resolve_routing_review", "/api/discovery/resolve-routing-review", "Resolve an explicit discovery routing review decision.", {
    input_schema: "shared/schemas/discovery-routing-record-request.schema.json",
    side_effects: ["writes discovery routing review record"],
    prerequisites: ["routing record exists", "operator rationale present"],
    allowed_after: ["discovery_open_route"],
  }),
  op("POST", "runtime_open_follow_up", "/api/runtime/open-follow-up", "Open a runtime follow-up artifact into the next runtime stage.", {
    side_effects: ["writes runtime record"],
    prerequisites: ["follow-up artifact exists", "approval boundary satisfied"],
    allowed_after: ["runtime_open_proof"],
  }),
  op("POST", "runtime_open_proof", "/api/runtime/open-proof", "Open a runtime record into proof collection.", {
    side_effects: ["writes runtime proof artifact"],
    prerequisites: ["runtime record exists", "approval boundary satisfied"],
    allowed_after: ["runtime_open_runtime_capability_boundary"],
  }),
  op("POST", "runtime_open_runtime_capability_boundary", "/api/runtime/open-runtime-capability-boundary", "Open runtime proof into capability-boundary review.", {
    side_effects: ["writes runtime capability-boundary artifact"],
    prerequisites: ["runtime proof exists", "approval boundary satisfied"],
    allowed_after: ["runtime_open_promotion_readiness"],
  }),
  op("POST", "runtime_open_promotion_readiness", "/api/runtime/open-promotion-readiness", "Open a capability boundary into promotion-readiness review.", {
    side_effects: ["writes runtime promotion-readiness artifact"],
    prerequisites: ["capability-boundary artifact exists", "approval boundary satisfied"],
    allowed_after: ["runtime_selection_resolutions", "runtime_promotion_seam_decisions"],
  }),
  op("POST", "runtime_selection_resolutions", "/api/runtime/selection-resolutions", "Resolve runtime host selection for a promotion-readiness artifact.", {
    side_effects: ["writes runtime host-selection resolution"],
    prerequisites: ["promotion-readiness artifact exists", "operator rationale present"],
    allowed_after: ["runtime_promotion_seam_decisions", "runtime_registry_acceptance_decisions"],
  }),
  op("POST", "runtime_promotion_seam_decisions", "/api/runtime/promotion-seam-decisions", "Resolve whether a runtime promotion seam is satisfied.", {
    side_effects: ["writes runtime promotion record"],
    prerequisites: ["promotion-readiness artifact exists", "operator rationale present"],
    allowed_after: ["runtime_registry_acceptance_decisions"],
  }),
  op("POST", "runtime_registry_acceptance_decisions", "/api/runtime/registry-acceptance-decisions", "Accept a runtime promotion record into the registry.", {
    side_effects: ["writes runtime registry acceptance decision", "may write runtime registry entry"],
    prerequisites: ["runtime promotion record exists", "operator rationale present"],
  }),
  op("POST", "invoke_capability", "/api/runtime/capabilities/invoke", "Invoke a capability through trust-gated execution (requires verified evidence and earned autonomy).", {
    input_schema: "shared/schemas/mcp-invoke-capability-input.schema.json",
    side_effects: ["executes capability", "appends to decision-policy ledger"],
    prerequisites: ["capability verified by harness", "operator trust score sufficient"],
  }),
  op("POST", "find_capability", "/api/runtime/capability-recall", "Search for capabilities matching a natural-language query. Ranks by semantic match, reliability, freshness, and trust.", {
    input_schema: "shared/schemas/find-capability-input.schema.json",
    output_schema: "shared/schemas/capability-recall.response.schema.json",
    side_effects: ["reads capability registry", "reads ledger outcomes"],
    prerequisites: [],
  }),
  op("POST", "report_outcome", "/api/runtime/capability-outcomes", "Record operator feedback after using a capability. Appends capability_outcome to the decision-policy ledger.", {
    input_schema: "shared/schemas/report-outcome-input.schema.json",
    side_effects: ["writes capability_outcome event to decision-policy ledger"],
    prerequisites: [],
  }),
  op("POST", "architecture_handoff_start", "/api/architecture/handoff-start", "Start an architecture experiment from a handoff artifact.", {
    side_effects: ["writes architecture start artifact"],
    prerequisites: ["handoff artifact exists"],
    allowed_after: ["architecture_bounded_closeout"],
  }),
  op("POST", "architecture_bounded_closeout", "/api/architecture/bounded-closeout", "Close an architecture start with a bounded result.", {
    side_effects: ["writes architecture result artifact"],
    prerequisites: ["architecture start exists", "result summary present"],
    allowed_after: ["architecture_bounded_continuation", "architecture_adopt_result"],
  }),
  op("POST", "architecture_note_handoff_closeout", "/api/architecture/note-handoff-closeout", "Close a note-style handoff with a bounded architecture result.", {
    side_effects: ["writes architecture result artifact"],
    prerequisites: ["handoff artifact exists", "result summary present"],
    allowed_after: ["architecture_bounded_continuation", "architecture_adopt_result"],
  }),
  op("POST", "architecture_bounded_continuation", "/api/architecture/bounded-continuation", "Continue architecture work from a bounded result.", {
    side_effects: ["writes architecture start artifact"],
    prerequisites: ["architecture result exists"],
  }),
  op("POST", "architecture_adopt_result", "/api/architecture/adopt-result", "Adopt an architecture result into the adoption lifecycle.", {
    side_effects: ["writes architecture adoption artifact"],
    prerequisites: ["architecture result exists"],
    allowed_after: ["architecture_create_implementation_target"],
  }),
  op("POST", "architecture_create_implementation_target", "/api/architecture/create-implementation-target", "Create an implementation target from an architecture adoption.", {
    side_effects: ["writes architecture implementation-target artifact"],
    prerequisites: ["architecture adoption exists"],
    allowed_after: ["architecture_create_implementation_result"],
  }),
  op("POST", "architecture_create_implementation_result", "/api/architecture/create-implementation-result", "Record an implementation result for an implementation target.", {
    side_effects: ["writes architecture implementation-result artifact"],
    prerequisites: ["implementation target exists", "result summary present"],
    allowed_after: ["architecture_confirm_retention"],
  }),
  op("POST", "architecture_confirm_retention", "/api/architecture/confirm-retention", "Confirm whether an implementation result should be retained.", {
    side_effects: ["writes architecture retention artifact"],
    prerequisites: ["implementation result exists"],
    allowed_after: ["architecture_create_integration_record"],
  }),
  op("POST", "architecture_create_integration_record", "/api/architecture/create-integration-record", "Create an integration record from a retained architecture result.", {
    side_effects: ["writes architecture integration-record artifact"],
    prerequisites: ["retention artifact exists"],
    allowed_after: ["architecture_record_consumption"],
  }),
  op("POST", "architecture_record_consumption", "/api/architecture/record-consumption", "Record downstream consumption of an integrated architecture result.", {
    side_effects: ["writes architecture consumption-record artifact"],
    prerequisites: ["integration record exists"],
    allowed_after: ["architecture_evaluate_consumption"],
  }),
  op("POST", "architecture_evaluate_consumption", "/api/architecture/evaluate-consumption", "Evaluate consumed architecture output and decide whether to keep or reopen.", {
    side_effects: ["writes architecture post-consumption evaluation"],
    prerequisites: ["consumption record exists"],
    allowed_after: ["architecture_reopen_from_evaluation"],
  }),
  op("POST", "architecture_reopen_from_evaluation", "/api/architecture/reopen-from-evaluation", "Reopen architecture work from a post-consumption evaluation.", {
    side_effects: ["writes architecture start artifact"],
    prerequisites: ["post-consumption evaluation exists"],
  }),
];

const DEEP_TAIL_DETAIL_ROUTE_TABLE: OperationEntry[] = ARCHITECTURE_DEEP_TAIL_STAGES.map((stage) =>
  op(
    "GET",
    `${stage.id}_detail_get`,
    `/api/${stage.apiRouteSegment}/detail`,
    `Read one ${stage.id.replaceAll("_", " ")} detail by relative path.`,
    {
      output_schema: "shared/schemas/artifact-detail.response.schema.json",
    },
  )
);

export const ROUTE_TABLE: OperationEntry[] = [...STATIC_ROUTE_TABLE, ...DEEP_TAIL_DETAIL_ROUTE_TABLE]
  .sort((left, right) => left.name.localeCompare(right.name));

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routePathToRegExp(routePath: string) {
  const pattern = routePath
    .split("/")
    .map((segment) => {
      if (!segment) {
        return "";
      }
      if (segment.startsWith(":")) {
        return "[^/]+";
      }
      return escapeRegex(segment);
    })
    .join("/");
  return new RegExp(`^${pattern}$`);
}

const ROUTE_MATCHERS = ROUTE_TABLE.map((entry) => ({
  entry,
  regexp: routePathToRegExp(entry.path),
}));

export function matchOperationEntry(method: string, pathname: string): OperationEntry | null {
  const normalizedMethod = method.toUpperCase();
  for (const matcher of ROUTE_MATCHERS) {
    if (matcher.entry.method !== normalizedMethod) {
      continue;
    }
    if (matcher.regexp.test(pathname)) {
      return matcher.entry;
    }
  }
  return null;
}

function toApiSchemaPath(schemaPath: string) {
  return `/api/schemas/${path.basename(schemaPath)}`;
}

function rewriteSchemaRef(
  schemaRef: string,
  style: "repo" | "api",
) {
  if (style === "repo") {
    return schemaRef;
  }
  if (schemaRef.startsWith(SHARED_SCHEMA_PREFIX)) {
    return toApiSchemaPath(schemaRef);
  }
  return schemaRef;
}

function buildCapabilityEntries(style: "repo" | "api"): CapabilityEntry[] {
  const capabilitiesDir = path.resolve(process.cwd(), "runtime/capabilities");
  if (!fs.existsSync(capabilitiesDir)) {
    return [];
  }

  return fs.readdirSync(capabilitiesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(capabilitiesDir, entry.name, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { id: entry.name } satisfies CapabilityEntry;
      }
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
          displayName?: string;
          description?: string;
          domain?: string;
          inputSchema?: string;
          outputSchema?: string;
        };
        const capability: CapabilityEntry = {
          id: entry.name,
        };
        if (manifest.displayName || manifest.description || manifest.domain) {
          capability.metadata = {
            ...(manifest.displayName ? { displayName: manifest.displayName } : {}),
            ...(manifest.description ? { description: manifest.description } : {}),
            ...(manifest.domain ? { domain: manifest.domain } : {}),
          };
        }
        if (manifest.inputSchema) {
          capability.inputSchema = rewriteSchemaRef(manifest.inputSchema, style);
        }
        if (manifest.outputSchema) {
          capability.outputSchema = rewriteSchemaRef(manifest.outputSchema, style);
        }
        return capability;
      } catch {
        return { id: entry.name } satisfies CapabilityEntry;
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildSchemaIndex(style: "repo" | "api"): Record<string, string> {
  const schemasDir = path.resolve(process.cwd(), "shared/schemas");
  if (!fs.existsSync(schemasDir)) {
    return {};
  }

  const entries = fs.readdirSync(schemasDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".schema.json"))
    .map((entry) => {
      const schemaRef = `shared/schemas/${entry.name}`;
      return [
        entry.name.replace(/\.schema\.json$/u, ""),
        rewriteSchemaRef(schemaRef, style),
      ] as const;
    })
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries);
}

export function buildApiManifest(input?: {
  schemaRefStyle?: "repo" | "api";
}): ApiManifest {
  const schemaRefStyle = input?.schemaRefStyle ?? "repo";
  return {
    $schema: rewriteSchemaRef(API_MANIFEST_SCHEMA_PATH, schemaRefStyle),
    operations: ROUTE_TABLE.map((entry) => ({
      ...entry,
      ...(entry.input_schema
        ? { input_schema: rewriteSchemaRef(entry.input_schema, schemaRefStyle) }
        : {}),
      ...(entry.output_schema
        ? { output_schema: rewriteSchemaRef(entry.output_schema, schemaRefStyle) }
        : {}),
    })),
    capabilities: buildCapabilityEntries(schemaRefStyle),
    schema_index: buildSchemaIndex(schemaRefStyle),
  };
}
