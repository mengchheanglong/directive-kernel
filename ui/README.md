# Directive Operator Dashboard

This is the canonical standalone UI app for Directive Kernel.

Stack:
- Vite
- Lit

Role:
- render the standalone operator UI
- call the real Directive Kernel host APIs
- stay thin and product-logic-free

It is served by:
- `hosts/web-host/`

Canonical root-level commands:

```bash
pnpm --filter @directive/kernel-ui build
pnpm run dev
```

If you are working directly inside `ui/`, `pnpm run build` also works.
