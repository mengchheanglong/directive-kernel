# Design: Directive Kernel Hello-World Quickstart

## Overview

Add a `try` subcommand to the existing standalone host CLI that runs a complete Discovery front-door pass against a hardcoded sample source in a fresh temp directive root, prints a one-fact-per-line summary, and exits cleanly. Add a `pnpm try` npm script and a five-line "Try It" block at the top of the README so the success path is the first thing a contributor sees.

The implementation is small and additive. No new top-level binary, no new sample payload, no new orchestration code. The Try Command is a thin composition over `runFirstHostIntegrationFlow` from the integration kit, which already does the heavy lifting (goal resolution, directive-root preparation, front-door submission).

The optional `--serve` flag and the recorded terminal cast from `Fix_Plan.md` F3 are out of scope for this spec. The README links the cast as a deferred follow-up.

## Architecture

```
hosts/standalone-host/cli.ts          (existing CLI dispatcher)
  └─ try subcommand
       └─ hosts/standalone-host/try-command.ts          (new)
            ├─ reads hosts/integration-kit/examples/discovery-submission-front-door.json
            ├─ builds inline DirectiveGoalEnvelope
            └─ invokes runFirstHostIntegrationFlow      (existing)
                 ├─ resolveFirstHostGoalEnvelope
                 ├─ prepareDirectiveKernelFirstHostRoot (writes DIRECTIVE_GOAL.md, scaffold)
                 ├─ buildDiscoverySubmissionFromGoalEnvelope
                 └─ submitDiscoveryEntryThroughFrontDoor
                      └─ submitDirectiveDiscoveryFrontDoor (engine pass + artifact write)
```

The new file `hosts/standalone-host/try-command.ts` exports two things:
1. A pure-ish in-process function `runStandaloneHostTryCommand(options)` that returns a structured result. The integration test asserts on this directly.
2. A printer `formatTryCommandOutput(result)` that returns the multi-line stdout block. The CLI dispatcher calls both: first the runner, then the formatter, then writes the formatted block to stdout.

Splitting runner from printer keeps the in-process test free of stdout capture and lets the subprocess smoke test focus on output formatting.

## Components

### `runStandaloneHostTryCommand(options)`

```typescript
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runFirstHostIntegrationFlow, type RunFirstHostIntegrationFlowResult } from "../integration-kit/lib/first-host-integration.ts";
import type { DirectiveGoalEnvelope } from "../../shared/lib/directive-goal.ts";
import { normalizeAbsolutePath } from "../../shared/lib/path-normalization.ts";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_SOURCE_RELATIVE_PATH = path.join(
  "..",
  "integration-kit",
  "examples",
  "discovery-submission-front-door.json",
);

export type StandaloneHostTryCommandOptions = {
  outputRoot?: string | null;
  receivedAt?: string | null;
  // injection seam used only by tests:
  sampleSourcePath?: string | null;
};

export type StandaloneHostTryCommandResult = {
  directiveRoot: string;
  directiveGoalPath: string;
  sampleSourcePath: string;
  candidateId: string;
  laneId: string;
  runId: string;
  artifactAbsolutePath: string;
  artifactRelativePath: string;
  flow: RunFirstHostIntegrationFlowResult;
};

export async function runStandaloneHostTryCommand(
  options: StandaloneHostTryCommandOptions = {},
): Promise<StandaloneHostTryCommandResult> {
  const sampleSourcePath = normalizeAbsolutePath(
    options.sampleSourcePath ?? path.resolve(MODULE_DIR, SAMPLE_SOURCE_RELATIVE_PATH),
  );
  if (!fs.existsSync(sampleSourcePath)) {
    throw new Error(
      `Sample source not found at ${sampleSourcePath}. The kernel cannot run the try command without it.`,
    );
  }

  const directiveRoot = normalizeAbsolutePath(
    options.outputRoot ?? path.resolve(os.tmpdir(), `directive-kernel-try-${Date.now()}`),
  );
  fs.mkdirSync(directiveRoot, { recursive: true });

  const goal = buildInlineGoalEnvelope();
  const sample = readSampleSource(sampleSourcePath);
  const flow = await runFirstHostIntegrationFlow({
    directiveRoot,
    goal,
    source: {
      candidateId: sample.candidate_id,
      candidateName: sample.candidate_name,
      sourceType: sample.source_type,
      sourceReference: sample.source_reference,
      summary: sample.mission_alignment ?? sample.notes ?? "Sample source pack from integration kit.",
      notes: sample.notes,
      capabilityGapId: sample.capability_gap_id,
      primaryAdoptionTarget: sample.primary_adoption_target,
      containsWorkflowPattern: sample.contains_workflow_pattern,
      improvesDirectiveWorkspace: sample.improves_directive_workspace,
      workflowBoundaryShape: sample.workflow_boundary_shape,
      missionAlignment: sample.mission_alignment,
    },
    receivedAt: options.receivedAt ?? undefined,
  });

  return {
    directiveRoot,
    directiveGoalPath: path.join(directiveRoot, "DIRECTIVE_GOAL.md"),
    sampleSourcePath,
    candidateId: flow.request.candidate_id,
    laneId: flow.submission.engine.record.selectedLane.laneId,
    runId: flow.submission.engine.record.runId,
    artifactAbsolutePath: flow.submission.engine.recordPath,
    artifactRelativePath: flow.submission.engine.recordRelativePath,
    flow,
  };
}
```

`buildInlineGoalEnvelope` returns a `DirectiveGoalEnvelope` with all six required fields populated. The `sourcePath` and `rawMarkdown` fields are derived from the goal data so `prepareDirectiveKernelFirstHostRoot` writes a real `DIRECTIVE_GOAL.md` to the directive root.

### `formatTryCommandOutput(result)`

```typescript
export function formatTryCommandOutput(result: StandaloneHostTryCommandResult): string {
  const lines = [
    `Created temp directive root: ${result.directiveRoot}`,
    `Wrote DIRECTIVE_GOAL.md`,
    `Submitted sample source: ${result.candidateId}`,
    `Engine routed to: ${result.laneId}`,
    `Run ID: ${result.runId}`,
    `Artifact: ${result.artifactAbsolutePath}`,
    ``,
    `Next step:`,
    `  pnpm web:serve --directive-root ${result.directiveRoot}`,
  ];
  return lines.join("\n");
}
```

The output format intentionally avoids JSON dumps (Requirement 3.9) and keeps each fact on its own line. The empty line and indented "Next step" block are visual separation, not structural.

### CLI dispatcher wiring

In `hosts/standalone-host/cli.ts`:

```typescript
// add to CommandName union
type CommandName = ... | "try";

// add to printUsage
//   try [--output-root <path>]

// add to main()
if (command === "try") {
  const outputRoot = readOptionalFlag(flags, "output-root") ?? null;
  const result = await runStandaloneHostTryCommand({ outputRoot });
  process.stdout.write(`${formatTryCommandOutput(result)}\n`);
  return;
}
```

The existing `parseArgs` already handles "missing value for `--output-root`" by throwing — covers Requirement 4.3.

The existing `main()` wraps the body in a top-level `void main().catch(...)` (or equivalent); errors thrown from `runStandaloneHostTryCommand` (sample source missing, flow failure) bubble out and surface a non-zero exit code through the existing handler. If the existing handler is too quiet, we add an explicit `try { await main(); } catch (err) { process.stderr.write(...); process.exit(1); }` wrapper inside `main()` itself.

### `pnpm try` script

In root `package.json`:

```json
"try": "node --experimental-strip-types ./hosts/standalone-host/cli.ts try"
```

`pnpm try -- --output-root /some/path` forwards flags via standard pnpm/npm passthrough (`pnpm try --output-root /some/path` works directly; the explicit `--` is only needed in some pnpm versions for safety).

### README Try It Block

```markdown
## Try It

```powershell
pnpm install
pnpm try
```

<!-- TODO: replace this block with a recorded terminal cast (Fix_Plan.md F3 follow-up). -->
```

Inserted at the top of `README.md`, before the existing `# Directive Kernel` content gets to "## What This Repo Is For". The current README opens with `# Directive Kernel` and a paragraph; the Try It Block goes between that paragraph and the "## What This Repo Is For" heading.

## Data Models

### Inline Goal Envelope

Hardcoded in `try-command.ts`. Keeps the engine pass independent of `DIRECTIVE_GOAL.md` parsing.

```typescript
function buildInlineGoalEnvelope(): DirectiveGoalEnvelope {
  return {
    goalId: "directive-kernel-try",
    goalStatement:
      "Demonstrate the Directive Kernel end-to-end by routing one sample source through Discovery and the engine.",
    whyNow:
      "A new contributor wants to confirm the kernel works on this machine before learning the model.",
    adoptionTarget: "architecture",
    constraints: [
      "stay bounded",
      "keep review explicit",
    ],
    successSignal:
      "One sample source produces a kernel-owned engine run record without manual configuration.",
    sourcePath: "<inline>",
    rawMarkdown: "<inline>",
  };
}
```

`runFirstHostIntegrationFlow` calls `normalizeGoalEnvelopeInput` internally, which rewrites `sourcePath` to the directive-root-relative goal path and re-renders `rawMarkdown` from the structured fields, so the `<inline>` placeholder values are overwritten before any file is written. The placeholder is just a type-level satisfier.

### Sample Source

Read from disk via the existing `readJson` helper:

```typescript
import { readJson } from "../../shared/lib/file-io.ts";
type SampleSourceFile = {
  candidate_id: string;
  candidate_name: string;
  source_type?: string;
  source_reference: string;
  mission_alignment?: string;
  capability_gap_id?: string | null;
  notes?: string | null;
  primary_adoption_target?: string | null;
  contains_workflow_pattern?: boolean | null;
  improves_directive_workspace?: boolean | null;
  workflow_boundary_shape?: string | null;
};
function readSampleSource(filePath: string): SampleSourceFile {
  return readJson<SampleSourceFile>(filePath);
}
```

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Sample source file missing | `runStandaloneHostTryCommand` throws `Error("Sample source not found at <path>. ...")`. CLI surfaces the message on stderr and exits non-zero. |
| `runFirstHostIntegrationFlow` throws (parse failure, engine failure, filesystem error) | Error bubbles up; CLI prints to stderr and exits non-zero. |
| `--output-root` flag with no value | `parseArgs` in the existing CLI dispatcher throws `"Missing value for --output-root"`. Already covered. |
| `--output-root` directory does not exist | `runStandaloneHostTryCommand` calls `fs.mkdirSync(..., { recursive: true })` so missing directories are created. No error. |
| Sample source exists but is malformed JSON | `readJson` throws; same surfacing path as the engine flow throwing. |

The CLI dispatcher's `main()` adds an outer `try/catch` that writes `String((err as Error).message ?? err)` to stderr and exits with code `1` if not already wrapped that way. This is the same shape used by other commands; if the existing dispatcher already has it, the new command inherits the behavior.

## Testing Strategy

### Integration test — in-process behavior

`tests/integration/try-command.test.ts` imports `runStandaloneHostTryCommand` directly and asserts on the structured result. One `beforeAll` runs the command once with no override; two additional `it(...)` blocks run with `--output-root` variants (existing path, deeply nested non-existent path) to cover the property test below.

### Integration test — subprocess smoke

`tests/integration/try-command-cli.test.ts` (or a second `describe` block in the same file) spawns `node --experimental-strip-types ./hosts/standalone-host/cli.ts try` as a child process via `node:child_process.spawnSync`, captures stdout and stderr, asserts:
- exit code is 0
- stdout contains "Created temp directive root:" followed by an absolute path
- stdout contains "Wrote DIRECTIVE_GOAL.md"
- stdout contains the literal sample candidate id `dw-example-front-door`
- stdout contains "Engine routed to: " followed by one of `discovery|architecture|runtime`
- stdout contains "Run ID:"
- stdout contains "Artifact:" followed by an absolute path that exists
- stdout contains `pnpm web:serve --directive-root`
- stdout does not contain `{` or `}`

A separate small subprocess test asserts that invoking `try --output-root` with no value exits non-zero and writes a message to stderr.

### Test layout matches F1

Mirrors the patterns established by `tests/integration/first-integration.test.ts` (one `beforeAll`, one `it(...)` per assertion family). Uses `os.tmpdir()` with a timestamp suffix. Covered by Vitest from F1.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Artifact path is real and non-empty

For any successful invocation of the Try Command — whether with no `--output-root` flag, with an explicit `--output-root` pointing at an existing directory, or with an explicit `--output-root` pointing at a non-existent nested directory — the engine run record artifact path returned by `runStandaloneHostTryCommand` and printed in the Try Output points to a file that exists on disk and has non-zero size.

This property ties the Try Command's promise (you can read the artifact at the path I just printed) to the engine's actual filesystem write. It catches three concrete classes of regression: path normalization mistakes between the CLI's directive-root resolution and the engine's record writer, missing-directory creation when `--output-root` is given a non-existent path, and silent partial-write failures.

The test exercises three input shapes — default temp root, existing override, non-existent nested override — and asserts the invariant for each. This is a small bounded property rather than a 100-iteration fast-check property because the input space is structurally narrow but the universal claim has real value.

**Validates: Requirements 1.4, 2.5, 3.7, 7.4**

## Out of Scope

These pieces of `Fix_Plan.md` F3 are deliberately deferred:

- `--serve` flag that boots the web host after a successful run. The interaction model agreed during clarification is to print the next-step `pnpm web:serve` command and exit cleanly. Adding `--serve` later is additive and does not change anything in this spec.
- Recorded terminal cast (`vhs` or `asciinema`). Recording is a polish step that requires an external tool, a clean recording, and a binary or `.cast` file in the repo. The README Try It Block includes a TODO marker for the follow-up.
- A new top-level binary or new package script other than `try`. The standalone host CLI is the natural home and adding another binary now would muddy the surface for no near-term gain.
