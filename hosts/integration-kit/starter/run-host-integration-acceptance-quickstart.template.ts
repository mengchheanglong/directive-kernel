import path from "node:path";

import {
  writeHostIntegrationAcceptanceReport,
  type WriteHostIntegrationAcceptanceReportOptions,
} from "./write-host-integration-acceptance-report.template.ts";

export type RunHostIntegrationAcceptanceQuickstartOptions = Omit<
  WriteHostIntegrationAcceptanceReportOptions,
  "outputPath"
> & {
  outputRoot: string;
  relativeOutputPath?: string;
};

const DEFAULT_RELATIVE_OUTPUT_PATH = path.join(
  "directive-workspace-artifacts",
  "host-integration-acceptance-report.json",
);

export async function runHostIntegrationAcceptanceQuickstart(
  options: RunHostIntegrationAcceptanceQuickstartOptions,
) {
  const outputPath = path.resolve(
    options.outputRoot,
    options.relativeOutputPath ?? DEFAULT_RELATIVE_OUTPUT_PATH,
  );

  const report = await writeHostIntegrationAcceptanceReport({
    hostName: options.hostName,
    moduleSurface: options.moduleSurface,
    generatedAt: options.generatedAt,
    outputPath,
  });

  return {
    outputPath,
    report,
  };
}
