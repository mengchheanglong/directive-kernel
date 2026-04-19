import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  runDiscoveryStarterSmoke,
} from "../../hosts/integration-kit/starter/discovery-submission-adapter.smoke.template.ts";
import {
  runDiscoveryFrontDoorStarterSmoke,
} from "../../hosts/integration-kit/starter/discovery-front-door-adapter.smoke.template.ts";
import {
  runHostIntegrationAcceptanceQuickstart,
} from "../../hosts/integration-kit/starter/run-host-integration-acceptance-quickstart.template.ts";

export async function runStarterAndHostChecks() {
  const discoveryStarter = await runDiscoveryStarterSmoke();
  assert.equal(discoveryStarter.ok, true);

  const frontDoorStarter = await runDiscoveryFrontDoorStarterSmoke();
  assert.equal(frontDoorStarter.ok, true);
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.routingRecordPath)));
  assert.ok(fs.existsSync(path.resolve(frontDoorStarter.directiveRoot, frontDoorStarter.engineRunRecordPath)));

  const acceptanceOutputRoot = path.resolve(
    os.tmpdir(),
    `directive-workspace-acceptance-${Date.now()}`,
  );
  const acceptance = await runHostIntegrationAcceptanceQuickstart({
    hostName: "Directive Kernel Hardening Smoke",
    moduleSurface: "mixed",
    generatedAt: "2026-04-10T00:00:00.000Z",
    outputRoot: acceptanceOutputRoot,
  });
  assert.ok(fs.existsSync(acceptance.outputPath));
  const acceptanceReport = JSON.parse(fs.readFileSync(acceptance.outputPath, "utf8")) as {
    accepted?: boolean;
    front_door_acceptance?: { ok?: boolean };
    engine_contract_surface?: { ok?: boolean };
  };
  assert.equal(acceptanceReport.accepted, true);
  assert.equal(acceptanceReport.front_door_acceptance?.ok, true);
  assert.equal(acceptanceReport.engine_contract_surface?.ok, true);
}
