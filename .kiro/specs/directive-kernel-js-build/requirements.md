# Requirements Document

## Introduction

The Directive Kernel currently ships and runs as raw TypeScript using Node's `--experimental-strip-types` flag and a `tsx` dev path. This feature introduces a `tsc`-based JavaScript build that emits compiled output to `/dist/` at the repo root, rewires `package.json` `exports` to expose source to dev tooling and compiled JS to consumers, updates execution scripts so production paths run compiled JS while dev paths stay on source, inserts a build step into CI ahead of typecheck, ignores the build output in git, documents the dev-vs-prod execution model, and guarantees the kernel is publish-ready. The build must preserve runtime data files (JSON examples) that source code resolves through `import.meta.url`. Existing dev workflows (typecheck, test, `pnpm try`, `pnpm dev`) must continue to work without requiring a prior build.

## Glossary

- **Build_Pipeline**: The orchestrated process that compiles repo TypeScript sources to JavaScript and copies non-TypeScript runtime assets into `/dist/`, invoked by `pnpm run build`.
- **Build_Config**: The TypeScript configuration file `tsconfig.build.json` at repo root that drives emit-mode compilation for the kernel.
- **Typecheck_Config**: The existing TypeScript configuration file `tsconfig.repo.json` at repo root used for no-emit type checking.
- **Package_Manifest**: The repo-root `package.json` file.
- **Exports_Map**: The `exports` field of the Package_Manifest.
- **Production_Script**: A `package.json` script that represents a user-facing or release execution path: `start`, `web:serve`, `standalone:cli`, `try`, `ui:start`, and their aliases (`frontend:*`).
- **Dev_Script**: A `package.json` script intended for local iteration on source: `dev`, `ui:dev`.
- **Repo_Gitignore**: The repo-root `.gitignore` file.
- **CI_Workflow**: The GitHub Actions workflow defined at `.github/workflows/ci.yml`.
- **Readme_Document**: The repo-root `README.md` file.
- **Build_Output_Directory**: The directory `/dist/` at repo root produced by Build_Pipeline.
- **Runtime_Data_File**: A non-TypeScript file under `hosts/integration-kit/examples/` (specifically the `*.json` source-pack examples) resolved at runtime by source code via `import.meta.url`.
- **Source_Condition**: The custom `package.json` exports condition named `development` that resolves to a `.ts` source file.
- **Dev_Tooling**: `tsx` and Vitest, both of which honor user conditions and are configured in this repo to use the `development` condition.

## Requirements

### Requirement 1: Build artifact shape and contents

**User Story:** As a kernel maintainer, I want a deterministic compiled output under `/dist/`, so that downstream consumers and production scripts can import compiled JavaScript with type definitions and source maps.

#### Acceptance Criteria

1. WHEN `pnpm run build` completes successfully, THE Build_Pipeline SHALL produce `/dist/` at the repo root containing one `.js` file for every TypeScript source file included by Build_Config.
2. WHEN `pnpm run build` completes successfully, THE Build_Pipeline SHALL emit a `.d.ts` file alongside every emitted `.js` file in Build_Output_Directory.
3. WHEN `pnpm run build` completes successfully, THE Build_Pipeline SHALL emit a `.d.ts.map` file alongside every emitted `.d.ts` file in Build_Output_Directory.
4. WHEN `pnpm run build` completes successfully, THE Build_Pipeline SHALL emit a `.js.map` file alongside every emitted `.js` file in Build_Output_Directory.
5. THE Build_Pipeline SHALL exclude files under `tests/` and `scripts/` from emitted output in Build_Output_Directory.
6. WHEN emitted JavaScript references a relative module that the source wrote with a `.ts` extension, THE Build_Pipeline SHALL rewrite the import specifier to use a `.js` extension in the emitted output.
7. WHEN `pnpm run build` completes successfully, THE Build_Pipeline SHALL copy each Runtime_Data_File from `hosts/integration-kit/examples/` into `dist/hosts/integration-kit/examples/` preserving file name and contents.

### Requirement 2: Build TypeScript configuration

**User Story:** As a kernel maintainer, I want a dedicated `tsconfig.build.json` separate from typecheck config, so that emit settings, declaration generation, and extension rewriting are explicit and isolated from no-emit type checking.

#### Acceptance Criteria

1. THE Build_Config SHALL set `compilerOptions.noEmit` to `false`.
2. THE Build_Config SHALL set `compilerOptions.outDir` to `./dist`.
3. THE Build_Config SHALL set `compilerOptions.declaration` to `true`.
4. THE Build_Config SHALL set `compilerOptions.declarationMap` to `true`.
5. THE Build_Config SHALL set `compilerOptions.sourceMap` to `true`.
6. THE Build_Config SHALL set `compilerOptions.rewriteRelativeImportExtensions` to `true`.
7. THE Build_Config SHALL omit `compilerOptions.allowImportingTsExtensions`, or set it to `false`.
8. THE Build_Config SHALL set its `include` field to the same set of source globs as Typecheck_Config minus the `tests/**/*.ts` and `scripts/**/*.ts` entries.
9. THE Build_Config SHALL exclude `ui/**`, `node_modules/**`, and `local/**`.
10. THE Typecheck_Config SHALL remain unchanged by this feature.
11. THE Package_Manifest SHALL declare `typescript` at version `^6.0.2` in `devDependencies`.

### Requirement 3: Package exports rewrite

**User Story:** As a consumer of `@directive/kernel`, I want each export to expose compiled JS plus type definitions while still letting in-repo dev tooling resolve TypeScript source, so that published consumers get types and runtime JS while local dev keeps hot-edit feedback.

#### Acceptance Criteria

1. WHERE an entry in the Exports_Map previously pointed to a `./<path>.ts` string, THE Package_Manifest SHALL replace that entry with a conditional object containing exactly the keys `development`, `types`, `import`, and `default`.
2. THE Package_Manifest SHALL set the `development` condition of each rewritten export entry to the original `./<path>.ts` source path.
3. THE Package_Manifest SHALL set the `types` condition of each rewritten export entry to `./dist/<path>.d.ts`.
4. THE Package_Manifest SHALL set the `import` condition of each rewritten export entry to `./dist/<path>.js`.
5. THE Package_Manifest SHALL set the `default` condition of each rewritten export entry to `./dist/<path>.js`.
6. THE Package_Manifest SHALL place the `development` condition before `types`, `import`, and `default` within each rewritten export entry so that resolvers honoring the `development` condition match it first.
7. THE Package_Manifest SHALL preserve the same set of export subpath keys (e.g., `.`, `./engine`, `./standalone-host`) that exist before this feature.

### Requirement 4: Production scripts run from compiled output

**User Story:** As an operator running the kernel via published scripts, I want production entrypoints to execute compiled JavaScript without Node's experimental strip-types flag, so that the kernel runs on stable Node features and behaves the same in CI, on developer machines, and when published.

#### Acceptance Criteria

1. THE Package_Manifest SHALL define each Production_Script to invoke `node` against a file under `./dist/`.
2. THE Package_Manifest SHALL omit the `--experimental-strip-types` flag from every Production_Script.
3. THE Package_Manifest SHALL preserve the user-facing argument shape of each Production_Script (e.g., `try` continues to accept the same positional and flag arguments as before).
4. WHERE a Production_Script previously aliased another script (for example `frontend:*` aliasing `ui:*`), THE Package_Manifest SHALL preserve that alias relationship after rewrite.
5. WHEN a Production_Script is invoked after `pnpm run build` has produced Build_Output_Directory, THE Production_Script SHALL execute successfully against the same inputs that worked before this feature.

### Requirement 5: Dev scripts run against source via tsx

**User Story:** As a kernel developer, I want `pnpm dev` and `pnpm ui:dev` to run directly against TypeScript source without a build step, so that source edits take effect immediately.

#### Acceptance Criteria

1. THE Package_Manifest SHALL define each Dev_Script to launch its entrypoint through `tsx` (either `pnpm exec tsx` or the `tsx` binary).
2. THE Package_Manifest SHALL define each Dev_Script to point at a `.ts` file under repo source (not under `./dist/`).
3. WHEN a Dev_Script is invoked in a clean checkout where Build_Output_Directory does not exist, THE Dev_Script SHALL execute successfully without first requiring `pnpm run build`.
4. WHEN a module imported by a Dev_Script entrypoint is resolved through the Exports_Map, THE Dev_Tooling SHALL match the Source_Condition and load the `.ts` source file.

### Requirement 6: Build orchestration and runtime data files

**User Story:** As a kernel maintainer, I want a single `pnpm run build` command that compiles TypeScript and copies runtime data files, so that producing a complete `/dist/` is a one-command operation.

#### Acceptance Criteria

1. THE Package_Manifest SHALL define a `build` script that, when executed, runs `tsc -p tsconfig.build.json` and then copies every Runtime_Data_File from `hosts/integration-kit/examples/` into `dist/hosts/integration-kit/examples/`.
2. WHEN `pnpm run build` finishes successfully, THE Build_Pipeline SHALL leave Build_Output_Directory in a state where every relative path that emitted source code resolves via `import.meta.url` points at a file that exists in Build_Output_Directory.
3. WHEN `node dist/hosts/standalone-host/cli.js try` is invoked after `pnpm run build` in a clean checkout, THE compiled `try` entrypoint SHALL locate `dist/hosts/integration-kit/examples/discovery-submission-front-door.json` and complete without raising a "sample source not found" error.
4. IF the TypeScript compile step of `pnpm run build` exits with a non-zero status, THEN THE Build_Pipeline SHALL exit with a non-zero status and SHALL NOT report success.
5. IF the runtime data file copy step of `pnpm run build` fails to copy any Runtime_Data_File, THEN THE Build_Pipeline SHALL exit with a non-zero status.

### Requirement 7: CI build step insertion

**User Story:** As a maintainer reviewing pull requests, I want CI to run the build before typecheck, so that emit-related regressions (extension rewriting, declaration generation, missing files) fail the pipeline.

#### Acceptance Criteria

1. THE CI_Workflow SHALL invoke `pnpm run build` as a step that runs after `pnpm install --frozen-lockfile` and before `pnpm run typecheck`.
2. IF `pnpm run build` exits with a non-zero status during a CI run, THEN THE CI_Workflow SHALL fail the job and SHALL NOT execute the typecheck or test steps.
3. THE CI_Workflow SHALL preserve the existing `pnpm run typecheck` and `pnpm run test` steps in their current relative order.

### Requirement 8: Gitignore update

**User Story:** As a contributor committing changes, I want `/dist/` excluded from version control, so that compiled output is not committed by accident.

#### Acceptance Criteria

1. THE Repo_Gitignore SHALL contain a rule that ignores the repo-root `dist/` directory.
2. THE Repo_Gitignore SHALL retain the existing `ui/dist/` rule.
3. WHEN `git status` is run after `pnpm run build` in an otherwise clean checkout, THE working tree SHALL report no untracked files inside `dist/`.

### Requirement 9: README dev-vs-prod execution note

**User Story:** As a new contributor reading the README, I want a clear statement of when the kernel runs from source versus from `/dist/`, so that I understand which scripts require a prior build.

#### Acceptance Criteria

1. THE Readme_Document SHALL contain a section that names the Dev_Scripts and states that each runs against TypeScript source through `tsx` and does not require `pnpm run build`.
2. THE Readme_Document SHALL contain a section that names the Production_Scripts and states that each runs from `/dist/` and requires `pnpm run build` to have been executed first (or invocation through `pnpm start`-style scripts that themselves run the build).
3. THE Readme_Document SHALL state that `pnpm run build` produces `/dist/` and SHALL NOT instruct readers to run the build before `pnpm test`, `pnpm typecheck`, `pnpm dev`, or `pnpm try`.

### Requirement 10: Dev workflow continuity without a prior build

**User Story:** As a kernel developer working from a fresh checkout, I want `pnpm typecheck`, `pnpm test`, `pnpm dev`, and `pnpm try` to all work without first running `pnpm run build`, so that source-level iteration stays fast and Build_Output_Directory is not a hidden prerequisite for routine workflows.

#### Acceptance Criteria

1. WHEN `pnpm run typecheck` is invoked in a checkout where Build_Output_Directory does not exist, THE typecheck script SHALL complete successfully.
2. WHEN `pnpm run test` is invoked in a checkout where Build_Output_Directory does not exist, THE Vitest run SHALL resolve every in-repo import via the Source_Condition and SHALL complete successfully.
3. WHEN `pnpm dev` is invoked in a checkout where Build_Output_Directory does not exist, THE Dev_Script SHALL launch successfully.
4. WHEN `pnpm try` is invoked in a checkout where Build_Output_Directory does not exist, THE `try` script SHALL complete successfully against the existing source-pack example without requiring `pnpm run build` to have run first.
5. THE Package_Manifest SHALL configure Vitest (directly or through its config file) so that Vitest resolves the Source_Condition when matching Exports_Map entries.

### Requirement 11: Publish-readiness

**User Story:** As a kernel maintainer preparing to publish `@directive/kernel`, I want `pnpm publish` to refuse to publish stale or missing build output, so that consumers never receive a tarball whose `exports` reference compiled paths that do not exist.

#### Acceptance Criteria

1. THE Package_Manifest SHALL define a `prepublishOnly` script that runs `pnpm run build`.
2. WHEN `pnpm publish` is invoked, THE Package_Manifest's `prepublishOnly` script SHALL execute before any tarball is produced.
3. IF `pnpm run build` exits with a non-zero status during `prepublishOnly`, THEN `pnpm publish` SHALL abort and SHALL NOT publish a tarball.
