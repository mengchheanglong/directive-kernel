# Open Improvement Tasks

This document expands the unfinished items from
[Improvement_Plan.md](./Improvement_Plan.md) into a working backlog.

It is intentionally more detailed than the summary table. The goal is to make
each remaining item easier to scope, discuss, and promote into a Kiro spec
without having to reverse-engineer intent from a one-line row.

## Current status

- Shipped: `I1`, `I2`, `I3`, `I4`, `I5`, `I6`, `I7`, `I8`, `I13`
- Open: `I9` through `I12`
- Source of truth for shipped vs open status:
  [Improvement_Plan.md](./Improvement_Plan.md)

## Suggested execution order

This is the pragmatic order, not a theoretical one:

1. `I10` Standardized telemetry + observability surface
2. `I9` Pluggable capability registry + capability template
3. `I11` Replay & time-travel debugger for engine runs
4. `I12` Multi-host federation (read-only)

Why this order:

- `I10` and `I9` are the next highest-leverage executable gaps after the
  read-surface work has landed.
- `I11` becomes easier and more defensible once explainability, legal-action
  hints, and telemetry are already in place.
- `I12` is last because federation magnifies every unresolved single-host
  design weakness.

---

## I4 - `/api/explain?runId=...`

### Status

Shipped. The web host now exposes `GET /api/explain?runId=<id>` as a derived
run explanation surface.

**Audience:** both humans and agents  
**Priority:** P1  
**Effort:** M  
**Depends on:** benefits from `I2`; becomes stronger with `I6`

### Problem

The kernel already stores enough information to answer "what happened to this
run?" but the answer is fragmented across multiple read endpoints and artifact
files. A host, operator, or agent currently has to synthesize the narrative
manually.

### Outcome we want

A single derived read surface that explains:

- what source came in
- what lane it was routed to
- why it was routed that way
- what stage it is currently in
- what is blocked
- what the next legal actions are

### Deliverable

A read endpoint such as:

- `GET /api/explain?runId=<id>`

that returns a structured explanation payload, not only a prose string.

### Recommended response shape

```json
{
  "runId": "run_123",
  "summary": "Submitted on 2026-06-01. Routed to runtime. Promotion is pending proof completion.",
  "lane": "runtime",
  "status": "pending_proof",
  "blockingConditions": ["proof artifact missing"],
  "nextLegalActions": [
    { "name": "runtime_open_proof", "requiresApproval": true }
  ],
  "relatedArtifacts": [],
  "rawRecordPath": "/api/engine-runs/run_123"
}
```

### Likely implementation surface

- `hosts/web-host/api-routes.ts`
- `engine/state/`
- existing run-detail readers and snapshot helpers

### Constraints

- This should be a derived read, not a second source of truth.
- Do not add AI-generated or probabilistic narrative.
- The endpoint should degrade gracefully when a run is partially populated.

### Verification

- unit tests for the summary builder
- integration tests for common run states:
  - newly submitted
  - routed and waiting review
  - runtime mid-lifecycle
  - architecture mid-lifecycle
  - closed/completed

### Main risk

The endpoint becomes misleading if it invents meaning not grounded in the real
artifact graph. Keep it projection-only.

---

## I5 - `/api/glossary`

### Status

Shipped. The web host now exposes `GET /api/glossary` plus exact
case-insensitive `?term=<value>` filtering backed by `GLOSSARY.md`.

**Audience:** both humans and agents  
**Priority:** P1  
**Effort:** S  
**Depends on:** `F4` completed

### Problem

The vocabulary is documented in [GLOSSARY.md](../GLOSSARY.md), but it is only
available as prose. Agents and UIs cannot query it directly.

### Outcome we want

A simple read-only vocabulary endpoint that exposes canonical term definitions,
related terms, and where each term is defined.

### Deliverable

- `GET /api/glossary`
- optionally `GET /api/glossary?term=<name>`

### Recommended response shape

```json
{
  "terms": [
    {
      "term": "directive root",
      "definition": "The on-disk workspace folder a kernel host reads and writes.",
      "relatedTerms": ["mission", "lane"],
      "definedIn": "GLOSSARY.md"
    }
  ]
}
```

### Likely implementation surface

- parser/generator derived from [GLOSSARY.md](../GLOSSARY.md)
- `hosts/web-host/api-routes.ts`

### Constraints

- `GLOSSARY.md` remains the source of truth.
- The generator should be deterministic and strict enough to fail if the
  glossary format drifts.
- No duplicated definitions in code.

### Verification

- unit test for glossary parsing
- integration test for `/api/glossary`
- contract check that every returned term exists in `GLOSSARY.md`

### Main risk

If the parser is too brittle, normal glossary edits will break the endpoint.
Use a minimal, explicit format contract.

---

## I6 - Next legal action hints on every read

### Status

Shipped on the host-facing read model. Queue entries, snapshot summaries, and
artifact detail responses now project structured next-legal-action hints from
canonical workspace state.

**Audience:** both humans and agents  
**Priority:** P1  
**Effort:** M  
**Depends on:** none, but complements `I4` and `I8`

### Problem

The kernel already knows allowed transitions through `allowedNextSteps`, but
most read surfaces do not expose that information directly. Consumers are
forced to infer next actions from lane/stage semantics.

### Outcome we want

Every artifact/detail read should tell the caller which next actions are legal
from that exact state.

### Deliverable

Extend relevant read responses with a structured field such as:

```json
{
  "nextLegalActions": [
    {
      "name": "runtime_open_follow_up",
      "label": "Open runtime follow-up",
      "requiresApproval": true
    }
  ]
}
```

### Likely implementation surface

- `engine/workspace-truth.ts`
- `engine/state/`
- `hosts/web-host/api-routes.ts`
- UI read renderers if they want to display the field

### Constraints

- This must derive from existing workflow truth, not ad hoc route tables in
  the host.
- Returned actions must stay bounded and state-specific.
- The field should appear only where the kernel can state it confidently.

### Verification

- unit tests that assert stage -> action mappings
- integration tests on representative artifact reads
- regression checks when lifecycle truth changes

### Main risk

Drift between lifecycle truth and the hint projection. Keep one authoritative
mapping and project from it.

---

## I7 - `$schema` in API responses

### Status

Shipped. The web host now serves schemas at `GET /api/schemas/:schemaName`
and all stable GET responses advertise a resolvable schema reference:

- object responses carry body-level `$schema`
- array responses carry `Link: <...>; rel="describedby"` so their body shape
  stays unchanged

**Audience:** primarily agents and programmatic hosts  
**Priority:** P1  
**Effort:** S  
**Depends on:** none

### Problem

The repo already has strong JSON Schemas, but most API responses do not point
back to those schemas. That leaves consumers guessing how to validate payloads.

### Outcome we want

Machine-readable responses that self-identify their schema so hosts and agents
can validate them immediately.

### Deliverable

1. Serve schemas under a stable API path, for example:
   - `GET /api/schemas/<schema-name>`
2. Add `$schema` to machine-readable API responses where practical.

### Likely implementation surface

- `hosts/web-host/api-routes.ts`
- `shared/schemas/`
- possibly a small schema-serving helper

### Constraints

- Array responses cannot carry body-level `$schema` without a breaking shape
  change, so they use `rel="describedby"` links instead.
- Keep URLs stable once introduced.

### Verification

- integration tests for schema-serving endpoints
- response-shape checks asserting `$schema` is present and resolvable
- build/check examples if any examples start consuming the new schema URLs

### Main risk

The API starts advertising schemas that do not fully match reality. If a
response is not stable enough for a schema, do not stamp it yet.

---

## I8 - Real operator workbench in the UI

### Status

Shipped in bounded first form. The browser surface now executes the
highest-value operator mutations through the same kernel-backed API routes the
CLI uses:

- source submission
- discovery review and route opening
- engine reroute and operator-owned plan progress updates
- mission preview, approve, and reject
- gap approve and reject
- runtime host selection, promotion seam, and registry acceptance
- runtime follow-up/proof/capability-boundary/promotion-readiness opening
- architecture handoff start plus the bounded materialization chain

**Audience:** human operators  
**Priority:** P1  
**Effort:** L  
**Depends on:** `F8` completed; strongly benefits from `I6` and `I7`

### Problem

The current UI direction is intentionally read-only. That is correct for the
fix track, but it means real operator work still happens through CLI and API
surfaces only.

### Outcome we want

A mutation-capable operator workbench that lets a human complete the bounded
workflow from the browser without inventing a second lifecycle model.

### Scope

This should cover the real operator actions already supported by the kernel,
not a new surface invented for the UI:

- submit source
- review or reroute
- approve/reject mission feedback
- approve/reject gap formalization
- runtime decisions
- architecture lifecycle mutations

### Likely implementation surface

- `ui/src/`
- `hosts/web-host/api-routes.ts`
- existing operator inbox / mutation routes

### Constraints

- Hosts stay thin.
- UI must call the same mutation surfaces already used elsewhere.
- Respect approval boundary and `allowedNextSteps`.
- Do not widen autonomy.

### Verification

- UI integration/smoke tests
- route-level integration tests for every supported mutation
- end-to-end checks for a few real operator flows

### Main risk

This is the easiest place to accidentally create host-local workflow rules.
The UI must stay a client of kernel truth, not its own policy engine.

- **Mutation coverage audit refreshed** at `docs/audits/ui-mutation-coverage-audit.md`. The workbench is no longer read-only; remaining gaps are follow-up polish, not the core I8 blocker.

---

## I9 - Pluggable capability registry + capability template

### Status

- Runtime capability metadata is now available through
  `runtime/core/capability-registry.ts`.
- The web host now exposes `GET /api/runtime/capabilities`.
- A scaffold writer now exists for new capability folders.
- Full contract unification and host-start auto-registration remain open.

**Audience:** both maintainers and consuming hosts  
**Priority:** P2  
**Effort:** M  
**Depends on:** none

### Problem

Capabilities are currently real, but adding one is still a manual,
pattern-copying exercise. There is no clean scaffold or normalized capability
contract beyond existing code conventions.

### Outcome we want

A clear capability contract plus a lightweight scaffolding path that makes
adding a new runtime capability boring and consistent.

### Deliverable

- a formal capability interface/contract
- a registry/discovery mechanism
- a minimal scaffold command or template

### Likely implementation surface

- `runtime/core/`
- `runtime/capabilities/`
- maybe `hosts/standalone-host/cli.ts` for a scaffold command
- `shared/contracts/`

### Constraints

- Existing shipped capabilities must still work unchanged from a consumer
  perspective.
- Avoid plugin theater. Start with an internal registry that is clear and easy
  to extend.
- Capability metadata should stay aligned with schemas and controls.

### Verification

- unit tests around registry loading
- scaffold smoke test
- regression tests for existing capabilities

### Main risk

Over-generalizing the capability model before enough capability patterns exist.
Keep the first pass narrow and grounded in the three shipped capabilities.

---

## I10 - Standardized telemetry + observability surface

### Status

- Telemetry helper shipped at `shared/lib/telemetry.ts`.
- Read-only telemetry snapshot shipped at `GET /api/telemetry/snapshot`.
- Broader engine-wide instrumentation and UI presentation remain open.

**Audience:** both operators and consuming hosts  
**Priority:** P2  
**Effort:** M  
**Depends on:** none

### Problem

There is no consistent, host-consumable observability surface for kernel
activity, latency, queue health, or storage pressure.

### Outcome we want

A minimal telemetry abstraction plus a read path that makes kernel health and
activity visible without binding the project to one telemetry vendor.

### Deliverable

- no-op telemetry interface by default
- instrumentation in high-value paths
- one read-only telemetry snapshot endpoint

### Likely implementation surface

- `shared/lib/`
- `engine/`
- `hosts/web-host/api-routes.ts`
- optional dashboard reader

### Constraints

- Default behavior should remain unchanged when no telemetry sink is supplied.
- Avoid high-cardinality noise.
- Keep the first pass focused on counts, timings, and bounded events.

### Verification

- unit tests for no-op and in-memory telemetry sinks
- integration test for snapshot endpoint
- performance sanity checks so instrumentation cost stays low

### Main risk

If the abstraction is too ambitious, the surface gets noisy fast. Keep the
first version intentionally small.

---

## I11 - Replay and time-travel debugger for engine runs

**Audience:** both humans and agents  
**Priority:** P2  
**Effort:** L  
**Depends on:** `F7`; benefits from `I4`

### Problem

The kernel has replay-related building blocks, but not a first-class "what if"
debugging surface for runs.

### Outcome we want

A non-mutating replay surface that can simulate how a run would behave under
changed inputs or conditions.

### Deliverable

- replay endpoint or CLI path for a run
- structured diff between actual and replayed outcomes
- explicit documentation of determinism boundaries

### Likely implementation surface

- `engine/run-record-replay.ts`
- `hosts/web-host/api-routes.ts`
- possible CLI command in the standalone host

### Constraints

- Replay must be non-persistent unless explicitly promoted into another flow.
- The response must distinguish exact replay from approximate replay.
- Do not hide dependency drift; report it.

### Verification

- unit tests for replay mechanics
- integration tests for run replay endpoints
- determinism checks on stable fixtures

### Main risk

Users may over-trust replay output if the system does not report where replay
cannot be exact. That disclosure has to be part of the feature.

### Status

- **Determinism boundaries documented** at `docs/replay-determinism.md`. Implementation remains open.

---

## I12 - Multi-host federation (read-only)

**Audience:** larger multi-kernel environments  
**Priority:** P3  
**Effort:** XL  
**Depends on:** `I1`, `I7`, and mature single-host read surfaces

### Problem

There is no aggregated view across multiple directive roots or kernel hosts.
That is fine today, but it is the eventual path for portfolio-level visibility.

### Outcome we want

A strictly read-only federation surface that can aggregate snapshots from
multiple kernels without introducing shared mutation semantics.

### Deliverable

- federation config
- aggregated snapshot read endpoint
- optional UI root selector

### Likely implementation surface

- new host-level federation layer
- web host aggregation routes
- maybe a separate config and launcher

### Constraints

- Keep it read-only in the first version.
- Do not merge workflow state or identities across roots.
- Do not start this before single-host read surfaces are stable.

### Verification

- integration tests over multiple temp directive roots
- auth/config tests for remote targets
- partial-failure behavior tests

### Main risk

Federation multiplies ambiguity. If the single-host contract is not already
tight, federation will amplify every inconsistency.

### Status

- **Deferral contract defined** at `shared/contracts/read-only-federation.md`. Implementation remains deferred.

---

## I13 - Reference consumer / golden-path example app

### Status

Shipped in a bounded first form. The repo now includes:
- executable reference consumer flow at `examples/reference-consumer/flow.ts`
- reference consumer inputs under `examples/reference-consumer/`
- CI-backed smoke coverage in `tests/integration/reference-consumer.test.ts`

**Audience:** both new human adopters and agents  
**Priority:** P1  
**Effort:** L  
**Depends on:** audience framing from `F10`; benefits from `I4`, `I6`, `I7`

### Problem

The kernel is meant to be embedded, but the repo still lacks a fully worked
consumer that demonstrates the intended integration shape end-to-end.

### Outcome we want

One concrete consumer that proves:

- how a host resolves a goal envelope
- how a host submits sources through Discovery
- how a host reads back state/results
- how thin the host is supposed to remain

### Deliverable

A small reference app, likely under `examples/` or a clearly named consumer
surface, with:

- a real domain
- a real goal resolver
- a thin host adapter
- a smoke test in CI
- a trace document showing how one source flows through the kernel

### Likely implementation surface

- new `examples/reference-consumer/` tree or equivalent
- README updates
- CI smoke wiring

### Constraints

- keep it small enough to read in one sitting
- do not let the consumer absorb kernel logic
- choose a domain that matches the repo's current audience framing

### Verification

- consumer smoke test in CI
- example flow documentation with exact commands
- contract checks against kernel HEAD

### Main risk

If it becomes a half-product instead of a reference consumer, it turns into a
maintenance burden without improving adoption. Keep it narrow and didactic.

### Status

- **Documentation skeleton exists** at `examples/reference-consumer/`. Implementation remains open.

---

## How to use this document

Use this file when you need:

- a quick explanation of what each remaining task actually means
- a sensible execution order
- likely files and verification surfaces before writing a spec

Do not treat this file as a second status table. Status still lives in
[Improvement_Plan.md](./Improvement_Plan.md).
