# Codex → OpenCode Handoff Instructions

When delegating implementation work to OpenCode (DeepSeek), follow this format exactly. OpenCode has 0 mistakes when prompts are surgical, never when they're conceptual.

## The formula

1. **Read the codebase first.** Before writing the prompt, open the allowed files. Know what's there.
2. **Write a tiny spec.** One task, one module, one concern. Never "add validation to the whole API."
3. **Translate the spec into a surgical prompt** using the template below.

## Prompt template

Every OpenCode prompt MUST follow this structure:

```
Task: <one-line description>

Repository:
<absolute path>

Primary specs:
<path to spec file(s)>

Allowed files:
- <explicit file path>
- <explicit file path>

Forbidden:
- Do not modify files outside the allowed list.
- Do not change <specific behavior X>.
- Do not change <specific behavior Y>.
- Do not update todo status.

Required implementation:
1. <exact requirement with field names, values, thresholds>
2. <exact requirement with field names, values, thresholds>
3. Preserve existing <behavior Z>.

Required command:
pnpm build

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| <binary check> | | |
| <binary check> | | |
| <binary check> | | |

Final report must include:
1. Files changed
2. Exact changes made
3. Command result
4. Self-check table
5. Anything not completed and why
```

## Rules

**Allowed files:** Exact paths only. Never "src/modules/*/". List every file OpenCode may touch. If OpenCode needs to read a file for context but not modify it, put it in a "Read-only context:" section above Allowed files.

**Forbidden:** Explicit negatives. "Do not modify X" is better than silence. List every invariant: auth behavior, middleware order, response shapes, existing validation, config sources.

**Required implementation:** Numbered, verifiable. Each step must be mechanically checkable. Use exact field names (`originalName`, `mimeType`, `config.r2.uploadMaxBytes`), exact thresholds (`20 requests / 600 seconds`, `min 1, max 100`), exact function names (`ipAndRouteKey`, `userAndRouteKey`). Never "add validation" — instead "`name`: trim, min 2, max 200".

**Required command:** One command. `pnpm build` for TypeScript projects. Not "pnpm run typecheck && pnpm run test" — one gate.

**Self-check table:** Binary only. Every row is Pass or Fail. Evidence column must be fillable by OpenCode. Checks must map 1:1 to Required implementation steps.

**Scope:** One module per prompt. If a task spans multiple modules, split into separate prompts. OpenCode handles mechanical repetition well; it handles cross-module judgment poorly.

## When Codex implements directly

Codex handles these itself (no OpenCode delegation):
- Shared infrastructure (cache layer, auth middleware, rate-limit service)
- Security-sensitive code (token handling, cookie management)
- Cross-module contracts (shared types, API shapes)
- Cache invalidation that could leak data

OpenCode handles:
- Per-module repetitive work (route validation, limiters, sanitization)
- Documentation and reporting
- Pattern-following implementation (once Codex proves the pattern on one module)

## Slice sizing

After Codex implements the shared infra on one module to prove the pattern, write one OpenCode prompt per remaining module. Each prompt is self-contained — OpenCode doesn't need context from other prompts.

Example: 8 modules need validation.
1. Codex implements shared validation helpers + proves pattern on Auth module.
2. Codex writes 7 OpenCode prompts (User, News, Research, Tags, Media, Partner, Investor).
3. OpenCode executes all 7 in parallel or sequence.
4. Codex evaluates each. One review pass max per slice.
