import { workerData, parentPort } from "node:worker_threads";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

require("tsx/cjs");

const { Engine } = require(path.resolve(dirname, "../../engine/engine.ts"));
const { createFilesystemEngineStore } = require(path.resolve(dirname, "../../engine/storage.ts"));
const { createDirectiveWorkspaceEngineLanes } = require(path.resolve(dirname, "../../engine/workspace-lanes.ts"));
const { createDefaultDirectiveMission } = require(path.resolve(dirname, "../../engine/mission/default-mission.ts"));

const { directiveRoot, index } = workerData;
const engineRunsRoot = path.join(directiveRoot, "runtime", "host-artifacts", "engine-runs");

const engine = new Engine({
  laneSet: createDirectiveWorkspaceEngineLanes(),
  store: createFilesystemEngineStore({ engineRunsRoot }),
});

engine
  .processSource({
    source: {
      sourceType: "technical-essay",
      sourceRef: `https://example.com/concurrent-test-source-${index}`,
      title: `Concurrent Test Source ${index}`,
      summary: `Concurrency property test submission ${index}`,
    },
    mission: createDefaultDirectiveMission(),
  })
  .then((result) => {
    parentPort.postMessage({ ok: true, runId: result.record.runId });
  })
  .catch((err) => {
    parentPort.postMessage({ ok: false, error: String(err) });
  });
