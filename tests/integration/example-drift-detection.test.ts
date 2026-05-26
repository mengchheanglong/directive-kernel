import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("example drift detection", () => {
  it("exits 1 and reports drift when a field is corrupted", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "example-drift-"));
    try {
      const examplesDir = path.join(tmp, "hosts", "integration-kit", "examples");
      const schemasDir = path.join(tmp, "shared", "schemas");
      fs.mkdirSync(examplesDir, { recursive: true });
      fs.mkdirSync(schemasDir, { recursive: true });

      const repoRoot = process.cwd();
      const exampleSrc = path.join(repoRoot, "hosts", "integration-kit", "examples", "host-integration-acceptance-report.json");
      const exampleDst = path.join(examplesDir, "host-integration-acceptance-report.json");
      const schemaSrc = path.join(repoRoot, "shared", "schemas", "host-integration-acceptance-report.schema.json");
      const schemaDst = path.join(schemasDir, "host-integration-acceptance-report.schema.json");

      fs.copyFileSync(exampleSrc, exampleDst);
      fs.copyFileSync(schemaSrc, schemaDst);

      const example = JSON.parse(fs.readFileSync(exampleDst, "utf8")) as Record<string, unknown>;
      example.host_name = 42;
      fs.writeFileSync(exampleDst, JSON.stringify(example, null, 2) + "\n");

      const scriptPath = path.join(repoRoot, "scripts", "check-example-schemas.ts");
      const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          EXAMPLE_ROOTS_OVERRIDE: path.relative(repoRoot, examplesDir).replaceAll(path.sep, "/"),
        },
      });

      let stderr = "";
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      const code = await new Promise<number | null>((resolve) => {
        child.on("close", resolve);
      });

      expect(code).toBe(1);
      expect(stderr).toContain("FAILED");
      expect(stderr).toContain("drift");
      expect(stderr).toContain("validation_error");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
