import { defineConfig } from "vitest/config";

// Vite ships with a hard-coded list of Node built-in modules and does not yet
// recognise newer experimental builtins such as `node:sqlite`. The standalone
// host imports `node:sqlite` via its persistence module, which is reachable
// from the web-host server pulled in by the hardening integration suite.
// Register a tiny resolver plugin that intercepts both forms and synthesises
// a module that performs a runtime `require("node:sqlite")` at evaluation
// time so Node's loader handles the actual resolution.
const nodeSqliteExternalPlugin = {
  name: "directive-kernel-node-sqlite-external",
  enforce: "pre" as const,
  resolveId(id: string) {
    if (id === "node:sqlite" || id === "sqlite") {
      return "\0directive-kernel-node-sqlite-shim";
    }
    return null;
  },
  load(id: string) {
    if (id === "\0directive-kernel-node-sqlite-shim") {
      return [
        "import { createRequire } from 'node:module';",
        "const require = createRequire(import.meta.url);",
        "const mod = require('node:sqlite');",
        "export const DatabaseSync = mod.DatabaseSync;",
        "export default mod;",
      ].join("\n");
    }
    return null;
  },
};

export default defineConfig({
  plugins: [nodeSqliteExternalPlugin],
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "ui/**",
      "discovery/research-engine/**",
      "hosts/integration-kit/**",
      "local/**",
      "state/**",
      "dist/**",
    ],
    globals: false,
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ["default"],
    pool: "forks",
    isolate: true,
  },
  resolve: {
    // Force Vite/Vitest to match the "development" exports condition we
    // added in package.json so tests resolve in-repo imports through the
    // .ts source path. Without this, Vite would pick "import" or "default"
    // and try to read paths under ./dist that don't exist in fresh
    // checkouts.
    conditions: ["development", "import", "default"],
  },
});
