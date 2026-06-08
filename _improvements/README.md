# Improvements

This folder holds the post-fix enhancement track for Directive Kernel.

## Current task surfaces

- `../Fix_Plan.md`
  Historical fix track and its acceptance record.
- `Improvement_Plan.md`
  The active enhancement backlog. Status values here are the source of truth for open versus shipped improvement items.
- `OPEN_TASKS.md`
  The detailed working document for the remaining open improvement items (`I4` through `I13`).
- `../.kiro/specs/README.md`
  The execution index for promoted specs, grouped by shipped work versus deferred stubs.

## Working rule

1. Treat `Improvement_Plan.md` as the backlog.
2. Promote only the next active item into a Kiro spec when it is ready to execute.
3. Keep historical audits and one-off analysis in `docs/audits/`, not at the repo root.

## Why this folder exists

It keeps roadmap work separate from the kernel runtime, host surfaces, and archived audit material.
