# Directive Kernel — Improvement Plan

> Plan for **net-new enhancements** that make the kernel more useful, compelling, and intuitive — for humans and for AI coding agents.
> Companion to `Fix_Plan.md` (which addresses current problems).
> Each item is scoped so it can be promoted to a Kiro spec when picked up for execution.

---

## Guiding principle

The kernel's bones are good. The problem is presentation, surface area, and agent-readiness. Every enhancement here is judged by one question:

> *Does this make it easier for a human or an agent to do useful work in the next 60 seconds?*

If the answer is no, the enhancement waits.

---

## How to read this plan

| Field | Meaning |
|-------|---------|
| **Audience** | H = human operator, A = AI coding agent, B = both |
| **Priority** | P0 = highest leverage, P1 = high impact, P2 = nice to have |
| **Effort** | S = ≤1 day, M = 2–5 days, L = 1–2 weeks, XL = 2+ weeks |
| **Depends on** | Items from `Fix_Plan.md` (F#) or this plan (I#) |

---

## Priority summary

| # | Item | Audience | Priority | Effort |
|---|------|----------|----------|--------|
| I1 | MCP server mirroring the HTTP API | A | P0 | M |
| I2 | `/api/manifest` operation catalog | A | P0 | S |
| I3 | `AGENTS.md` repo-root primer | A | P0 | S |
| I4 | `/api/explain?runId=...` natural-language summary | B | P1 | M |
| I5 | `/api/glossary` queryable vocabulary | B | P1 | S |
| I6 | "Next legal action" hints on every read | B | P1 | M |
| I7 | Schemas referenced via `$schema` in API responses | A | P1 | S |
| I8 | Real operator workbench in the UI | H | P1 | L |
| I9 | Pluggable capability registry + capability template | B | P2 | M |
| I10 | Standardized telemetry + observability surface | B | P2 | M |
| I11 | Replay & time-travel debugger for engine runs | B | P2 | L |
| I12 | Multi-host federation (read-only) | B | P3 | XL |
| I13 | Reference consumer / golden-path example app | B | P1 | L |

---

## I1 — MCP server mirroring the HTTP API

**Audience:** A · **Priority:** P0 · **Effort:** M · **Depends on:** F2 (JS build helps but not required)

**Why this is the single highest-leverage move.** The kernel already has a clean operation surface: submit source, route, plan-progress, reroute, approve, write record. Wrapping that surface as an MCP server lets any AI coding agent drive the entire workflow without learning the CLI or HTTP semantics. Given the current AI tooling moment, this is table stakes for "agent-friendly." Without it, agents have to reinvent the wheel.

**What to build.**
1. New package `hosts/mcp-host/` exposing every existing operation in `hosts/web-host/api-routes.ts` as an MCP tool.
2. Each tool name maps 1:1 to an API route: `discovery_submit`, `engine_reroute`, `runtime_open_follow_up`, `architecture_handoff_start`, etc.
3. Tool input schemas come straight from `shared/schemas/` — no hand-written types.
4. Tool descriptions include: purpose, prerequisites, side effects, allowed next operations.
5. CLI: `kernel mcp serve --directive-root <path>` — speaks MCP over stdio; works with Claude Desktop, Cursor, and other MCP clients out of the box.
6. Add example MCP client config to `README.md`.

**Why this beats just having a REST API.** Agents don't natively browse REST APIs. MCP gives them a tool catalog, schema validation, and structured outputs — the contract is explicit and machine-checkable.

**Files.** New `hosts/mcp-host/` tree, updated root `package.json` exports, README example.

**Risk.** Low. The kernel's HTTP API already has clean separation between transport and operation; MCP becomes another transport binding.

---

## I2 — `/api/manifest` operation catalog

**Audience:** A · **Priority:** P0 · **Effort:** S · **Depends on:** —

**What.** A single GET endpoint that returns the entire kernel operation catalog as JSON:

```json
{
  "operations": [
    {
      "name": "discovery_submit",
      "method": "POST",
      "path": "/api/discovery/submissions",
      "input_schema": "$schema/discovery-submission-request.json",
      "output_schema": "$schema/directive-engine-run-record.json",
      "side_effects": ["writes intake record", "writes routing record"],
      "prerequisites": ["goal envelope present"],
      "allowed_after": ["engine_reroute", "runtime_open_follow_up"]
    }
  ],
  "capabilities": [...],
  "schema_index": {...}
}
```

**Why.** An agent (or new contributor) can read this once and know the full surface. No more grepping through five files to figure out what's POST-able.

**Files.** `hosts/web-host/api-routes.ts` (new route), small generator that walks the existing route table.

**Risk.** Low. The catalog is derived data; no logic moves.

---

## I3 — `AGENTS.md` repo-root primer

**Audience:** A · **Priority:** P0 · **Effort:** S · **Depends on:** F4 (vocabulary diet helps but not required)

**Why.** `Tech_Blueprint.md` describes the system. `AGENTS.md` tells an agent what to do. They are different documents.

**Contents.**
1. **Top 20 terms** with one-sentence plain-English definitions (subset of `GLOSSARY.md`).
2. **Top 10 operations** the agent will actually run, with example commands.
3. **5 things that will break** — e.g. "don't write to `01-intake/` directly, use the front door"; "don't bypass the approval boundary"; "the schema version must match `shared/schemas/`."
4. **Canonical entry points** — exactly one path each for: submit a source, see current state, run the UI, run tests, rebuild.
5. **What lives where** — three sentences on the lane/host split.
6. **How to ask** — point to `/api/manifest` and `/api/glossary` for live lookup.

**Files.** New `AGENTS.md` at repo root.

**Risk.** None. Pure documentation.

---

## I4 — `/api/explain?runId=...` natural-language summary

**Audience:** B · **Priority:** P1 · **Effort:** M · **Depends on:** I2 helps

**Problem.** To answer "what happened to source X?" a human or agent has to compose the answer from `/api/engine-runs`, `/api/queue-entry`, `/api/discovery-routing-records/detail`, and the artifact files. That is five reads and a synthesis step.

**Fix.** A single endpoint that takes a `runId` and returns a structured natural-language summary:

```json
{
  "summary": "Submitted 2026-05-12. Routed to runtime with confidence 0.78. Operator approved 2026-05-13. Currently in proof phase, gate `proof_artifact_present` not yet passed.",
  "next_legal_actions": ["runtime_open_proof", "runtime_open_runtime_capability_boundary"],
  "blocking_conditions": ["awaiting proof artifact"],
  "related_runs": [...],
  "raw_record_url": "/api/engine-runs/<id>"
}
```

**Why.** Agents shouldn't have to compose state from primitives when the engine already knows the answer. Humans in the UI benefit identically.

**Files.** New route in `hosts/web-host/api-routes.ts`, helper in `engine/state/` or `engine/execution/`.

**Risk.** Low. The "raw" view stays available; this is a derived projection.

---

## I5 — `/api/glossary` queryable vocabulary

**Audience:** B · **Priority:** P1 · **Effort:** S · **Depends on:** F4

**What.** Endpoint returning the project's vocabulary as queryable JSON:

```json
{
  "terms": [
    {
      "term": "earned autonomy",
      "plain_english": "How much the system trusts the operator's recent routing decisions",
      "related_terms": ["decision policy ledger", "operator trust score"],
      "defined_in": "engine/routing/earned-autonomy.ts"
    }
  ]
}
```

Generated from `GLOSSARY.md` (which `Fix_Plan.md` F4 produces).

**Why.** Half the friction with this codebase is decoding terms. Making them queryable removes that friction for agents and gives the UI a tooltip backbone.

**Files.** Small generator script + new route. Source of truth stays in `GLOSSARY.md`.

**Risk.** None. Read-only derived data.

---

## I6 — "Next legal action" hints on every read

**Audience:** B · **Priority:** P1 · **Effort:** M · **Depends on:** —

**Why.** `engine/workspace-truth.ts` already encodes `legalNextSeams` per lane. That information is currently locked inside the engine and surfaces only implicitly through the UI. Exposing it on every artifact response converts "guess what's allowed" into "the API tells me what's allowed."

**Fix.**
1. Every artifact-detail response (handoff, runtime record, architecture result, etc.) gains a `next_legal_actions: [{ name, label, requires_approval }]` field.
2. `engine/state/` computes the list by reading the artifact's lane + current stage and consulting `legalNextSeams`.
3. The UI workbench (F8) and any agent (I1, I2) can then render an exact action menu without hand-coded rules.

**Files.** Most artifact response builders in `hosts/web-host/api-routes.ts`, helper in `engine/state/`.

**Risk.** Medium. The truth map must stay accurate; covered by F1 tests.

---

## I7 — Schemas referenced via `$schema` in API responses

**Audience:** A · **Priority:** P1 · **Effort:** S · **Depends on:** —

**Why.** `shared/schemas/` already contains JSON Schemas for every machine-readable shape. They sit there unused by the API. Adding `"$schema": "/api/schemas/<name>.json"` to every response (and serving the schema files at that path) lets any agent validate a response without guessing.

**Fix.**
1. Add a `/api/schemas/<name>` static route that serves files from `shared/schemas/`.
2. Every response from `hosts/web-host/api-routes.ts` includes a `$schema` URL pointing to its schema.
3. Add an `Accept: application/schema+json` header convention for fetching just the schema.

**Files.** `hosts/web-host/api-routes.ts`, possibly a small middleware.

**Risk.** None.

---

## I8 — Real operator workbench in the UI

**Audience:** H · **Priority:** P1 · **Effort:** L · **Depends on:** F8 decision

**Note.** This is the implementation half of `Fix_Plan.md` F8. Listed here because it is also a feature improvement, not just a fix for the current half-built UI.

**Scope.** Browser-side mutations for:
1. Submit source (front door)
2. Approve / reject route
3. Reroute with structured answers
4. Write decision record
5. Mission feedback + approve
6. Gap formalize / approve
7. Runtime openers (follow-up, proof, capability boundary, promotion readiness)
8. Architecture lifecycle steps (handoff, bounded closeout, adopt result, materialization tail)

Each form derives its inputs from the matching JSON Schema (I7). Each form respects approval boundary (refuses to render submit when `integrityState !== "ok"`). Each form shows the `next_legal_actions` hint (I6) after success.

**Files.** `ui/src/forms/`, `ui/src/page-actions.ts`, renderers.

**Risk.** Medium-high. The full surface is large; ship vertical slices (one mutation per PR).

---

## I9 — Pluggable capability registry + capability template

**Audience:** B · **Priority:** P2 · **Effort:** M · **Depends on:** —

**Problem.** `runtime/capabilities/` ships three concrete capabilities (literature-access, code-normalizer, research-vault-source-pack), all hand-wired. Adding a fourth means copying patterns from the existing three. There is no "capability scaffold."

**Fix.**
1. Define a `Capability` interface in `runtime/core/` with: `id`, `metadata`, `inputSchema`, `outputSchema`, `execute()`, `controls`, `lifecycle`.
2. Move the three existing capabilities to implement it.
3. Add a `kernel new-capability <name>` CLI that scaffolds a new capability folder with stubs.
4. Add a discovery mechanism: capability folders matching a convention are auto-registered on host start.
5. Document the contract in `shared/contracts/capability.md` with an enforced reference to the interface.

**Files.** `runtime/core/`, `runtime/capabilities/*`, new CLI command.

**Risk.** Medium. Touches the runtime contract; F1 tests must catch regressions.

---

## I10 — Standardized telemetry + observability surface

**Audience:** B · **Priority:** P2 · **Effort:** M · **Depends on:** —

**Problem.** `process-fingerprint.ts` already exposes hits/misses telemetry. Nothing else does. Operators and agents have no consistent way to ask "is the system healthy?" or "where is time being spent?"

**Fix.**
1. Introduce a `Telemetry` interface with `counter`, `gauge`, `histogram`, `event`. No-op implementation by default; consumers wire whatever they want (OpenTelemetry, console, custom).
2. Instrument the high-traffic paths: every `processSource`, every store write, every routing assessment, every approval-boundary check.
3. Add `/api/telemetry/snapshot` returning current counters + gauges as JSON.
4. Add a "system health" panel to the UI driven by the snapshot.

**Files.** New `shared/lib/telemetry.ts`, instrumentation throughout `engine/`, new route, UI panel.

**Risk.** Low. Default no-op preserves current behavior.

---

## I11 — Replay & time-travel debugger for engine runs

**Audience:** B · **Priority:** P2 · **Effort:** L · **Depends on:** F7

**Why.** `run-record-replay.ts` already exists. It currently powers reroute and mission preview. Extending it into a full debugger gives operators (and agents) a way to ask "what would have happened if?" without writing.

**What.**
1. `/api/runs/<id>/replay?with_changes=...` returns a full simulated run record without persistence.
2. UI: a "what if" panel on every run-detail page that lets an operator change mission/source fields and see the new routing decision.
3. CLI: `kernel replay <runId> --change goal=...` for agents.
4. Document the determinism boundaries: replay is exact when fingerprint inputs are unchanged; approximate when external context (decision-policy ledger, source-similarity index) has drifted.

**Files.** `engine/run-record-replay.ts` extensions, new route, UI panel, CLI command.

**Risk.** Medium. Determinism guarantees need property tests. Sequence after F1, F7.

---

## I12 — Multi-host federation (read-only)

**Audience:** B · **Priority:** P3 · **Effort:** XL · **Depends on:** I1, I7

**Speculative.** Allow a UI or agent to view multiple directive roots through one host. Useful for orgs running per-team kernels who want a portfolio view. Out of scope until single-host UX is polished.

**Sketch.** A federation host reads `kernel-federation.config.json` listing remote `(name, url, auth)` entries. It exposes `/api/federation/snapshot` aggregating per-root snapshots. UI gains a root selector.

**Risk.** High. Don't build until the rest is solid.

---

## I13 — Reference consumer / golden-path example app

**Audience:** B · **Priority:** P1 · **Effort:** L · **Depends on:** F10 (audience pick) helps; not strictly required

**Why.** The kernel is pitched as "embed in another project," but there is no working consuming project in the repo that exercises it end-to-end. `hosts/integration-kit/examples/` ships JSON payloads, not a real app. New users (and AI agents) have to assemble the picture from contracts, schemas, and three reference hosts that aren't themselves consumers.

A real reference consumer answers questions the docs can't: "what does a goal resolver actually look like?", "where do project-local records live?", "how does the host adapter wire into a real domain?", "what does the operator workflow feel like end-to-end?"

**What to build.**

1. New top-level folder `examples/reference-consumer/` (or its own repo, depending on F10 outcome).
2. A small but realistic consuming project — concrete enough that someone can read it cover-to-cover in 30 minutes and copy the patterns. Suggested domain: customer feedback triage (non-research, generic enough to repurpose). Alternative: security advisory triage. Whichever F10 picks.
3. The reference consumer demonstrates:
   - Implementing a project-specific goal resolver that maps product state to a goal envelope
   - Submitting sources through the canonical Discovery front door (not through a custom path)
   - A thin host adapter for one real callable capability
   - Project-local storage choices (e.g. SQLite for the consumer's own records, kernel for routing decisions)
   - A project-local approval policy that gates which routes auto-approve
   - A small consumer-side UI that embeds the kernel UI as a panel
4. Includes a `README.md` walking through every wiring point with line-level references back to the kernel exports it uses.
5. Includes a `kernel-trace.md` that shows, for one real source moving through the system, exactly which kernel files are touched in what order — turning the abstract pipeline into a concrete trace.
6. CI runs the reference consumer's smoke test against the kernel HEAD; breakage in the consumer is the kernel's bug, not the consumer's. This is the kernel's integration test.

**Why this matters more than another doc.**
- For humans: copying a working project beats reading 50 contracts.
- For AI agents: a worked example with traceable file references is the single most useful artifact you can give them. It's the difference between "I understand the kernel" and "I can build with the kernel."
- For the kernel itself: forces the team to feel the rough edges a real consumer feels. Every paper-cut the reference consumer hits gets fixed in the kernel, not papered over in docs.

**Files.** New `examples/reference-consumer/` tree. CI integration. README updates pointing to it as the canonical "start here."

**Risk.** Medium. The reference consumer becomes a maintenance commitment — but that's a feature, since it forces the team to keep the kernel actually usable.

**Note on scope.** The reference consumer should be small enough to read in one sitting (target: under 1,500 LOC). If it grows beyond that, split into "minimal" and "advanced" tracks. The point is to be readable, not to be a product.

---

## How the two plans relate

```
                 ┌─── Fix Plan (F1–F10) ───┐
                 │  remove pain, build     │
                 │  trust in the bones     │
                 └─────────────┬───────────┘
                               │
                               ▼
                 ┌─── Improvement Plan ────┐
                 │  add leverage, make it  │
                 │  agent-native           │
                 └─────────────────────────┘
```

Sequence: ship the P0 fixes (F1, F2, F3, F4) before any P0 improvement except I3 (which is just docs). Once the kernel is testable, runnable in production, demonstrable in 60 seconds, and free of vocabulary tax, the improvements compound.

If only one improvement ships, ship **I1 (MCP server)** + **I3 (AGENTS.md)**. Those two together convert the project from "interesting but inscrutable" to "I can put an agent on this in an afternoon."

---

*Each I-item can become a Kiro spec on demand. Keep this file as the rolling list of net-new ideas; move items into in-flight specs as they're picked up.*
