# Web Host

This is the thin web/API host for Directive Kernel.

It serves the built frontend and exposes live API routes against a directive root.

Use it when you want:
- a browser UI over the kernel
- a local operator surface
- the same core behavior as the standalone host, but through HTTP + frontend routes

Quickstart:

```powershell
npm run frontend:install
npm run start
```

Dev mode:

```powershell
npm run dev
```

The frontend stays thin. Engine, Discovery, Runtime, and Architecture behavior still live in the kernel codebase.
