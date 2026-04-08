import { runDiscoveryOverviewStarterSmoke } from "./discovery-overview-reader.smoke.template.ts";
import { runDiscoverySignalStarterSmoke } from "./discovery-signal-adapter.smoke.template.ts";
import { runDiscoveryStarterSmoke } from "./discovery-submission-adapter.smoke.template.ts";

export type HostIntegrationAcceptanceModuleSurface =
  | "package_import"
  | "starter_copy"
  | "mixed";

export type HostIntegrationAcceptanceSection = {
  ok: boolean;
  check_count: number;
  summary: string;
};

export type HostIntegrationAcceptanceReport = {
  host_name: string;
  accepted: boolean;
  generated_at: string;
  module_surface: HostIntegrationAcceptanceModuleSurface;
  submission_acceptance: HostIntegrationAcceptanceSection;
  overview_acceptance: HostIntegrationAcceptanceSection;
  signal_acceptance: HostIntegrationAcceptanceSection;
  notes: string[];
};

type RunHostIntegrationAcceptanceOptions = {
  hostName: string;
  moduleSurface: HostIntegrationAcceptanceModuleSurface;
  generatedAt?: string;
};

function createSection(input: {
  ok: boolean;
  checkCount: number;
  summary: string;
}): HostIntegrationAcceptanceSection {
  return {
    ok: input.ok,
    check_count: input.checkCount,
    summary: input.summary,
  };
}

export async function runHostIntegrationAcceptance(
  options: RunHostIntegrationAcceptanceOptions,
): Promise<HostIntegrationAcceptanceReport> {
  const submission = await runDiscoveryStarterSmoke();
  const overview = runDiscoveryOverviewStarterSmoke();
  const signal = await runDiscoverySignalStarterSmoke();

  const submissionAcceptance = createSection({
    ok: submission.ok,
    checkCount: Object.keys(submission.queueStatuses).length,
    summary:
      "Queue-only, fast-path, and split-case submissions all exercised the canonical Discovery submission path.",
  });

  const overviewAcceptance = createSection({
    ok: overview.ok,
    checkCount: overview.recentEntryIds.length + Object.keys(overview.statusCounts).length,
    summary:
      "Overview reader consumed the canonical queue document and returned status counts plus recent entries.",
  });

  const signalAcceptance = createSection({
    ok: signal.ok,
    checkCount: Object.keys(signal.queueStatuses).length,
    summary:
      "Signal adapter accepted degraded signals through canonical Discovery submission and ignored healthy runtime state.",
  });

  const accepted =
    submissionAcceptance.ok && overviewAcceptance.ok && signalAcceptance.ok;

  return {
    host_name: options.hostName,
    accepted,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    module_surface: options.moduleSurface,
    submission_acceptance: submissionAcceptance,
    overview_acceptance: overviewAcceptance,
    signal_acceptance: signalAcceptance,
    notes: [
      "Directive Workspace remains the product; the host is only accepted as a consumer of the canonical surface.",
      "Passing this acceptance harness does not authorize host-local redefinition of Discovery, Runtime, or Architecture vocabulary.",
    ],
  };
}
