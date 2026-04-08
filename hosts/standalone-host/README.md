# Standalone Host

This is the reference filesystem host for Directive Kernel.

Use it when you want:
- a local bootstrapped directive root
- a bounded HTTP API
- a CLI for Discovery and Runtime artifact flows
- a simple proof that the kernel can run without a larger host project

Main entrypoints:
- `cli.ts`
- `runtime.ts`
- `server.ts`
- `bootstrap.ts`
- `config.ts`
- `persistence.ts`

Quickstart:

```powershell
node --experimental-strip-types ./hosts/standalone-host/cli.ts init --output-root ./local/standalone
node --experimental-strip-types ./hosts/standalone-host/cli.ts serve --config ./local/standalone/standalone-host.config.json
```

The bootstrap command creates:
- a local directive root
- a seed Discovery queue
- example Discovery and Runtime payloads
- a standalone-host config

This host is intentionally bounded:
- local/shareable
- filesystem first
- optional SQLite ledger
- no fake multi-host parity claim
