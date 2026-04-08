import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  runHostIntegrationAcceptance,
  type HostIntegrationAcceptanceModuleSurface,
  type HostIntegrationAcceptanceReport,
} from "./host-integration-acceptance.template.ts";

export type WriteHostIntegrationAcceptanceReportOptions = {
  hostName: string;
  moduleSurface: HostIntegrationAcceptanceModuleSurface;
  outputPath: string;
  generatedAt?: string;
};

async function ensureParentDirectory(outputPath: string) {
  const parentDirectory = path.dirname(outputPath);
  await mkdir(parentDirectory, { recursive: true });
}

export async function writeHostIntegrationAcceptanceReport(
  options: WriteHostIntegrationAcceptanceReportOptions,
): Promise<HostIntegrationAcceptanceReport> {
  const report = await runHostIntegrationAcceptance({
    hostName: options.hostName,
    moduleSurface: options.moduleSurface,
    generatedAt: options.generatedAt,
  });

  await ensureParentDirectory(options.outputPath);
  await writeFile(options.outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}
