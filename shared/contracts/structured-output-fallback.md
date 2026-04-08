# Structured Output Fallback Contract

Purpose:
- provide deterministic fallback parsing for malformed or noisy structured outputs
- preserve typed artifact boundaries without silently claiming successful strict parsing

Profile:
- `structured_output_fallback/v1`

Allowed fallback sequence:
1. strict direct JSON parse
2. fenced JSON extraction parse (```json ... ```)
3. likely JSON segment extraction parse (`{...}` or `[...]`)
4. trailing-comma cleanup parse
5. typed list fallback (markdown bullets / CSV / markdown links)

Allowed outputs:
- parsed object
- parsed array
- normalized string list
- explicit null/empty when parsing fails

Disallowed behavior:
- implicit success when parse fails
- lossy silent field dropping
- coercing malformed content into typed artifacts without explicit fallback path

Validation hooks:
- `npm run check:directive-structured-output-fallback`
- `npm run check:ops-stack`
