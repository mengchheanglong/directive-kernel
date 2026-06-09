# Agents Primer for Directive Kernel

This file is for AI coding agents. Humans should read
[README.md](./README.md) and [Tech_Blueprint.md](./Tech_Blueprint.md) first.
The kernel's audience and positioning are documented in
[AUDIENCE.md](./AUDIENCE.md). This primer gives you the smallest set of
facts, commands, and warnings you need to be productive in 60 seconds.

Longer-form context lives in [README.md](./README.md),
[Tech_Blueprint.md](./Tech_Blueprint.md),
[GLOSSARY.md](./GLOSSARY.md),
[AUDIENCE.md](./AUDIENCE.md), and
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Top 20 terms

These are high-frequency domain terms you will encounter reading kernel
source and contracts. Each term is sourced from
[GLOSSARY.md](./GLOSSARY.md).

- **[Directive root](./GLOSSARY.md#terms)** - The on-disk workspace folder
  a kernel host reads and writes. See `engine/storage.ts`.
- **[Mission](./GLOSSARY.md#terms)** - The top-level intent that frames a
  kernel run. See `engine/mission/`.
- **[Lane](./GLOSSARY.md#terms)** - A top-level workspace member such as
  `discovery`, `runtime`, or `architecture`. See
  `engine/workspace-lanes.ts`.
- **[Discovery](./GLOSSARY.md#terms)** - The lane that turns sources into
  shaped intake records. See `discovery/README.md`.
- **[Runtime](./GLOSSARY.md#terms)** - The lane that operationalizes
  reusable capability work. See `runtime/README.md`.
- **[Architecture](./GLOSSARY.md#terms)** - The lane that handles
  long-horizon decisions and system-improvement artifacts. See
  `architecture/README.md`.
- **[Source](./GLOSSARY.md#terms)** - A consumed input to the kernel such
  as a repo, alert, issue, advisory, or paper. See
  `engine/process-source-record.ts`.
- **[Route](./GLOSSARY.md#terms)** - A routing decision target produced by
  the routing engine. See `engine/routing/routing-assessment.ts`.
- **[Submission](./GLOSSARY.md#terms)** - A source submission through the
  front door. See `discovery/lib/front-door/submission-router.ts`.
- **[Intake](./GLOSSARY.md#terms)** - Discovery's first stage for ingesting
  raw sources. See `discovery/lib/intake/`.
- **[Operator trust score](./GLOSSARY.md#terms)** - The score that gates
  how much initiative an opener can take without reconfirmation. See
  `engine/routing/routing-assessment.ts`.
- **[Allowed next steps](./GLOSSARY.md#terms)** - The valid next-step seam
  options available at a lifecycle stage. See `engine/workspace-truth.ts`.
- **[Closeout](./GLOSSARY.md#terms)** - The terminal lifecycle stage of an
  experiment or architecture cycle. See
  `architecture/lib/experiments/closeout.ts`.
- **[Integrity check](./GLOSSARY.md#terms)** - The guard that confirms
  referenced artifacts exist on disk before an opener proceeds. See
  `engine/approval-boundary.ts`.
- **[Goal envelope](./GLOSSARY.md#terms)** - The host-provided goal input
  that bounds what the kernel may pursue. See
  `shared/contracts/goal-input.md`.
- **[Capability gap](./GLOSSARY.md#terms)** - A documented gap in the
  kernel's capability set. See
  `shared/schemas/capability-gap-entry.schema.json`.
- **[Open gaps view](./GLOSSARY.md#terms)** - The projection that surfaces
  unaddressed capability gaps to operators. See `discovery/lib/gaps/`.
- **[Materialization tail](./GLOSSARY.md#terms)** - The post-experiment
  phase where consumption is recorded and integration is materialized. See
  `architecture/lib/control/materialization-tail-stage-map.ts`.
- **[Schema](./GLOSSARY.md#terms)** - A JSON Schema that defines the shape
  of a persisted artifact. See `shared/schemas/run-record.schema.json`.
- **[Decision-policy ledger](./GLOSSARY.md#terms)** - The append-only record
  of routing and review decisions. See `engine/decision-policy-ledger.ts`.

For terms not listed here, see [GLOSSARY.md](./GLOSSARY.md) or
query `/api/glossary`.

## Top operations

These are the most frequently invoked operator actions. Prefer the CLI
where it exists today. API-only operations are labeled explicitly.

### 1. Submit a source
Submit a source through the Discovery front door.

- **CLI:** `pnpm run standalone:cli discovery-submit --directive-root <path> --input-json-path <path> [--process-with-engine]`
- **API:** `POST /api/discovery/submissions`
- **Contract:** [shared/contracts/goal-input.md](./shared/contracts/goal-input.md)

### 2. See current state
Inspect queue entries, engine runs, handoffs, and summary state.

- **API:** `GET /api/snapshot`
- **API:** `GET /api/operator-decision-inbox`
- No standalone CLI command for state overview exists today.

### 3. Reroute with answers
Fold operator answers into a fresh routing pass for an existing engine run.

- **CLI:** `pnpm run standalone:cli engine-reroute --directive-root <path> --run-id <id> --answers-json-path <path>`
- **API:** `POST /api/engine-runs/:runId/reroute`
- **Contract:** [shared/schemas/run-record.schema.json](./shared/schemas/run-record.schema.json)

### 4. Write decision (promotion seam)
Resolve a Runtime promotion-seam decision.

- **CLI:** `pnpm run standalone:cli runtime-promotion-seam-resolve --directive-root <path> --promotion-readiness-path <path> --rationale <text>`
- **API:** `POST /api/runtime/promotion-seam-decisions`

### 5. Write decision (host selection)
Resolve a Runtime host-selection decision.

- **CLI:** `pnpm run standalone:cli runtime-host-selection-resolve --directive-root <path> --promotion-readiness-path <path> --decision <select_standalone|select_web|confirm_inferred|override|defer> --rationale <text>`
- **API:** `POST /api/runtime/selection-resolutions`

### 6. Write decision (registry acceptance)
Accept a Runtime promotion record into the registry.

- **CLI:** `pnpm run standalone:cli runtime-registry-accept --directive-root <path> --promotion-record-path <path> --rationale <text>`
- **API:** `POST /api/runtime/registry-acceptance-decisions`

### 7. Formalize a gap
Approve or reject a capability-gap formalization.

- **CLI:** `pnpm run standalone:cli gap-approve --directive-root <path> --formalization-id <id> --priority <high|medium|low> --rationale <text>`
- **API:** `POST /api/gaps/approve`
- **Contract:** [shared/schemas/capability-gap-entry.schema.json](./shared/schemas/capability-gap-entry.schema.json)

### 8. Edit mission
Preview, approve, reject, revert, or inspect mission evolution.

- **CLI:** `pnpm run standalone:cli mission-feedback --directive-root <path>`
- **CLI:** `pnpm run standalone:cli mission-preview --directive-root <path> --feedback-id <id>`
- **CLI:** `pnpm run standalone:cli mission-approve --directive-root <path> --feedback-id <id> --rationale <text>`
- **API:** `POST /api/mission/preview`, `POST /api/mission/approve`, `POST /api/mission/reject`, `POST /api/mission/revert`
- **Contract:** [shared/contracts/goal-input.md](./shared/contracts/goal-input.md)

### 9. Open runtime follow-up
Write a Runtime follow-up artifact from a prior run record.

- **CLI:** `pnpm run standalone:cli runtime-followup-write --directive-root <path> --input-json-path <path>`
- **API-only** for opening from an existing run record.

### 10. Run maintenance
Archive old run records and rotate the decision-policy ledger.

- **CLI:** `pnpm run standalone:cli maintenance archive --directive-root <path> [--max-age-days <n>] [--rotate-ledger|--no-rotate-ledger] [--dry-run]`
- **Contract:** [shared/contracts/data-retention.md](./shared/contracts/data-retention.md)

## 5 things that will break

1. **Direct writes to numbered artifact folders.** Writing files into
   `discovery/01-intake/` or `architecture/02-adopted/` by hand puts files
   on disk but the workflow does not pick them up correctly. Fix: use the
   front door or a documented CLI/API entry point. Enforced by
   `discovery/lib/intake/queue-writer.ts` and the intake/front-door path.

2. **Bypassing the approval boundary.** Writing artifacts directly to disk
   without going through `engine/approval-boundary.ts` breaks integrity and
   lifecycle invariants. Fix: route mutable writes through the approval
   boundary. Enforced by `engine/approval-boundary.ts` and hardening coverage
   under `tests/integration/hardening/`.

3. **Schema-version mismatch.** Submitting a record with
   `schemaVersion > 9` produces `schema_version_future` from
   `engine/storage.ts`. Records older than v9 are migrated automatically on
   read. Fix: the kernel supports up to v9 records; downgrade or migrate
   intentionally. Enforced by `shared/contracts/schema-versioning.md` and
   `tests/integration/hardening/schema-version-check.test.ts`.

4. **Submitting a source without a goal envelope.** Discovery refuses to
   route a source that has no goal context. Fix: provide goal input per
   `shared/contracts/goal-input.md` or use `DIRECTIVE_GOAL.md` at the
   directive root. Enforced by `shared/lib/goal.ts` and the submission
   validation path.

5. **Ignoring `allowedNextSteps`.** The kernel rejects artifact transitions
   that are not in the documented `allowedNextSteps` array. Symptom: opener
   or transition validation fails with a missing-prerequisite error. Fix:
   follow `allowedNextSteps` on each artifact and use
   `docs/operator-cli.md` for canonical commands. Enforced by
   `engine/workspace-truth.ts` and `runtime/lib/operations/`.

## Canonical entry points

Do exactly one of these per task.

| Task | Command |
|------|---------|
| Submit a source | `pnpm run standalone:cli discovery-submit --directive-root <path> --input-json-path <path> --process-with-engine` |
| See current state | `GET /api/snapshot` through a running web host (`pnpm run start`) |
| Run the UI | `pnpm run start` |
| Run tests | `pnpm run test` |
| Rebuild | `pnpm run build` |

Prerequisite for any command that reads or writes a directive root: run
`pnpm run standalone:cli init --output-root <path> --received-at <yyyy-mm-dd>`
first.

## What lives where

- **`engine/`** - Shared logic that ties the lanes together: routing
  assessment, mission management, orchestration, state resolution, and the
  case store. Canonical entry: `engine/index.ts`.

- **`discovery/`** - Source intake, triage, and routing. Owns the front door
  (`discovery/lib/front-door/index.ts`), the intake queue, capability gaps,
  and routing records. The Python `research-engine/` workspace is a separate
  opt-in component under `discovery/research-engine/`.

- **`runtime/`** - Capability operationalization. Owns the operations layer
  (`runtime/lib/operations/`), contract types (`runtime/core/`), callable
  implementations (`runtime/capabilities/`), and dashboard projections.

- **`architecture/`** - Long-horizon decisions: experiments, adoption,
  closeout, materialization, and implementation records. Canonical entry:
  `architecture/lib/index.ts`.

See `Tech_Blueprint.md` Section 4 ("Lanes") for the longer treatment.

## How to ask (live lookup)

- **`/api/manifest`** - Operation catalog listing available endpoints and
  commands, including schema references where defined.

- **`/api/glossary`** - Vocabulary lookup returning one-sentence term
  definitions from [GLOSSARY.md](./GLOSSARY.md). Supports
  `?term=<name>` for exact case-insensitive lookup.

- **`/api/snapshot`** - Current state of the directive root, including queue
  entries, engine runs, handoffs, and dashboard summary state.

- **`/api/operator-decision-inbox`** - Pending reviews and operator-facing
  decision work.

- **`/api/runtime/status`** - Storage and maintenance status for the
  directive root. Use this for storage summary, not full workflow state.
