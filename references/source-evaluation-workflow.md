# Source Evaluation Workflow

How the Directive Kernel classifies and routes incoming sources after
[Jarvis Capability Kernel](../.hermes/specs/jarvis-capability-kernel/01-target-architecture.md)
refactor slices.

## Overview

Every source that enters the kernel passes through a deterministic
operationalization classifier before any downstream action. The classifier
produces one of six decisions, and the pipeline respects those decisions by
default.

```text
new source
  -> normalize metadata
  -> evaluate relevance / community signal
  -> classify operationalization decision
  -> one of:
       reject
       note_only -> Obsidian/wiki note
       training_lab_only -> external training lab reference
       fine_tune_later -> backlog, no Runtime promotion
       capability_candidate -> Runtime pipeline
       architecture_experiment -> Architecture experiment
```

## Decision types

| Decision | Meaning | Runtime entry? |
|----------|---------|----------------|
| `capability_candidate` | Callable CLI/API/package with sufficient community signal | **Yes** — one-shot pipeline |
| `architecture_experiment` | Bounded local system-layer experiment with kill criteria | No — manual experiment design required |
| `note_only` | Reference, documentation, or explanation only | No |
| `training_lab_only` | Requires base-model training (pretraining, architecture change) | No |
| `fine_tune_later` | Dataset or fine-tuning recipe without immediate system patch | No |
| `reject` | Too low on relevance, community signal, or actionability | No |

## Pipeline guardrails

The one-shot pipeline (`scripts/pipeline.ts`) enforces these rules:

1. **Decision first.** The pipeline prints the operationalization decision
   before any action, including:
   - decision,
   - classification,
   - actionability / community / Hermes-relevance scores (0–100),
   - rationale,
   - recommended lane,
   - next artifact path.

2. **Only `capability_candidate` advances to Runtime.** All other decisions
   halt the pipeline with clear next-action instructions.

3. **Architecture experiments** are not auto-routed to Runtime. The pipeline
   prints the experiment path, required hypothesis fields, kill criteria,
   and operator handoff instructions.

4. **Auto-ingest** (`scripts/auto-ingest.ts`) inherits these guardrails.
   It already skips docs/lists/references via keyword patterns, and the
   pipeline's own classifier provides a second safety layer.

## Dry-run / preview

Both `pipeline.ts` and `auto-ingest.ts` support `--dry-run`:

```bash
# Preview a single source's decision
npx tsx scripts/pipeline.ts "My Source" "https://github.com/example/repo" github-repo --dry-run

# Preview all matching repos from a GitHub search
bash scripts/auto-ingest.sh "developer tools stars:>5000" --dry-run
```

Dry-run prints the operationalization decision and next-action instructions
but creates no artifacts and makes no registry changes.

## Manual override

The default guardrail can be overridden by an operator with explicit intent.
Pipeline advancement decisions are logged, and the rationale is included in
the decision output so the operator can make an informed choice.

To force a non-capability source through the Runtime pipeline,
invoke the pipeline without the classifier gate (manual CLI path),
understanding that the source was classified differently by the automated
evaluator.

## Scoring

The classifier computes three 0–100 scores:

| Score | What it measures |
|-------|-----------------|
| `actionability_score` | Callable surface, experiment path, executable code, docs penalty |
| `community_signal_score` | GitHub stars, citation count, reference count |
| `hermes_relevance_score` | Mission overlap, capability gap, workflow pattern match |

These scores, together with boolean flags (`requires_model_training`,
`requires_external_service`, etc.), determine the final decision.

## Related files

| File | Purpose |
|------|---------|
| `engine/routing/source-operationalization.ts` | Classifier implementation |
| `scripts/pipeline.ts` | One-shot pipeline with guardrails |
| `scripts/auto-ingest.ts` | Batch GitHub ingestion |
| `scripts/auto-ingest.sh` | Shell wrapper for auto-ingest |
| `tests/unit/source-operationalization.test.ts` | Unit tests for classifier |
| `shared/schemas/source-operationalization-decision.schema.json` | Decision contract |
