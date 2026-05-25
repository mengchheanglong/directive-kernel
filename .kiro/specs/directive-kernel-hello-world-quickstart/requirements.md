# Requirements Document

## Introduction

Directive Kernel currently has no end-to-end path from `pnpm install` to "I see a useful result." The README walks through `init`, config files, JSON payloads, and several CLI subcommands before the operator sees anything that looks like the kernel working. This feature adds a single subcommand on the existing standalone host CLI — `try` — that performs a complete Discovery-front-door pass against a hardcoded sample source in a fresh temp directive root, prints the routing decision and the resulting artifact path, and exits. It also adds a five-line "Try it" block at the top of the README so a new contributor sees the success path before the explanation.

The implementation reuses three existing pieces: the standalone host CLI dispatcher (`hosts/standalone-host/cli.ts`), the integration kit's `runFirstHostIntegrationFlow` (which already composes goal resolution, directive-root preparation, and front-door submission), and the example source at `hosts/integration-kit/examples/discovery-submission-front-door.json`. No new top-level binary, no new sample payload, no new orchestration code.

The recorded terminal cast mentioned in `Fix_Plan.md` F3 is explicitly out of scope for this spec; a TODO note in the README points to the future task.

## Glossary

- **Try Command**: The new subcommand `try` on `hosts/standalone-host/cli.ts`. Invoked as `node --experimental-strip-types ./hosts/standalone-host/cli.ts try` or via the `pnpm try` npm script.
- **Standalone Host CLI**: The existing CLI entry point at `hosts/standalone-host/cli.ts` that already exposes `init`, `serve`, `discovery-submit`, and other subcommands.
- **Temp Directive Root**: A fresh directory under `os.tmpdir()` with a timestamp suffix that the Try Command creates and uses as the directive root for one end-to-end submission.
- **Output Root Override**: A user-supplied path passed as `--output-root <path>` that overrides the default Temp Directive Root location.
- **Sample Source**: The JSON payload at `hosts/integration-kit/examples/discovery-submission-front-door.json`. The Try Command reads this file rather than hardcoding a duplicate.
- **Inline Goal Envelope**: A `DirectiveGoalEnvelope` value constructed in code inside the Try Command. The engine pass uses this inline value, so the command works even if `DIRECTIVE_GOAL.md` parsing has issues.
- **Try Output**: The plain-text, one-fact-per-line output written to stdout by the Try Command on success.
- **First Host Integration Flow**: The exported function `runFirstHostIntegrationFlow` in `hosts/integration-kit/lib/first-host-integration.ts` that the Try Command composes for the actual engine pass.
- **README Try It Block**: A five-line markdown block added at the top of the repo `README.md`, before the "What This Repo Is For" section.

## Requirements

### Requirement 1 — Try Command exists on the standalone host CLI

**User Story:** As a new contributor, I want a single command that runs the kernel end-to-end without any prior setup, so that I can see the kernel work in under sixty seconds.

#### Acceptance Criteria

1. THE Standalone Host CLI SHALL expose a subcommand named `try`.
2. WHEN the Try Command is invoked with no flags, THE Try Command SHALL create a fresh Temp Directive Root under `os.tmpdir()` with a path of the form `directive-kernel-try-<timestamp>` where `<timestamp>` is the millisecond Unix epoch at invocation.
3. WHEN the Try Command is invoked with `--output-root <path>`, THE Try Command SHALL use the supplied path as the directive root instead of creating a Temp Directive Root.
4. WHEN the Try Command is invoked with `--output-root <path>` and the supplied path does not exist, THE Try Command SHALL create the directory before writing into it.
5. WHEN the Try Command is invoked with `--help`, THE Standalone Host CLI SHALL include a usage line for `try` in the printed usage block, listing the `--output-root` flag as optional.

### Requirement 2 — Try Command runs a full Discovery front-door pass

**User Story:** As a new contributor, I want the command to actually exercise the engine, not just print a hello message, so that I can trust the kernel works on this machine.

#### Acceptance Criteria

1. WHEN the Try Command runs, THE Try Command SHALL read the Sample Source from `hosts/integration-kit/examples/discovery-submission-front-door.json` relative to the kernel repo root.
2. WHEN the Try Command runs, THE Try Command SHALL construct an Inline Goal Envelope in code with all six required fields (`goalId`, `goalStatement`, `whyNow`, `adoptionTarget`, `constraints`, `successSignal`) populated.
3. WHEN the Try Command runs, THE Try Command SHALL also write a `DIRECTIVE_GOAL.md` file rendered from the Inline Goal Envelope to the directive root.
4. WHEN the Try Command runs, THE Try Command SHALL invoke the First Host Integration Flow with the Inline Goal Envelope and the Sample Source.
5. WHEN the First Host Integration Flow returns a successful submission result, THE Try Command SHALL exit with status code `0`.

### Requirement 3 — Try Output reports the run results in plain text

**User Story:** As a new contributor, I want the command's output to tell me what happened in plain English with paths I can use, so that I know the result is real and I know where to look next.

#### Acceptance Criteria

1. WHEN the Try Command completes a successful run, THE Try Command SHALL print Try Output to stdout containing one fact per line.
2. THE Try Output SHALL include a line that contains the absolute path of the directive root used for the run.
3. THE Try Output SHALL include a line that names the file `DIRECTIVE_GOAL.md` to indicate the goal markdown was written.
4. THE Try Output SHALL include a line that contains the `candidate_id` of the Sample Source.
5. THE Try Output SHALL include a line that contains the `laneId` selected by the engine for the run.
6. THE Try Output SHALL include a line that contains the engine `runId` returned for the run.
7. THE Try Output SHALL include a line that contains the absolute path of the engine run record artifact.
8. THE Try Output SHALL include a final block of one or more lines suggesting the next command the user can run, including a `web:serve` invocation parameterized with the directive root from this run.
9. THE Try Output SHALL NOT include any JSON object dump.

### Requirement 4 — Try Command reports failure clearly

**User Story:** As a new contributor, I want the command to fail loudly and clearly when something is wrong, so that I do not have to debug what step quietly skipped.

#### Acceptance Criteria

1. IF the Sample Source file does not exist at the expected path when the Try Command runs, THEN THE Try Command SHALL print an error message to stderr that includes the expected path and SHALL exit with a non-zero status code.
2. IF the First Host Integration Flow throws or returns a non-successful goal resolution, THEN THE Try Command SHALL print the underlying error message to stderr and SHALL exit with a non-zero status code.
3. IF the `--output-root` flag is supplied without a value, THEN THE Standalone Host CLI SHALL print a message naming the missing flag value and SHALL exit with a non-zero status code.

### Requirement 5 — `pnpm try` npm script runs the Try Command

**User Story:** As a new contributor, I want a single `pnpm try` invocation that does not require remembering the `node --experimental-strip-types` incantation, so that the README block stays five lines.

#### Acceptance Criteria

1. THE root `package.json` SHALL define a script named `try` that invokes the Standalone Host CLI's `try` subcommand using the same `node --experimental-strip-types ./hosts/standalone-host/cli.ts` form used by the existing `standalone:cli` script.
2. WHEN a user runs `pnpm try` from the repo root, THE script SHALL execute the Try Command with no additional flags.
3. WHEN a user runs `pnpm try --output-root <path>`, THE script SHALL forward the flag and value to the Try Command.

### Requirement 6 — README Try It Block

**User Story:** As a new contributor, I want the success path visible at the top of the README before any explanation, so that I see what works before I learn how it works.

#### Acceptance Criteria

1. THE repo `README.md` SHALL contain a Try It Block positioned before the "What This Repo Is For" section.
2. THE README Try It Block SHALL have a level-2 markdown heading reading `## Try It`.
3. THE README Try It Block SHALL include a fenced code block whose contents include the literal commands `pnpm install` and `pnpm try`, each on its own line.
4. THE README Try It Block SHALL include a TODO comment or note pointing to the future terminal-cast recording task.
5. THE README Try It Block SHALL be no more than ten lines of markdown including heading, code fence, and TODO note.

### Requirement 7 — Integration test for the Try Command

**User Story:** As a maintainer, I want the Try Command covered by automated tests so that a regression in the engine, the front door, or the CLI dispatcher does not silently break the kernel's hello-world path.

#### Acceptance Criteria

1. THE repo SHALL include a Vitest integration test under `tests/integration/` that exercises the Try Command end-to-end.
2. THE integration test SHALL invoke the Try Command via an exported in-process function and SHALL assert on the structured result the function returns.
3. THE integration test SHALL include at least one assertion that the engine `runId` returned by the run is a non-empty string.
4. THE integration test SHALL include at least one assertion that the engine run record artifact path returned by the run points to an existing file on disk.
5. THE integration test SHALL include a subprocess smoke case that spawns the CLI as a child process via the `node --experimental-strip-types` form and asserts that stdout contains every line shape required by Requirement 3.
6. THE integration test SHALL run each invocation against a unique `os.tmpdir()` path with a timestamp suffix, matching the pattern used by `tests/integration/first-integration.test.ts`.
