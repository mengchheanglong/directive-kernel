# Web Host

This is the thin web/API host for Directive Kernel.

It serves the built UI and exposes live API routes against a directive root.

Use it when you want:
- a browser UI over the kernel
- a local operator surface
- the same core behavior as the standalone host, but through HTTP + UI routes

Quickstart:

```powershell
pnpm install
pnpm run start
```

Dev mode:

```powershell
pnpm run dev
```

The UI stays thin. Engine, Discovery, Runtime, and Architecture behavior still live in the kernel codebase.
