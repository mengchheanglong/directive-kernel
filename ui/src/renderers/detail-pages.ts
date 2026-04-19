import { html, nothing } from "lit";

import { artifactPathToViewPath, navTo } from "../app-utils.ts";

export function renderResidualDetailPage(page: any, context: any) {
  switch (page.kind) {
    case "handoff-detail": {
      const detail = page.data;
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
            <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? context.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
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
                  ? html`<button @click=${() => context.approveRuntimeFollowUp(detail.relativePath || "")}>Approve capability record</button>`
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
            <tr><th>re-entry contract</th><td>${context.artifactLink(detail.reentryContractPath)}</td></tr>
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
            <tr><th>originating Architecture record</th><td>${context.artifactLink(detail.originatingArchitectureRecordPath)}</td></tr>
            <tr><th>mixed-value partition ref</th><td>${context.artifactLink(detail.mixedValuePartitionRef)}</td></tr>
            <tr><th>Runtime follow-up</th><td>${context.artifactLink(detail.runtimeFollowUpPath)}</td></tr>
            <tr><th>capability record</th><td>${context.artifactLink(detail.runtimeRecordPath)}</td></tr>
            <tr><th>proof artifact</th><td>${context.artifactLink(detail.runtimeProofPath)}</td></tr>
            <tr><th>promotion record</th><td>${context.artifactLink(detail.promotionRecordPath)}</td></tr>
            <tr><th>registry entry</th><td>${context.artifactLink(detail.registryEntryPath)}</td></tr>
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
          <tr><th>Engine run record</th><td>${artifact.engineRunRecordPath ? context.artifactLink(artifact.engineRunRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>Engine run report</th><td>${artifact.engineRunReportPath ? context.artifactLink(artifact.engineRunReportPath) : html`<span class="muted">not resolved</span>`}</td></tr>
          <tr><th>Discovery routing record</th><td>${artifact.discoveryRoutingRecordPath ? context.artifactLink(artifact.discoveryRoutingRecordPath) : html`<span class="muted">not resolved</span>`}</td></tr>
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
          <div class="actions">${artifact.startExists && artifact.startRelativePath ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(artifact.startRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(artifact.startRelativePath)}`); }}>Open bounded start</a>` : html`<button @click=${() => context.startArchitecture(artifact.handoffRelativePath)}>Approve bounded start</button>`}</div>
        </section>
        <section class="panel"><h3>Raw handoff artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    case "runtime-record-detail": {
      const detail = page.data;
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
          <tr><th>source Runtime follow-up</th><td>${context.artifactLink(detail.linkedFollowUpRecord)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? context.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
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
                ? html`<button @click=${() => context.approveRuntimeRecordProof(detail.relativePath || "")}>Approve capability proof artifact</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw capability record</h3><pre>${detail.content}</pre></section>
      `;
    }

    case "runtime-proof-detail": {
      const detail = page.data;
      if (!detail.ok) return html`<section class="panel warning"><h2>Capability proof artifact not found</h2><pre>${detail.error}</pre></section>`;
      return html`
        <section class="panel"><h2>Capability proof artifact</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
          <tr><th>candidate id</th><td>${detail.candidateId}</td></tr>
          <tr><th>candidate name</th><td>${detail.candidateName}</td></tr>
          <tr><th>runtime objective</th><td>${detail.runtimeObjective}</td></tr>
          <tr><th>proposed host</th><td>${detail.proposedHost}</td></tr>
          <tr><th>proposed capability shape</th><td>${detail.proposedRuntimeSurface}</td></tr>
          <tr><th>current status</th><td>${detail.currentStatus}</td></tr>
          <tr><th>Legacy capability record</th><td>${context.artifactLink(detail.linkedRuntimeRecordPath)}</td></tr>
          <tr><th>source Runtime follow-up</th><td>${context.artifactLink(detail.linkedFollowUpPath)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? context.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
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
                ? html`<button @click=${() => context.approveRuntimeProofRuntimeCapabilityBoundary(detail.relativePath || "")}>Approve runtime capability boundary</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw capability proof artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    case "runtime-runtime-capability-boundary-detail": {
      const detail = page.data;
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
          <tr><th>Legacy capability record</th><td>${context.artifactLink(detail.linkedRuntimeRecordPath)}</td></tr>
          <tr><th>source Runtime follow-up</th><td>${context.artifactLink(detail.linkedFollowUpPath)}</td></tr>
          <tr><th>linked Discovery routing record</th><td>${detail.linkedRoutingPath ? context.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</td></tr>
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
                ? html`<button @click=${() => context.approveRuntimePromotionReadiness(detail.relativePath || "")}>Approve promotion-readiness artifact</button>`
                : nothing}
          </div>
        </section>
        <section class="panel"><h3>Raw runtime capability boundary</h3><pre>${detail.content}</pre></section>
      `;
    }

    case "runtime-promotion-readiness-detail": {
      const detail = page.data;
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
          <p>This is the current product-facing Runtime stop for Directive Kernel. The UI shows the live Runtime truth, but Runtime and Engine still own blocker judgment, progression rules, and any later implementation, integration, or execution work.</p>
          <div class="hero-meta">
            ${context.renderQueueTag(detail.currentStage || "runtime.promotion_readiness.opened", "runtime")}
            ${context.renderQueueTag(detail.currentStatus || "promotion_readiness_opened")}
            ${context.renderQueueTag(detail.proposedHost || "Directive Kernel web host", "runtime")}
          </div>
          <div class="muted mono" style="margin-top:10px;">${detail.relativePath}</div>
        </section>
        <section class="panel">
          <div class="seam-grid">
            <section class="seam-card"><h3>Current Runtime truth</h3><p class="seam-value">${detail.currentStage}</p><p class="muted" style="margin-top:8px;">${detail.nextLegalStep}</p></section>
            <section class="seam-card"><h3>Proposed host surface</h3><p class="seam-value">${detail.proposedHost}</p><p class="muted" style="margin-top:8px;">Directive Kernel web host is the active product surface for this phase. This page reads the live product state directly rather than mirroring a separate host UI.</p></section>
            <section class="seam-card"><h3>Runtime objective</h3><p class="seam-value">${detail.runtimeObjective}</p><p class="muted" style="margin-top:8px;">Proposed runtime surface: ${detail.proposedRuntimeSurface ?? "n/a"}</p></section>
            <section class="seam-card"><h3>Execution state</h3><p class="seam-value">${detail.executionState}</p><p class="muted" style="margin-top:8px;">Promotion-readiness decision: ${detail.promotionReadinessDecision ?? "n/a"}</p></section>
          </div>
        </section>
        <section class="grid">
          <section class="panel warning">
            <h3>Blocked seams</h3>
            ${blockers.length ? html`<ul>${blockers.map((blocker: string) => html`<li><code>${blocker}</code></li>`)}</ul>` : html`<p class="muted">No promotion-readiness blockers were recorded.</p>`}
            <p class="seam-note muted" style="margin-top:12px;">Host-facing promotion remains a reviewed but unopened seam. This page does not imply callable implementation, host integration, or execution are available.</p>
          </section>
          <section class="panel"><h3>What remains intentionally closed</h3><ul>${closedSeams.map((item) => html`<li>${item}</li>`)}</ul><p class="muted" style="margin-top:12px;">This page is for operator seam review, not for activating downstream Runtime behavior.</p></section>
        </section>
        <section class="panel good">
          <h3>Opened implementation slice</h3>
          <p>The first bounded Runtime-implementation slice is now explicit on the Directive Kernel web host: the host owns one implementation-bundle section for the OpenMOSS seam-review surface, while Runtime and Engine continue to own stage truth, blockers, legality, and downstream progression.</p>
          <div class="link-stack">
            <div><strong>Opened runtime-implementation slice:</strong> ${context.artifactLink(detail.openedRuntimeImplementationSlicePath)}</div>
            <div><strong>Pre-promotion implementation slice:</strong> ${context.artifactLink(detail.prePromotionImplementationSlicePath)}</div>
            <div><strong>Compile contract:</strong> ${context.artifactLink(detail.compileContractPath)}</div>
            <div><strong>Promotion-input package:</strong> ${context.artifactLink(detail.promotionInputPackagePath)}</div>
            <div><strong>Profile/checker decision:</strong> ${context.artifactLink(detail.profileCheckerDecisionPath)}</div>
            <div><strong>Promotion go/no-go decision:</strong> ${context.artifactLink(detail.promotionGoNoGoDecisionPath)}</div>
          </div>
          <p class="muted" style="margin-top:12px;">This remains non-promoting and non-executing. It makes the host-owned implementation boundary real without opening host-facing promotion, host integration, callable implementation, or runtime execution.</p>
        </section>
        <section class="panel">
          <h3>Artifact chain</h3>
          <div class="link-stack">
            <div><strong>Runtime capability boundary:</strong> <a href=${`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.linkedCapabilityBoundaryPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-runtime-capability-boundaries/view?path=${encodeURIComponent(detail.linkedCapabilityBoundaryPath || "")}`); }}>${detail.linkedCapabilityBoundaryPath}</a></div>
            <div><strong>Runtime proof artifact:</strong> <a href=${`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/runtime-proofs/view?path=${encodeURIComponent(detail.linkedRuntimeProofPath || "")}`); }}>${detail.linkedRuntimeProofPath}</a></div>
            <div><strong>Legacy Runtime record:</strong> ${context.artifactLink(detail.linkedRuntimeRecordPath)}</div>
            <div><strong>Source Runtime follow-up:</strong> ${context.artifactLink(detail.linkedFollowUpPath)}</div>
            <div><strong>Linked Discovery routing record:</strong> ${detail.linkedRoutingPath ? context.artifactLink(detail.linkedRoutingPath) : html`<span class="muted">n/a</span>`}</div>
          </div>
        </section>
        <section class="panel message">
          <h3>Directive Kernel product boundary</h3>
          <p>The Directive Kernel UI is the active review surface here. It exposes current stage, next legal step, proposed host, blockers, and linked artifacts, while Runtime and Engine continue to own all real gating and progression logic.</p>
          <p class="muted">DW UI capability: ${detail.frontendCapabilityDecision || "not explicitly recorded"} | host-facing promotion decision: ${detail.hostFacingPromotionDecision || "not explicitly recorded"}</p>
        </section>
        <section class="panel"><h3>Raw promotion-readiness artifact</h3><pre>${detail.content}</pre></section>
      `;
    }

    case "architecture-start":
    case "architecture-result":
    case "architecture-adoption":
    case "architecture-implementation-target":
    case "architecture-implementation-result":
    case "architecture-retained":
    case "architecture-integration-record":
    case "architecture-consumption-record":
    case "architecture-post-consumption-evaluation":
      return renderArchitectureResidualPage(page, context);

    case "artifact":
      return html`<section class="panel"><h2>Artifact view</h2><div class="muted mono">${page.data.relativePath}</div></section><section class="panel"><pre>${page.data.content}</pre></section>`;
    case "not-found":
      return html`<section class="panel warning"><h2>Not found</h2><p>${page.path}</p></section>`;
    default:
      return null;
  }
}

function renderArchitectureResidualPage(page: any, context: any) {
  const detail = page.data;
  if (!detail.ok) {
    const titleByKind: Record<string, string> = {
      "architecture-start": "Bounded start not found",
      "architecture-result": "Bounded result not found",
      "architecture-adoption": "Adoption artifact not found",
      "architecture-implementation-target": "Implementation target not found",
      "architecture-implementation-result": "Implementation result not found",
      "architecture-retained": "Retained artifact not found",
      "architecture-integration-record": "Integration record not found",
      "architecture-consumption-record": "Consumption record not found",
      "architecture-post-consumption-evaluation": "Post-consumption evaluation not found",
    };
    return html`<section class="panel warning"><h2>${titleByKind[page.kind] ?? "Artifact not found"}</h2><pre>${detail.error}</pre></section>`;
  }

  // Preserve the existing page behavior while moving it out of the shell.
  // The remaining architecture pages share the same shape: summary table, one bounded next-step form or action, raw artifact.
  if (page.kind === "architecture-start") {
    const assist = detail.closeoutAssist;
    const resultEvidence = detail.resultEvidence;
    return html`
      <section class="panel good"><h2>Architecture bounded start</h2><div class="muted mono">${detail.relativePath}</div><table><tbody><tr><th>candidate id</th><td>${detail.candidateId}</td></tr><tr><th>candidate name</th><td>${detail.candidateName}</td></tr><tr><th>objective</th><td>${detail.objective}</td></tr><tr><th>start approval</th><td>${detail.startApproval}</td></tr><tr><th>result summary</th><td>${detail.resultSummary}</td></tr><tr><th>handoff stub</th><td><a href=${`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/handoffs/view?path=${encodeURIComponent(detail.handoffStubPath || "")}`); }}>${detail.handoffStubPath}</a></td></tr><tr><th>bounded result</th><td>${detail.resultRelativePath ? html`<a href=${`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>Open bounded result</a>` : html`<span class="muted">not recorded yet</span>`}</td></tr></tbody></table></section>
      ${resultEvidence ? html`<section class=${resultEvidence.availability === "not_available" ? "panel message" : "panel good"}><h3>Result evidence</h3><p>${resultEvidence.summary}</p><table><tbody><tr><th>evidence kind</th><td>${resultEvidence.primaryKind}</td></tr><tr><th>availability</th><td>${resultEvidence.availability}</td></tr><tr><th>${resultEvidence.primaryLabel}</th><td>${resultEvidence.primaryPath ? html`<a href=${artifactPathToViewPath(resultEvidence.primaryPath)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(resultEvidence.primaryPath || "")); }}>${resultEvidence.primaryPath}</a>` : html`<span class="muted">not available</span>`}</td></tr></tbody></table>${resultEvidence.supportingEvidence.length > 0 ? html`<div class="panel" style="margin-top:12px;"><h4>Supporting evidence</h4><ul>${resultEvidence.supportingEvidence.map((item: { kind: string; path: string; label: string }) => html`<li>${item.label}: <a href=${artifactPathToViewPath(item.path)} @click=${(event: Event) => { event.preventDefault(); navTo(artifactPathToViewPath(item.path)); }}>${item.path}</a></li>`)}</ul></div>` : nothing}</section>` : nothing}
      ${assist ? html`<section class="panel message"><h3>Closeout assist</h3><p>Derived from the bounded start and linked Engine run. Review it, then keep the final closeout decision explicit.</p></section>` : nothing}
      <section class=${detail.resultRelativePath ? "panel good" : "panel message"}><h3>Bounded closeout</h3><p>${detail.resultRelativePath ? "A bounded Architecture result has been recorded for this start artifact." : "Execution still remains manual, but bounded result/closeout can now be recorded directly from this start artifact without rebuilding the context by hand again."}</p>${detail.resultRelativePath ? html`<div class="actions"><a href=${`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-results/view?path=${encodeURIComponent(detail.resultRelativePath || "")}`); }}>Open bounded result</a>${detail.decisionRelativePath ? html`<a href=${`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/artifacts?path=${encodeURIComponent(detail.decisionRelativePath || "")}`); }}>Open closeout decision JSON</a>` : nothing}</div>` : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.closeArchitectureStart(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="row"><label>result summary</label><textarea name="result_summary">${assist?.suggestedResultSummary || "Bounded Architecture slice clarified the next engine-owned adaptation target and should stay experimental until the product-owned implementation artifact is materialized."}</textarea></div><div class="row"><label>primary evidence path</label><input name="primary_evidence_path" placeholder="shared/lib/example.ts or architecture/.../artifact.md" /></div><div class="row"><label>transformed artifacts produced</label><textarea name="transformed_artifacts_produced" placeholder="One workspace-relative path per line when this slice actually materialized concrete artifacts. Leave blank when none were produced."></textarea></div><div class="grid"><div class="row"><label>next decision</label><select name="next_decision"><option value="needs-more-evidence">needs-more-evidence</option><option value="adopt">adopt</option><option value="defer">defer</option><option value="reject">reject</option></select></div><div class="row"><label>value shape</label><select name="value_shape"><option value="working_document">working_document</option><option value="design_pattern">design_pattern</option><option value="executable_logic">executable_logic</option><option value="behavior_rule">behavior_rule</option><option value="data_shape">data_shape</option><option value="interface_or_handoff">interface_or_handoff</option><option value="operating_model_change">operating_model_change</option></select></div><div class="row"><label>adaptation quality</label><select name="adaptation_quality"><option value="adequate">adequate</option><option value="strong">strong</option><option value="weak">weak</option><option value="skipped">skipped</option></select></div><div class="row"><label>improvement quality</label><select name="improvement_quality"><option value="skipped">skipped</option><option value="adequate">adequate</option><option value="strong">strong</option><option value="weak">weak</option></select></div></div><div class="actions"><label><input type="checkbox" name="proof_executed" /> proof executed</label><label><input type="checkbox" name="target_artifact_clarified" checked /> target artifact clarified</label><label><input type="checkbox" name="delta_evidence_present" checked /> delta evidence present</label><label><input type="checkbox" name="no_unresolved_baggage" /> unresolved baggage cleared</label><label><input type="checkbox" name="product_artifact_materialized" /> product artifact materialized</label><button type="submit">Record bounded closeout</button></div></form>`}</section>
      <section class="panel"><h3>Raw bounded-start artifact</h3><pre>${detail.content}</pre></section>
    `;
  }

  // The remaining architecture pages follow the same "summary + next step + raw artifact" model.
  // Keep them structurally out of the shell while preserving existing operator actions and links.
  const actionsByKind: Record<string, unknown> = {
    "architecture-result": detail.continuationStartRelativePath
      ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.continuationStartRelativePath || "")}`); }}>Open continuation start</a>`
      : detail.verdict === "stay_experimental" && detail.nextDecision === "needs-more-evidence"
        ? html`<button @click=${() => context.continueArchitectureResult(detail.relativePath || "")}>Open next bounded start</button>`
        : html`<span class="muted">Continuation not available.</span>`,
    "architecture-adoption": detail.implementationTargetRelativePath
      ? html`<a href=${`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-targets/view?path=${encodeURIComponent(detail.implementationTargetRelativePath || "")}`); }}>Open implementation target</a>`
      : html`<button @click=${() => context.createArchitectureImplementationTarget(detail.relativePath || "")}>Create Implementation Target</button>`,
    "architecture-implementation-target": detail.implementationResultRelativePath
      ? html`<a href=${`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-implementation-results/view?path=${encodeURIComponent(detail.implementationResultRelativePath || "")}`); }}>Open implementation result</a>`
      : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.completeArchitectureImplementation(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="row"><label>actual result summary</label><textarea name="result_summary">Bounded implementation slice completed the retained Architecture target and kept the materialization boundary explicit.</textarea></div><div class="grid"><div class="row"><label>outcome</label><select name="outcome"><option value="success">success</option><option value="failure">failure</option></select></div><div class="row"><label>validation result</label><input name="validation_result" value="Implementation stayed within the bounded target and remained aligned with the adopted artifact." /></div></div><div class="row"><label>deviations</label><textarea name="deviations"></textarea></div><div class="row"><label>evidence</label><textarea name="evidence"></textarea></div><div class="row"><label>rollback note</label><textarea name="rollback_note">Return to the implementation target artifact and adjust the bounded slice before attempting another completion.</textarea></div><div class="actions"><button type="submit">Complete Implementation</button></div></form>`,
    "architecture-implementation-result": detail.retainedRelativePath
      ? html`<a href=${`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-retained/view?path=${encodeURIComponent(detail.retainedRelativePath || "")}`); }}>Open retained artifact</a>`
      : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.confirmArchitectureRetention(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="row"><label>final usefulness assessment</label><textarea name="usefulness_assessment">This completed implementation result is worth retaining as Directive-owned Architecture output within the current bounded engine-improvement scope.</textarea></div><div class="grid"><div class="row"><label>stability level</label><select name="stability_level"><option value="bounded-stable">bounded-stable</option><option value="stable">stable</option><option value="provisional">provisional</option></select></div><div class="row"><label>reuse scope</label><input name="reuse_scope" value="Retain for Directive Kernel Architecture use within the current engine-improvement boundary." /></div></div><div class="row"><label>confirmation decision</label><textarea name="confirmation_decision">Retain this implementation result as valid Directive Kernel Architecture output for the current bounded scope.</textarea></div><div class="row"><label>rollback boundary</label><textarea name="rollback_boundary">If this retained output proves unstable or premature, return to the implementation result or implementation target and reopen a bounded Architecture slice.</textarea></div><div class="actions"><button type="submit">Confirm Retention</button></div></form>`,
    "architecture-retained": detail.integrationRecordRelativePath
      ? html`<a href=${`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-integration-records/view?path=${encodeURIComponent(detail.integrationRecordRelativePath || "")}`); }}>Open integration record</a>`
      : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.createArchitectureIntegrationRecord(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="row"><label>integration target/surface</label><textarea name="integration_target_surface">Directive Kernel engine-owned product logic within the current Architecture boundary.</textarea></div><div class="row"><label>readiness summary</label><textarea name="readiness_summary">This retained Architecture output is stable enough within the bounded scope to be recorded as integration-ready product input.</textarea></div><div class="row"><label>expected effect</label><textarea name="expected_effect">Directive Kernel can consume this retained output as an explicit engine-owned integration candidate without re-reading the prior Architecture chain.</textarea></div><div class="row"><label>validation boundary</label><textarea name="validation_boundary">Validate against the retained artifact, implementation result, and bounded source chain only; do not imply execution or downstream automation.</textarea></div><div class="row"><label>integration decision</label><textarea name="integration_decision">Record this retained output as integration-ready Directive Kernel Architecture output for the current bounded scope.</textarea></div><div class="row"><label>rollback boundary</label><textarea name="rollback_boundary">If this integration-ready record proves premature, fall back to the retained artifact and reopen a bounded Architecture slice before any further integration step.</textarea></div><div class="actions"><button type="submit">Create Integration Record</button></div></form>`,
    "architecture-integration-record": detail.consumptionRelativePath
      ? html`<a href=${`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-consumption-records/view?path=${encodeURIComponent(detail.consumptionRelativePath || "")}`); }}>Open consumption record</a>`
      : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.recordArchitectureConsumption(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="row"><label>where it was applied</label><textarea name="applied_surface">Directive Kernel engine-owned product logic within the current bounded Architecture surface.</textarea></div><div class="row"><label>application summary</label><textarea name="application_summary">This integration-ready Architecture output has now been explicitly consumed as engine-owned Directive Kernel product input within the bounded scope.</textarea></div><div class="row"><label>observed effect</label><textarea name="observed_effect">Directive Kernel now has an explicit applied-integration record for this retained Architecture output without re-reading the prior chain.</textarea></div><div class="grid"><div class="row"><label>outcome</label><select name="outcome"><option value="success">success</option><option value="failure">failure</option></select></div><div class="row"><label>validation result</label><input name="validation_result" value="Consumption stayed within the integration-ready boundary and remained linked to the retained Architecture chain." /></div></div><div class="row"><label>rollback note</label><textarea name="rollback_note">If this applied integration proves premature or inaccurate, fall back to the integration record and reopen a bounded Architecture review before any further step.</textarea></div><div class="actions"><button type="submit">Record Consumption</button></div></form>`,
    "architecture-consumption-record": detail.evaluationRelativePath
      ? html`<a href=${`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-post-consumption-evaluations/view?path=${encodeURIComponent(detail.evaluationRelativePath || "")}`); }}>Open evaluation</a>`
      : html`<form @submit=${(event: SubmitEvent) => { event.preventDefault(); void context.evaluateArchitectureConsumption(event.currentTarget as HTMLFormElement, detail.relativePath || ""); }}><div class="grid"><div class="row"><label>keep or reopen</label><select name="decision"><option value="keep">keep</option><option value="reopen">reopen</option></select></div><div class="row"><label>observed stability</label><input name="observed_stability" value="Observed behavior stayed stable within the applied integration boundary." /></div></div><div class="row"><label>rationale</label><textarea name="rationale">Real bounded use validated this applied Architecture output strongly enough to keep it as valid retained Directive Kernel Architecture output.</textarea></div><div class="row"><label>retained usefulness assessment</label><textarea name="retained_usefulness_assessment">The retained Architecture output still appears useful and valid after real bounded consumption.</textarea></div><div class="row"><label>next bounded action if reopen</label><textarea name="next_bounded_action">No reopen action required within the current bounded scope.</textarea></div><div class="row"><label>rollback note</label><textarea name="rollback_note">If this evaluation later proves inaccurate, return to the consumption record and reassess keep versus reopen before any further step.</textarea></div><div class="actions"><button type="submit">Evaluate After Use</button></div></form>`,
    "architecture-post-consumption-evaluation": detail.reopenedStartRelativePath
      ? html`<a href=${`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath)}`} @click=${(event: Event) => { event.preventDefault(); navTo(`/architecture-starts/view?path=${encodeURIComponent(detail.reopenedStartRelativePath || "")}`); }}>Open reopened start</a>`
      : detail.decision === "reopen"
        ? html`<button @click=${() => context.reopenArchitectureFromEvaluation(detail.relativePath || "")}>Reopen Architecture Work</button>`
        : html`<span class="muted">No reopen action is exposed for keep decisions.</span>`,
  };

  const titleByKind: Record<string, string> = {
    "architecture-result": "Architecture bounded result",
    "architecture-adoption": "Architecture adoption artifact",
    "architecture-implementation-target": "Architecture implementation target",
    "architecture-implementation-result": "Architecture implementation result",
    "architecture-retained": "Retained Architecture output",
    "architecture-integration-record": "Architecture integration record",
    "architecture-consumption-record": "Architecture consumption record",
    "architecture-post-consumption-evaluation": "Post-consumption evaluation",
  };

  return html`
    <section class="panel good"><h2>${titleByKind[page.kind] ?? "Architecture detail"}</h2><div class="muted mono">${detail.relativePath}</div><table><tbody>
      ${Object.entries(detail)
        .filter(([key, value]) => !["ok", "error", "content", "relativePath"].includes(key) && typeof value !== "object")
        .slice(0, 14)
        .map(([key, value]) => html`<tr><th>${key}</th><td>${String(value)}</td></tr>`)}
    </tbody></table></section>
    <section class="panel ${page.kind === "architecture-post-consumption-evaluation" && detail.decision === "reopen" ? "message" : "good"}">
      <h3>Next bounded step</h3>
      <div class="actions">${actionsByKind[page.kind] as any}</div>
    </section>
    <section class="panel"><h3>Raw artifact</h3><pre>${detail.content}</pre></section>
  `;
}
