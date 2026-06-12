# Glossary

This document is the source of truth for kernel-internal vocabulary.
Every term defined here is either a Vocabulary_Rename_Set target (a term
introduced or kept by the v8 → v9 cut) or a Do_Not_Touch_Term_Set entry
(a term locked from renaming for project-history reasons). The audit at
[`vocabulary-audit.csv`](./vocabulary-audit.csv) records the disposition
of every term considered for renaming; this glossary is the human-
readable companion to that audit.

## Terms

- **Adopter**: A consuming project that embeds or calls the kernel. See
  [`shared/contracts/standalone-host-runtime-profile.md`](./shared/contracts/standalone-host-runtime-profile.md).
- **Adoption**: The lifecycle stage where an architecture experiment is
  formally adopted into the codebase. See
  [`architecture/lib/adoption/`](./architecture/lib/adoption/).
- **Allowed next steps**: The set of next-step seam options available to
  an opener at a given lifecycle stage; replaces "legal next seams". See
  [`engine/workspace-truth.ts`](./engine/workspace-truth.ts).
- **Approval**: An operator approval action that gates a lifecycle
  transition. See
  [`engine/approval-boundary.ts`](./engine/approval-boundary.ts).
- **Architecture**: The lane that holds long-horizon decisions and
  artifacts; locked term per Do_Not_Touch_Term_Set. See
  [`architecture/README.md`](./architecture/README.md).
- **Artifact**: A persisted JSON document produced by the kernel during a
  run. See [`shared/contracts/`](./shared/contracts/).
- **Audit**: An auditable record or a code review of kernel output. See
  [`docs/contracts/design-review-skill-guard.md`](./docs/contracts/design-review-skill-guard.md).
- **Bearer**: A bearer token used by hosts to authenticate with the
  kernel. See
  [`shared/contracts/standalone-host-api-auth-guard.md`](./shared/contracts/standalone-host-api-auth-guard.md).
- **Boundary**: An approval boundary or capability boundary that gates
  kernel transitions. See
  [`engine/approval-boundary.ts`](./engine/approval-boundary.ts).
- **Bundle**: A research bundle or runtime callable bundle of related
  artifacts. See
  [`shared/schemas/cross-source-synthesis-packet.schema.json`](./shared/schemas/cross-source-synthesis-packet.schema.json).
- **Capability**: A reusable callable surface exposed by the kernel
  (literature access, web access, etc.). See
  [`shared/contracts/host-callable-adapter.md`](./shared/contracts/host-callable-adapter.md).
- **Capability gap**: A documented gap in the kernel's capability set
  that discovery has surfaced. See
  [`shared/schemas/capability-gap-entry.schema.json`](./shared/schemas/capability-gap-entry.schema.json).
- **Case**: A case record tracked by the kernel engine. See
  [`engine/process-source-record.ts`](./engine/process-source-record.ts).
- **Closeout**: The terminal lifecycle stage of an experiment or
  architecture cycle; replaces "bounded closeout". See
  [`architecture/lib/experiments/closeout.ts`](./architecture/lib/experiments/closeout.ts).
- **Consumption**: The architecture consumption-record stage where
  downstream usage of an adopted result is recorded. See
  [`architecture/lib/materialization/`](./architecture/lib/materialization/).
- **Coverage**: A Discovery coverage metric that tracks how well the
  capability-gap space is addressed. See
  [`discovery/lib/front-door/coverage.ts`](./discovery/lib/front-door/coverage.ts).
- **Directive root**: The on-disk workspace folder a kernel host reads
  and writes; locked term per Do_Not_Touch_Term_Set. See
  [`engine/storage.ts`](./engine/storage.ts).
- **Discovery**: The lane that turns sources into shaped intake records;
  locked term per Do_Not_Touch_Term_Set. See
  [`discovery/README.md`](./discovery/README.md).
- **Evaluation**: The post-consumption evaluation stage where operator
  feedback is collected. See
  [`docs/contracts/evaluator-contract.md`](./docs/contracts/evaluator-contract.md).
- **Event**: An event record produced by the kernel. See
  [`engine/storage.ts`](./engine/storage.ts).
- **Experiment**: An architecture experiment that tests a proposed change
  before adoption. See
  [`architecture/lib/experiments/`](./architecture/lib/experiments/).
- **Feedback**: Operator feedback collected during evaluation. See
  [`docs/contracts/experiment-score-feedback.md`](./docs/contracts/experiment-score-feedback.md).
- **Front door**: The Discovery submission entry point where sources
  enter the kernel. See
  [`discovery/lib/front-door/index.ts`](./discovery/lib/front-door/index.ts).
- **Goal envelope**: A goal envelope from the host that bounds what the
  kernel may pursue. See
  [`shared/contracts/goal-input.md`](./shared/contracts/goal-input.md).
- **Host**: The runtime that embeds or invokes the kernel. See
  [`shared/contracts/runtime-to-host.md`](./shared/contracts/runtime-to-host.md).
- **Inbox**: The operator decision inbox where pending approvals and
  reviews are surfaced. See
  [`engine/mission/mission-feedback-inbox.ts`](./engine/mission/mission-feedback-inbox.ts).
- **Intake**: Discovery's first stage that ingests raw sources. See
  [`discovery/lib/intake/`](./discovery/lib/intake/).
- **Integrity check**: The pre-opener guard that confirms a directive
  root's referenced artifacts exist on disk; replaces "integrity gate".
  See [`engine/approval-boundary.ts`](./engine/approval-boundary.ts).
- **Intelligence packet**: A research-engine output packet that bundles
  source analysis results. See
  [`shared/schemas/phase-handoff-packet.schema.json`](./shared/schemas/phase-handoff-packet.schema.json).
- **Kernel**: The root TypeScript package `@directive/kernel`; locked
  term. See [`README.md`](./README.md).
- **Lane**: A top-level workspace member of the kernel
  (`discovery`/`runtime`/`architecture`); locked term. See
  [`engine/workspace-lanes.ts`](./engine/workspace-lanes.ts).
- **Materialization**: The architecture phase that records consumption
  and realized outcomes. See
  [`architecture/lib/materialization/`](./architecture/lib/materialization/).
- **Materialization tail**: The post-experiment phase where consumption
  is recorded and integration is materialized; replaces "deep tail". See
  [`architecture/lib/control/materialization-tail-stage-map.ts`](./architecture/lib/control/materialization-tail-stage-map.ts).
- **Migration**: A schema migration that rewrites persisted records
  between versions. See
  [`shared/schemas/migrations/index.ts`](./shared/schemas/migrations/index.ts).
- **Mission**: The top-level intent that frames a kernel run; locked
  term per Do_Not_Touch_Term_Set. See
  [`engine/mission/`](./engine/mission/).
- **Mission alignment**: A source's alignment to the host's mission goal
  envelope. See
  [`shared/contracts/discovery-mission-routing.md`](./shared/contracts/discovery-mission-routing.md).
- **Open gaps view**: The projection that surfaces unaddressed capability
  gaps to operators; replaces "gap radar". See
  [`discovery/lib/gaps/`](./discovery/lib/gaps/).
- **Operator trust score**: The numeric score that gates how much
  initiative an opener can take without re-confirmation; replaces
  "earned autonomy". See
  [`engine/routing/assessment.ts`](./engine/routing/assessment.ts).
- **Out of scope**: An explicit boundary marker on the items a cut will
  not touch; replaces "forbidden scope expansion". See
  [`engine/workspace-truth.ts`](./engine/workspace-truth.ts).
- **Process**: Standard English term used in the process-source flow.
  See [`engine/process-source-record.ts`](./engine/process-source-record.ts).
- **Promotion**: Runtime's promotion lifecycle stage that advances
  artifacts toward readiness. See
  [`runtime/lib/operations/promotion-readiness.ts`](./runtime/lib/operations/promotion-readiness.ts).
- **Proof**: Evidence backing a runtime or architecture record,
  collected during proof-openers. See
  [`runtime/lib/operations/record-proof-opener.ts`](./runtime/lib/operations/record-proof-opener.ts).
- **Rate limit**: A request-rate cap enforced by the kernel on host
  calls. See
  [`shared/contracts/standalone-host-api-auth-guard.md`](./shared/contracts/standalone-host-api-auth-guard.md).
- **Readiness**: The runtime promotion-readiness state that gates whether
  an artifact can be promoted. See
  [`runtime/lib/operations/promotion-readiness.ts`](./runtime/lib/operations/promotion-readiness.ts).
- **Record**: A persisted JSON artifact at rest in a directive root. See
  [`engine/storage.ts`](./engine/storage.ts).
- **Registry**: Runtime's registry of accepted capabilities that the
  kernel exposes to hosts. See
  [`shared/schemas/checker-definition-registry.schema.json`](./shared/schemas/checker-definition-registry.schema.json).
- **Route**: A routing decision target (`runtime`, `architecture`, etc.)
  produced by the routing engine. See
  [`engine/routing/assessment.ts`](./engine/routing/assessment.ts).
- **Routing**: The act of deciding a route for a source. See
  [`engine/routing/`](./engine/routing/).
- **Routing assessment**: The structured output of the routing engine
  that scores and routes a source. See
  [`engine/routing/assessment.ts`](./engine/routing/assessment.ts).
- **Routing digest**: A summarized routing assessment surfaced to
  operators. See
  [`engine/routing/digest.ts`](./engine/routing/digest.ts).
- **Runtime**: The lane that runs experiments under operator review;
  locked term per Do_Not_Touch_Term_Set. See
  [`runtime/README.md`](./runtime/README.md).
- **Schema**: A JSON Schema that defines the shape of a persisted
  artifact. See
  [`shared/schemas/run-record.schema.json`](./shared/schemas/run-record.schema.json).
- **Seam**: A workflow seam that marks a decision point between lifecycle
  stages. See
  [`docs/contracts/lifecycle-transition-policy.md`](./docs/contracts/lifecycle-transition-policy.md).
- **Signal**: A source signal token used in routing to classify the
  source. See
  [`docs/contracts/intake-stack-signals.md`](./docs/contracts/intake-stack-signals.md).
- **Snapshot**: A snapshot artifact that captures the state of a
  directive root at a point in time. See
  [`engine/storage.ts`](./engine/storage.ts).
- **Source**: A consumed input to the kernel (paper, repo, signal, etc.).
  See [`engine/process-source-record.ts`](./engine/process-source-record.ts).
- **Source thread context**: The chain of source signals that informed a
  routing decision; replaces "narrative threading". See
  [`engine/routing/assessment.ts`](./engine/routing/assessment.ts).
- **Submission**: A source submission through the front door. See
  [`discovery/lib/front-door/discovery-submission-router.ts`](./discovery/lib/front-door/discovery-submission-router.ts).
- **Triage**: Discovery's second stage for complex sources that require
  deeper routing review. See
  [`shared/contracts/discovery-intake-queue.md`](./shared/contracts/discovery-intake-queue.md).
- **Version**: A schema version integer that identifies the shape of a
  persisted record. See
  [`shared/contracts/schema-versioning.md`](./shared/contracts/schema-versioning.md).
- **Worklist**: A Discovery gap worklist that prioritizes capability gaps
  for attention. See
  [`shared/schemas/discovery-gap-worklist.schema.json`](./shared/schemas/discovery-gap-worklist.schema.json).
