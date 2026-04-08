# Starter Templates

These templates are for host projects that want real adapter code shapes instead of only example payloads.

Use them when:
- your host runs Node/TypeScript
- you want to keep Discovery first
- you want a thin adapter over canonical kernel libs
- direct package imports are not practical

Recommended order:

1. start with `discovery-front-door-adapter.template.ts`
2. prove the shape with the matching smoke template
3. add a storage bridge
4. add overview or acceptance helpers only when needed
5. keep `DIRECTIVE_GOAL.md` in the consuming project root or directive root
6. keep goal resolution in the consuming project, then pass the resolved goal into the canonical Discovery submission
