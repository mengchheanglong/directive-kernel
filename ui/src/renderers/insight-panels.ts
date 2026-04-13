import { html, nothing } from "lit";

import type { FrontendDiscoveryRoutingDetail, FrontendGapPressureDetail } from "../app-types";
import { navTo } from "../app-utils";

export function renderGapPressureSummary(gapPressure: FrontendGapPressureDetail | null | undefined) {
  if (!gapPressure) {
    return html`<span class="muted">n/a</span>`;
  }

  if (!gapPressure.matchedGapId) {
    return html`No matched open gap. Open gaps considered: ${gapPressure.openGapCount}; gap alignment score: ${gapPressure.gapAlignmentScore ?? "n/a"}.`;
  }

  return html`${gapPressure.matchedGapId} (rank ${gapPressure.matchedGapRank ?? "n/a"}, priority ${gapPressure.matchedGapPriority ?? "n/a"}): ${gapPressure.matchedGapDescription ?? "n/a"}`;
}

export function renderGoalCopilot(goalCopilot: {
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
  if (!goalCopilot) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Goal Copilot</h3>
      <div class="muted">overall score ${goalCopilot.overallScore}/100</div>
      <ul>
        <li>Objective specificity: ${goalCopilot.objectiveSpecificityScore}/5</li>
        <li>Usefulness signals: ${goalCopilot.usefulnessSignalQualityScore}/5</li>
        <li>Constraints: ${goalCopilot.constraintQualityScore}/5</li>
        <li>Lane clarity: ${goalCopilot.laneClarityScore}/5</li>
      </ul>
      ${goalCopilot.warnings.length > 0 ? html`
        <h4>Warnings</h4>
        <ul>${goalCopilot.warnings.map((entry) => html`<li>${entry}</li>`)}</ul>
      ` : nothing}
      ${goalCopilot.suggestedObjective ? html`
        <h4>Suggested objective rewrite</h4>
        <p>${goalCopilot.suggestedObjective}</p>
      ` : nothing}
      ${goalCopilot.suggestedConstraints.length > 0 ? html`
        <h4>Suggested constraints</h4>
        <ul>${goalCopilot.suggestedConstraints.map((entry) => html`<li>${entry}</li>`)}</ul>
      ` : nothing}
      ${goalCopilot.suggestedUsefulnessSignals.length > 0 ? html`
        <h4>Suggested usefulness signals</h4>
        <ul>${goalCopilot.suggestedUsefulnessSignals.map((entry) => html`<li>${entry}</li>`)}</ul>
      ` : nothing}
      ${goalCopilot.suggestedCapabilityLanes.length > 0 ? html`
        <h4>Suggested lane order</h4>
        <ul>${goalCopilot.suggestedCapabilityLanes.map((entry) => html`<li>${entry}</li>`)}</ul>
      ` : nothing}
    </section>
  `;
}

export function renderConfidenceRecovery(confidenceRecovery: {
  summary: string;
  confidenceLift: string;
  requestedInputs: Array<{
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
  }>;
} | null | undefined) {
  if (!confidenceRecovery) {
    return nothing;
  }

  return html`
    <section class="panel warning">
      <h3>Confidence recovery follow-up</h3>
      <p>${confidenceRecovery.summary}</p>
      <p class="muted">${confidenceRecovery.confidenceLift}</p>
      <ul>
        ${confidenceRecovery.requestedInputs.map((entry) => html`
          <li>
            <strong>${entry.field}</strong>: ${entry.question}
            <div class="muted">${entry.whyItMatters}</div>
            <div class="muted">Example: ${entry.exampleAnswer ?? "n/a"}</div>
          </li>
        `)}
      </ul>
    </section>
  `;
}

export function renderGapRadar(gapRadar: {
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
  if (!gapRadar) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Gap Radar</h3>
      <p>${gapRadar.summary}</p>
      <ul>
        ${gapRadar.suggestions.map((entry) => html`
          <li>
            <strong>${entry.targetLaneId}</strong> | ${entry.confidence} confidence | ${entry.evidenceCount} events
            <div>${entry.summary}</div>
            <div class="muted">${entry.recommendedChange}</div>
            <div class="muted">Signals: ${entry.signalTokens.join(", ") || "none"} | related open gap: ${entry.relatedOpenGapId ?? "n/a"} | suggested priority: ${entry.suggestedPriority}</div>
          </li>
        `)}
      </ul>
    </section>
  `;
}

export function renderEarnedAutonomy(earnedAutonomy: {
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
  if (!earnedAutonomy) {
    return nothing;
  }

  return html`
    <section class=${earnedAutonomy.approvalReductionApplied ? "panel good" : "panel"}>
      <h3>Earned Autonomy</h3>
      <div class="muted">score ${earnedAutonomy.overallScore}/100 | evidence ${earnedAutonomy.evidenceCount} | route class ${earnedAutonomy.routeClass}</div>
      <p>${earnedAutonomy.summary}</p>
      <ul>
        <li>Operator agreement: ${earnedAutonomy.operatorAgreementRate == null ? "n/a" : `${Math.round(earnedAutonomy.operatorAgreementRate * 100)}%`}</li>
        <li>Review clear rate: ${earnedAutonomy.reviewClearRate == null ? "n/a" : `${Math.round(earnedAutonomy.reviewClearRate * 100)}%`}</li>
        <li>Reversal count: ${earnedAutonomy.reversalCount}</li>
        <li>Auto-approval eligible: ${earnedAutonomy.autoApprovalEligible ? "yes" : "no"}</li>
        <li>Approval reduction applied: ${earnedAutonomy.approvalReductionApplied ? "yes" : "no"}</li>
      </ul>
      ${earnedAutonomy.rationale.length > 0 ? html`
        <h4>Why</h4>
        <ul>${earnedAutonomy.rationale.map((entry) => html`<li>${entry}</li>`)}</ul>
      ` : nothing}
    </section>
  `;
}

export function renderMissionHealth(missionHealth: {
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
  if (!missionHealth) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Mission Health</h3>
      <div class="muted">score ${missionHealth.overallScore}/100 | grade ${missionHealth.healthGrade}</div>
      <ul>
        <li>Objective specificity: ${missionHealth.objectiveSpecificityScore}/5</li>
        <li>Usefulness quality: ${missionHealth.usefulnessSignalQualityScore}/5</li>
        <li>Constraint quality: ${missionHealth.constraintQualityScore}/5</li>
        <li>Lane clarity: ${missionHealth.lanePriorityClarityScore}/5</li>
        <li>Over-match risk: ${missionHealth.overmatchRiskScore}/5</li>
        <li>Staleness risk: ${missionHealth.stalenessRiskScore}/5</li>
      </ul>
      ${missionHealth.warnings.length > 0 ? html`<ul>${missionHealth.warnings.map((entry) => html`<li>${entry}</li>`)}</ul>` : nothing}
      ${missionHealth.tensionSignals.length > 0 ? html`<ul>${missionHealth.tensionSignals.map((entry) => html`<li>${entry}</li>`)}</ul>` : nothing}
      ${missionHealth.suggestedObjectiveRewrite ? html`<p>${missionHealth.suggestedObjectiveRewrite}</p>` : nothing}
    </section>
  `;
}

export function renderFollowUpQuestions(followUpQuestions: {
  summary: string;
  questions: Array<{
    field: string;
    question: string;
    whyItMatters: string;
    exampleAnswer: string | null;
    predictedEffect: string;
  }>;
} | null | undefined) {
  if (!followUpQuestions) {
    return nothing;
  }

  return html`
    <section class="panel warning">
      <h3>Active Follow-Up Questions</h3>
      <p>${followUpQuestions.summary}</p>
      <ul>
        ${followUpQuestions.questions.map((entry) => html`
          <li>
            <strong>${entry.field}</strong>: ${entry.question}
            <div class="muted">${entry.whyItMatters}</div>
            <div class="muted">Effect: ${entry.predictedEffect}</div>
            <div class="muted">Example: ${entry.exampleAnswer ?? "n/a"}</div>
          </li>
        `)}
      </ul>
    </section>
  `;
}

export function renderSourceMemory(sourceMemory: {
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
  if (!sourceMemory) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Source Memory</h3>
      <p>${sourceMemory.summary}</p>
      <div class="muted">
        Bias: ${Object.entries(sourceMemory.biasAdjustments).map(([lane, score]) => `${lane} ${score >= 0 ? "+" : ""}${score}`).join(" | ")}
      </div>
      ${sourceMemory.matchingTopics.length > 0 ? html`
        <ul>${sourceMemory.matchingTopics.map((entry) => html`<li>${entry.token}: ${entry.recentCount} recent / ${entry.totalCount} total, dominant lane ${entry.dominantLaneId}</li>`)}</ul>
      ` : nothing}
    </section>
  `;
}

export function renderSourceSimilarity(sourceSimilarity: {
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
  if (!sourceSimilarity) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Source Similarity</h3>
      <p>${sourceSimilarity.summary}</p>
      <ul>
        ${sourceSimilarity.relatedSources.map((entry) => html`
          <li>
            <strong>${entry.candidateName}</strong> | ${entry.laneId} | ${entry.similarityScore}% similarity
            <div class="muted">Shared tokens: ${entry.sharedTokens.join(", ") || "none"}</div>
            <div class="muted">
              <a
                href=${`/engine-runs/${encodeURIComponent(entry.runId)}`}
                @click=${(event: Event) => {
                  event.preventDefault();
                  navTo(`/engine-runs/${encodeURIComponent(entry.runId)}`);
                }}
              >
                Open related run
              </a>
            </div>
          </li>
        `)}
      </ul>
    </section>
  `;
}

export function renderNarrativeContext(narrativeContext: {
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
  if (!narrativeContext) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Narrative Threading</h3>
      <p>${narrativeContext.summary}</p>
      <div class="muted">
        Bias: ${Object.entries(narrativeContext.biasAdjustments).map(([lane, score]) => `${lane} ${score >= 0 ? "+" : ""}${score}`).join(" | ")}
      </div>
      ${narrativeContext.primaryThread ? html`
        <ul>
          <li>Primary thread: ${narrativeContext.primaryThread.name}</li>
          <li>State: ${narrativeContext.primaryThread.state}</li>
          <li>Lane tendency: ${narrativeContext.primaryThread.laneTendency.dominantLaneId} (${narrativeContext.primaryThread.laneTendency.dominancePercent}%)</li>
          <li>Follow-through: ${narrativeContext.primaryThread.followThrough.followThroughRate}% (${narrativeContext.primaryThread.followThrough.completedProofCount} completed / ${narrativeContext.primaryThread.followThrough.stalledProofCount} stalled)</li>
          <li>Gap coverage: ${narrativeContext.primaryThread.gapCoverage.dominantGapId ?? "n/a"} | ${narrativeContext.primaryThread.gapCoverage.status}</li>
        </ul>
      ` : nothing}
      ${narrativeContext.demandSignals.length > 0 ? html`
        <h4>Thread demand</h4>
        <ul>${narrativeContext.demandSignals.map((entry) => html`<li>${entry.priority}: ${entry.summary}</li>`)}</ul>
      ` : nothing}
      ${narrativeContext.relatedThreads.length > 0 ? html`
        <h4>Related threads</h4>
        <ul>
          ${narrativeContext.relatedThreads.map((entry) => html`
            <li>
              <strong>${entry.name}</strong> | ${entry.state} | ${entry.currentSourceOverlap} shared tokens | ${entry.laneTendency.dominantLaneId} ${entry.laneTendency.dominancePercent}%
            </li>
          `)}
        </ul>
      ` : nothing}
    </section>
  `;
}

export function renderLaneProportions(
  laneProportions: Record<string, number> | null | undefined,
  secondaryLanes: Array<{ laneId: string; proportion: number; reason: string }> | null | undefined,
) {
  if (!laneProportions) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Lane Proportions</h3>
      <div class="muted">
        ${Object.entries(laneProportions).map(([lane, value]) => `${lane} ${value}%`).join(" | ")}
      </div>
      ${secondaryLanes && secondaryLanes.length > 0 ? html`
        <ul>${secondaryLanes.map((entry) => html`<li>${entry.laneId}: ${entry.proportion}% - ${entry.reason}</li>`)}</ul>
      ` : nothing}
    </section>
  `;
}

export function renderPriorPlanContext(priorPlanContext: {
  routeClass: string;
  summary: string;
  matchingRunCount: number;
  successfulFollowThroughCount: number;
  stalledRunCount: number;
  recurringImprovementGoals: string[];
  recurringProofKinds: Array<{ proofKind: string; count: number; status: "successful" | "stalled" | "mixed" }>;
  adaptationPatterns: Array<{ directiveOwnedForm: string; count: number; successfulCount: number; stalledCount: number }>;
  relatedRunIds: string[];
} | null | undefined) {
  if (!priorPlanContext) {
    return nothing;
  }

  return html`
    <section class="panel">
      <h3>Prior Plan Context</h3>
      <p>${priorPlanContext.summary}</p>
      <ul>
        <li>Route class: ${priorPlanContext.routeClass}</li>
        <li>Matching runs: ${priorPlanContext.matchingRunCount}</li>
        <li>Successful follow-through: ${priorPlanContext.successfulFollowThroughCount}</li>
        <li>Stalled runs: ${priorPlanContext.stalledRunCount}</li>
      </ul>
      ${priorPlanContext.recurringImprovementGoals.length > 0 ? html`<ul>${priorPlanContext.recurringImprovementGoals.map((entry) => html`<li>${entry}</li>`)}</ul>` : nothing}
    </section>
  `;
}

export function renderRoutingExplanationBreakdown(detail: FrontendDiscoveryRoutingDetail | null | undefined) {
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
