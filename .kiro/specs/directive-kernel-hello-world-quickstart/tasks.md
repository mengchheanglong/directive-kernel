# Implementation Plan: Directive Kernel Hello-World Quickstart

## Overview

Convert the design into a series of small, mechanical, ordered tasks that an LLM coding agent can execute end-to-end. Each task ~30 minutes to 2 hours. The order is: build the in-process runner first, wire it into the CLI dispatcher, add the npm script, write the integration test (covering the design's correctness property), update the README, and run the full suite. Each task references specific requirements for traceability.

## Tasks

- [x] 1. Add `runStandaloneHostTryCommand` and `formatTryCommandOutput` in a new file
  - Create `hosts/standalone-host/try-command.ts`
  - Export `StandaloneHostTryCommandOptions`, `StandaloneHostTryCommandResult`, `runStandaloneHostTryCommand`, and `formatTryCommandOutput` exactly as shown in the design
  - Implement `buildInlineGoalEnvelope()` returning a `DirectiveGoalEnvelope` with all six required fields populated (`goalId`, `goalStatement`, `whyNow`, `adoptionTarget`, `constraints`, `successSignal`) plus the placeholder `sourcePath` and `rawMarkdown` strings the design specifies
  - Implement `readSampleSource(filePath)` using the existing `readJson` helper from `shared/lib/file-io.ts`
  - In `runStandaloneHostTryCommand`: resolve `sampleSourcePath` (default to the integration-kit example, allow injection via options), throw a clear error if missing, resolve `directiveRoot` (default to `os.tmpdir()/directive-kernel-try-<Date.now()>`, allow override), `mkdirSync` the directive root, build the inline goal, read the sample, call `runFirstHostIntegrationFlow`, return the structured result
  - In `formatTryCommandOutput`: produce the multi-line block from the design with no JSON
  - Run `pnpm run typecheck` and confirm no errors
  - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2_

- [x] 2. Wire the `try` subcommand into the standalone host CLI dispatcher
  - In `hosts/standalone-host/cli.ts`, add `"try"` to the `CommandName` union
  - Add a usage line `  try [--output-root <path>]` to the `printUsage()` block, formatted consistently with the existing lines
  - Import `runStandaloneHostTryCommand` and `formatTryCommandOutput` from `./try-command.ts`
  - Add a dispatch branch in `main()`: read the optional `--output-root` flag via `readOptionalFlag`, call the runner, write the formatted output followed by a newline to `process.stdout`, return
  - If the existing `main()` does not already wrap its body in a top-level `try/catch` that writes errors to stderr and exits non-zero, add that wrapper now (mirroring the shape used elsewhere in the file)
  - Run `pnpm run typecheck` and confirm no errors
  - _Requirements: 1.1, 1.5, 2.5, 4.1, 4.2, 4.3_

- [x] 3. Add the `pnpm try` npm script
  - In the root `package.json`, add `"try": "node --experimental-strip-types ./hosts/standalone-host/cli.ts try"` to the `scripts` object, placed near the existing `standalone:cli` script for visual grouping
  - Manually verify by running `pnpm try` from the repo root that the command produces output matching the format from the design
  - Manually verify by running `pnpm try --output-root ./local/try-test` that the override is honored
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Checkpoint — Try Command works end-to-end manually
  - Run `pnpm try` and confirm the printed directive-root path exists, `DIRECTIVE_GOAL.md` is at that path, and the printed artifact path points to a real JSON file
  - Read the artifact JSON and confirm `runId`, `selectedLane.laneId`, and `candidate.candidateId` match what was printed
  - Ensure `pnpm run typecheck` is green
  - Ask the user if questions arise
  - _Requirements: 1.1, 2.5, 3.1–3.8_

- [x] 5. Add the integration test for the Try Command
  - [x] 5.1 Add `tests/integration/try-command.test.ts`
    - Import `runStandaloneHostTryCommand` from `../../hosts/standalone-host/try-command.ts`
    - One `describe("standalone host try command")` block
    - One `beforeAll` that runs the command once with `outputRoot: undefined`, captures the result
    - `it("returns a non-empty engine run id")` — assert `result.runId` is a string with length > 0
    - `it("writes DIRECTIVE_GOAL.md into the directive root")` — assert `fs.existsSync(result.directiveGoalPath)` is true and the file contains the goal statement substring
    - `it("returns a candidate id matching the sample source")` — assert `result.candidateId === "dw-example-front-door"`
    - `it("returns one of the three known lane ids")` — assert `["discovery","architecture","runtime"].includes(result.laneId)`
    - `it("returns an artifact path that exists on disk")` — assert `fs.existsSync(result.artifactAbsolutePath)` and `fs.statSync(...).size > 0`
    - Use `os.tmpdir()` + `Date.now()` patterns matching `tests/integration/first-integration.test.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

  - [x]* 5.2 Add the property test for artifact-path realness
    - **Property 1: Artifact path is real and non-empty**
    - In the same file, add an `it("ensures the artifact path is real for default, existing-override, and missing-override roots")` block that runs `runStandaloneHostTryCommand` three times: once with `outputRoot: undefined`, once with an `outputRoot` pointing at a pre-existing temp dir, once with an `outputRoot` pointing at a deeply nested non-existent path; for each, assert `fs.existsSync(result.artifactAbsolutePath)` and `fs.statSync(...).size > 0`
    - **Validates: Requirements 1.4, 2.5, 3.7, 7.4**

  - [x]* 5.3 Add the subprocess smoke test
    - Add `tests/integration/try-command-cli.test.ts`
    - Use `node:child_process.spawnSync` to invoke `node --experimental-strip-types ./hosts/standalone-host/cli.ts try` from the repo root
    - Assert `status === 0`
    - Assert stdout contains `"Created temp directive root: "` followed by an absolute path
    - Assert stdout contains `"Wrote DIRECTIVE_GOAL.md"`
    - Assert stdout contains `"dw-example-front-door"`
    - Assert stdout contains `"Engine routed to: "` followed by `discovery`, `architecture`, or `runtime`
    - Assert stdout contains `"Run ID: "`
    - Assert stdout contains `"Artifact: "` followed by an absolute path; assert that path exists on disk
    - Assert stdout contains `"pnpm web:serve --directive-root "`
    - Assert stdout does not contain `{` or `}` characters
    - Add a second case spawning `... try --output-root` with no value; assert non-zero exit and a message on stderr
    - _Requirements: 7.5, 4.3, 3.9_

- [x] 6. Update the README with the Try It Block
  - In the repo `README.md`, insert a new block immediately after the opening intro paragraph and before the `## What This Repo Is For` heading
  - Block content (exact shape):
    ```markdown
    ## Try It

    ```powershell
    pnpm install
    pnpm try
    ```

    <!-- TODO: replace this block with a recorded terminal cast (Fix_Plan.md F3 follow-up). -->
    ```
  - Confirm total block length is no more than ten lines
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Final checkpoint — full suite green
  - Run `pnpm run typecheck`; confirm no errors
  - Run `pnpm run test`; confirm all tests pass including the new integration tests
  - Run `pnpm try` one more time and visually confirm the output matches the design's format exactly
  - Update `Fix_Plan.md` to mark F3 as done (mirror the F1 status format)
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional. Task 5.1 is core (the in-process behavior assertions); tasks 5.2 and 5.3 are the property test and the subprocess smoke test, both valuable but skippable for an MVP.
- Each task references the requirements it satisfies. Property test references the design property number plus the requirement clauses it validates.
- The test infrastructure from F1 (Vitest + the integration directory) is the substrate for tasks 5.x. No new harness work is needed.
- The optional `--serve` flag and the recorded terminal cast are explicitly out of scope per the design's "Out of Scope" section.
- Ordering rationale: build the in-process function first so the test harness has something to call, wire the CLI dispatcher second so the subprocess test has something to spawn, add the npm script third so the manual checkpoint can use `pnpm try`, then tests, then README, then close the loop.
