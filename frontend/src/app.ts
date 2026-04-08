import { LitElement, html, nothing } from "lit";

import { appStyles } from "./app-styles";
import type {
  FrontendArchitectureAdoptionDetail,
  FrontendArchitectureConsumptionRecordDetail,
  FrontendArchitectureImplementationResultDetail,
  FrontendArchitectureImplementationTargetDetail,
  FrontendArchitectureIntegrationRecordDetail,
  FrontendArchitecturePostConsumptionEvaluationDetail,
  FrontendArchitectureResultDetail,
  FrontendArchitectureRetentionDetail,
  FrontendArchitectureStartDetail,
  FrontendArchitectureSummaryCase,
  FrontendDiscoveryRoutingDetail,
  FrontendGapPressureDetail,
  FrontendEngineRunDetail,
  FrontendEngineRunRecord,
  FrontendEngineRunsOverview,
  FrontendHandoffStub,
  FrontendLaneAnchor,
  FrontendLaneCaseStripInput,
  FrontendLegacyRuntimeFollowUpDetail,
  FrontendLegacyRuntimeHandoffDetail,
  FrontendOperatorDecisionInboxEntry,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendQueueOverview,
  FrontendRuntimeFollowUpDetail,
  FrontendRuntimePromotionReadinessDetail,
  FrontendRuntimeProofDetail,
  FrontendRuntimeRecordDetail,
  FrontendRuntimeRuntimeCapabilityBoundaryDetail,
  FrontendRuntimeSummaryCase,
  FrontendSnapshot,
} from "./app-types";
import { artifactPathToViewPath, getJson, navTo } from "./app-utils";
import {
  renderArchitectureCaseStrip,
  renderArchitectureLaneSummary,
  renderDiscoveryLanePage,
  renderLaneAnchorList,
  renderLaneCaseStrip,
  renderLaneOverviewCard,
  renderQueueCard,
  renderQueueStat,
  renderQueueTag,
  renderRuntimeCaseStrip,
  renderRuntimeLaneSummary,
} from "./components/lane-sections";

class DirectiveFrontendApp extends LitElement {
  static properties = {
    route: { state: true },
    page: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = appStyles;

  declare route: string;
  declare page: any;
  declare loading: boolean;
  declare error: string;

  constructor() {
    super();
    this.route = "";
    this.page = null;
    this.loading = true;
    this.error = "";
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
      if (url.pathname === "/") {
        const [snapshot, inbox] = await Promise.all([
          getJson<FrontendSnapshot>("/api/snapshot"),
          getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
        ]);
        this.page = { kind: "home", data: snapshot, inbox };
      } else if (url.pathname === "/discovery") {
        this.page = { kind: "discovery-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
      } else if (url.pathname === "/architecture") {
        this.page = { kind: "architecture-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
      } else if (url.pathname === "/runtime") {
        this.page = { kind: "runtime-lane", data: await getJson<FrontendSnapshot>("/api/snapshot") };
      } else if (url.pathname === "/engine-runs") {
        this.page = { kind: "engine-runs", data: await getJson<FrontendEngineRunsOverview>("/api/engine-runs") };
      } else if (url.pathname === "/operator-inbox") {
        this.page = {
          kind: "operator-inbox",
          data: await getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
        };
      } else if (url.pathname === "/workflow-map") {
        const [snapshot, inbox] = await Promise.all([
          getJson<FrontendSnapshot>("/api/snapshot"),
          getJson<FrontendOperatorDecisionInboxReport>("/api/operator-decision-inbox"),
        ]);
        this.page = { kind: "workflow-map", snapshot, inbox };
      } else if (url.pathname.startsWith("/engine-runs/")) {
        const runId = decodeURIComponent(url.pathname.replace(/^\/engine-runs\//, ""));
        const [detail, queue, handoffs] = await Promise.all([
          getJson<FrontendEngineRunDetail>(`/api/engine-runs/${encodeURIComponent(runId)}`),
          getJson<FrontendQueueOverview>("/api/queue"),
          getJson<FrontendHandoffStub[]>("/api/handoffs"),
        ]);
        this.page = { kind: "engine-run-detail", detail, queue, handoffs };
      } else if (url.pathname === "/queue") {
        const [queue, runs, handoffs] = await Promise.all([
          getJson<FrontendQueueOverview>("/api/queue"),
          getJson<FrontendEngineRunsOverview>("/api/engine-runs"),
          getJson<FrontendHandoffStub[]>("/api/handoffs"),
        ]);
        this.page = { kind: "queue", queue, runs, handoffs };
      } else if (url.pathname === "/discovery-routing-records/view") {
        this.page = {
          kind: "discovery-routing-detail",
          data: await getJson<FrontendDiscoveryRoutingDetail>(
            `/api/discovery-routing-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
          ),
        };
      } else if (url.pathname === "/handoffs") {
        this.page = { kind: "handoffs", data: await getJson<FrontendSnapshot>("/api/snapshot") };
      } else if (url.pathname === "/handoffs/view") {
        this.page = { kind: "handoff-detail", data: await getJson(`/api/handoffs/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/runtime-records/view") {
        this.page = { kind: "runtime-record-detail", data: await getJson<FrontendRuntimeRecordDetail>(`/api/runtime-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/runtime-proofs/view") {
        this.page = { kind: "runtime-proof-detail", data: await getJson<FrontendRuntimeProofDetail>(`/api/runtime-proofs/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/runtime-runtime-capability-boundaries/view") {
        this.page = {
          kind: "runtime-runtime-capability-boundary-detail",
          data: await getJson<FrontendRuntimeRuntimeCapabilityBoundaryDetail>(
            `/api/runtime-runtime-capability-boundaries/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
          ),
        };
      } else if (url.pathname === "/runtime-promotion-readiness/view") {
        this.page = {
          kind: "runtime-promotion-readiness-detail",
          data: await getJson<FrontendRuntimePromotionReadinessDetail>(
            `/api/runtime-promotion-readiness/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`,
          ),
        };
      } else if (url.pathname === "/architecture-starts/view") {
        this.page = { kind: "architecture-start", data: await getJson<FrontendArchitectureStartDetail>(`/api/architecture-starts/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-results/view") {
        this.page = { kind: "architecture-result", data: await getJson<FrontendArchitectureResultDetail>(`/api/architecture-results/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-adoptions/view") {
        this.page = { kind: "architecture-adoption", data: await getJson<FrontendArchitectureAdoptionDetail>(`/api/architecture-adoptions/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-implementation-targets/view") {
        this.page = { kind: "architecture-implementation-target", data: await getJson<FrontendArchitectureImplementationTargetDetail>(`/api/architecture-implementation-targets/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-implementation-results/view") {
        this.page = { kind: "architecture-implementation-result", data: await getJson<FrontendArchitectureImplementationResultDetail>(`/api/architecture-implementation-results/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-retained/view") {
        this.page = { kind: "architecture-retained", data: await getJson<FrontendArchitectureRetentionDetail>(`/api/architecture-retained/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-integration-records/view") {
        this.page = { kind: "architecture-integration-record", data: await getJson<FrontendArchitectureIntegrationRecordDetail>(`/api/architecture-integration-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-consumption-records/view") {
        this.page = { kind: "architecture-consumption-record", data: await getJson<FrontendArchitectureConsumptionRecordDetail>(`/api/architecture-consumption-records/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/architecture-post-consumption-evaluations/view") {
        this.page = { kind: "architecture-post-consumption-evaluation", data: await getJson<FrontendArchitecturePostConsumptionEvaluationDetail>(`/api/architecture-post-consumption-evaluations/detail?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else if (url.pathname === "/artifacts") {
        this.page = { kind: "artifact", data: await getJson(`/api/artifacts?path=${encodeURIComponent(url.searchParams.get("path") || "")}`) };
      } else {
        this.page = { kind: "not-found", path: url.pathname };
      }
    } catch (error) {
      this.error = String((error as Error).message || error);
    } finally {
      this.loading = false;
    }
  };

  private link(path: string, label: string, active = false) {
    return html`<a class=${active ? "nav active" : "nav"} href=${path} @click=${(event: Event) => { event.preventDefault(); navTo(path); }}>${label}</a>`;
  }

  private artifactLink(pathValue: string | null | undefined) {
    if (!pathValue) return html`<span class="muted">n/a</span>`;
    const href = `/artifacts?path=${encodeURIComponent(pathValue)}`;
    return html`<a href=${href} @click=${(event: Event) => { event.preventDefault(); navTo(href); }}>${pathValue}</a>`;
  }

  private renderGapPressureSummary(gapPressure: FrontendGapPressureDetail | null | undefined) {
    if (!gapPressure) {
      return html`<span class="muted">n/a</span>`;
    }

    if (!gapPressure.matchedGapId) {
      return html`No matched open gap. Open gaps considered: ${gapPressure.openGapCount}; gap alignment score: ${gapPressure.gapAlignmentScore ?? "n/a"}.`;
    }

    return html`${gapPressure.matchedGapId} (rank ${gapPressure.matchedGapRank ?? "n/a"}, priority ${gapPressure.matchedGapPriority ?? "n/a"}): ${gapPressure.matchedGapDescription ?? "n/a"}`;
  }

  private renderRoutingExplanationBreakdown(detail: FrontendDiscoveryRoutingDetail | null | undefined) {
    const breakdown = detail?.explanationBreakdown;
    if (!breakdown) {
      return nothing;
    }
    return html`
      <section class="panel">
        <h3>Routing explanation breakdown</h3>
        <ul>
          ${breakdown.keywordSignals.map((entry) => html`<li>Keyword: ${entry}</li>`)}
          ${breakdown.metadataSignals.map((entry) => html`<li>Metadata: ${entry}</li>`)}
          ${breakdown.gapAlignmentSignals.map((entry) => html`<li>Gap: ${entry}</li>`)}
          ${breakdown.ambiguitySignals.map((entry) => html`<li>Ambiguity: ${entry}</li>`)}
        </ul>
      </section>
    `;
  }

  private currentHeadLink(entry: FrontendQueueEntry) {
    const head = entry.current_head;
    if (!head) {
      return html`<span class="muted">n/a</span>`;
    }

    return html`<a href=${head.view_path} @click=${(event: Event) => { event.preventDefault(); navTo(head.view_path); }}>${head.artifact_path}</a>`;
  }

  private currentHeadSummary(entry: FrontendQueueEntry) {
    const head = entry.current_head;
    if (!head) {
      return html`<span class="muted">not resolved yet</span>`;
    }

    return html`
      <div>${this.currentHeadLink(entry)}</div>
      <div class="muted">${head.artifact_stage} | ${head.artifact_lane}</div>
    `;
  }

  private renderQueueTag(value: string, tone: "default" | "runtime" | "architecture" | "warning" = "default") {
    return renderQueueTag(value, tone);
  }

  private renderQueueStat(label: string, value: number, description: string) {
    return renderQueueStat(label, value, description);
  }

  private renderLaneCaseStrip(input: FrontendLaneCaseStripInput) {
    return renderLaneCaseStrip(input, this.renderQueueTag.bind(this));
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

  private renderLaneAnchorList(title: string, description: string, anchors: FrontendLaneAnchor[]) {
    return renderLaneAnchorList(title, description, anchors);
  }

  private renderArchitectureCaseStrip(entry: FrontendArchitectureSummaryCase) {
    return renderArchitectureCaseStrip(entry, {
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

  private renderLaneOverviewCard(input: {
    title: string;
    tone: "discovery" | "architecture" | "runtime";
    description: string;
    primaryLabel: string;
    primaryValue: string | number;
    secondaryLabel: string;
    secondaryValue: string | number;
    tertiary?: string;
    href: string;
  }) {
    return renderLaneOverviewCard(input);
  }

  private async approveDiscoveryRoute(routingPath: string) {
    try {
      const result: any = await getJson("/api/discovery/open-route", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routingPath,
          approved: true,
        }),
      });
      navTo(`/handoffs/view?path=${encodeURIComponent(result.stubRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeFollowUp(followUpPath: string) {
    try {
      const result: any = await getJson("/api/runtime/open-follow-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          followUpPath,
          approved: true,
        }),
      });
      navTo(`/runtime-records/view?path=${encodeURIComponent(result.runtimeRecordRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeRecordProof(runtimeRecordPath: string) {
    try {
      const result: any = await getJson("/api/runtime/open-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runtimeRecordPath,
          approved: true,
        }),
      });
      navTo(`/runtime-proofs/view?path=${encodeURIComponent(result.runtimeProofRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimeProofRuntimeCapabilityBoundary(runtimeProofPath: string) {
    try {
      const result: any = await getJson("/api/runtime/open-runtime-capability-boundary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runtimeProofPath,
          approved: true,
        }),
      });
      navTo(`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(result.runtimeCapabilityBoundaryRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async approveRuntimePromotionReadiness(capabilityBoundaryPath: string) {
    try {
      const result: any = await getJson("/api/runtime/open-promotion-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          capabilityBoundaryPath,
          approved: true,
        }),
      });
      navTo(`/artifacts?path=${encodeURIComponent(result.promotionReadinessRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async startArchitecture(handoffPath: string) {
    try {
      const result: any = await getJson("/api/architecture/handoff-start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoffPath }),
      });
      navTo(`/architecture-starts/view?path=${encodeURIComponent(result.startRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async closeArchitectureStart(form: HTMLFormElement, startPath: string) {
    try {
      const data = new FormData(form);
      const resultSummary = String(data.get("result_summary") || "").trim();
      const primaryEvidencePath = String(data.get("primary_evidence_path") || "").trim();
      const transformedArtifactsProduced = String(
        data.get("transformed_artifacts_produced") || "",
      )
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (!resultSummary) {
        throw new Error("result_summary_required");
      }

      const result: any = await getJson("/api/architecture/bounded-closeout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startPath,
          resultSummary,
          primaryEvidencePath: primaryEvidencePath || undefined,
          transformedArtifactsProduced,
          nextDecision: String(data.get("next_decision") || "needs-more-evidence").trim(),
          valueShape: String(data.get("value_shape") || "working_document").trim(),
          adaptationQuality: String(data.get("adaptation_quality") || "adequate").trim(),
          improvementQuality: String(data.get("improvement_quality") || "skipped").trim(),
          proofExecuted: data.get("proof_executed") === "on",
          targetArtifactClarified: data.get("target_artifact_clarified") === "on",
          deltaEvidencePresent: data.get("delta_evidence_present") === "on",
          noUnresolvedBaggage: data.get("no_unresolved_baggage") === "on",
          productArtifactMaterialized: data.get("product_artifact_materialized") === "on",
        }),
      });
      navTo(`/architecture-results/view?path=${encodeURIComponent(result.resultRelativePath)}`);
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async continueArchitectureResult(resultPath: string) {
    try {
      const result: any = await getJson("/api/architecture/bounded-continuation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultPath }),
      });
      navTo(
        `/architecture-starts/view?path=${encodeURIComponent(result.continuationStartRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async adoptArchitectureResult(resultPath: string) {
    try {
      const result: any = await getJson("/api/architecture/adopt-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resultPath }),
      });
      navTo(
        `/architecture-adoptions/view?path=${encodeURIComponent(result.adoptedRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async createArchitectureImplementationTarget(adoptionPath: string) {
    try {
      const result: any = await getJson("/api/architecture/create-implementation-target", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adoptionPath }),
      });
      navTo(
        `/architecture-implementation-targets/view?path=${encodeURIComponent(result.targetRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async completeArchitectureImplementation(form: HTMLFormElement, targetPath: string) {
    try {
      const data = new FormData(form);
      const resultSummary = String(data.get("result_summary") || "").trim();
      if (!resultSummary) {
        throw new Error("result_summary_required");
      }

      const result: any = await getJson("/api/architecture/create-implementation-result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetPath,
          resultSummary,
          outcome: String(data.get("outcome") || "success").trim(),
          deviations: String(data.get("deviations") || "").trim(),
          evidence: String(data.get("evidence") || "").trim(),
          validationResult: String(data.get("validation_result") || "").trim(),
          rollbackNote: String(data.get("rollback_note") || "").trim(),
        }),
      });
      navTo(
        `/architecture-implementation-results/view?path=${encodeURIComponent(result.resultRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async confirmArchitectureRetention(form: HTMLFormElement, resultPath: string) {
    try {
      const data = new FormData(form);
      const result: any = await getJson("/api/architecture/confirm-retention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resultPath,
          usefulnessAssessment: String(data.get("usefulness_assessment") || "").trim(),
          stabilityLevel: String(data.get("stability_level") || "bounded-stable").trim(),
          reuseScope: String(data.get("reuse_scope") || "").trim(),
          confirmationDecision: String(data.get("confirmation_decision") || "").trim(),
          rollbackBoundary: String(data.get("rollback_boundary") || "").trim(),
        }),
      });
      navTo(
        `/architecture-retained/view?path=${encodeURIComponent(result.retainedRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async createArchitectureIntegrationRecord(form: HTMLFormElement, retainedPath: string) {
    try {
      const data = new FormData(form);
      const result: any = await getJson("/api/architecture/create-integration-record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          retainedPath,
          integrationTargetSurface: String(data.get("integration_target_surface") || "").trim(),
          readinessSummary: String(data.get("readiness_summary") || "").trim(),
          expectedEffect: String(data.get("expected_effect") || "").trim(),
          validationBoundary: String(data.get("validation_boundary") || "").trim(),
          integrationDecision: String(data.get("integration_decision") || "").trim(),
          rollbackBoundary: String(data.get("rollback_boundary") || "").trim(),
        }),
      });
      navTo(
        `/architecture-integration-records/view?path=${encodeURIComponent(result.integrationRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async recordArchitectureConsumption(form: HTMLFormElement, integrationPath: string) {
    try {
      const data = new FormData(form);
      const result: any = await getJson("/api/architecture/record-consumption", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          integrationPath,
          appliedSurface: String(data.get("applied_surface") || "").trim(),
          applicationSummary: String(data.get("application_summary") || "").trim(),
          observedEffect: String(data.get("observed_effect") || "").trim(),
          validationResult: String(data.get("validation_result") || "").trim(),
          outcome: String(data.get("outcome") || "success").trim(),
          rollbackNote: String(data.get("rollback_note") || "").trim(),
        }),
      });
      navTo(
        `/architecture-consumption-records/view?path=${encodeURIComponent(result.consumptionRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async evaluateArchitectureConsumption(form: HTMLFormElement, consumptionPath: string) {
    try {
      const data = new FormData(form);
      const result: any = await getJson("/api/architecture/evaluate-consumption", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consumptionPath,
          decision: String(data.get("decision") || "keep").trim(),
          rationale: String(data.get("rationale") || "").trim(),
          observedStability: String(data.get("observed_stability") || "").trim(),
          retainedUsefulnessAssessment: String(data.get("retained_usefulness_assessment") || "").trim(),
          nextBoundedAction: String(data.get("next_bounded_action") || "").trim(),
          rollbackNote: String(data.get("rollback_note") || "").trim(),
        }),
      });
      navTo(
        `/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(result.evaluationRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private async reopenArchitectureFromEvaluation(evaluationPath: string) {
    try {
      const result: any = await getJson("/api/architecture/reopen-from-evaluation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evaluationPath }),
      });
      navTo(
        `/architecture-starts/view?path=${encodeURIComponent(result.reopenedStartRelativePath)}`,
      );
    } catch (error) {
      this.error = String((error as Error).message || error);
    }
  }

  private renderOperatorDecisionEntry(entry: FrontendOperatorDecisionInboxEntry) {
    return html`
      <article class=${`decision-entry ${entry.decisionSurface}`}>
        <div class="queue-card-header">
          <div>
            <h3 class="queue-card-title">${entry.candidateName ?? entry.candidateId ?? entry.entryId}</h3>
            <div class="queue-card-subtitle">${entry.entryId}</div>
          </div>
          <div class="queue-tag-row">
            ${this.renderQueueTag(entry.lane, entry.lane === "runtime" ? "runtime" : entry.lane === "architecture" ? "architecture" : "default")}
            ${this.renderQueueTag(entry.decisionSurface, "warning")}
          </div>
        </div>
        <div class="queue-kv-grid">
          <div class="queue-kv"><h4>Current stage</h4><p>${entry.currentStage ?? "n/a"}</p></div>
          <div class="queue-kv"><h4>Blocked because</h4><p>${entry.blockReason}</p></div>
          <div class="queue-kv"><h4>Next action</h4><p>${entry.eligibleNextAction}</p></div>
          <div class="queue-kv"><h4>Source artifact</h4><p>${this.artifactLink(entry.artifactPath)}</p></div>
        </div>
        <section class="queue-highlight">
          <h4>Required proof</h4>
          <ul>${entry.requiredProof.map((proof) => html`<li>${proof}</li>`)}</ul>
        </section>
        <section class="queue-highlight">
          <h4>Resolver command or artifact</h4>
          <pre>${entry.resolverCommandOrArtifact}</pre>
        </section>
        ${entry.relatedArtifacts.length
          ? html`<section class="queue-highlight"><h4>Related artifacts</h4><ul>${entry.relatedArtifacts.map((artifact) => html`<li>${this.artifactLink(artifact)}</li>`)}</ul></section>`
          : nothing}
        <p class="muted">Stop-line: ${entry.stopLine}</p>
      </article>
    `;
  }

  private renderCompactSourceList(entries: FrontendQueueEntry[]) {
    const rows = entries.slice(0, 8);
    if (!rows.length) {
      return html`<div class="queue-empty muted">No sources have entered Discovery yet.</div>`;
    }

    return html`
      <div class="simple-list">
        ${rows.map((entry) => {
          const href = entry.current_head?.view_path
            ?? (entry.routing_record_path
              ? `/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path)}`
              : "/queue");
          const tone = entry.routing_target === "runtime"
            ? "runtime"
            : entry.routing_target === "architecture"
              ? "architecture"
              : "default";
          return html`
            <a class="simple-row" href=${href} @click=${(event: Event) => {
              event.preventDefault();
              navTo(href);
            }}>
              <span class="simple-row-main">
                <strong>${entry.candidate_name}</strong>
                <span class="muted mono">${entry.candidate_id}</span>
              </span>
              <span class="simple-row-meta">
                ${this.renderQueueTag(entry.status_effective, "default")}
                ${entry.routing_target ? this.renderQueueTag(entry.routing_target, tone) : nothing}
              </span>
            </a>
          `;
        })}
      </div>
    `;
  }

  private renderCompactDecisionList(entries: FrontendOperatorDecisionInboxEntry[]) {
    const rows = entries.slice(0, 5);
    if (!rows.length) {
      return html`<div class="queue-empty muted">No active operator decisions.</div>`;
    }

    return html`
      <div class="simple-list">
        ${rows.map((entry) => html`
          <a class="simple-row" href="/operator-inbox" @click=${(event: Event) => {
            event.preventDefault();
            navTo("/operator-inbox");
          }}>
            <span class="simple-row-main">
              <strong>${entry.candidateName ?? entry.candidateId ?? entry.entryId}</strong>
              <span class="muted">${entry.blockReason}</span>
            </span>
            <span class="simple-row-meta">
              ${this.renderQueueTag(entry.lane, entry.lane === "runtime" ? "runtime" : entry.lane === "architecture" ? "architecture" : "default")}
            </span>
          </a>
        `)}
      </div>
    `;
  }

  private renderOperatorDecisionInboxPage(inbox: FrontendOperatorDecisionInboxReport) {
    const runtimeHostSelection = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_host_selection");
    const runtimePromotionSeamDecision = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_promotion_seam_decision");
    const runtimeRegistryAcceptance = inbox.entries.filter((entry) => entry.decisionSurface === "runtime_registry_acceptance");
    const architectureMaterialization = inbox.entries.filter((entry) => entry.decisionSurface === "architecture_materialization_due");
    const discoveryRoutingReview = inbox.entries.filter((entry) => entry.decisionSurface === "discovery_routing_review");
    const renderGroup = (title: string, description: string, entries: FrontendOperatorDecisionInboxEntry[]) => html`
      <section class="panel">
        <h2>${title}</h2>
        <p class="muted">${description}</p>
        ${entries.length
          ? html`<div class="decision-entry-list">${entries.map((entry) => this.renderOperatorDecisionEntry(entry))}</div>`
          : html`<div class="queue-empty muted">No actionable entries for this group.</div>`}
      </section>
    `;

    return html`
      <section class="panel">
        <h2>Operator Decision Inbox</h2>
        <p class="muted">Live read-only triage over current Discovery, Architecture, and Runtime decision gates. This page is API-backed by Engine coordination state; it does not resolve routes, write host-selection artifacts, run host adapters, create Architecture materialization artifacts, or write registry entries.</p>
        <div class="queue-summary-grid">
          ${this.renderQueueStat("Actionable entries", inbox.summary.totalActionableEntries, "Current Discovery, Architecture, and Runtime decisions requiring explicit operator attention.")}
          ${this.renderQueueStat("Runtime host selections", inbox.summary.runtimeHostSelectionCount, "Runtime promotion paths blocked on explicit host selection.")}
          ${this.renderQueueStat("Runtime seam decisions", inbox.summary.runtimePromotionSeamDecisionCount, "Runtime promotion paths ready for explicit manual promotion-seam review.")}
          ${this.renderQueueStat("Architecture materialization", inbox.summary.architectureMaterializationDueCount, "Architecture adoptions or implementation targets awaiting explicit lane-native materialization.")}
          ${this.renderQueueStat("Registry acceptance", inbox.summary.runtimeRegistryAcceptanceCount, "Proof-backed Runtime registry decisions requiring explicit acceptance.")}
          ${this.renderQueueStat("Discovery routing reviews", inbox.summary.discoveryRoutingReviewCount, "Conflicted or non-high-confidence Discovery routes requiring review.")}
        </div>
        <p class="muted">Snapshot: ${inbox.snapshotAt} | version: ${inbox.inboxVersion}</p>
      </section>
      <section class="panel message">
        <h3>Guardrails</h3>
        <p>Read-only: ${String(inbox.guardrails.readOnly)} | mutates workflow state: ${String(inbox.guardrails.mutatesWorkflowState)} | bypasses review: ${String(inbox.guardrails.bypassesReview)} | writes registry entries: ${String(inbox.guardrails.writesRegistryEntries)} | runs host adapters: ${String(inbox.guardrails.runsHostAdapters)}</p>
      </section>
      ${renderGroup("Runtime Host Selection", "Highest-priority review work because it unblocks Runtime promotion paths without claiming execution or registry acceptance.", runtimeHostSelection)}
      ${renderGroup("Runtime Promotion Seam Decision", "Runtime cases with host selection resolved that still require an explicit manual promotion-seam decision.", runtimePromotionSeamDecision)}
      ${renderGroup("Architecture Materialization", "Explicit Architecture due items only: implementation-target creation or implementation-result recording. This group can be empty when Architecture is clean.", architectureMaterialization)}
      ${renderGroup("Runtime Registry Acceptance", "Proof-backed registry acceptance remains explicitly gated and disabled by default.", runtimeRegistryAcceptance)}
      ${renderGroup("Discovery Routing Review", "Discovery remains the front door; conflicted or medium-confidence routes need explicit review before downstream continuation.", discoveryRoutingReview)}
    `;
  }

  private workflowDecisionForCandidate(
    inbox: FrontendOperatorDecisionInboxReport,
    candidateId: string | null | undefined,
  ) {
    if (!candidateId) return null;
    return inbox.entries.find((entry) => entry.candidateId === candidateId) ?? null;
  }

  private renderWorkflowMapRow(input: {
    lane: "research" | "discovery" | "architecture" | "runtime" | "host";
    title: string;
    stage: string | null | undefined;
    nextStep: string | null | undefined;
    artifactPath?: string | null;
    actionHref?: string | null;
    actionLabel?: string;
    decision?: FrontendOperatorDecisionInboxEntry | null;
    meta?: string | null;
  }) {
    const decision = input.decision ?? null;
    const tone = input.lane === "runtime"
      ? "runtime"
      : input.lane === "architecture"
      ? "architecture"
      : "default";
    const status = decision ? "decision needed" : input.stage ?? "live";
    return html`
      <details class=${`workflow-row ${input.lane}`}>
        <summary>
          <span class="workflow-main">
            <strong>${input.title}</strong>
            <span class="muted">${input.stage ?? "stage not resolved"}</span>
          </span>
          <span class="workflow-tags">
            ${this.renderQueueTag(input.lane, tone)}
            ${decision ? this.renderQueueTag("decision", "warning") : this.renderQueueTag("live", "default")}
          </span>
        </summary>
        <div class="workflow-row-detail">
          <div class="workflow-detail-grid">
            <div><h4>Status</h4><p>${status}</p></div>
            <div><h4>Next legal step</h4><p>${input.nextStep ?? "n/a"}</p></div>
            <div><h4>Current artifact</h4><p>${input.artifactPath ? this.artifactLink(input.artifactPath) : html`<span class="muted">n/a</span>`}</p></div>
            <div><h4>Decision gate</h4><p>${decision ? `${decision.decisionSurface}: ${decision.blockReason}` : "none currently surfaced"}</p></div>
          </div>
          ${input.meta ? html`<p class="muted">${input.meta}</p>` : nothing}
          <div class="actions">
            ${input.actionHref
              ? html`<a href=${input.actionHref} @click=${(event: Event) => { event.preventDefault(); navTo(input.actionHref || ""); }}>${input.actionLabel ?? "Open detail"}</a>`
              : nothing}
            ${decision
              ? html`<a href="/operator-inbox" @click=${(event: Event) => { event.preventDefault(); navTo("/operator-inbox"); }}>Open inbox decision</a>`
              : nothing}
          </div>
        </div>
      </details>
    `;
  }

  private renderWorkflowMapGroup(input: {
    title: string;
    description: string;
    rows: unknown[];
    renderRow: (row: any) => unknown;
  }) {
    return html`
      <section class="workflow-group">
        <div class="workflow-group-heading">
          <div>
            <h2>${input.title}</h2>
            <p class="muted">${input.description}</p>
          </div>
          <span class="pill">${input.rows.length}</span>
        </div>
        ${input.rows.length
          ? html`<div class="workflow-row-list">${input.rows.map((row) => input.renderRow(row))}</div>`
          : html`<div class="queue-empty muted">No live rows in this phase.</div>`}
      </section>
    `;
  }

  private renderWorkflowMapPage(snapshot: FrontendSnapshot, inbox: FrontendOperatorDecisionInboxReport) {
    const recentRuns = (snapshot.engineRuns.recentRuns || []).slice(0, 6);
    const discoveryRows = (snapshot.queue.entries || []).slice(0, 12);
    const architectureRows = [
      ...(snapshot.architectureSummary.activeCases || []),
      ...(snapshot.architectureSummary.recentAnchors || []),
    ].slice(0, 8);
    const runtimeRows = [
      ...(snapshot.runtimeSummary.activeCases || []),
      ...(snapshot.runtimeSummary.recentAnchors || []),
    ].slice(0, 8);
    const hostRows = (snapshot.runtimeSummary.activeCases || [])
      .filter((entry) => (entry.current_case_stage || "").includes("registry") || (entry.current_case_stage || "").includes("promotion_record"))
      .slice(0, 8);

    return html`
      <section class="workflow-hero">
        <div>
          <h2>Workflow Map</h2>
          <p>Live source-to-usefulness map. Rows stay compact; open a row for detail.</p>
        </div>
        <div class="workflow-hero-stats">
          <span><strong>${snapshot.queue.totalEntries}</strong><small>Discovery</small></span>
          <span><strong>${snapshot.architectureSummary.activeCases.length}</strong><small>Architecture</small></span>
          <span><strong>${snapshot.runtimeSummary.activeCases.length}</strong><small>Runtime</small></span>
          <span><strong>${inbox.summary.totalActionableEntries}</strong><small>Decisions</small></span>
        </div>
      </section>
      <section class="workflow-map">
        ${this.renderWorkflowMapGroup({
          title: "Research Engine / Engine Runs",
          description: "Recent live analysis and routing records before lane handoff.",
          rows: recentRuns,
          renderRow: (run: { record: FrontendEngineRunRecord }) => this.renderWorkflowMapRow({
            lane: "research",
            title: run.record.candidate.candidateName,
            stage: `engine.route.${run.record.selectedLane.laneId}`,
            nextStep: run.record.integrationProposal?.nextAction,
            artifactPath: null,
            actionHref: `/engine-runs/${encodeURIComponent(run.record.runId)}`,
            actionLabel: "Open run",
            decision: this.workflowDecisionForCandidate(inbox, run.record.candidate.candidateId),
            meta: `Usefulness: ${run.record.candidate.usefulnessLevel}; proof: ${run.record.proofPlan?.proofKind ?? "n/a"}`,
          }),
        })}
        ${this.renderWorkflowMapGroup({
          title: "Discovery",
          description: "Front-door intake, routing, review pressure, and current downstream pointer.",
          rows: discoveryRows,
          renderRow: (entry: FrontendQueueEntry) => this.renderWorkflowMapRow({
            lane: "discovery",
            title: entry.candidate_name,
            stage: entry.current_case_stage ?? entry.status_effective ?? entry.status,
            nextStep: entry.current_case_next_legal_step,
            artifactPath: entry.current_head?.artifact_path ?? entry.result_record_path ?? entry.routing_record_path,
            actionHref: entry.current_head?.view_path ?? (entry.routing_record_path ? `/discovery-routing-records/view?path=${encodeURIComponent(entry.routing_record_path)}` : null),
            actionLabel: "Open current artifact",
            decision: this.workflowDecisionForCandidate(inbox, entry.candidate_id),
            meta: `Route: ${entry.routing_target ?? "n/a"}; integrity: ${entry.integrity_state ?? "n/a"}`,
          }),
        })}
        ${this.renderWorkflowMapGroup({
          title: "Architecture",
          description: "Engine-improvement lane heads and materialization due items when they exist.",
          rows: architectureRows,
          renderRow: (entry: FrontendArchitectureSummaryCase | FrontendLaneAnchor) => this.renderWorkflowMapRow({
            lane: "architecture",
            title: "label" in entry ? entry.label : entry.candidate_name,
            stage: "currentStage" in entry ? entry.currentStage : entry.current_case_stage,
            nextStep: "nextLegalStep" in entry ? entry.nextLegalStep : entry.current_case_next_legal_step,
            artifactPath: "artifactPath" in entry ? entry.artifactPath : entry.current_head?.artifact_path,
            actionHref: "artifactPath" in entry ? artifactPathToViewPath(entry.artifactPath) : entry.current_head?.view_path,
            actionLabel: "Open Architecture detail",
            decision: this.workflowDecisionForCandidate(inbox, "candidateId" in entry ? entry.candidateId : entry.candidate_id),
            meta: "Architecture rows are live lane heads or recent canonical anchors, not static roadmap items.",
          }),
        })}
        ${this.renderWorkflowMapGroup({
          title: "Runtime",
          description: "Reusable capability conversion, proof, promotion, and parked host-selection work.",
          rows: runtimeRows,
          renderRow: (entry: FrontendRuntimeSummaryCase | FrontendLaneAnchor) => this.renderWorkflowMapRow({
            lane: "runtime",
            title: "label" in entry ? entry.label : entry.candidate_name,
            stage: "currentStage" in entry ? entry.currentStage : entry.current_case_stage,
            nextStep: "nextLegalStep" in entry ? entry.nextLegalStep : entry.current_case_next_legal_step,
            artifactPath: "artifactPath" in entry ? entry.artifactPath : entry.current_head?.artifact_path,
            actionHref: "artifactPath" in entry ? artifactPathToViewPath(entry.artifactPath) : entry.current_head?.view_path,
            actionLabel: "Open Runtime detail",
            decision: this.workflowDecisionForCandidate(inbox, "candidateId" in entry ? entry.candidateId : entry.candidate_id),
            meta: "runtime_summary" in entry ? `Proposed host: ${entry.runtime_summary?.proposed_host ?? "n/a"}` : "Runtime canonical anchor.",
          }),
        })}
        ${this.renderWorkflowMapGroup({
          title: "Registry / Host",
          description: "Host-backed or registry-adjacent Runtime heads; still read-only here.",
          rows: hostRows,
          renderRow: (entry: FrontendRuntimeSummaryCase) => this.renderWorkflowMapRow({
            lane: "host",
            title: entry.candidate_name,
            stage: entry.current_case_stage,
            nextStep: entry.current_case_next_legal_step,
            artifactPath: entry.current_head?.artifact_path,
            actionHref: entry.current_head?.view_path,
            actionLabel: "Open host/runtime artifact",
            decision: this.workflowDecisionForCandidate(inbox, entry.candidate_id),
            meta: `Proposed host: ${entry.runtime_summary?.proposed_host ?? "n/a"}`,
          }),
        })}
      </section>
    `;
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
      const snapshot = this.page.data;
      const inbox = this.page.inbox as FrontendOperatorDecisionInboxReport;
      const runtimePrimary = snapshot.runtimeSummary.activeCases[0] ?? null;
      const architecturePrimary = snapshot.architectureSummary.activeCases[0] ?? null;
      const queueReviewPressureCount = snapshot.queue.entries.filter((entry) => Boolean(entry.review_pressure)).length;
      const queueConflictedCount = snapshot.queue.entries.filter((entry) => entry.review_pressure?.route_conflict).length;
      return html`
        <section class="panel shell-hero">
          <div>
            <h2>System overview</h2>
            <p class="muted">Use this frontend to see what sources entered the system, where they currently sit, and what still needs review. Deep artifact detail stays behind click-through.</p>
          </div>
          <div class="actions">
            <a href="/workflow-map" @click=${(event: Event) => { event.preventDefault(); navTo("/workflow-map"); }}>Open workflow map</a>
          </div>
        </section>
        ${snapshot.handoffWarnings?.length ? html`<section class="panel warning"><h3>Handoff artifact warnings</h3><ul>${snapshot.handoffWarnings.map((warning: string) => html`<li>${warning}</li>`)}</ul></section>` : nothing}
        <section class="simple-stat-grid">
          ${this.renderQueueStat("Sources", snapshot.queue.totalEntries, "Discovery entries currently tracked.")}
          ${this.renderQueueStat("Decisions", inbox.summary.totalActionableEntries, "Current operator reviews across lanes.")}
          ${this.renderQueueStat("Architecture", snapshot.architectureSummary.activeCases.length, "Active Architecture cases.")}
          ${this.renderQueueStat("Runtime", snapshot.runtimeSummary.activeCases.length, "Active Runtime cases.")}
        </section>
        <section class="grid">
          <section class="panel">
            <h3>Recent sources</h3>
            <p class="muted">Latest source entries and their current route/state.</p>
            ${this.renderCompactSourceList(snapshot.queue.entries)}
            <div class="actions" style="margin-top:12px;">
              <a href="/queue" @click=${(event: Event) => { event.preventDefault(); navTo("/queue"); }}>Open all sources</a>
            </div>
          </section>
          <section class="panel">
            <h3>Next decisions</h3>
            <p class="muted">Only active operator work. Deep decision detail stays in the inbox.</p>
            ${this.renderCompactDecisionList(inbox.entries)}
            <div class="actions" style="margin-top:12px;">
              <a href="/operator-inbox" @click=${(event: Event) => { event.preventDefault(); navTo("/operator-inbox"); }}>Open inbox</a>
            </div>
          </section>
        </section>
        ${(runtimePrimary || architecturePrimary)
          ? html`
              <section class="panel">
                <h2>Current lane heads</h2>
                <p class="muted">The main live heads for Architecture and Runtime.</p>
                <div class="lane-head-strip-grid" style="margin-top:14px;">
                  ${runtimePrimary ? this.renderRuntimeCaseStrip(runtimePrimary) : nothing}
                  ${architecturePrimary ? this.renderArchitectureCaseStrip(architecturePrimary) : nothing}
                </div>
              </section>
            `
          : nothing}
        <section class="panel message">
          <h3>Discovery status</h3>
          <p class="muted">Review pressure: ${queueReviewPressureCount}. Conflicted routes: ${queueConflictedCount}. Discovery remains explicit and does not auto-open downstream work.</p>
          <div class="actions">
            <a href="/discovery" @click=${(event: Event) => { event.preventDefault(); navTo("/discovery"); }}>Open Discovery</a>
            <a href="/architecture" @click=${(event: Event) => { event.preventDefault(); navTo("/architecture"); }}>Open Architecture</a>
            <a href="/runtime" @click=${(event: Event) => { event.preventDefault(); navTo("/runtime"); }}>Open Runtime</a>
          </div>
        </section>
      `;
    }

    if (this.page.kind === "discovery-lane") {
      return this.renderDiscoveryLanePage(this.page.data as FrontendSnapshot);
    }

    if (this.page.kind === "architecture-lane") {
      return this.renderArchitectureLaneSummary((this.page.data as FrontendSnapshot).architectureSummary);
    }

    if (this.page.kind === "runtime-lane") {
      return this.renderRuntimeLaneSummary((this.page.data as FrontendSnapshot).runtimeSummary);
    }

    if (this.page.kind === "engine-runs") {
      const overview = this.page.data;
      return html`<section class="panel"><h2>Engine runs</h2><table><thead><tr><th>run id</th><th>candidate</th><th>lane</th><th>usefulness</th><th>review pressure</th><th>decision</th><th>created</th></tr></thead><tbody>
        ${overview.recentRuns.length ? overview.recentRuns.map((run: any) => {
          const reviewGuidance = run.record.routingAssessment?.reviewGuidance;
          const routeConflict = run.record.routingAssessment?.routeConflict;
          const confidence = run.record.routingAssessment?.confidence ?? run.record.candidate.confidence ?? "n/a";
          const reviewSummary = reviewGuidance
            ? `${reviewGuidance.summary} (${confidence}; conflict: ${routeConflict == null ? "n/a" : routeConflict ? "yes" : "no"})`
            : `No extra review guidance (${confidence}; conflict: ${routeConflict == null ? "n/a" : routeConflict ? "yes" : "no"})`;
          return html`<tr><td><a href=${`/engine-runs/${encodeURIComponent(run.record.runId)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/engine-runs/${encodeURIComponent(run.record.runId)}`); }}>${run.record.runId}</a></td><td>${run.record.candidate.candidateName}</td><td><span class="pill">${run.record.selectedLane.laneId}</span></td><td>${run.record.candidate.usefulnessLevel}</td><td>${reviewSummary}</td><td>${run.record.decision.decisionState}</td><td>${run.record.receivedAt}</td></tr>`;
        }) : html`<tr><td colspan="7" class="muted">No Engine runs found.</td></tr>`}
      </tbody></table></section>`;
    }

    if (this.page.kind === "operator-inbox") {
      return this.renderOperatorDecisionInboxPage(this.page.data as FrontendOperatorDecisionInboxReport);
    }

    if (this.page.kind === "workflow-map") {
      return this.renderWorkflowMapPage(
        this.page.snapshot as FrontendSnapshot,
        this.page.inbox as FrontendOperatorDecisionInboxReport,
      );
    }

    if (this.page.kind === "engine-run-detail") {
      const detail = this.page.detail;
      if (!detail.ok || !detail.record) return html`<section class="panel warning"><h2>Run not found</h2><pre>${detail.error ?? "run_not_found"}</pre></section>`;
      const record = detail.record;
      const queueEntry = (this.page.queue.entries || []).find((entry: any) => entry.candidate_id === record.candidate.candidateId) ?? null;
      const relatedHandoffs = (this.page.handoffs || []).filter((stub: any) => stub.candidateId === record.candidate.candidateId);
      const noDownstream = queueEntry && !queueEntry.result_record_path ? "No downstream handoff was materialized from this path yet. The Engine run exists, but this frontend submission flow still stops before queue advancement into a lane-native handoff artifact." : "";
      return html`
        <section class="panel"><h2>Engine run detail</h2><table><tbody>
          <tr><th>run id</th><td>${record.runId}</td></tr>
          <tr><th>candidate</th><td>${record.candidate.candidateName}</td></tr>
          <tr><th>lane</th><td><span class="pill">${record.selectedLane.laneId}</span></td></tr>
          <tr><th>usefulness level</th><td>${record.candidate.usefulnessLevel}</td></tr>
          <tr><th>usefulness rationale</th><td>${record.analysis.usefulnessRationale}</td></tr>
          <tr><th>routing confidence</th><td>${record.routingAssessment?.confidence ?? record.candidate.confidence ?? "n/a"}</td></tr>
          <tr><th>matched capability gap</th><td>${record.routingAssessment?.matchedGapId ?? "n/a"}</td></tr>
          <tr><th>gap pressure</th><td>${this.renderGapPressureSummary(detail.gapPressure)}</td></tr>
          <tr><th>gap alignment score</th><td>${detail.gapPressure?.gapAlignmentScore ?? "n/a"}</td></tr>
          <tr><th>open gaps considered</th><td>${detail.gapPressure?.openGapCount ?? "n/a"}</td></tr>
          <tr><th>gap mission objective</th><td>${detail.gapPressure?.relatedMissionObjective ?? "n/a"}</td></tr>
          <tr><th>route conflict</th><td>${record.routingAssessment?.routeConflict === undefined ? "n/a" : record.routingAssessment?.routeConflict ? "yes" : "no"}</td></tr>
          <tr><th>needs human review</th><td>${record.routingAssessment?.needsHumanReview === undefined ? (record.candidate.requiresHumanReview === undefined ? "n/a" : record.candidate.requiresHumanReview ? "yes" : "no") : record.routingAssessment?.needsHumanReview ? "yes" : "no"}</td></tr>
          <tr><th>ambiguity summary</th><td>${record.routingAssessment?.ambiguitySummary
            ? `${record.routingAssessment.ambiguitySummary.topLaneId} over ${record.routingAssessment.ambiguitySummary.runnerUpLaneId ?? "none"} by ${record.routingAssessment.ambiguitySummary.scoreDelta}; conflicting signals: ${record.routingAssessment.ambiguitySummary.conflictingSignalFamilies.join(", ") || "none"}`
            : "n/a"}</td></tr>
          <tr><th>review guidance</th><td>${record.routingAssessment?.reviewGuidance?.summary ?? "n/a"}</td></tr>
          <tr><th>decision state</th><td>${record.decision.decisionState}</td></tr>
          <tr><th>proof kind</th><td>${record.proofPlan.proofKind}</td></tr>
          <tr><th>integration mode</th><td>${record.integrationProposal.integrationMode}</td></tr>
          <tr><th>report summary</th><td>${record.reportPlan.summary}</td></tr>
          <tr><th>record path</th><td>${this.artifactLink(detail.recordPath)}</td></tr>
          <tr><th>report path</th><td>${this.artifactLink(detail.reportPath)}</td></tr>
        </tbody></table></section>
        ${record.routingAssessment?.reviewGuidance ? html`
          <section class="panel warning">
            <h3>Review handling guidance</h3>
            <p>${record.routingAssessment.reviewGuidance.operatorAction}</p>
            <ul>
              ${record.routingAssessment.reviewGuidance.requiredChecks.map((entry) => html`<li>${entry}</li>`)}
            </ul>
            <p class="muted">Stop-line: ${record.routingAssessment.reviewGuidance.stopLine}</p>
          </section>
        ` : nothing}
        <section class=${noDownstream ? "panel warning" : "panel message"}>
          <h3>Related queue and handoff state</h3>
          <div class="muted">queue status: ${queueEntry?.status ?? "n/a"} | routing target: ${queueEntry?.routing_target ?? "n/a"}</div>
          <div class="muted">first downstream stub: ${queueEntry?.result_record_path ?? "n/a"}</div>
          <div class="muted">current case stage: ${queueEntry?.current_case_stage ?? "n/a"} | integrity: ${queueEntry?.integrity_state ?? "n/a"}</div>
          <div class="muted">current live artifact: ${queueEntry?.current_head ? html`<a href=${queueEntry.current_head.view_path} @click=${(event: Event) => { event.preventDefault(); navTo(queueEntry.current_head?.view_path || ""); }}>${queueEntry.current_head.artifact_path}</a>` : "n/a"}</div>
          <div class="muted">current live artifact stage: ${queueEntry?.current_head?.artifact_stage ?? "n/a"}</div>
          <div class="muted">continue from here: ${queueEntry?.current_case_next_legal_step ?? "n/a"}</div>
          ${relatedHandoffs.length ? html`<ul>${relatedHandoffs.map((stub: any) => html`<li><a href=${`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`); }}>${stub.title}</a></li>`)}</ul>` : html`<div class="muted">No routed handoff stub found for this run.</div>`}
          ${noDownstream ? html`<p>${noDownstream}</p>` : nothing}
        </section>
        <section class="panel"><h3>Paired markdown report</h3><pre>${detail.reportContent ?? detail.reportExcerpt ?? "No report content."}</pre></section>
      `;
    }

    if (this.page.kind === "queue") {
      const runByCandidateId = new Map<string, FrontendEngineRunRecord>(
        (this.page.runs.recentRuns || []).map((run: { record: FrontendEngineRunRecord }) => [run.record.candidate.candidateId, run.record]),
      );
      const handoffByCandidateId = new Map<string, FrontendHandoffStub>(
        (this.page.handoffs || []).map((stub: FrontendHandoffStub) => [stub.candidateId, stub]),
      );
      const entries = this.page.queue.entries || [];
      const runtimeEntries = entries.filter((entry: FrontendQueueEntry) => entry.current_head?.artifact_lane === "runtime" || entry.routing_target === "runtime");
      const architectureEntries = entries.filter((entry: FrontendQueueEntry) => entry.current_head?.artifact_lane === "architecture" || entry.routing_target === "architecture");
      const closedEntries = entries.filter((entry: FrontendQueueEntry) => (entry.current_case_stage || "").endsWith(".keep"));
      const pendingActionEntries = entries.filter((entry: FrontendQueueEntry) => Boolean(entry.current_case_next_legal_step && !entry.current_case_next_legal_step.startsWith("No automatic")));
      const openmossEntry = entries.find((entry: FrontendQueueEntry) => entry.candidate_name === "OpenMOSS");
      return html`
        <section class="panel">
          <h2>Discovery queue</h2>
          <p class="muted">Directive Kernel uses this queue as the live front door into Discovery, Architecture, and Runtime. The product surface now emphasizes current heads, current case stage, and the next legal step instead of treating queue state like a raw spreadsheet.</p>

          <section class="queue-summary-grid">
            ${this.renderQueueStat("Total queue entries", entries.length, "All persisted Discovery queue cases visible to the product frontend.")}
            ${this.renderQueueStat("Runtime-tracked cases", runtimeEntries.length, "Cases whose current head or route is now in the Runtime lane.")}
            ${this.renderQueueStat("Architecture-tracked cases", architectureEntries.length, "Cases whose current head or route is now in the Architecture lane.")}
            ${this.renderQueueStat("Cases with live next steps", pendingActionEntries.length, "Entries that still expose an explicit continue-from-here action in current truth.")}
          </section>

          ${openmossEntry ? this.renderRuntimeCaseStrip(openmossEntry) : nothing}

          ${entries.length
            ? html`<section class="queue-card-list">
                ${entries.map((entry: FrontendQueueEntry) => {
                  const run = runByCandidateId.get(entry.candidate_id);
                  const handoff = handoffByCandidateId.get(entry.candidate_id);
                  const handoffPath = entry.result_record_path ?? handoff?.relativePath ?? null;
                  return this.renderQueueCard(entry, run, handoffPath);
                })}
              </section>`
            : html`<div class="queue-empty muted">No queue entries found.</div>`}

          ${closedEntries.length
            ? html`<p class="muted" style="margin-top:16px;">${closedEntries.length} queue case${closedEntries.length === 1 ? "" : "s"} already resolve to an explicit keep state. They remain visible here as history, but not as open work by default.</p>`
            : nothing}
        </section>
      `;
    }

    if (this.page.kind === "discovery-routing-detail") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Discovery routing record not found</h2><pre>${detail.error}</pre></section>`;
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
          <tr><th>gap pressure</th><td>${this.renderGapPressureSummary(detail.gapPressure)}</td></tr>
          <tr><th>gap alignment score</th><td>${detail.gapPressure?.gapAlignmentScore ?? "n/a"}</td></tr>
          <tr><th>open gaps considered</th><td>${detail.gapPressure?.openGapCount ?? "n/a"}</td></tr>
          <tr><th>gap mission objective</th><td>${detail.gapPressure?.relatedMissionObjective ?? "n/a"}</td></tr>
          <tr><th>routing confidence</th><td>${detail.routingConfidence ?? "n/a"}</td></tr>
          <tr><th>route conflict</th><td>${detail.routeConflict === null || detail.routeConflict === undefined ? "n/a" : detail.routeConflict ? "yes" : "no"}</td></tr>
          <tr><th>needs human review</th><td>${detail.needsHumanReview === null || detail.needsHumanReview === undefined ? "n/a" : detail.needsHumanReview ? "yes" : "no"}</td></tr>
          <tr><th>ambiguity summary</th><td>${detail.ambiguitySummary
            ? `${detail.ambiguitySummary.topLaneId} over ${detail.ambiguitySummary.runnerUpLaneId ?? "none"} by ${detail.ambiguitySummary.scoreDelta}; conflicting signals: ${detail.ambiguitySummary.conflictingSignalFamilies.join(", ") || "none"}`
            : "n/a"}</td></tr>
          <tr><th>review guidance</th><td>${detail.reviewGuidance?.summary ?? "n/a"}</td></tr>
          <tr><th>Engine usefulness level</th><td>${detail.usefulnessLevel ?? "n/a"}</td></tr>
          <tr><th>Engine usefulness rationale</th><td>${detail.usefulnessRationale ?? "n/a"}</td></tr>
          <tr><th>linked intake record</th><td>${this.artifactLink(detail.linkedIntakeRecord)}</td></tr>
          <tr><th>linked triage record</th><td>${this.artifactLink(detail.linkedTriageRecord)}</td></tr>
          <tr><th>Engine run record</th><td>${detail.engineRunRecordPath ? this.artifactLink(detail.engineRunRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>Engine run report</th><td>${detail.engineRunReportPath ? this.artifactLink(detail.engineRunReportPath) : html`<span class="muted">not resolved</span>`}</td></tr>
        </tbody></table></section>
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
        ${this.renderRoutingExplanationBreakdown(detail)}
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
                ? html`<button @click=${() => this.approveDiscoveryRoute(detail.relativePath || "")}>${openLabel}</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw routing artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "handoffs") {
      const data = this.page.data;
      return html`
        ${data.handoffWarnings?.length ? html`<section class="panel warning"><h3>Invalid handoff artifacts</h3><p class="muted">These are shown as raw files so the frontend remains operable even when one handoff artifact is malformed.</p></section>` : nothing}
        <section class="panel"><h2>Handoff stubs</h2><table><thead><tr><th>title</th><th>lane</th><th>status</th><th>candidate id</th><th>artifact</th><th>bounded start</th></tr></thead><tbody>
          ${data.handoffStubs.length ? data.handoffStubs.map((stub: any) => html`
            <tr>
              <td>${stub.kind === "architecture_handoff_invalid" ? this.artifactLink(stub.relativePath) : html`<a href=${`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`); }}>${stub.title}</a>`}${stub.warning ? html`<div class="muted">${stub.warning}</div>` : nothing}</td>
              <td><span class="pill">${stub.lane}</span></td>
              <td>${stub.status}</td>
              <td>${stub.candidateId}</td>
              <td>${this.artifactLink(stub.relativePath)}</td>
              <td>${stub.lane === "architecture" ? (stub.kind === "architecture_handoff_invalid" ? html`<span class="muted">invalid handoff artifact</span>` : stub.startRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(stub.startRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(stub.startRelativePath)}`); }}>view bounded start</a>` : html`<button class="secondary" @click=${() => this.startArchitecture(stub.relativePath)}>start bounded work</button>`) : html`<span class="muted">no start path yet</span>`}</td>
            </tr>`) : html`<tr><td colspan="6" class="muted">No handoff stubs found.</td></tr>`}
        </tbody></table></section>
      `;
    }

    if (this.page.kind === "handoff-detail") {
      const detail = this.page.data as FrontendRuntimeFollowUpDetail | FrontendLegacyRuntimeFollowUpDetail | FrontendLegacyRuntimeHandoffDetail | any;
      if (!detail.ok) return html`<section class="panel warning"><h2>Handoff not found</h2><pre>${detail.error}</pre></section>`;
      if (detail.kind === "runtime_follow_up") {
        return html`
          <section class="panel"><h2>Runtime follow-up stub</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
            <tr><th>title</th><td>${detail.title}</td></tr>
            <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
            <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
            <tr><th>status</th><td>${detail.status}</td></tr>
            <tr><th>runtime value</th><td>${detail.runtimeValueToOperationalize}</td></tr>
            <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
            <tr><th>proposed integration mode</th><td>${detail.proposedIntegrationMode}</td></tr>
            <tr><th>review cadence</th><td>${detail.reviewCadence}</td></tr>
            <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? this.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>next capability record</th><td>${detail.runtimeRecordExists ? html`<a href=${`/runtime-records/view?path=${encodeURIComponent(detail.runtimeRecordRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-records/view?path=${encodeURIComponent(detail.runtimeRecordRelativePath || "")}`); }}>Open capability record</a>` : html`<span class="muted">${detail.runtimeRecordRelativePath}</span>`}</td></tr>
          </tbody></table></section>
          <section class=${detail.runtimeRecordExists ? "panel good" : detail.approvalAllowed ? "panel message" : "panel warning"}>
            <h3>Runtime review/open boundary</h3>
            <p>${detail.runtimeRecordExists
              ? "This Runtime follow-up has already been explicitly reviewed and opened into one bounded non-executing capability record."
              : detail.approvalAllowed
                ? "This review step stays explicit and human-controlled. Approving here opens exactly one bounded non-executing capability record and stops before proof execution, host integration, or broader capability work."
                : "This Runtime follow-up is not in a reviewable state for opening the next bounded capability artifact."}</p>
            <div class="actions">
              ${detail.runtimeRecordExists
                ? html`<a href=${`/runtime-records/view?path=${encodeURIComponent(detail.runtimeRecordRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-records/view?path=${encodeURIComponent(detail.runtimeRecordRelativePath || "")}`); }}>Open capability record</a>`
                : detail.approvalAllowed
                  ? html`<button @click=${() => this.approveRuntimeFollowUp(detail.relativePath || "")}>Approve capability record</button>`
                  : nothing}
            </div>
          </section>
          <section class="panel"><h3>Raw follow-up artifact</h3><pre>${detail.content}</pre></section>
        `;
      }
      if (detail.kind === "runtime_follow_up_legacy") {
        return html`
          <section class="panel"><h2>Legacy Runtime follow-up</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
            <tr><th>title</th><td>${detail.title}</td></tr>
            <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
            <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
            <tr><th>current decision state</th><td>${detail.currentDecisionState ?? html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>runtime value</th><td>${detail.runtimeValueToOperationalize}</td></tr>
            <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
            <tr><th>proposed integration mode</th><td>${detail.proposedIntegrationMode ?? html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>re-entry contract</th><td>${this.artifactLink(detail.reentryContractPath)}</td></tr>
            <tr><th>current status</th><td>${detail.currentStatus ?? html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>review cadence</th><td>${detail.reviewCadence ?? html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>required proof</th><td>${detail.requiredProof?.length ? html`<ul>${detail.requiredProof.map((entry: string) => html`<li>${entry}</li>`)}</ul>` : html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>required gates</th><td>${detail.requiredGates?.length ? html`<ul>${detail.requiredGates.map((entry: string) => html`<li>${entry}</li>`)}</ul>` : html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>rollback note</th><td>${detail.rollbackNote ?? html`<span class="muted">n/a</span>`}</td></tr>
          </tbody></table></section>
          <section class="panel message">
            <h3>Boundary note</h3>
            <p>This is a historical deferred Runtime follow-up artifact. It is inspectable through the host surface, but it does not claim membership in the current non-executing Legacy Runtime chain.</p>
          </section>
          <section class="panel"><h3>Raw follow-up artifact</h3><pre>${detail.content}</pre></section>
        `;
      }
      if (detail.kind === "runtime_handoff_legacy") {
        return html`
          <section class="panel"><h2>Legacy Runtime handoff</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
            <tr><th>title</th><td>${detail.title}</td></tr>
            <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
            <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
            <tr><th>handoff type</th><td>${detail.handoffType ?? html`<span class="muted">n/a</span>`}</td></tr>
            <tr><th>runtime value</th><td>${detail.runtimeValueToOperationalize}</td></tr>
            <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
            <tr><th>proposed capability shape</th><td>${detail.proposedRuntimeSurface}</td></tr>
            <tr><th>originating Architecture record</th><td>${this.artifactLink(detail.originatingArchitectureRecordPath)}</td></tr>
            <tr><th>mixed-value partition ref</th><td>${this.artifactLink(detail.mixedValuePartitionRef)}</td></tr>
            <tr><th>Runtime follow-up</th><td>${this.artifactLink(detail.runtimeFollowUpPath)}</td></tr>
            <tr><th>capability record</th><td>${this.artifactLink(detail.runtimeRecordPath)}</td></tr>
            <tr><th>proof artifact</th><td>${this.artifactLink(detail.runtimeProofPath)}</td></tr>
            <tr><th>promotion record</th><td>${this.artifactLink(detail.promotionRecordPath)}</td></tr>
            <tr><th>registry entry</th><td>${this.artifactLink(detail.registryEntryPath)}</td></tr>
            <tr><th>quality gate result</th><td>${detail.qualityGateResult ?? html`<span class="muted">n/a</span>`}</td></tr>
          </tbody></table></section>
          <section class="panel message">
            <h3>Boundary note</h3>
            <p>This is a historical Runtime handoff artifact. It is inspectable through the host surface, but it does not claim membership in the current non-executing Legacy Runtime chain.</p>
          </section>
          <section class="panel"><h3>Raw handoff artifact</h3><pre>${detail.content}</pre></section>
        `;
      }
      const artifact = detail.artifact;
      return html`
        <section class="panel"><h2>Architecture handoff detail</h2><div class="muted mono">${artifact.handoffRelativePath}</div><table><tbody>
          <tr><th>status</th><td>${artifact.status}</td></tr>
          <tr><th>candidate id</th><td>${artifact.candidateId}</td></tr>
          <tr><th>source reference</th><td>${artifact.sourceReference}</td></tr>
          <tr><th>usefulness level</th><td>${artifact.usefulnessLevel}</td></tr>
          <tr><th>usefulness rationale</th><td>${artifact.usefulnessRationale}</td></tr>
          <tr><th>objective</th><td>${artifact.objective}</td></tr>
          <tr><th>Engine run record</th><td>${artifact.engineRunRecordPath ? this.artifactLink(artifact.engineRunRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>Engine run report</th><td>${artifact.engineRunReportPath ? this.artifactLink(artifact.engineRunReportPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>Discovery routing record</th><td>${artifact.discoveryRoutingRecordPath ? this.artifactLink(artifact.discoveryRoutingRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>rollback</th><td>${artifact.rollback}</td></tr>
        </tbody></table></section>
        <section class="grid">
          <section class="panel"><h3>Bounded scope</h3><ul>${artifact.boundedScope.map((item: string) => html`<li>${item}</li>`)}</ul></section>
          <section class="panel"><h3>Inputs</h3><ul>${artifact.inputs.map((item: string) => html`<li>${item}</li>`)}</ul></section>
          <section class="panel"><h3>Validation gates</h3><ul>${artifact.validationGates.map((item: string) => html`<li>${item}</li>`)}</ul></section>
          <section class="panel"><h3>Next decision</h3><ul>${artifact.nextDecision.map((item: string) => html`<li>${item}</li>`)}</ul></section>
        </section>
        <section class=${artifact.startExists ? "panel good" : "panel message"}>
          <h3>Architecture bounded start</h3>
          <p class="muted">Human review and explicit start approval remain required. This path opens the bounded-start artifact only; it does not execute the Architecture work.</p>
          <div class="actions">${artifact.startExists && artifact.startRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(artifact.startRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(artifact.startRelativePath)}`); }}>Open bounded start</a>` : html`<button @click=${() => this.startArchitecture(artifact.handoffRelativePath)}>Approve bounded start</button>`}</div>
        </section>
        <section class="panel"><h3>Raw handoff artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "runtime-record-detail") {
      const detail = this.page.data as FrontendRuntimeRecordDetail;
      if (!detail.ok) return html`<section class="panel warning"><h2>Capability record not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel"><h2>Legacy capability record</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>runtime objective</th><td>${detail.runtimeObjective}</td></tr>
          <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
          <tr><th>proposed capability shape</th><td>${detail.proposedRuntimeSurface}</td></tr>
          <tr><th>required proof summary</th><td>${detail.requiredProofSummary}</td></tr>
          <tr><th>current status</th><td>${detail.currentStatus}</td></tr>
          <tr><th>source Runtime follow-up</th><td>${this.artifactLink(detail.linkedFollowUpRecord)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? this.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
          <tr><th>next capability proof artifact</th><td>${detail.proofExists ? html`<a href=${`/runtime-proofs/view?path=${encodeURIComponent(detail.runtimeProofRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-proofs/view?path=${encodeURIComponent(detail.runtimeProofRelativePath || "")}`); }}>Open capability proof artifact</a>` : html`<span class="muted">${detail.runtimeProofRelativePath}</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.proofExists ? "panel good" : detail.approvalAllowed ? "panel message" : "panel warning"}>
          <h3>Capability proof opening boundary</h3>
          <p>${detail.proofExists
            ? "This legacy capability record has already been explicitly reviewed and opened into one capability proof artifact."
            : detail.approvalAllowed
              ? "This approval step stays explicit and bounded. Approving here opens exactly one capability proof artifact and stops before execution, host integration, callable implementation, or promotion work."
              : "This legacy capability record is not in an approval state for opening the proof artifact."}</p>
          <div class="actions">
            ${detail.proofExists
              ? html`<a href=${`/runtime-proofs/view?path=${encodeURIComponent(detail.runtimeProofRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-proofs/view?path=${encodeURIComponent(detail.runtimeProofRelativePath || "")}`); }}>Open capability proof artifact</a>`
              : detail.approvalAllowed
                ? html`<button @click=${() => this.approveRuntimeRecordProof(detail.relativePath || "")}>Approve capability proof artifact</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw capability record</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "runtime-proof-detail") {
      const detail = this.page.data as FrontendRuntimeProofDetail;
      if (!detail.ok) return html`<section class="panel warning"><h2>Capability proof artifact not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel"><h2>Capability proof artifact</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>runtime objective</th><td>${detail.runtimeObjective}</td></tr>
          <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
          <tr><th>proposed capability shape</th><td>${detail.proposedRuntimeSurface}</td></tr>
          <tr><th>current status</th><td>${detail.currentStatus}</td></tr>
          <tr><th>Legacy capability record</th><td>${this.artifactLink(detail.linkedRuntimeRecordPath)}</td></tr>
          <tr><th>source Runtime follow-up</th><td>${this.artifactLink(detail.linkedFollowUpPath)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? this.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
          <tr><th>bounded capability boundary</th><td>${detail.runtimeCapabilityBoundaryExists ? html`<a href=${`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.runtimeCapabilityBoundaryRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.runtimeCapabilityBoundaryRelativePath || "")}`); }}>Open bounded capability boundary</a>` : html`<span class="muted">${detail.runtimeCapabilityBoundaryRelativePath}</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.runtimeCapabilityBoundaryExists ? "panel good" : detail.approvalAllowed ? "panel message" : "panel warning"}>
          <h3>Bounded capability boundary</h3>
          <p>${detail.runtimeCapabilityBoundaryExists
            ? "This capability proof artifact has already been explicitly reviewed and opened into one bounded capability boundary."
            : detail.approvalAllowed
              ? "This approval step stays explicit and bounded. Approving here opens exactly one bounded capability boundary and stops before execution, host integration, callable implementation, or promotion work."
              : "This capability proof artifact is not in an approval state for opening the bounded capability boundary."}</p>
          <div class="actions">
            ${detail.runtimeCapabilityBoundaryExists
              ? html`<a href=${`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.runtimeCapabilityBoundaryRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.runtimeCapabilityBoundaryRelativePath || "")}`); }}>Open bounded capability boundary</a>`
              : detail.approvalAllowed
                ? html`<button @click=${() => this.approveRuntimeProofRuntimeCapabilityBoundary(detail.relativePath || "")}>Approve runtime capability boundary</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw capability proof artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "runtime-runtime-capability-boundary-detail") {
      const detail = this.page.data as FrontendRuntimeRuntimeCapabilityBoundaryDetail;
      if (!detail.ok) return html`<section class="panel warning"><h2>Runtime capability boundary not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel"><h2>Runtime runtime capability boundary</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>runtime objective</th><td>${detail.runtimeObjective}</td></tr>
          <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
          <tr><th>proposed capability shape</th><td>${detail.proposedRuntimeSurface}</td></tr>
          <tr><th>current proof status</th><td>${detail.currentProofStatus}</td></tr>
          <tr><th>Capability proof artifact</th><td><a href=${`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`); }}>${detail.linkedRuntimeProofPath}</a></td></tr>
          <tr><th>Legacy capability record</th><td>${this.artifactLink(detail.linkedRuntimeRecordPath)}</td></tr>
          <tr><th>source Runtime follow-up</th><td>${this.artifactLink(detail.linkedFollowUpPath)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? this.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
          <tr><th>promotion-readiness artifact</th><td>${detail.promotionReadinessExists ? html`<a href=${`/runtime-promotion-readiness/view?path=${encodeURIComponent(detail.promotionReadinessRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-promotion-readiness/view?path=${encodeURIComponent(detail.promotionReadinessRelativePath || "")}`); }}>Open promotion-readiness detail</a>` : html`<span class="muted">${detail.promotionReadinessRelativePath}</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.promotionReadinessExists ? "panel good" : detail.approvalAllowed ? "panel message" : "panel warning"}>
          <h3>Promotion-readiness boundary</h3>
          <p>${detail.promotionReadinessExists
            ? "This bounded runtime capability boundary has already been explicitly reviewed and opened into one non-executing promotion-readiness artifact."
            : detail.approvalAllowed
              ? "This approval step stays explicit and bounded. Approving here opens exactly one non-executing promotion-readiness artifact and stops before host-facing promotion, host integration, runtime execution, or callable implementation."
              : "This runtime capability boundary is not in an approval state for opening the promotion-readiness artifact."}</p>
          <div class="actions">
            ${detail.promotionReadinessExists
              ? html`<a href=${`/runtime-promotion-readiness/view?path=${encodeURIComponent(detail.promotionReadinessRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-promotion-readiness/view?path=${encodeURIComponent(detail.promotionReadinessRelativePath || "")}`); }}>Open promotion-readiness detail</a>`
              : detail.approvalAllowed
                ? html`<button @click=${() => this.approveRuntimePromotionReadiness(detail.relativePath || "")}>Approve promotion-readiness artifact</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw runtime capability boundary</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "runtime-promotion-readiness-detail") {
      const detail = this.page.data as FrontendRuntimePromotionReadinessDetail;
      if (!detail.ok) return html`<section class="panel warning"><h2>Runtime promotion-readiness artifact not found</h2><pre>${detail.error}</pre></section>`;
      const blockers = detail.promotionReadinessBlockers || [];
      const closedSeams = [
        "host-facing promotion remains unopened",
        "callable implementation remains unopened",
        "host integration remains unopened",
        "runtime execution remains unopened",
      ];
      return html`
        <section class="hero">
          <h2>OpenMOSS Runtime seam review</h2>
          <p>This is the current product-facing Runtime stop for Directive Kernel. The frontend shows the live Runtime truth, but Runtime and Engine still own blocker judgment, progression rules, and any later implementation, integration, or execution work.</p>
          <div class="hero-meta">
            ${this.renderQueueTag(detail.currentStage || "runtime.promotion_readiness.opened", "runtime")}
            ${this.renderQueueTag(detail.currentStatus || "promotion_readiness_opened")}
            ${this.renderQueueTag(detail.proposedHost || "Directive Kernel web host", "runtime")}
          </div>
          <div class="muted mono" style="margin-top:10px;">${detail.relativePath}</div>
        </section>

        <section class="panel">
          <div class="seam-grid">
            <section class="seam-card">
              <h3>Current Runtime truth</h3>
              <p class="seam-value">${detail.currentStage}</p>
              <p class="muted" style="margin-top:8px;">${detail.nextLegalStep}</p>
            </section>

            <section class="seam-card">
              <h3>Proposed host surface</h3>
              <p class="seam-value">${detail.proposedHost}</p>
              <p class="muted" style="margin-top:8px;">Directive Kernel web host is the active product surface for this phase. This page reads the live product state directly rather than mirroring a separate host UI.</p>
            </section>

            <section class="seam-card">
              <h3>Runtime objective</h3>
              <p class="seam-value">${detail.runtimeObjective}</p>
              <p class="muted" style="margin-top:8px;">Proposed runtime surface: ${detail.proposedRuntimeSurface ?? "n/a"}</p>
            </section>

            <section class="seam-card">
              <h3>Execution state</h3>
              <p class="seam-value">${detail.executionState}</p>
              <p class="muted" style="margin-top:8px;">Promotion-readiness decision: ${detail.promotionReadinessDecision ?? "n/a"}</p>
            </section>
          </div>
        </section>

        <section class="grid">
          <section class="panel warning">
            <h3>Blocked seams</h3>
            ${blockers.length
              ? html`<ul>${blockers.map((blocker) => html`<li><code>${blocker}</code></li>`)}</ul>`
              : html`<p class="muted">No promotion-readiness blockers were recorded.</p>`}
            <p class="seam-note muted" style="margin-top:12px;">Host-facing promotion remains a reviewed but unopened seam. This page does not imply callable implementation, host integration, or execution are available.</p>
          </section>

          <section class="panel">
            <h3>What remains intentionally closed</h3>
            <ul>${closedSeams.map((item) => html`<li>${item}</li>`)}</ul>
            <p class="muted" style="margin-top:12px;">This page is for operator seam review, not for activating downstream Runtime behavior.</p>
          </section>
        </section>

        <section class="panel good">
          <h3>Opened implementation slice</h3>
          <p>The first bounded Runtime-implementation slice is now explicit on the Directive Kernel web host: the host owns one implementation-bundle section for the OpenMOSS seam-review surface, while Runtime and Engine continue to own stage truth, blockers, legality, and downstream progression.</p>
          <div class="link-stack">
            <div><strong>Opened runtime-implementation slice:</strong> ${this.artifactLink(detail.openedRuntimeImplementationSlicePath)}</div>
            <div><strong>Pre-promotion implementation slice:</strong> ${this.artifactLink(detail.prePromotionImplementationSlicePath)}</div>
            <div><strong>Compile contract:</strong> ${this.artifactLink(detail.compileContractPath)}</div>
            <div><strong>Promotion-input package:</strong> ${this.artifactLink(detail.promotionInputPackagePath)}</div>
            <div><strong>Profile/checker decision:</strong> ${this.artifactLink(detail.profileCheckerDecisionPath)}</div>
            <div><strong>Promotion go/no-go decision:</strong> ${this.artifactLink(detail.promotionGoNoGoDecisionPath)}</div>
          </div>
          <p class="muted" style="margin-top:12px;">This remains non-promoting and non-executing. It makes the host-owned implementation boundary real without opening host-facing promotion, host integration, callable implementation, or runtime execution.</p>
        </section>

        <section class="panel">
          <h3>Artifact chain</h3>
          <div class="link-stack">
            <div><strong>Runtime capability boundary:</strong> <a href=${`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.linkedCapabilityBoundaryPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.linkedCapabilityBoundaryPath || "")}`); }}>${detail.linkedCapabilityBoundaryPath}</a></div>
            <div><strong>Runtime proof artifact:</strong> <a href=${`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`); }}>${detail.linkedRuntimeProofPath}</a></div>
            <div><strong>Legacy Runtime record:</strong> ${this.artifactLink(detail.linkedRuntimeRecordPath)}</div>
            <div><strong>Source Runtime follow-up:</strong> ${this.artifactLink(detail.linkedFollowUpPath)}</div>
            <div><strong>Linked Discovery routing record:</strong> ${detail.linkedRoutingPath ? this.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</div>
          </div>
        </section>

        <section class="panel message">
          <h3>Directive Kernel product boundary</h3>
          <p>The Directive Kernel frontend is the active review surface here. It exposes current stage, next legal step, proposed host, blockers, and linked artifacts, while Runtime and Engine continue to own all real gating and progression logic.</p>
          <p class="muted">DW frontend capability: ${detail.frontendCapabilityDecision || "not explicitly recorded"} | host-facing promotion decision: ${detail.hostFacingPromotionDecision || "not explicitly recorded"}</p>
        </section>

        <section class="panel"><h3>Raw promotion-readiness artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-start") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Bounded start not found</h2><pre>${detail.error}</pre></section>`;
      const assist = detail.closeoutAssist;
      const resultEvidence = detail.resultEvidence;
      return html`
        <section class="panel good"><h2>Architecture bounded start</h2><div class="muted mono">${detail.relativePath}</div><table><tbody><tr><th>candidate id</th><td>${detail.candidateId}</td></tr><tr><th>candidate name</th><td>${detail.candidateName}</td></tr><tr><th>objective</th><td>${detail.objective}</td></tr><tr><th>start approval</th><td>${detail.startApproval}</td></tr><tr><th>result summary</th><td>${detail.resultSummary}</td></tr><tr><th>handoff stub</th><td><a href=${`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`); }}>${detail.handoffStubPath}</a></td></tr><tr><th>bounded result</th><td>${detail.resultRelativePath ? html`<a href=${`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>Open bounded result</a>` : html`<span class="muted">not recorded yet</span>`}</td></tr></tbody></table></section>
        ${resultEvidence ? html`
          <section class=${resultEvidence.availability === "not_available" ? "panel message" : "panel good"}>
            <h3>Result evidence</h3>
            <p>${resultEvidence.summary}</p>
            <table><tbody>
              <tr><th>evidence kind</th><td>${resultEvidence.primaryKind}</td></tr>
              <tr><th>availability</th><td>${resultEvidence.availability}</td></tr>
              <tr><th>${resultEvidence.primaryLabel}</th><td>${resultEvidence.primaryPath ? html`<a href=${artifactPathToViewPath(resultEvidence.primaryPath)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(resultEvidence.primaryPath || "")); }}>${resultEvidence.primaryPath}</a>` : html`<span class="muted">not available</span>`}</td></tr>
            </tbody></table>
            ${resultEvidence.supportingEvidence.length > 0 ? html`
              <div class="panel" style="margin-top:12px;">
                <h4>Supporting evidence</h4>
                <ul>${resultEvidence.supportingEvidence.map((item: { kind: string; path: string; label: string }) => html`<li>${item.label}: <a href=${artifactPathToViewPath(item.path)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(item.path)); }}>${item.path}</a></li>`)}</ul>
              </div>
            ` : nothing}
          </section>
        ` : nothing}
        ${assist ? html`
          <section class="panel message">
            <h3>Closeout assist</h3>
            <p>Derived from the bounded start and linked Engine run. Review it, then keep the final closeout decision explicit.</p>
            <table><tbody>
              <tr><th>mission fit summary</th><td>${assist.missionFitSummary}</td></tr>
              <tr><th>primary adoption question</th><td>${assist.primaryAdoptionQuestion}</td></tr>
              <tr><th>directive-owned form</th><td>${assist.directiveOwnedForm}</td></tr>
              <tr><th>intended delta</th><td>${assist.intendedDelta}</td></tr>
              <tr><th>structural stages</th><td>${assist.structuralStages.length > 0 ? assist.structuralStages.join(" -> ") : html`<span class="muted">none detected</span>`}</td></tr>
              <tr><th>stage-preservation expectation</th><td>${assist.stagePreservationExpectation}</td></tr>
              <tr><th>stage-preservation guidance</th><td>${assist.stagePreservationSummary}</td></tr>
              <tr><th>closeout decision guidance</th><td>${assist.decisionGuidance}</td></tr>
            </tbody></table>
            <div class="grid" style="margin-top:12px;">
              <div class="panel">
                <h4>Extracted value</h4>
                ${assist.extractedValue.length > 0 ? html`<ul>${assist.extractedValue.map((item: string) => html`<li>${item}</li>`)}</ul>` : html`<p class="muted">No extracted-value guidance available.</p>`}
              </div>
              <div class="panel">
                <h4>Excluded baggage</h4>
                ${assist.excludedBaggage.length > 0 ? html`<ul>${assist.excludedBaggage.map((item: string) => html`<li>${item}</li>`)}</ul>` : html`<p class="muted">No excluded-baggage guidance available.</p>`}
              </div>
              <div class="panel">
                <h4>Adapted value</h4>
                ${assist.adaptedValue.length > 0 ? html`<ul>${assist.adaptedValue.map((item: string) => html`<li>${item}</li>`)}</ul>` : html`<p class="muted">No adapted-value guidance available.</p>`}
              </div>
              <div class="panel">
                <h4>Improvement goals</h4>
                ${assist.improvementGoals.length > 0 ? html`<ul>${assist.improvementGoals.map((item: string) => html`<li>${item}</li>`)}</ul>` : html`<p class="muted">No improvement-goal guidance available.</p>`}
              </div>
            </div>
            <div class="panel" style="margin-top:12px;">
              <h4>Readiness guidance</h4>
              <ul>${assist.readinessGuidance.map((item: string) => html`<li>${item}</li>`)}</ul>
            </div>
          </section>
        ` : nothing}
        <section class=${detail.resultRelativePath ? "panel good" : "panel message"}>
          <h3>Bounded closeout</h3>
          <p>${detail.resultRelativePath ? "A bounded Architecture result has been recorded for this start artifact." : "Execution still remains manual, but bounded result/closeout can now be recorded directly from this start artifact without rebuilding the context by hand again."}</p>
          ${detail.resultRelativePath ? html`<div class="actions"><a href=${`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>Open bounded result</a>${detail.decisionRelativePath ? html`<a href=${`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`); }}>Open closeout decision JSON</a>` : nothing}</div>` : html`
            <form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.closeArchitectureStart(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
              <div class="row"><label>result summary</label><textarea name="result_summary">${assist?.suggestedResultSummary || "Bounded Architecture slice clarified the next engine-owned adaptation target and should stay experimental until the product-owned implementation artifact is materialized."}</textarea></div>
              <div class="row"><label>primary evidence path</label><input name="primary_evidence_path" placeholder="shared/lib/example.ts or architecture/.../artifact.md" /></div>
              <div class="row"><label>transformed artifacts produced</label><textarea name="transformed_artifacts_produced" placeholder="One workspace-relative path per line when this slice actually materialized concrete artifacts. Leave blank when none were produced."></textarea></div>
              <div class="grid">
                <div class="row"><label>next decision</label><select name="next_decision"><option value="needs-more-evidence">needs-more-evidence</option><option value="adopt">adopt</option><option value="defer">defer</option><option value="reject">reject</option></select></div>
                <div class="row"><label>value shape</label><select name="value_shape"><option value="working_document">working_document</option><option value="design_pattern">design_pattern</option><option value="executable_logic">executable_logic</option><option value="behavior_rule">behavior_rule</option><option value="data_shape">data_shape</option><option value="interface_or_handoff">interface_or_handoff</option><option value="operating_model_change">operating_model_change</option></select></div>
                <div class="row"><label>adaptation quality</label><select name="adaptation_quality"><option value="adequate">adequate</option><option value="strong">strong</option><option value="weak">weak</option><option value="skipped">skipped</option></select></div>
                <div class="row"><label>improvement quality</label><select name="improvement_quality"><option value="skipped">skipped</option><option value="adequate">adequate</option><option value="strong">strong</option><option value="weak">weak</option></select></div>
              </div>
              <div class="actions">
                <label><input type="checkbox" name="proof_executed" /> proof executed</label>
                <label><input type="checkbox" name="target_artifact_clarified" checked /> target artifact clarified</label>
                <label><input type="checkbox" name="delta_evidence_present" checked /> delta evidence present</label>
                <label><input type="checkbox" name="no_unresolved_baggage" /> unresolved baggage cleared</label>
                <label><input type="checkbox" name="product_artifact_materialized" /> product artifact materialized</label>
                <button type="submit">Record bounded closeout</button>
              </div>
            </form>
          `}
        </section>
        <section class="panel"><h3>Raw bounded-start artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-result") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Bounded result not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture bounded result</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>objective</th><td>${detail.objective}</td></tr>
          <tr><th>closeout approval</th><td>${detail.closeoutApproval}</td></tr>
          <tr><th>result summary</th><td>${detail.resultSummary}</td></tr>
          <tr><th>next decision</th><td>${detail.nextDecision}</td></tr>
          <tr><th>closeout verdict</th><td>${detail.verdict}</td></tr>
          <tr><th>closeout rationale</th><td>${detail.rationale}</td></tr>
          <tr><th>bounded start</th><td><a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.startRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.startRelativePath || "")}`); }}>${detail.startRelativePath}</a></td></tr>
          <tr><th>handoff stub</th><td><a href=${`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`); }}>${detail.handoffStubPath}</a></td></tr>
          <tr><th>closeout decision artifact</th><td><a href=${`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`); }}>${detail.decisionRelativePath}</a></td></tr>
          <tr><th>next bounded start</th><td>${detail.continuationStartRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath || "")}`); }}>Open continuation start</a>` : html`<span class="muted">not opened yet</span>`}</td></tr>
          <tr><th>adoption artifact</th><td>${detail.adoptionRelativePath ? html`<a href=${`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`); }}>Open adoption artifact</a>` : html`<span class="muted">not materialized yet</span>`}</td></tr>
        </tbody></table></section>
        ${detail.resultEvidence ? html`
          <section class=${detail.resultEvidence.availability === "not_available" ? "panel message" : "panel good"}>
            <h3>Result evidence</h3>
            <p>${detail.resultEvidence.summary}</p>
            <table><tbody>
              <tr><th>evidence kind</th><td>${detail.resultEvidence.primaryKind}</td></tr>
              <tr><th>availability</th><td>${detail.resultEvidence.availability}</td></tr>
              <tr><th>${detail.resultEvidence.primaryLabel}</th><td>${detail.resultEvidence.primaryPath ? html`<a href=${artifactPathToViewPath(detail.resultEvidence.primaryPath)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(detail.resultEvidence?.primaryPath || "")); }}>${detail.resultEvidence.primaryPath}</a>` : html`<span class="muted">not available</span>`}</td></tr>
            </tbody></table>
            ${detail.resultEvidence.supportingEvidence.length > 0 ? html`
              <div class="panel" style="margin-top:12px;">
                <h4>Supporting evidence</h4>
                <ul>${detail.resultEvidence.supportingEvidence.map((item: { kind: string; path: string; label: string }) => html`<li>${item.label}: <a href=${artifactPathToViewPath(item.path)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(item.path)); }}>${item.path}</a></li>`)}</ul>
              </div>
            ` : nothing}
          </section>
        ` : nothing}
        <section class=${detail.continuationStartRelativePath ? "panel good" : "panel message"}>
          <h3>Bounded continuation</h3>
          <p>${detail.continuationStartRelativePath
            ? "A next bounded Architecture start has already been opened from this result artifact."
            : "This bounded result can now seed the next bounded Architecture start directly, so the operator does not have to reconstruct the continuation slice by hand again."}</p>
          ${detail.verdict === "stay_experimental" && detail.nextDecision === "needs-more-evidence"
            ? html`<div class="actions">${detail.continuationStartRelativePath
              ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath || "")}`); }}>Open continuation start</a>`
              : html`<button @click=${() => this.continueArchitectureResult(detail.relativePath || "")}>Open next bounded start</button>`}</div>`
            : html`<p class="muted">Continuation is only available for stay-experimental results whose next decision is needs-more-evidence.</p>`}
        </section>
        <section class=${detail.adoptionRelativePath ? "panel good" : "panel message"}>
          <h3>Adopt / Materialize</h3>
          <p>${detail.adoptionRelativePath
            ? "This bounded result has already been materialized into a product-owned Architecture adoption artifact."
            : "This bounded result can now be retained as a product-owned Architecture adoption artifact without reconstructing the result chain by hand."}</p>
          <div class="actions">${detail.adoptionRelativePath
            ? html`<a href=${`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`); }}>Open adoption artifact</a>`
            : html`<button @click=${() => this.adoptArchitectureResult(detail.relativePath || "")}>Adopt / Materialize</button>`}</div>
        </section>
        <section class="panel"><h3>Raw bounded-result artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-adoption") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Adoption artifact not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture adoption artifact</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>final status</th><td>${detail.finalStatus}</td></tr>
          <tr><th>source bounded result</th><td><a href=${`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`); }}>${detail.sourceResultRelativePath}</a></td></tr>
          <tr><th>paired decision artifact</th><td><a href=${`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`); }}>${detail.decisionRelativePath}</a></td></tr>
          <tr><th>implementation target</th><td>${detail.implementationTargetRelativePath ? html`<a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath || "")}`); }}>Open implementation target</a>` : html`<span class="muted">not created yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.implementationTargetRelativePath ? "panel good" : "panel message"}><h3>Create Implementation Target</h3><p>${detail.implementationTargetRelativePath ? "A bounded Architecture implementation target has already been opened from this adoption artifact." : "This adoption artifact can now open one bounded Architecture implementation target directly, without reconstructing the adopted result chain by hand."}</p><div class="actions">${detail.implementationTargetRelativePath ? html`<a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath || "")}`); }}>Open implementation target</a>` : html`<button @click=${() => this.createArchitectureImplementationTarget(detail.relativePath || "")}>Create Implementation Target</button>`}</div></section>
        <section class="panel"><h3>Raw adoption artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-implementation-target") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Implementation target not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture implementation target</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>artifact type intent</th><td>${detail.artifactType}</td></tr>
          <tr><th>final adoption status</th><td>${detail.finalStatus}</td></tr>
          <tr><th>objective</th><td>${detail.objective}</td></tr>
          <tr><th>expected outcome</th><td>${detail.expectedOutcome}</td></tr>
          <tr><th>source adoption artifact</th><td><a href=${`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`); }}>${detail.adoptionRelativePath}</a></td></tr>
          <tr><th>paired adoption decision</th><td><a href=${`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`); }}>${detail.decisionRelativePath}</a></td></tr>
          <tr><th>source bounded result</th><td><a href=${`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`); }}>${detail.sourceResultRelativePath}</a></td></tr>
          <tr><th>implementation result</th><td>${detail.implementationResultRelativePath ? html`<a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath || "")}`); }}>Open implementation result</a>` : html`<span class="muted">not recorded yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.implementationResultRelativePath ? "panel good" : "panel message"}><h3>Complete Implementation</h3><p>${detail.implementationResultRelativePath ? "A bounded implementation result has already been recorded for this target." : "This implementation target can now close out into one bounded implementation result artifact without reconstructing the adopted chain by hand."}</p>${detail.implementationResultRelativePath ? html`<div class="actions"><a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath || "")}`); }}>Open implementation result</a></div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.completeArchitectureImplementation(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
          <div class="row"><label>actual result summary</label><textarea name="result_summary">Bounded implementation slice completed the retained Architecture target and kept the materialization boundary explicit.</textarea></div>
          <div class="grid">
            <div class="row"><label>outcome</label><select name="outcome"><option value="success">success</option><option value="failure">failure</option></select></div>
            <div class="row"><label>validation result</label><input name="validation_result" value="Implementation stayed within the bounded target and remained aligned with the adopted artifact." /></div>
          </div>
          <div class="row"><label>deviations</label><textarea name="deviations"></textarea></div>
          <div class="row"><label>evidence</label><textarea name="evidence"></textarea></div>
          <div class="row"><label>rollback note</label><textarea name="rollback_note">Return to the implementation target artifact and adjust the bounded slice before attempting another completion.</textarea></div>
          <div class="actions"><button type="submit">Complete Implementation</button></div>
        </form>`}</section>
        <section class="panel"><h3>Raw implementation target artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-implementation-result") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Implementation result not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture implementation result</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>objective</th><td>${detail.objective}</td></tr>
          <tr><th>outcome</th><td>${detail.outcome}</td></tr>
          <tr><th>actual result summary</th><td>${detail.resultSummary}</td></tr>
          <tr><th>validation result</th><td>${detail.validationResult}</td></tr>
          <tr><th>rollback note</th><td>${detail.rollbackNote}</td></tr>
          <tr><th>source implementation target</th><td><a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`); }}>${detail.targetRelativePath}</a></td></tr>
          <tr><th>source adoption artifact</th><td><a href=${`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`); }}>${detail.adoptionRelativePath}</a></td></tr>
          <tr><th>source bounded result</th><td><a href=${`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.sourceResultRelativePath || "")}`); }}>${detail.sourceResultRelativePath}</a></td></tr>
          <tr><th>retained output</th><td>${detail.retainedRelativePath ? html`<a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>Open retained artifact</a>` : html`<span class="muted">not confirmed yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.retainedRelativePath ? "panel good" : "panel message"}><h3>Confirm Retention</h3><p>${detail.retainedRelativePath ? "This implementation result has already been confirmed as retained Directive Kernel Architecture output." : "This implementation result can now be confirmed as retained Directive Kernel Architecture output without reconstructing the full chain by hand."}</p>${detail.retainedRelativePath ? html`<div class="actions"><a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>Open retained artifact</a></div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.confirmArchitectureRetention(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
          <div class="row"><label>final usefulness assessment</label><textarea name="usefulness_assessment">This completed implementation result is worth retaining as Directive-owned Architecture output within the current bounded engine-improvement scope.</textarea></div>
          <div class="grid">
            <div class="row"><label>stability level</label><select name="stability_level"><option value="bounded-stable">bounded-stable</option><option value="stable">stable</option><option value="provisional">provisional</option></select></div>
            <div class="row"><label>reuse scope</label><input name="reuse_scope" value="Retain for Directive Kernel Architecture use within the current engine-improvement boundary." /></div>
          </div>
          <div class="row"><label>confirmation decision</label><textarea name="confirmation_decision">Retain this implementation result as valid Directive Kernel Architecture output for the current bounded scope.</textarea></div>
          <div class="row"><label>rollback boundary</label><textarea name="rollback_boundary">If this retained output proves unstable or premature, return to the implementation result or implementation target and reopen a bounded Architecture slice.</textarea></div>
          <div class="actions"><button type="submit">Confirm Retention</button></div>
        </form>`}</section>
        <section class="panel"><h3>Raw implementation-result artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-retained") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Retained artifact not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Retained Architecture output</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>retained objective</th><td>${detail.objective}</td></tr>
          <tr><th>stability level</th><td>${detail.stabilityLevel}</td></tr>
          <tr><th>reuse scope</th><td>${detail.reuseScope}</td></tr>
          <tr><th>confirmation decision</th><td>${detail.confirmationDecision}</td></tr>
          <tr><th>rollback boundary</th><td>${detail.rollbackBoundary}</td></tr>
          <tr><th>source implementation result</th><td><a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>${detail.resultRelativePath}</a></td></tr>
          <tr><th>source implementation target</th><td><a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`); }}>${detail.targetRelativePath}</a></td></tr>
          <tr><th>source adoption artifact</th><td><a href=${`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-adoptions/view?path=${encodeURIComponent(detail.adoptionRelativePath || "")}`); }}>${detail.adoptionRelativePath}</a></td></tr>
          <tr><th>integration record</th><td>${detail.integrationRecordRelativePath ? html`<a href=${`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath || "")}`); }}>Open integration record</a>` : html`<span class="muted">not created yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.integrationRecordRelativePath ? "panel good" : "panel message"}><h3>Create Integration Record</h3><p>${detail.integrationRecordRelativePath ? "An integration-ready Architecture record has already been opened from this retained output." : "This retained output can now be recorded as integration-ready Directive Kernel Architecture output without reconstructing the full chain by hand."}</p>${detail.integrationRecordRelativePath ? html`<div class="actions"><a href=${`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath || "")}`); }}>Open integration record</a></div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.createArchitectureIntegrationRecord(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
          <div class="row"><label>integration target/surface</label><textarea name="integration_target_surface">Directive Kernel engine-owned product logic within the current Architecture boundary.</textarea></div>
          <div class="row"><label>readiness summary</label><textarea name="readiness_summary">This retained Architecture output is stable enough within the bounded scope to be recorded as integration-ready product input.</textarea></div>
          <div class="row"><label>expected effect</label><textarea name="expected_effect">Directive Kernel can consume this retained output as an explicit engine-owned integration candidate without re-reading the prior Architecture chain.</textarea></div>
          <div class="row"><label>validation boundary</label><textarea name="validation_boundary">Validate against the retained artifact, implementation result, and bounded source chain only; do not imply execution or downstream automation.</textarea></div>
          <div class="row"><label>integration decision</label><textarea name="integration_decision">Record this retained output as integration-ready Directive Kernel Architecture output for the current bounded scope.</textarea></div>
          <div class="row"><label>rollback boundary</label><textarea name="rollback_boundary">If this integration-ready record proves premature, fall back to the retained artifact and reopen a bounded Architecture slice before any further integration step.</textarea></div>
          <div class="actions"><button type="submit">Create Integration Record</button></div>
        </form>`}</section>
        <section class="panel"><h3>Raw retained artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-integration-record") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Integration record not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture integration record</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>retained objective</th><td>${detail.objective}</td></tr>
          <tr><th>integration target/surface</th><td>${detail.integrationTargetSurface}</td></tr>
          <tr><th>readiness summary</th><td>${detail.readinessSummary}</td></tr>
          <tr><th>expected effect</th><td>${detail.expectedEffect}</td></tr>
          <tr><th>validation boundary</th><td>${detail.validationBoundary}</td></tr>
          <tr><th>integration decision</th><td>${detail.integrationDecision}</td></tr>
          <tr><th>rollback boundary</th><td>${detail.rollbackBoundary}</td></tr>
          <tr><th>source retained artifact</th><td><a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>${detail.retainedRelativePath}</a></td></tr>
          <tr><th>source implementation result</th><td><a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>${detail.resultRelativePath}</a></td></tr>
          <tr><th>source implementation target</th><td><a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.targetRelativePath || "")}`); }}>${detail.targetRelativePath}</a></td></tr>
          <tr><th>consumption record</th><td>${detail.consumptionRelativePath ? html`<a href=${`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath || "")}`); }}>Open consumption record</a>` : html`<span class="muted">not recorded yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.consumptionRelativePath ? "panel good" : "panel message"}><h3>Record Consumption</h3><p>${detail.consumptionRelativePath ? "A bounded applied-integration record has already been created from this integration record." : "This integration-ready Architecture record can now be marked as actually consumed by Directive Kernel without reconstructing the retained chain by hand."}</p>${detail.consumptionRelativePath ? html`<div class="actions"><a href=${`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath || "")}`); }}>Open consumption record</a></div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.recordArchitectureConsumption(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
          <div class="row"><label>where it was applied</label><textarea name="applied_surface">Directive Kernel engine-owned product logic within the current bounded Architecture surface.</textarea></div>
          <div class="row"><label>application summary</label><textarea name="application_summary">This integration-ready Architecture output has now been explicitly consumed as engine-owned Directive Kernel product input within the bounded scope.</textarea></div>
          <div class="row"><label>observed effect</label><textarea name="observed_effect">Directive Kernel now has an explicit applied-integration record for this retained Architecture output without re-reading the prior chain.</textarea></div>
          <div class="grid">
            <div class="row"><label>outcome</label><select name="outcome"><option value="success">success</option><option value="failure">failure</option></select></div>
            <div class="row"><label>validation result</label><input name="validation_result" value="Consumption stayed within the integration-ready boundary and remained linked to the retained Architecture chain." /></div>
          </div>
          <div class="row"><label>rollback note</label><textarea name="rollback_note">If this applied integration proves premature or inaccurate, fall back to the integration record and reopen a bounded Architecture review before any further step.</textarea></div>
          <div class="actions"><button type="submit">Record Consumption</button></div>
        </form>`}</section>
        <section class="panel"><h3>Raw integration record</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-consumption-record") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Consumption record not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Architecture consumption record</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>retained objective</th><td>${detail.objective}</td></tr>
          <tr><th>where it was applied</th><td>${detail.appliedSurface}</td></tr>
          <tr><th>application summary</th><td>${detail.applicationSummary}</td></tr>
          <tr><th>observed effect</th><td>${detail.observedEffect}</td></tr>
          <tr><th>validation result</th><td>${detail.validationResult}</td></tr>
          <tr><th>outcome</th><td>${detail.outcome}</td></tr>
          <tr><th>rollback note</th><td>${detail.rollbackNote}</td></tr>
          <tr><th>source integration record</th><td><a href=${`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRelativePath || "")}`); }}>${detail.integrationRelativePath}</a></td></tr>
          <tr><th>source retained artifact</th><td><a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>${detail.retainedRelativePath}</a></td></tr>
          <tr><th>source implementation result</th><td><a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>${detail.resultRelativePath}</a></td></tr>
          <tr><th>post-consumption evaluation</th><td>${detail.evaluationRelativePath ? html`<a href=${`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath || "")}`); }}>Open evaluation</a>` : html`<span class="muted">not evaluated yet</span>`}</td></tr>
        </tbody></table></section>
        <section class=${detail.evaluationRelativePath ? "panel good" : "panel message"}><h3>Evaluate After Use</h3><p>${detail.evaluationRelativePath ? "A post-consumption keep/reopen decision has already been recorded for this applied-integration artifact." : "This consumption record can now be evaluated as keep or reopen without reconstructing the applied Architecture chain by hand."}</p>${detail.evaluationRelativePath ? html`<div class="actions"><a href=${`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath || "")}`); }}>Open evaluation</a></div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void this.evaluateArchitectureConsumption(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}>
          <div class="grid">
            <div class="row"><label>keep or reopen</label><select name="decision"><option value="keep">keep</option><option value="reopen">reopen</option></select></div>
            <div class="row"><label>observed stability</label><input name="observed_stability" value="Observed behavior stayed stable within the applied integration boundary." /></div>
          </div>
          <div class="row"><label>rationale</label><textarea name="rationale">Real bounded use validated this applied Architecture output strongly enough to keep it as valid retained Directive Kernel Architecture output.</textarea></div>
          <div class="row"><label>retained usefulness assessment</label><textarea name="retained_usefulness_assessment">The retained Architecture output still appears useful and valid after real bounded consumption.</textarea></div>
          <div class="row"><label>next bounded action if reopen</label><textarea name="next_bounded_action">No reopen action required within the current bounded scope.</textarea></div>
          <div class="row"><label>rollback note</label><textarea name="rollback_note">If this evaluation later proves inaccurate, return to the consumption record and reassess keep versus reopen before any further step.</textarea></div>
          <div class="actions"><button type="submit">Evaluate After Use</button></div>
        </form>`}</section>
        <section class="panel"><h3>Raw consumption record</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "architecture-post-consumption-evaluation") {
      const detail = this.page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Post-consumption evaluation not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel good"><h2>Post-consumption evaluation</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>usefulness level</th><td>${detail.usefulnessLevel}</td></tr>
          <tr><th>retained objective</th><td>${detail.objective}</td></tr>
          <tr><th>decision</th><td>${detail.decision}</td></tr>
          <tr><th>rationale</th><td>${detail.rationale}</td></tr>
          <tr><th>observed stability</th><td>${detail.observedStability}</td></tr>
          <tr><th>retained usefulness assessment</th><td>${detail.retainedUsefulnessAssessment}</td></tr>
          <tr><th>next bounded action if reopen</th><td>${detail.nextBoundedAction}</td></tr>
          <tr><th>rollback note</th><td>${detail.rollbackNote}</td></tr>
          <tr><th>source consumption record</th><td><a href=${`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath || "")}`); }}>${detail.consumptionRelativePath}</a></td></tr>
          <tr><th>source integration record</th><td><a href=${`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRelativePath || "")}`); }}>${detail.integrationRelativePath}</a></td></tr>
          <tr><th>source retained artifact</th><td><a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>${detail.retainedRelativePath}</a></td></tr>
          <tr><th>reopened bounded start</th><td>${detail.reopenedStartRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath || "")}`); }}>Open reopened start</a>` : html`<span class="muted">${detail.decision === "reopen" ? "not created yet" : "not applicable for keep"}</span>`}</td></tr>
        </tbody></table></section>
        ${detail.decision === "reopen"
          ? html`<section class=${detail.reopenedStartRelativePath ? "panel good" : "panel message"}><h3>Reopen Architecture Work</h3><p>${detail.reopenedStartRelativePath ? "A reopened bounded Architecture start has already been created from this evaluation." : "This post-consumption evaluation can now reopen one bounded Architecture slice directly, without reconstructing the retained and applied chain by hand."}</p>${detail.reopenedStartRelativePath ? html`<div class="actions"><a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath || "")}`); }}>Open reopened start</a></div>` : html`<div class="actions"><button @click=${() => this.reopenArchitectureFromEvaluation(detail.relativePath || "")}>Reopen Architecture Work</button></div>`}</section>`
          : html`<section class="panel message"><h3>Current boundary</h3><p>This evaluation keeps the applied Architecture output retained. No reopen action is exposed for keep decisions.</p></section>`}
        <section class="panel"><h3>Raw post-consumption evaluation</h3><pre>${detail.content}</pre></section>
      `;
    }

    if (this.page.kind === "artifact") {
      return html`<section class="panel"><h2>Artifact view</h2><div class="muted mono">${this.page.data.relativePath}</div></section><section class="panel"><pre>${this.page.data.content}</pre></section>`;
    }

    return html`<section class="panel warning"><h2>Not found</h2><p>${this.page.path}</p></section>`;
  }

  render() {
    const current = window.location.pathname;
    return html`
      <main>
        <section class="panel shell-header">
          <div>
            <h1>Directive Kernel</h1>
            <div class="muted">Light operator surface over live Discovery, Architecture, and Runtime state.</div>
          </div>
          <div class="shell-nav">
            ${this.link("/", "Overview", current === "/")}
            ${this.link("/queue", "Sources", current === "/queue")}
            ${this.link("/workflow-map", "Workflow", current === "/workflow-map")}
            ${this.link("/operator-inbox", "Inbox", current === "/operator-inbox")}
          </div>
        </section>
        ${this.renderContent()}
      </main>
    `;
  }
}

customElements.define("directive-frontend-app", DirectiveFrontendApp);

