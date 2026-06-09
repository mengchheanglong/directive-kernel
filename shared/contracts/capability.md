# Runtime Capability Contract

This contract defines the minimum file-backed shape for a Runtime capability
registered under `runtime/capabilities/`.

## Required layout

Each capability lives in its own folder:

```text
runtime/capabilities/<capability-id>/
  manifest.json
  index.ts
  executor.ts
```

The folder name is the capability id. It must be stable, kebab-case, and
safe to expose through host-facing read surfaces.

## Required manifest

`manifest.json` is the registry source of truth for human-readable metadata.
It must contain:

```json
{
  "displayName": "Example Capability",
  "description": "One bounded sentence describing the Runtime value.",
  "domain": "runtime"
}
```

Optional fields:

- `inputSchema`
- `outputSchema`

If present, schema fields must point at stable repo schema paths such as
`shared/schemas/example-input.schema.json`.

## Required code surface

- `index.ts` is the capability entrypoint exposed by the registry.
- `executor.ts` owns the callable or bounded executable behavior.

The scaffolded template may start with a stub executor, but shipped
capabilities must replace the stub with real bounded behavior before they are
advertised to consuming hosts as usable execution surfaces.

## Registry behavior

- The runtime capability registry discovers capabilities from
  `runtime/capabilities/*`.
- Metadata shown to hosts and agents must come from `manifest.json`.
- Missing manifests are tolerated only as a fallback for legacy folders; new
  capabilities must include a manifest from the start.

## Host boundary

Hosts may list capabilities and scaffold new folders, but host code must not
invent separate capability metadata outside this contract. The repo-owned
manifest plus the repo-owned executor remain authoritative.
