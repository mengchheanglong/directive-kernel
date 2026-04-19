import { html, nothing } from "lit";

import type {
  FrontendEngineRunDetail,
  FrontendEngineRunRecord,
  FrontendEngineRunsOverview,
  FrontendGapPressureDetail,
  FrontendHandoffStub,
  FrontendOperatorDecisionInboxReport,
  FrontendQueueEntry,
  FrontendQueueOverview,
} from "../types/index.ts";
import { navTo } from "../app-utils.ts";

type QueuePageRendererContext = {
  submitting: boolean;
  renderQueueStat: (label: string, value: number, description: string) => unknown;
  renderRuntimeCaseStrip: (entry: FrontendQueueEntry) => unknown;
  renderQueueCard: (
    entry: FrontendQueueEntry,
    run: FrontendEngineRunRecord | undefined,
    handoffPath: string | null,
  ) => unknown;
  submitDiscoveryFrontDoor: (form: HTMLFormElement) => Promise<void>;
};

type EngineRunDetailRendererContext = {
  artifactLink: (pathValue: string | null | undefined) => unknown;
  renderGapPressureSummary: (gapPressure: FrontendGapPressureDetail | null | undefined) => unknown;
  renderRoutingDigest: (digest: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { digest?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderConfidenceRecovery: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { confidenceRecovery?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderFollowUpQuestions: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { followUpQuestions?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderMissionHealth: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { missionHealth?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderSourceMemory: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { sourceMemory?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderSourceSimilarity: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { sourceSimilarity?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderNarrativeContext: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { narrativeContext?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderLaneProportions: (
    laneProportions: Record<string, number> | null | undefined,
    secondaryLanes: Array<{ laneId: string; proportion: number; reason: string; }> | null | undefined,
  ) => unknown;
  renderGapRadar: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { gapRadar?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderEarnedAutonomy: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { earnedAutonomy?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderGoalCopilot: (value: FrontendEngineRunRecord["routingAssessment"] extends infer T ? T extends { goalCopilot?: infer D } ? D | null | undefined : null | undefined : null | undefined) => unknown;
  renderPriorPlanContext: (value: FrontendEngineRunRecord["priorPlanContext"] | null | undefined) => unknown;
};

export function renderEngineRunsPage(overview: FrontendEngineRunsOverview) {
  return html`<section class="panel"><h2>Engine runs</h2><table><thead><tr><th>run id</th><th>candidate</th><th>lane</th><th>usefulness</th><th>review pressure</th><th>decision</th><th>created</th></tr></thead><tbody>
    ${overview.recentRuns.length ? overview.recentRuns.map((run) => {
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

function renderExecutablePlanState(
  record: FrontendEngineRunRecord,
) {
  const state = record.executablePlanState;
  if (!state?.actions?.length) {
    return nothing;
  }

  const actionById = new Map(state.actions.map((action) => [action.actionId, action]));
  const nextActions = state.nextActionIds
    .map((actionId) => actionById.get(actionId) ?? null)
    .filter((action): action is NonNullable<typeof action> => Boolean(action));
  const blockedActions = state.blockedActionIds
    .map((actionId) => actionById.get(actionId) ?? null)
    .filter((action): action is NonNullable<typeof action> => Boolean(action));
  const pendingActionCount = state.actions.filter((action) =>
    action.status !== "completed" && action.status !== "skipped"
  ).length;

  return html`
    <section class="panel">
      <h3>Executable plan state</h3>
      <div class="queue-summary-grid">
        <section class="queue-highlight">
          <div class="queue-count">${state.completionRate}%</div>
          <h4>Completion</h4>
          <p class="muted">Structured plan progress rolled up into executable action state.</p>
        </section>
        <section class="queue-highlight">
          <div class="queue-count">${pendingActionCount}</div>
          <h4>Pending actions</h4>
          <p class="muted">Actions not yet completed or skipped.</p>
        </section>
        <section class="queue-highlight">
          <div class="queue-count">${blockedActions.length}</div>
          <h4>Blocked actions</h4>
          <p class="muted">Actions waiting on other steps or proof gates.</p>
        </section>
        <section class="queue-highlight">
          <div class="queue-count">${nextActions.length}</div>
          <h4>Next actions</h4>
          <p class="muted">Current frontier exposed by the executable plan.</p>
        </section>
      </div>
      <div class="queue-kv-grid">
        <div><h4>Proof final state</h4><p>${state.proofState.finalState}</p></div>
        <div><h4>Objective state</h4><p>${state.proofState.objectiveState}</p></div>
        <div><h4>Evidence state</h4><p>${state.proofState.evidenceState}</p></div>
        <div><h4>Gate state</h4><p>${state.proofState.gateState}</p></div>
      </div>
      ${state.rationale.length
        ? html`<p class="muted">${state.rationale.join(" ")}</p>`
        : nothing}
      <section class="queue-highlight">
        <h4>Next executable actions</h4>
        ${nextActions.length
          ? html`<ul>${nextActions.map((action) => html`
            <li>
              <strong>${action.title}</strong> (${action.plan} / ${action.owner} / ${action.status})
              ${action.detail ? html`<div class="muted">${action.detail}</div>` : nothing}
            </li>
          `)}</ul>`
          : html`<p class="muted">No next actions are currently exposed.</p>`}
      </section>
      <section class="queue-highlight">
        <h4>Blocked executable actions</h4>
        ${blockedActions.length
          ? html`<ul>${blockedActions.map((action) => html`
            <li>
              <strong>${action.title}</strong> (${action.plan} / ${action.owner} / ${action.status})
              ${action.blockedByActionIds.length
                ? html`<div class="muted">Blocked by: ${action.blockedByActionIds.join(", ")}</div>`
                : nothing}
            </li>
          `)}</ul>`
          : html`<p class="muted">No blocked actions are currently recorded.</p>`}
      </section>
    </section>
  `;
}

export function renderEngineRunDetailPage(
  detail: FrontendEngineRunDetail,
  queue: FrontendQueueOverview,
  handoffs: FrontendHandoffStub[],
  context: EngineRunDetailRendererContext,
) {
  if (!detail.ok || !detail.record) return html`<section class="panel warning"><h2>Run not found</h2><pre>${detail.error ?? "run_not_found"}</pre></section>`;
  const record = detail.record;
  const queueEntry = (queue.entries || []).find((entry) => entry.candidate_id === record.candidate.candidateId) ?? null;
  const relatedHandoffs = (handoffs || []).filter((stub) => stub.candidateId === record.candidate.candidateId);
  const noDownstream = queueEntry && !queueEntry.result_record_path
    ? "No downstream handoff was materialized from this path yet. This run either stayed in Discovery or still requires explicit review before a lane-native stub can open."
    : "";
  return html`
    <section class="panel"><h2>Engine run detail</h2><table><tbody>
      <tr><th>run id</th><td>${record.runId}</td></tr>
      <tr><th>candidate</th><td>${record.candidate.candidateName}</td></tr>
      <tr><th>lane</th><td><span class="pill">${record.selectedLane.laneId}</span></td></tr>
      <tr><th>usefulness level</th><td>${record.candidate.usefulnessLevel}</td></tr>
      <tr><th>usefulness rationale</th><td>${record.analysis.usefulnessRationale}</td></tr>
      <tr><th>routing confidence</th><td>${record.routingAssessment?.confidence ?? record.candidate.confidence ?? "n/a"}</td></tr>
      <tr><th>routing digest</th><td>${record.routingAssessment?.digest?.headline ?? "n/a"}</td></tr>
      <tr><th>matched capability gap</th><td>${record.routingAssessment?.matchedGapId ?? "n/a"}</td></tr>
      <tr><th>gap pressure</th><td>${context.renderGapPressureSummary(detail.gapPressure)}</td></tr>
      <tr><th>gap alignment score</th><td>${detail.gapPressure?.gapAlignmentScore ?? "n/a"}</td></tr>
      <tr><th>open gaps considered</th><td>${detail.gapPressure?.openGapCount ?? "n/a"}</td></tr>
      <tr><th>gap mission objective</th><td>${detail.gapPressure?.relatedMissionObjective ?? "n/a"}</td></tr>
      <tr><th>route conflict</th><td>${record.routingAssessment?.routeConflict === undefined ? "n/a" : record.routingAssessment?.routeConflict ? "yes" : "no"}</td></tr>
      <tr><th>needs human review</th><td>${record.routingAssessment?.needsHumanReview === undefined ? (record.candidate.requiresHumanReview === undefined ? "n/a" : record.candidate.requiresHumanReview ? "yes" : "no") : record.routingAssessment?.needsHumanReview ? "yes" : "no"}</td></tr>
      <tr><th>mission specificity warning</th><td>${record.routingAssessment?.missionSpecificityWarning ?? "n/a"}</td></tr>
      <tr><th>Mission Health</th><td>${record.routingAssessment?.missionHealth ? `${record.routingAssessment.missionHealth.overallScore}/100 | ${record.routingAssessment.missionHealth.healthGrade}` : "n/a"}</td></tr>
      <tr><th>Goal Copilot score</th><td>${record.routingAssessment?.goalCopilot ? `${record.routingAssessment.goalCopilot.overallScore}/100` : "n/a"}</td></tr>
      <tr><th>active follow-up questions</th><td>${record.routingAssessment?.followUpQuestions?.summary ?? "n/a"}</td></tr>
      <tr><th>Source Memory</th><td>${record.routingAssessment?.sourceMemory?.summary ?? "n/a"}</td></tr>
      <tr><th>Source Similarity</th><td>${record.routingAssessment?.sourceSimilarity?.summary ?? "n/a"}</td></tr>
      <tr><th>Narrative Threading</th><td>${record.routingAssessment?.narrativeContext?.summary ?? "n/a"}</td></tr>
      <tr><th>lane proportions</th><td>${record.routingAssessment?.laneProportions ? Object.entries(record.routingAssessment.laneProportions).map(([lane, value]) => `${lane} ${value}%`).join(" | ") : "n/a"}</td></tr>
      <tr><th>Gap Radar</th><td>${record.routingAssessment?.gapRadar?.summary ?? "n/a"}</td></tr>
      <tr><th>ambiguity summary</th><td>${record.routingAssessment?.ambiguitySummary
        ? `${record.routingAssessment.ambiguitySummary.topLaneId} over ${record.routingAssessment.ambiguitySummary.runnerUpLaneId ?? "none"} by ${record.routingAssessment.ambiguitySummary.scoreDelta}; conflicting signals: ${record.routingAssessment.ambiguitySummary.conflictingSignalFamilies.join(", ") || "none"}`
        : "n/a"}</td></tr>
      <tr><th>review guidance</th><td>${record.routingAssessment?.reviewGuidance?.summary ?? "n/a"}</td></tr>
      <tr><th>confidence recovery</th><td>${record.routingAssessment?.confidenceRecovery?.summary ?? "n/a"}</td></tr>
      <tr><th>Earned Autonomy</th><td>${record.routingAssessment?.earnedAutonomy ? `${record.routingAssessment.earnedAutonomy.overallScore}/100 | ${record.routingAssessment.earnedAutonomy.summary}` : "n/a"}</td></tr>
      <tr><th>prior plan context</th><td>${record.priorPlanContext?.summary ?? "n/a"}</td></tr>
      <tr><th>decision state</th><td>${record.decision.decisionState}</td></tr>
      <tr><th>proof kind</th><td>${record.proofPlan.proofKind}</td></tr>
      <tr><th>proof state</th><td>${record.executablePlanState?.proofState.finalState ?? "n/a"}</td></tr>
      <tr><th>plan completion</th><td>${record.executablePlanState ? `${record.executablePlanState.completionRate}%` : "n/a"}</td></tr>
      <tr><th>next executable actions</th><td>${record.executablePlanState?.nextActionIds.length ?? 0}</td></tr>
      <tr><th>integration mode</th><td>${record.integrationProposal.integrationMode}</td></tr>
      <tr><th>report summary</th><td>${record.reportPlan.summary}</td></tr>
      <tr><th>record path</th><td>${context.artifactLink(detail.recordPath)}</td></tr>
      <tr><th>report path</th><td>${context.artifactLink(detail.reportPath)}</td></tr>
    </tbody></table></section>
    ${context.renderRoutingDigest(record.routingAssessment?.digest)}
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
    ${context.renderConfidenceRecovery(record.routingAssessment?.confidenceRecovery)}
    ${context.renderFollowUpQuestions(record.routingAssessment?.followUpQuestions)}
    ${context.renderMissionHealth(record.routingAssessment?.missionHealth)}
    ${context.renderSourceMemory(record.routingAssessment?.sourceMemory)}
    ${context.renderSourceSimilarity(record.routingAssessment?.sourceSimilarity)}
    ${context.renderNarrativeContext(record.routingAssessment?.narrativeContext)}
    ${context.renderLaneProportions(record.routingAssessment?.laneProportions, record.routingAssessment?.secondaryLanes)}
    ${context.renderGapRadar(record.routingAssessment?.gapRadar)}
    ${context.renderEarnedAutonomy(record.routingAssessment?.earnedAutonomy)}
    ${context.renderGoalCopilot(record.routingAssessment?.goalCopilot)}
    ${context.renderPriorPlanContext(record.priorPlanContext)}
    ${renderExecutablePlanState(record)}
    <section class=${noDownstream ? "panel warning" : "panel message"}>
      <h3>Related queue and handoff state</h3>
      <div class="muted">queue status: ${queueEntry?.status ?? "n/a"} | routing target: ${queueEntry?.routing_target ?? "n/a"}</div>
      <div class="muted">first downstream stub: ${queueEntry?.result_record_path ?? "n/a"}</div>
      <div class="muted">current case stage: ${queueEntry?.current_case_stage ?? "n/a"} | integrity: ${queueEntry?.integrity_state ?? "n/a"}</div>
      <div class="muted">current live artifact: ${queueEntry?.current_head ? html`<a href=${queueEntry.current_head.view_path} @click=${(event: Event) => { event.preventDefault(); navTo(queueEntry.current_head?.view_path || ""); }}>${queueEntry.current_head.artifact_path}</a>` : "n/a"}</div>
      <div class="muted">current live artifact stage: ${queueEntry?.current_head?.artifact_stage ?? "n/a"}</div>
      <div class="muted">continue from here: ${queueEntry?.current_case_next_legal_step ?? "n/a"}</div>
      ${relatedHandoffs.length ? html`<ul>${relatedHandoffs.map((stub) => html`<li><a href=${`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(stub.relativePath)}`); }}>${stub.title}</a></li>`)}</ul>` : html`<div class="muted">No routed handoff stub found for this run.</div>`}
      ${noDownstream ? html`<p>${noDownstream}</p>` : nothing}
    </section>
    <section class="panel"><h3>Paired markdown report</h3><pre>${detail.reportContent ?? detail.reportExcerpt ?? "No report content."}</pre></section>
  `;
}

export function renderQueuePage(
  queue: FrontendQueueOverview,
  runs: FrontendEngineRunsOverview,
  handoffs: FrontendHandoffStub[],
  context: QueuePageRendererContext,
) {
  const runByCandidateId = new Map<string, FrontendEngineRunRecord>(
    (runs.recentRuns || []).map((run) => [run.record.candidate.candidateId, run.record]),
  );
  const handoffByCandidateId = new Map<string, FrontendHandoffStub>(
    (handoffs || []).map((stub) => [stub.candidateId, stub]),
  );
  const entries = queue.entries || [];
  const runtimeEntries = entries.filter((entry) => entry.current_head?.artifact_lane === "runtime" || entry.routing_target === "runtime");
  const architectureEntries = entries.filter((entry) => entry.current_head?.artifact_lane === "architecture" || entry.routing_target === "architecture");
  const closedEntries = entries.filter((entry) => (entry.current_case_stage || "").endsWith(".keep"));
  const pendingActionEntries = entries.filter((entry) => Boolean(entry.current_case_next_legal_step && !entry.current_case_next_legal_step.startsWith("No automatic")));
  const openmossEntry = entries.find((entry) => entry.candidate_name === "OpenMOSS");
  return html`
    <section class="panel">
      <h2>Discovery queue</h2>
      <p class="muted">Directive Kernel uses this queue as the live front door into Discovery, Architecture, and Runtime. The product surface now emphasizes current heads, current case stage, and the next legal step instead of treating queue state like a raw spreadsheet.</p>

      <section class="queue-highlight">
        <h3>Submit a source</h3>
        <p class="muted">This sends a source through the Engine-backed Discovery front door. Leave candidate id blank to derive it from the candidate name automatically.</p>
        <form @submit=${async (event: Event) => {
          event.preventDefault();
          await context.submitDiscoveryFrontDoor(event.currentTarget as HTMLFormElement);
        }}>
          <div class="form-grid">
            <div class="row">
              <label>Candidate name</label>
              <input name="candidate_name" placeholder="Bounded Runtime Planning Paper" ?disabled=${context.submitting} />
            </div>
            <div class="row">
              <label>Candidate id</label>
              <input name="candidate_id" placeholder="optional-auto-slug" ?disabled=${context.submitting} />
            </div>
            <div class="row">
              <label>Source type</label>
              <select name="source_type" ?disabled=${context.submitting}>
                <option value="internal-signal">internal-signal</option>
                <option value="workflow-writeup">workflow-writeup</option>
                <option value="paper">paper</option>
                <option value="product-doc">product-doc</option>
                <option value="technical-essay">technical-essay</option>
                <option value="github-repo">github-repo</option>
                <option value="external-system">external-system</option>
                <option value="theory">theory</option>
              </select>
            </div>
            <div class="row">
              <label>Primary adoption target</label>
              <select name="primary_adoption_target" ?disabled=${context.submitting}>
                <option value="">auto</option>
                <option value="discovery">discovery</option>
                <option value="architecture">architecture</option>
                <option value="runtime">runtime</option>
              </select>
            </div>
          </div>
          <div class="row">
            <label>Source reference</label>
            <input name="source_reference" placeholder="https://example.com/source" ?disabled=${context.submitting} />
          </div>
          <div class="form-grid">
            <div class="row">
              <label>Capability gap id</label>
              <input name="capability_gap_id" placeholder="optional-gap-id" ?disabled=${context.submitting} />
            </div>
            <div class="row">
              <label>Workflow boundary shape</label>
              <select name="workflow_boundary_shape" ?disabled=${context.submitting}>
                <option value="">auto</option>
                <option value="bounded_protocol">bounded_protocol</option>
                <option value="iterative_loop">iterative_loop</option>
              </select>
            </div>
          </div>
          <div class="row">
            <label>Mission alignment</label>
            <textarea name="mission_alignment" placeholder="What problem this source helps solve under the active mission." ?disabled=${context.submitting}></textarea>
          </div>
          <div class="row">
            <label>Notes</label>
            <textarea name="notes" placeholder="Optional intake notes." ?disabled=${context.submitting}></textarea>
          </div>
          <div class="checkbox-grid">
            <label class="checkbox-row"><input type="checkbox" name="contains_executable_code" ?disabled=${context.submitting} />Executable code present</label>
            <label class="checkbox-row"><input type="checkbox" name="contains_workflow_pattern" ?disabled=${context.submitting} checked />Workflow pattern present</label>
            <label class="checkbox-row"><input type="checkbox" name="improves_directive_workspace" ?disabled=${context.submitting} />Improves Directive Workspace itself</label>
          </div>
          <div class="actions">
            <button type="submit" ?disabled=${context.submitting}>${context.submitting ? "Submitting..." : "Submit through front door"}</button>
          </div>
        </form>
      </section>

      <section class="queue-summary-grid">
        ${context.renderQueueStat("Total queue entries", entries.length, "All persisted Discovery queue cases visible to the product UI.")}
        ${context.renderQueueStat("Runtime-tracked cases", runtimeEntries.length, "Cases whose current head or route is now in the Runtime lane.")}
        ${context.renderQueueStat("Architecture-tracked cases", architectureEntries.length, "Cases whose current head or route is now in the Architecture lane.")}
        ${context.renderQueueStat("Cases with live next steps", pendingActionEntries.length, "Entries that still expose an explicit continue-from-here action in current truth.")}
      </section>

      ${openmossEntry ? context.renderRuntimeCaseStrip(openmossEntry) : nothing}

      ${entries.length
        ? html`<section class="queue-card-list">
            ${entries.map((entry) => {
              const run = runByCandidateId.get(entry.candidate_id);
              const handoff = handoffByCandidateId.get(entry.candidate_id);
              const handoffPath = entry.result_record_path ?? handoff?.relativePath ?? null;
              return context.renderQueueCard(entry, run, handoffPath);
            })}
          </section>`
        : html`<div class="queue-empty muted">No queue entries found.</div>`}

      ${closedEntries.length
        ? html`<p class="muted" style="margin-top:16px;">${closedEntries.length} queue case${closedEntries.length === 1 ? "" : "s"} already resolve to an explicit keep state. They remain visible here as history, but not as open work by default.</p>`
        : nothing}
    </section>
  `;
}
