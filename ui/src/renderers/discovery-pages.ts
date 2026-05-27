import { html, nothing } from "lit";

import type {
  FrontendDiscoveryRoutingDetail,
  FrontendSnapshot,
} from "../types/index.ts";
import { navTo } from "../app-utils.ts";
import type { AllowedNextStep } from "../components/legal-next-steps-hint.ts";
import "../components/legal-next-steps-hint.ts";

type DiscoveryRoutingDetailRendererContext = {
  artifactLink: (pathValue: string | null | undefined) => unknown;
  approveDiscoveryRoute: (relativePath: string) => Promise<void>;
  renderConfidenceRecovery: (
    value: FrontendDiscoveryRoutingDetail["confidenceRecovery"],
  ) => unknown;
  renderEarnedAutonomy: (
    value: FrontendDiscoveryRoutingDetail["earnedAutonomy"],
  ) => unknown;
  renderFollowUpQuestions: (
    value: FrontendDiscoveryRoutingDetail["followUpQuestions"],
  ) => unknown;
  renderGapPressureSummary: (
    value: FrontendDiscoveryRoutingDetail["gapPressure"],
  ) => unknown;
  renderGapRadar: (value: FrontendDiscoveryRoutingDetail["gapRadar"]) => unknown;
  renderGoalCopilot: (
    value: FrontendDiscoveryRoutingDetail["goalCopilot"],
  ) => unknown;
  renderLaneProportions: (
    laneProportions: FrontendDiscoveryRoutingDetail["laneProportions"],
    secondaryLanes: FrontendDiscoveryRoutingDetail["secondaryLanes"],
  ) => unknown;
  renderMissionHealth: (
    value: FrontendDiscoveryRoutingDetail["missionHealth"],
  ) => unknown;
  renderNarrativeContext: (
    value: FrontendDiscoveryRoutingDetail["narrativeContext"],
  ) => unknown;
  renderRoutingDigest: (value: FrontendDiscoveryRoutingDetail["digest"]) => unknown;
  renderRoutingExplanationBreakdown: (
    detail: FrontendDiscoveryRoutingDetail,
  ) => unknown;
  renderSourceMemory: (
    value: FrontendDiscoveryRoutingDetail["sourceMemory"],
  ) => unknown;
  renderSourceSimilarity: (
    value: FrontendDiscoveryRoutingDetail["sourceSimilarity"],
  ) => unknown;
};

function deriveSteps(artifact: Record<string, unknown>): AllowedNextStep[] {
  const steps = (artifact as Record<string, unknown>).allowedNextSteps;
  if (!Array.isArray(steps)) return [];
  return steps.filter(Boolean).map((step: Record<string, unknown>) => {
    const stepKind = String(step.kind ?? step.step ?? step.label ?? "");
    const cliMap: Record<string, string> = {
      approve: "pnpm run standalone:cli discovery-route-approve --directive-root <root> --routing-record-path <path>",
      reject: "pnpm run standalone:cli discovery-route-reject --directive-root <root> --routing-record-path <path>",
      defer: "pnpm run standalone:cli discovery-route-defer --directive-root <root> --routing-record-path <path>",
    };
    return {
      label: String(step.label ?? step.description ?? stepKind),
      cliInvocation: cliMap[stepKind] ?? "pnpm run standalone:cli discovery-route-approve --directive-root <root> --routing-record-path <path>",
      docsAnchor: step.docsAnchor as string | undefined,
    };
  });
}

type HandoffsPageRendererContext = {
  artifactLink: (pathValue: string | null | undefined) => unknown;
  startArchitecture: (relativePath: string) => Promise<void>;
};

export function renderDiscoveryRoutingDetailPage(
  detail: FrontendDiscoveryRoutingDetail,
  context: DiscoveryRoutingDetailRendererContext,
) {
  if (!detail.ok) {
    return html`<section class="panel warning"><h2>Discovery routing record not found</h2><pre>${detail.error}</pre></section>`;
  }
  const openLabel = detail.routeDestination === "runtime"
    ? "Approve Runtime follow-up"
    : "Approve Architecture handoff";
  return html`
    <section class="panel"><h2>Discovery routing record</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
      <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
      <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
      <tr><th>source type</th><td>${detail.sourceType}</td></tr>
      <tr><th>decision state</th><td>${detail.decisionState}</td></tr>
      <tr><th>route destination</th><td><span class="pill">${detail.routeDestination}</span></td></tr>
      <tr><th>adoption target</th><td>${detail.adoptionTarget}</td></tr>
      <tr><th>why this route</th><td>${detail.whyThisRoute}</td></tr>
      <tr><th>why not alternatives</th><td>${detail.whyNotAlternatives}</td></tr>
      <tr><th>required next artifact</th><td>${detail.requiredNextArtifact}</td></tr>
      <tr><th>review cadence</th><td>${detail.reviewCadence ?? "n/a"}</td></tr>
      <tr><th>mission priority score</th><td>${detail.missionPriorityScore ?? "n/a"}</td></tr>
      <tr><th>matched capability gap</th><td>${detail.matchedGapId ?? "n/a"}</td></tr>
      <tr><th>gap pressure</th><td>${context.renderGapPressureSummary(detail.gapPressure)}</td></tr>
      <tr><th>gap alignment score</th><td>${detail.gapPressure?.gapAlignmentScore ?? "n/a"}</td></tr>
      <tr><th>open gaps considered</th><td>${detail.gapPressure?.openGapCount ?? "n/a"}</td></tr>
      <tr><th>gap mission objective</th><td>${detail.gapPressure?.relatedMissionObjective ?? "n/a"}</td></tr>
      <tr><th>routing confidence</th><td>${detail.routingConfidence ?? "n/a"}</td></tr>
      <tr><th>routing digest</th><td>${detail.digest?.headline ?? "n/a"}</td></tr>
      <tr><th>route conflict</th><td>${detail.routeConflict === null || detail.routeConflict === undefined ? "n/a" : detail.routeConflict ? "yes" : "no"}</td></tr>
      <tr><th>needs human review</th><td>${detail.needsHumanReview === null || detail.needsHumanReview === undefined ? "n/a" : detail.needsHumanReview ? "yes" : "no"}</td></tr>
      <tr><th>mission specificity warning</th><td>${detail.missionSpecificityWarning ?? "n/a"}</td></tr>
      <tr><th>Mission Health</th><td>${detail.missionHealth ? `${detail.missionHealth.overallScore}/100 | ${detail.missionHealth.healthGrade}` : "n/a"}</td></tr>
      <tr><th>Goal Copilot score</th><td>${detail.goalCopilot ? `${detail.goalCopilot.overallScore}/100` : "n/a"}</td></tr>
      <tr><th>active follow-up questions</th><td>${detail.followUpQuestions?.summary ?? "n/a"}</td></tr>
      <tr><th>Source Memory</th><td>${detail.sourceMemory?.summary ?? "n/a"}</td></tr>
      <tr><th>Source Similarity</th><td>${detail.sourceSimilarity?.summary ?? "n/a"}</td></tr>
      <tr><th>Narrative Threading</th><td>${detail.narrativeContext?.summary ?? "n/a"}</td></tr>
      <tr><th>lane proportions</th><td>${detail.laneProportions ? Object.entries(detail.laneProportions).map(([lane, value]) => `${lane} ${value}%`).join(" | ") : "n/a"}</td></tr>
      <tr><th>Gap Radar</th><td>${detail.gapRadar?.summary ?? "n/a"}</td></tr>
      <tr><th>ambiguity summary</th><td>${detail.ambiguitySummary
        ? `${detail.ambiguitySummary.topLaneId} over ${detail.ambiguitySummary.runnerUpLaneId ?? "none"} by ${detail.ambiguitySummary.scoreDelta}; conflicting signals: ${detail.ambiguitySummary.conflictingSignalFamilies.join(", ") || "none"}`
        : "n/a"}</td></tr>
      <tr><th>review guidance</th><td>${detail.reviewGuidance?.summary ?? "n/a"}</td></tr>
      <tr><th>confidence recovery</th><td>${detail.confidenceRecovery?.summary ?? "n/a"}</td></tr>
      <tr><th>Earned Autonomy</th><td>${detail.earnedAutonomy ? `${detail.earnedAutonomy.overallScore}/100 | ${detail.earnedAutonomy.summary}` : "n/a"}</td></tr>
      <tr><th>Engine usefulness level</th><td>${detail.usefulnessLevel ?? "n/a"}</td></tr>
      <tr><th>Engine usefulness rationale</th><td>${detail.usefulnessRationale ?? "n/a"}</td></tr>
      <tr><th>linked intake record</th><td>${context.artifactLink(detail.linkedIntakeRecord)}</td></tr>
      <tr><th>linked triage record</th><td>${context.artifactLink(detail.linkedTriageRecord)}</td></tr>
      <tr><th>Engine run record</th><td>${detail.engineRunRecordPath ? context.artifactLink(detail.engineRunRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
      <tr><th>Engine run report</th><td>${detail.engineRunReportPath ? context.artifactLink(detail.engineRunReportPath) : html`<span class="muted">not resolved</span>`}</td></tr>
    </tbody></table></section>
    ${context.renderRoutingDigest(detail.digest)}
    ${detail.reviewGuidance ? html`
      <section class="panel warning">
        <h3>Review handling guidance</h3>
        <p>${detail.reviewGuidance.operatorAction}</p>
        <ul>
          ${detail.reviewGuidance.requiredChecks.map((entry) => html`<li>${entry}</li>`)}
        </ul>
        <p class="muted">Stop-line: ${detail.reviewGuidance.stopLine}</p>
      </section>
    ` : nothing}
    ${context.renderConfidenceRecovery(detail.confidenceRecovery)}
    ${context.renderFollowUpQuestions(detail.followUpQuestions)}
    ${context.renderMissionHealth(detail.missionHealth)}
    ${context.renderSourceMemory(detail.sourceMemory)}
    ${context.renderSourceSimilarity(detail.sourceSimilarity)}
    ${context.renderNarrativeContext(detail.narrativeContext)}
    ${context.renderLaneProportions(detail.laneProportions, detail.secondaryLanes)}
    ${context.renderGapRadar(detail.gapRadar)}
    ${context.renderEarnedAutonomy(detail.earnedAutonomy)}
    ${context.renderGoalCopilot(detail.goalCopilot)}
    ${context.renderRoutingExplanationBreakdown(detail)}
    <legal-next-steps-hint .steps=${deriveSteps(detail as unknown as Record<string, unknown>)}></legal-next-steps-hint>
    <section class=${detail.downstreamStubRelativePath ? "panel good" : detail.approvalAllowed ? "panel message" : "panel warning"}>
      <h3>Route approval</h3>
      <p>${detail.downstreamStubRelativePath
        ? "This Discovery routing decision has already been approved and opened into one downstream bounded stub."
        : detail.approvalAllowed
          ? "Discovery stays first and inspectable here. Opening the next bounded Architecture or Runtime stub requires this explicit approval action and stops before any downstream execution."
          : "This routing record does not currently open a downstream Architecture or Runtime stub."}</p>
      <div class="actions">
        ${detail.engineRunId ? html`<a href=${`/engine-runs/${encodeURIComponent(detail.engineRunId)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/engine-runs/${encodeURIComponent(detail.engineRunId || "")}`); }}>Open Engine run detail</a>` : nothing}
        ${detail.downstreamStubRelativePath
          ? html`<a href=${`/handoffs/view?path=${encodeURIComponent(detail.downstreamStubRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(detail.downstreamStubRelativePath || "")}`); }}>Open downstream stub</a>`
          : detail.approvalAllowed
            ? html`<button @click=${() => context.approveDiscoveryRoute(detail.relativePath || "")}>${openLabel}</button>`
            : nothing}
      </div>
    </section>
    <section class="panel"><h3>Raw routing artifact</h3><pre>${detail.content}</pre></section>
  `;
}

export function renderHandoffsPage(
  snapshot: FrontendSnapshot,
  context: HandoffsPageRendererContext,
) {
  return html`
    ${snapshot.handoffWarnings?.length ? html`<section class="panel warning"><h3>Invalid handoff artifacts</h3><p class="muted">These are shown as raw files so the UI remains operable even when one handoff artifact is malformed.</p></section>` : nothing}
    <section class="panel"><h2>Handoff stubs</h2><table><thead><tr><th>title</th><th>lane</th><th>status</th><th>candidate id</th><th>artifact</th><th>bounded start</th></tr></thead><tbody>
      ${snapshot.handoffStubs.length ? snapshot.handoffStubs.map((stub) => {
        const startRelativePath = stub.startRelativePath;
        return html`
        <tr>
          <td>${stub.kind === "architecture_handoff_invalid" ? context.artifactLink(stub.relativePath) : html`<a href=${`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`); }}>${stub.title}</a>`}${stub.warning ? html`<div class="muted">${stub.warning}</div>` : nothing}</td>
          <td><span class="pill">${stub.lane}</span></td>
          <td>${stub.status}</td>
          <td>${stub.candidateId}</td>
          <td>${context.artifactLink(stub.relativePath)}</td>
          <td>${stub.lane === "architecture" ? (stub.kind === "architecture_handoff_invalid" ? html`<span class="muted">invalid handoff artifact</span>` : startRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(startRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(startRelativePath)}`); }}>view bounded start</a>` : html`<button class="secondary" @click=${() => context.startArchitecture(stub.relativePath)}>start bounded work</button>`) : html`<span class="muted">no start path yet</span>`}</td>
        </tr>`;
      }) : html`<tr><td colspan="6" class="muted">No handoff stubs found.</td></tr>`}
    </tbody></table></section>
  `;
}
