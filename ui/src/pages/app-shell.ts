import { LitElement, html, nothing } from "lit";

import { appStyles } from "../app-styles";
import type {
  FrontendDiscoveryRoutingDetail,
  FrontendExecutablePlanAction,
  FrontendGapPressureDetail,
  FrontendEngineRunRecord,
  FrontendEngineRunsOverview,
  FrontendMissionFeedbackPreview,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendQueueOverview,
  FrontendRuntimeStatus,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
  FrontendTelemetrySnapshot,
} from "../types";
import { artifactPathToViewPath, navTo } from "../app-utils";
import {
  adoptArchitectureResultAction,
  approveDiscoveryRouteAction,
  resolveDiscoveryRoutingReviewAction,
  resolveRuntimeHostSelectionAction,
  resolveRuntimePromotionSeamDecisionAction,
  acceptRuntimeRegistryAcceptanceAction,
  approveRuntimeFollowUpAction,
  approveRuntimePromotionReadinessAction,
  approveRuntimeProofRuntimeCapabilityBoundaryAction,
  approveRuntimeRecordProofAction,
  approveGapFormalizationAction,
  approveMissionFeedbackAction,
  closeArchitectureStartAction,
  completeArchitectureImplementationAction,
  confirmArchitectureRetentionAction,
  continueArchitectureResultAction,
  createArchitectureImplementationTargetAction,
  createArchitectureIntegrationRecordAction,
  evaluateArchitectureConsumptionAction,
  previewMissionFeedbackAction,
  recordArchitectureConsumptionAction,
  rejectGapFormalizationAction,
  rejectMissionFeedbackAction,
  reopenArchitectureFromEvaluationAction,
  rerouteEngineRunAction,
  startArchitectureAction,
  submitDiscoveryFrontDoorAction,
  updateEnginePlanProgressAction,
} from "../page-actions.ts";
import { getDirectiveUiPageChrome } from "../page-chrome.ts";
import { loadDirectiveUiPage } from "../route-loader";
import {
  renderArchitectureLaneSummary,
  renderDiscoveryLanePage,
  renderQueueCard,
  renderQueueStat,
  renderQueueTag,
  renderRuntimeCaseStrip,
  renderRuntimeLaneSummary,
} from "../components/lane-sections";
import {
  renderHomePage,
  renderOperatorDecisionInboxPage as renderOperatorDecisionInboxPageView,
  renderTelemetryPage,
} from "../renderers/dashboard";
import {
  renderDiscoveryRoutingDetailPage,
  renderHandoffsPage,
} from "../renderers/discovery-pages.ts";
import { renderResidualDetailPage } from "../renderers/detail-pages.ts";
import {
  renderEngineRunDetailPage,
  renderEngineRunsPage,
  renderQueuePage,
} from "../renderers/execution-pages.ts";
import {
  renderConfidenceRecovery as renderConfidenceRecoveryPanel,
  renderEarnedAutonomy as renderEarnedAutonomyPanel,
  renderFollowUpQuestions as renderFollowUpQuestionsPanel,
  renderGapPressureSummary as renderGapPressureSummaryView,
  renderGapRadar as renderGapRadarPanel,
  renderGoalCopilot as renderGoalCopilotPanel,
  renderLaneProportions as renderLaneProportionsPanel,
  renderMissionHealth as renderMissionHealthPanel,
  renderNarrativeContext as renderNarrativeContextPanel,
  renderPriorPlanContext as renderPriorPlanContextPanel,
  renderRoutingExplanationBreakdown as renderRoutingExplanationBreakdownView,
  renderSourceMemory as renderSourceMemoryPanel,
  renderSourceSimilarity as renderSourceSimilarityPanel,
} from "../renderers/insight-panels";
import {
  getShellInbox as getShellInboxView,
  getShellSnapshot as getShellSnapshotView,
  renderActionLink as renderActionLinkView,
  renderSidebar as renderSidebarView,
  renderSidebarLink as renderSidebarLinkView,
} from "../renderers/shell";
import {
  artifactLink as artifactLinkView,
  currentHeadLink as currentHeadLinkView,
} from "../renderers/shared";
import { renderWorkflowMapPage as renderWorkflowMapPageView } from "../renderers/workflow";

class DirectiveUiApp extends LitElement {
  static properties = {
    route: { state: true },
    page: { state: true },
    loading: { state: true },
    error: { state: true },
    submitting: { state: true },
    missionFeedbackPreviews: { state: true },
  };

  static styles = appStyles;

  declare route: string;
  declare page: any;
  declare loading: boolean;
  declare error: string;
  declare submitting: boolean;
  declare missionFeedbackPreviews: Record<string, FrontendMissionFeedbackPreview | undefined>;

  constructor() {
    super();
    this.route = "";
    this.page = null;
    this.loading = true;
    this.error = "";
    this.submitting = false;
    this.missionFeedbackPreviews = {};
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("popstate", this.handleRoute);
    this.handleRoute();
  }

  disconnectedCallback() {
    window.removeEventListener("popstate", this.handleRoute);
    super.disconnectedCallback();
  }

  private handleRoute = async () => {
    const url = new URL(window.location.href);
    this.route = `${url.pathname}${url.search}`;
    this.loading = true;
    this.error = "";
    try {
      this.page = await loadDirectiveUiPage(url);
    } catch (error) {
      this.error = String((error as Error).message || error);
    } finally {
      this.loading = false;
    }
  };

  private renderActionLink(
    href: string,
    label: string,
    tone: "primary" | "secondary" = "secondary",
  ) {
    return renderActionLinkView(href, label, tone);
  }

  private renderSidebarLink(input: {
    current: string;
    href: string;
    label: string;
    caption: string;
    icon: string;
    badge?: string | number | null;
    active: (path: string) => boolean;
  }) {
    return renderSidebarLinkView(input);
  }

  private getShellSnapshot() {
    return getShellSnapshotView(this.page);
  }

  private getShellInbox() {
    return getShellInboxView(this.page);
  }

  private getPageChrome(current: string) {
    return getDirectiveUiPageChrome(current);
  }

  private renderSidebar(current: string) {
    const snapshot = this.getShellSnapshot();
    const inbox = this.getShellInbox();
    const reviewPressure = snapshot
      ? snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length
      : null;

    return html`
      <aside class="sidebar-shell">
        <div class="sidebar-brand">
          <strong>Directive Kernel</strong>
          <span class="muted">Research dashboard</span>
        </div>

        <div class="sidebar-group">
          <div class="sidebar-group-label">Workspace</div>
          ${this.renderSidebarLink({
            current,
            href: "/",
            label: "Dashboard",
            caption: "Live posture and lane heads",
            icon: "overview",
            active: (path) => path === "/",
          })}
          ${this.renderSidebarLink({
            current,
            href: "/workflow-map",
            label: "Workflow map",
            caption: "System flow across phases",
            icon: "workflow",
            active: (path) => path === "/workflow-map",
          })}
          ${this.renderSidebarLink({
            current,
            href: "/operator-inbox",
            label: "Decision inbox",
            caption: "Bounded operator triage and blockers",
            icon: "inbox",
            badge: inbox?.summary.totalActionableEntries || null,
            active: (path) => path === "/operator-inbox",
          })}
          ${this.renderSidebarLink({
            current,
            href: "/telemetry",
            label: "Observability",
            caption: "Request health, storage pressure, and recent telemetry events",
            icon: "observability",
            active: (path) => path === "/telemetry",
          })}
        </div>

        <div class="sidebar-group">
          <div class="sidebar-group-label">Lanes</div>
          ${this.renderSidebarLink({
            current,
            href: "/queue",
            label: "Sources",
            caption: "Queue, routing, and downstream state",
            icon: "sources",
            active: (path) => path === "/queue" || path.startsWith("/discovery-routing-records/"),
          })}
          ${this.renderSidebarLink({
            current,
            href: "/discovery",
            label: "Discovery",
            caption: "Front-door intake and routing pressure",
            icon: "discovery",
            active: (path) => path === "/discovery",
          })}
          ${this.renderSidebarLink({
            current,
            href: "/architecture",
            label: "Architecture",
            caption: "Lane heads and retained outputs",
            icon: "architecture",
            active: (path) => path === "/architecture" || path.startsWith("/architecture-"),
          })}
          ${this.renderSidebarLink({
            current,
            href: "/runtime",
            label: "Runtime",
            caption: "Capability progression and blockers",
            icon: "runtime",
            active: (path) => path === "/runtime" || path.startsWith("/runtime-"),
          })}
        </div>

        <div class="sidebar-group">
          <div class="sidebar-group-label">Trace</div>
          ${this.renderSidebarLink({
            current,
            href: "/engine-runs",
            label: "Engine runs",
            caption: "Decision traces and proof planning",
            icon: "runs",
            active: (path) => path === "/engine-runs" || path.startsWith("/engine-runs/"),
          })}
          ${this.renderSidebarLink({
            current,
            href: "/handoffs",
            label: "Handoffs",
            caption: "Bounded downstream continuation",
            icon: "handoffs",
            active: (path) => path === "/handoffs" || path.startsWith("/handoffs/"),
          })}
        </div>

        <div class="sidebar-footer">
          <div class="sidebar-footer-heading">
            <span class="eyebrow">Live posture</span>
            <strong>System pulse</strong>
          </div>
          <div class="sidebar-pulse-grid">
            <div class="sidebar-pulse">
              <span>Sources</span>
              <strong>${snapshot?.queue.totalEntries ?? "-"}</strong>
            </div>
            <div class="sidebar-pulse">
              <span>Decisions</span>
              <strong>${inbox?.summary.totalActionableEntries ?? "-"}</strong>
            </div>
            <div class="sidebar-pulse">
              <span>Pressure</span>
              <strong>${reviewPressure ?? "-"}</strong>
            </div>
            <div class="sidebar-pulse">
              <span>Runtime</span>
              <strong>${snapshot?.runtimeSummary.activeCases.length ?? "-"}</strong>
            </div>
          </div>
          <p class="muted sidebar-footnote">
            This shell stays lane-aware while exposing bounded mutations through kernel-owned routes. Decisions remain explicit, traceable, and workflow-bound.
          </p>
        </div>
      </aside>
    `;
  }

  private artifactLink(pathValue: string | null | undefined) {
    return artifactLinkView(pathValue);
  }

  private renderGapPressureSummary(gapPressure: FrontendGapPressureDetail | null | undefined) {
    return renderGapPressureSummaryView(gapPressure);
  }

  private renderRoutingDigest(digest: {
    headline: string;
    explanation: string;
    primaryConcern: {
      kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
      summary: string;
      suggestedAction: string;
    } | null;
    secondaryConcerns: Array<{
      kind: "conflict" | "low_confidence" | "mission_weakness" | "stalled_thread" | "narrative_action" | "gap_pressure";
      summary: string;
    }>;
    threadContext: string | null;
    trustLevel: string;
  } | null | undefined) {
    if (!digest) {
      return nothing;
    }

    return html`
      <section class=${digest.primaryConcern ? "panel warning" : "panel good"}>
        <h3>Routing Digest</h3>
        <p><strong>${digest.headline}</strong></p>
        <p>${digest.explanation}</p>
        ${digest.primaryConcern ? html`
          <div class="stack-block">
            <p><strong>Primary concern:</strong> ${digest.primaryConcern.summary}</p>
            <p class="muted">Suggested action: ${digest.primaryConcern.suggestedAction}</p>
          </div>
        ` : nothing}
        ${digest.secondaryConcerns.length
          ? html`<ul>${digest.secondaryConcerns.map((concern) => html`<li>${concern.summary}</li>`)}</ul>`
          : nothing}
        <p class="muted">${digest.threadContext ?? "No active narrative thread."}</p>
        <p class="muted">${digest.trustLevel}</p>
      </section>
    `;
  }

  private renderGoalCopilot(goalCopilot: {
    overallScore: number;
    objectiveSpecificityScore: number;
    usefulnessSignalQualityScore: number;
    constraintQualityScore: number;
    laneClarityScore: number;
    warnings: string[];
    rationale: string[];
    suggestedObjective: string | null;
    suggestedConstraints: string[];
    suggestedUsefulnessSignals: string[];
    suggestedCapabilityLanes: string[];
  } | null | undefined) {
    return renderGoalCopilotPanel(goalCopilot);
  }

  private renderConfidenceRecovery(confidenceRecovery: {
    summary: string;
    confidenceLift: string;
    requestedInputs: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
    }>;
  } | null | undefined) {
    return renderConfidenceRecoveryPanel(confidenceRecovery);
  }

  private renderGapRadar(gapRadar: {
    summary: string;
    suggestions: Array<{
      radarId: string;
      targetLaneId: string;
      confidence: string;
      evidenceCount: number;
      summary: string;
      recommendedChange: string;
      signalTokens: string[];
      relatedOpenGapId: string | null;
      suggestedPriority: string;
    }>;
  } | null | undefined) {
    return renderGapRadarPanel(gapRadar);
  }

  private renderEarnedAutonomy(earnedAutonomy: {
    routeClass: string;
    overallScore: number;
    evidenceCount: number;
    operatorAgreementRate: number | null;
    reviewClearRate: number | null;
    reversalCount: number;
    autoApprovalEligible: boolean;
    approvalReductionApplied: boolean;
    summary: string;
    rationale: string[];
  } | null | undefined) {
    return renderEarnedAutonomyPanel(earnedAutonomy);
  }

  private renderMissionHealth(missionHealth: {
    overallScore: number;
    healthGrade: "A" | "B" | "C" | "D" | "F";
    objectiveSpecificityScore: number;
    usefulnessSignalQualityScore: number;
    constraintQualityScore: number;
    lanePriorityClarityScore: number;
    overmatchRiskScore: number;
    stalenessRiskScore: number;
    warnings: string[];
    tensionSignals: string[];
    rationale: string[];
    suggestedObjectiveRewrite: string | null;
    suggestedConstraintAdditions: string[];
  } | null | undefined) {
    return renderMissionHealthPanel(missionHealth);
  }

  private renderFollowUpQuestions(followUpQuestions: {
    summary: string;
    questions: Array<{
      field: string;
      question: string;
      whyItMatters: string;
      exampleAnswer: string | null;
      predictedEffect: string;
    }>;
  } | null | undefined) {
    return renderFollowUpQuestionsPanel(followUpQuestions);
  }

  private renderSourceMemory(sourceMemory: {
    summary: string;
    biasAdjustments: Record<string, number>;
    matchingTopics: Array<{
      token: string;
      recentCount: number;
      totalCount: number;
      dominantLaneId: string;
    }>;
    matchingRouteClass: {
      routeClass: string;
      laneId: string;
      sourceType: string;
      recentCount: number;
      totalCount: number;
      lastSeenAt: string;
    } | null;
    rationale: string[];
  } | null | undefined) {
    return renderSourceMemoryPanel(sourceMemory);
  }

  private renderSourceSimilarity(sourceSimilarity: {
    summary: string;
    relatedSources: Array<{
      runId: string;
      candidateId: string;
      candidateName: string;
      laneId: string;
      decisionState: string;
      receivedAt: string;
      similarityScore: number;
      sharedTokens: string[];
      summary: string;
    }>;
  } | null | undefined) {
    return renderSourceSimilarityPanel(sourceSimilarity);
  }

  private renderNarrativeContext(narrativeContext: {
    summary: string;
    primaryThread: {
      threadId: string;
      name: string;
      state: "nascent" | "developing" | "mature" | "stalled" | "completed";
      summary: string;
      sourceCount: number;
      firstSeenAt: string;
      lastSeenAt: string;
      activeSpanDays: number;
      currentSourceOverlap: number;
      topTokens: string[];
      laneTendency: {
        dominantLaneId: string;
        dominancePercent: number;
        laneCounts: Record<string, number>;
        biasAdjustment: number;
      };
      gapCoverage: {
        dominantGapId: string | null;
        matchedGapIds: string[];
        status: "none" | "emerging" | "partially_addressed" | "closed";
      };
      followThrough: {
        completedProofCount: number;
        stalledProofCount: number;
        followThroughRate: number;
      };
      demandSignals: Array<{
        kind: string;
        priority: string;
        summary: string;
        requestedLaneId: string | null;
      }>;
      relatedRunIds: string[];
    } | null;
    relatedThreads: Array<{
      threadId: string;
      name: string;
      state: "nascent" | "developing" | "mature" | "stalled" | "completed";
      summary: string;
      sourceCount: number;
      firstSeenAt: string;
      lastSeenAt: string;
      activeSpanDays: number;
      currentSourceOverlap: number;
      topTokens: string[];
      laneTendency: {
        dominantLaneId: string;
        dominancePercent: number;
        laneCounts: Record<string, number>;
        biasAdjustment: number;
      };
      gapCoverage: {
        dominantGapId: string | null;
        matchedGapIds: string[];
        status: "none" | "emerging" | "partially_addressed" | "closed";
      };
      followThrough: {
        completedProofCount: number;
        stalledProofCount: number;
        followThroughRate: number;
      };
      demandSignals: Array<{
        kind: string;
        priority: string;
        summary: string;
        requestedLaneId: string | null;
      }>;
      relatedRunIds: string[];
    }>;
    biasAdjustments: Record<string, number>;
    demandSignals: Array<{
      kind: string;
      priority: string;
      summary: string;
      requestedLaneId: string | null;
    }>;
    rationale: string[];
  } | null | undefined) {
    return renderNarrativeContextPanel(narrativeContext);
  }

  private renderLaneProportions(
    laneProportions: Record<string, number> | null | undefined,
    secondaryLanes: Array<{ laneId: string; proportion: number; reason: string; }> | null | undefined,
  ) {
    return renderLaneProportionsPanel(laneProportions, secondaryLanes);
  }

  private renderPriorPlanContext(priorPlanContext: {
    routeClass: string;
    summary: string;
    matchingRunCount: number;
    successfulFollowThroughCount: number;
    stalledRunCount: number;
    recurringImprovementGoals: string[];
    recurringProofKinds: Array<{ proofKind: string; count: number; status: "successful" | "stalled" | "mixed"; }>;
    adaptationPatterns: Array<{ directiveOwnedForm: string; count: number; successfulCount: number; stalledCount: number; }>;
    relatedRunIds: string[];
  } | null | undefined) {
    return renderPriorPlanContextPanel(priorPlanContext);
  }

  private renderRoutingExplanationBreakdown(detail: FrontendDiscoveryRoutingDetail | null | undefined) {
    return renderRoutingExplanationBreakdownView(detail);
  }

  private currentHeadLink(entry: FrontendQueueEntry) {
    return currentHeadLinkView(entry);
  }

  private renderQueueTag(value: string, tone: "default" | "runtime" | "architecture" | "warning" = "default") {
    return renderQueueTag(value, tone);
  }

  private renderQueueStat(label: string, value: number, description: string) {
    return renderQueueStat(label, value, description);
  }

  private renderQueueCard(
    entry: FrontendQueueEntry,
    run: FrontendEngineRunRecord | undefined,
    handoffPath: string | null,
  ) {
    return renderQueueCard(entry, run, handoffPath, {
      currentHeadLink: this.currentHeadLink.bind(this),
    });
  }

  private renderRuntimeCaseStrip(entry: FrontendRuntimeSummaryCase | FrontendQueueEntry) {
    return renderRuntimeCaseStrip(entry, {
      currentHeadLink: this.currentHeadLink.bind(this),
    });
  }

  private renderRuntimeLaneSummary(summary: FrontendSnapshot["runtimeSummary"]) {
    return renderRuntimeLaneSummary(summary, {
      currentHeadLink: this.currentHeadLink.bind(this),
    });
  }

  private renderArchitectureLaneSummary(summary: FrontendSnapshot["architectureSummary"]) {
    return renderArchitectureLaneSummary(summary, {
      currentHeadLink: this.currentHeadLink.bind(this),
    });
  }

  private renderDiscoveryLanePage(snapshot: FrontendSnapshot) {
    return renderDiscoveryLanePage(snapshot);
  }

  private async submitDiscoveryFrontDoor(form: HTMLFormElement) {
    try {
      this.submitting = true;
      this.error = "";
      const result = await submitDiscoveryFrontDoorAction(form);
      if (result.resetForm) {
        form.reset();
      }
      navTo(result.navigateTo);
    } catch (error) {
      this.error = String((error as Error).message || error);
    } finally {
      this.submitting = false;
    }
  }

  private async approveDiscoveryRoute(routingPath: string) {
    try {
      navTo(await approveDiscoveryRouteAction(routingPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeFollowUp(followUpPath: string) {
    try {
      navTo(await approveRuntimeFollowUpAction(followUpPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeRecordProof(runtimeRecordPath: string) {
    try {
      navTo(await approveRuntimeRecordProofAction(runtimeRecordPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeProofRuntimeCapabilityBoundary(runtimeProofPath: string) {
    try {
      navTo(await approveRuntimeProofRuntimeCapabilityBoundaryAction(runtimeProofPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimePromotionReadiness(capabilityBoundaryPath: string) {
    try {
      navTo(await approveRuntimePromotionReadinessAction(capabilityBoundaryPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async startArchitecture(handoffPath: string) {
    try {
      navTo(await startArchitectureAction(handoffPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async closeArchitectureStart(form: HTMLFormElement, startPath: string) {
    try {
      navTo(await closeArchitectureStartAction(form, startPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async continueArchitectureResult(resultPath: string) {
    try {
      navTo(await continueArchitectureResultAction(resultPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async adoptArchitectureResult(resultPath: string) {
    try {
      navTo(await adoptArchitectureResultAction(resultPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async createArchitectureImplementationTarget(adoptionPath: string) {
    try {
      navTo(await createArchitectureImplementationTargetAction(adoptionPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async completeArchitectureImplementation(form: HTMLFormElement, targetPath: string) {
    try {
      navTo(await completeArchitectureImplementationAction(form, targetPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async confirmArchitectureRetention(form: HTMLFormElement, resultPath: string) {
    try {
      navTo(await confirmArchitectureRetentionAction(form, resultPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async createArchitectureIntegrationRecord(form: HTMLFormElement, retainedPath: string) {
    try {
      navTo(await createArchitectureIntegrationRecordAction(form, retainedPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async recordArchitectureConsumption(form: HTMLFormElement, integrationPath: string) {
    try {
      navTo(await recordArchitectureConsumptionAction(form, integrationPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async evaluateArchitectureConsumption(form: HTMLFormElement, consumptionPath: string) {
    try {
      navTo(await evaluateArchitectureConsumptionAction(form, consumptionPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async reopenArchitectureFromEvaluation(evaluationPath: string) {
    try {
      navTo(await reopenArchitectureFromEvaluationAction(evaluationPath));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async updateEnginePlanProgress(
    runId: string,
    action: FrontendExecutablePlanAction,
    status: FrontendExecutablePlanAction["status"],
  ) {
    try {
      await updateEnginePlanProgressAction({
        runId,
        action,
        status,
      });
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async rerouteEngineRun(form: HTMLFormElement, runId: string) {
    try {
      navTo(await rerouteEngineRunAction(form, runId));
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async previewMissionFeedback(feedbackId: string) {
    try {
      const preview = await previewMissionFeedbackAction(feedbackId);
      this.missionFeedbackPreviews = {
        ...this.missionFeedbackPreviews,
        [feedbackId]: preview,
      };
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveMissionFeedback(form: HTMLFormElement, feedbackId: string) {
    try {
      await approveMissionFeedbackAction(form, feedbackId);
      this.missionFeedbackPreviews = {};
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async rejectMissionFeedback(form: HTMLFormElement, feedbackId: string) {
    try {
      await rejectMissionFeedbackAction(form, feedbackId);
      this.missionFeedbackPreviews = {};
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveGapFormalization(form: HTMLFormElement, formalizationId: string) {
    try {
      await approveGapFormalizationAction(form, formalizationId);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async rejectGapFormalization(form: HTMLFormElement, formalizationId: string) {
    try {
      await rejectGapFormalizationAction(form, formalizationId);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async resolveDiscoveryRoutingReview(
    form: HTMLFormElement,
    routingRecordPath: string,
  ) {
    try {
      await resolveDiscoveryRoutingReviewAction(form, routingRecordPath);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async resolveRuntimeHostSelection(
    form: HTMLFormElement,
    promotionReadinessPath: string,
  ) {
    try {
      await resolveRuntimeHostSelectionAction(form, promotionReadinessPath);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async resolveRuntimePromotionSeamDecision(
    form: HTMLFormElement,
    promotionReadinessPath: string,
  ) {
    try {
      await resolveRuntimePromotionSeamDecisionAction(form, promotionReadinessPath);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async acceptRuntimeRegistryAcceptance(
    form: HTMLFormElement,
    promotionRecordPath: string,
  ) {
    try {
      await acceptRuntimeRegistryAcceptanceAction(form, promotionRecordPath);
      await this.handleRoute();
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private renderContent() {
    if (this.loading) {
      return html`<section class="panel message"><h2>Loading</h2><p>Reading live Directive Kernel state.</p></section>`;
    }
    if (this.error) {
      return html`<section class="panel warning"><h2>Frontend error</h2><pre>${this.error}</pre></section>`;
    }
    if (!this.page) return nothing;

    if (this.page.kind === "home") {
      return renderHomePage(
        this.page.data as FrontendSnapshot,
        this.page.inbox as FrontendOperatorDecisionInboxReport,
        this.page.telemetry as FrontendTelemetrySnapshot,
        this.page.runtimeStatus as FrontendRuntimeStatus,
        {
          renderRuntimeCaseStrip: this.renderRuntimeCaseStrip.bind(this),
          currentHeadLink: this.currentHeadLink.bind(this),
        },
      );
    }

    if (this.page.kind === "discovery-lane") {
      return this.renderDiscoveryLanePage(this.page.data as FrontendSnapshot);
    }

    if (this.page.kind === "architecture-lane") {
      return this.renderArchitectureLaneSummary(
        (this.page.data as FrontendSnapshot).architectureSummary,
      );
    }

    if (this.page.kind === "runtime-lane") {
      return this.renderRuntimeLaneSummary(
        (this.page.data as FrontendSnapshot).runtimeSummary,
      );
    }

    if (this.page.kind === "engine-runs") {
      return renderEngineRunsPage(
        this.page.data as FrontendEngineRunsOverview,
      );
    }

    if (this.page.kind === "operator-inbox") {
      return renderOperatorDecisionInboxPageView(
        this.page.data as FrontendOperatorDecisionInboxReport,
        {
          resolveDiscoveryRoutingReview: this.resolveDiscoveryRoutingReview.bind(this),
          resolveRuntimeHostSelection: this.resolveRuntimeHostSelection.bind(this),
          resolveRuntimePromotionSeamDecision:
            this.resolveRuntimePromotionSeamDecision.bind(this),
          acceptRuntimeRegistryAcceptance:
            this.acceptRuntimeRegistryAcceptance.bind(this),
          missionFeedbackPreviews: this.missionFeedbackPreviews,
          approveGapFormalization: this.approveGapFormalization.bind(this),
          previewMissionFeedback: this.previewMissionFeedback.bind(this),
          rejectGapFormalization: this.rejectGapFormalization.bind(this),
          approveMissionFeedback: this.approveMissionFeedback.bind(this),
          rejectMissionFeedback: this.rejectMissionFeedback.bind(this),
        },
      );
    }

    if (this.page.kind === "telemetry") {
      return renderTelemetryPage({
        snapshot: this.page.snapshot as FrontendSnapshot,
        inbox: this.page.inbox as FrontendOperatorDecisionInboxReport,
        telemetry: this.page.telemetry as FrontendTelemetrySnapshot,
        runtimeStatus: this.page.runtimeStatus as FrontendRuntimeStatus,
      });
    }

    if (this.page.kind === "workflow-map") {
      return renderWorkflowMapPageView(
        this.page.snapshot as FrontendSnapshot,
        this.page.inbox as FrontendOperatorDecisionInboxReport,
      );
    }

    if (this.page.kind === "engine-run-detail") {
      return renderEngineRunDetailPage(
        this.page.detail,
        this.page.queue,
        this.page.handoffs,
        {
          artifactLink: this.artifactLink.bind(this),
          renderConfidenceRecovery: this.renderConfidenceRecovery.bind(this),
          renderEarnedAutonomy: this.renderEarnedAutonomy.bind(this),
          renderFollowUpQuestions: this.renderFollowUpQuestions.bind(this),
          renderGapPressureSummary: this.renderGapPressureSummary.bind(this),
          renderGapRadar: this.renderGapRadar.bind(this),
          renderGoalCopilot: this.renderGoalCopilot.bind(this),
          renderLaneProportions: this.renderLaneProportions.bind(this),
          renderMissionHealth: this.renderMissionHealth.bind(this),
          renderNarrativeContext: this.renderNarrativeContext.bind(this),
          renderPriorPlanContext: this.renderPriorPlanContext.bind(this),
          renderRoutingDigest: this.renderRoutingDigest.bind(this),
          renderSourceMemory: this.renderSourceMemory.bind(this),
          renderSourceSimilarity: this.renderSourceSimilarity.bind(this),
          rerouteEngineRun: this.rerouteEngineRun.bind(this),
          updateEnginePlanProgress: this.updateEnginePlanProgress.bind(this),
        },
      );
    }

    if (this.page.kind === "queue") {
      return renderQueuePage(
        this.page.queue,
        this.page.runs,
        this.page.handoffs,
        {
          renderQueueCard: this.renderQueueCard.bind(this),
          renderQueueStat: this.renderQueueStat.bind(this),
          renderRuntimeCaseStrip: this.renderRuntimeCaseStrip.bind(this),
          submitDiscoveryFrontDoor: this.submitDiscoveryFrontDoor.bind(this),
          submitting: this.submitting,
        },
      );
    }

    if (this.page.kind === "handoffs") {
      return renderHandoffsPage(this.page.data as FrontendSnapshot, {
        artifactLink: this.artifactLink.bind(this),
        startArchitecture: this.startArchitecture.bind(this),
      });
    }

    if (this.page.kind === "discovery-routing-detail") {
      return renderDiscoveryRoutingDetailPage(
        this.page.data as FrontendDiscoveryRoutingDetail,
        {
          approveDiscoveryRoute: this.approveDiscoveryRoute.bind(this),
          artifactLink: this.artifactLink.bind(this),
          renderConfidenceRecovery: this.renderConfidenceRecovery.bind(this),
          renderEarnedAutonomy: this.renderEarnedAutonomy.bind(this),
          renderFollowUpQuestions: this.renderFollowUpQuestions.bind(this),
          renderGapPressureSummary: this.renderGapPressureSummary.bind(this),
          renderGapRadar: this.renderGapRadar.bind(this),
          renderGoalCopilot: this.renderGoalCopilot.bind(this),
          renderLaneProportions: this.renderLaneProportions.bind(this),
          renderMissionHealth: this.renderMissionHealth.bind(this),
          renderNarrativeContext: this.renderNarrativeContext.bind(this),
          renderRoutingDigest: this.renderRoutingDigest.bind(this),
          renderRoutingExplanationBreakdown: this.renderRoutingExplanationBreakdown.bind(this),
          renderSourceMemory: this.renderSourceMemory.bind(this),
          renderSourceSimilarity: this.renderSourceSimilarity.bind(this),
        },
      );
    }

    const residualDetail = renderResidualDetailPage(this.page, {
      adoptArchitectureResult: this.adoptArchitectureResult.bind(this),
      approveRuntimeFollowUp: this.approveRuntimeFollowUp.bind(this),
      approveRuntimePromotionReadiness: this.approveRuntimePromotionReadiness.bind(this),
      approveRuntimeProofRuntimeCapabilityBoundary: this.approveRuntimeProofRuntimeCapabilityBoundary.bind(this),
      approveRuntimeRecordProof: this.approveRuntimeRecordProof.bind(this),
      artifactLink: this.artifactLink.bind(this),
      closeArchitectureStart: this.closeArchitectureStart.bind(this),
      completeArchitectureImplementation: this.completeArchitectureImplementation.bind(this),
      confirmArchitectureRetention: this.confirmArchitectureRetention.bind(this),
      continueArchitectureResult: this.continueArchitectureResult.bind(this),
      createArchitectureImplementationTarget: this.createArchitectureImplementationTarget.bind(this),
      createArchitectureIntegrationRecord: this.createArchitectureIntegrationRecord.bind(this),
      evaluateArchitectureConsumption: this.evaluateArchitectureConsumption.bind(this),
      recordArchitectureConsumption: this.recordArchitectureConsumption.bind(this),
      renderQueueTag: this.renderQueueTag.bind(this),
      reopenArchitectureFromEvaluation: this.reopenArchitectureFromEvaluation.bind(this),
      startArchitecture: this.startArchitecture.bind(this),
    });
    if (residualDetail) {
      return residualDetail;
    }

    return html`<section class="panel warning"><h2>Not found</h2><p>${(this.page as { path?: string }).path ?? window.location.pathname}</p></section>`;
  }
  render() {
    const current = window.location.pathname;
    const chrome = this.getPageChrome(current);
    return html`
      <main class="app-shell">
        ${this.renderSidebar(current)}
        <section class="shell-main">
          <section class="page-chrome">
            <div>
              ${chrome.eyebrow ? html`<div class="eyebrow">${chrome.eyebrow}</div>` : nothing}
              <h1>${chrome.title}</h1>
              ${chrome.description ? html`<p class="muted">${chrome.description}</p>` : nothing}
            </div>
            ${chrome.actions.length
              ? html`
                  <div class="page-actions">
                    ${chrome.actions.map((action) => this.renderActionLink(action.href, action.label, action.tone))}
                  </div>
                `
              : nothing}
          </section>
          <section class="content-stack">
            ${this.renderContent()}
          </section>
        </section>
      </main>
    `;
  }
}

customElements.define("directive-ui-app", DirectiveUiApp);

