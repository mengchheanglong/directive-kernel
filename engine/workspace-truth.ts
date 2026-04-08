export const DIRECTIVE_WORKSPACE_BLOCKED_ADVANCEMENT_MESSAGE =
  "No workflow advancement is legal until the broken or inconsistent artifact state is repaired and the anchor is rerun.";

export const DIRECTIVE_WORKSPACE_FIELD_INTERPRETATION = {
  artifactStage:
    "The stage represented by the inspected artifact itself. Use this to understand the local boundary and what that artifact directly authorizes next.",
  currentStage:
    "The latest reachable case state discovered from linked downstream artifacts. Use this to understand where the full case currently stands.",
  currentHead:
    "The derived current live artifact for the case. Use currentHead.artifactPath and currentHead.artifactStage to find the practical continuation point without treating the queue as workflow state.",
  artifactNextLegalStep:
    "The next legal step from the inspected artifact boundary only.",
  nextLegalStep:
    "The next legal step from the latest reachable case state only.",
  routeTarget:
    "When present, this is the original Discovery routing target for the case, not a claim that the currently inspected artifact belongs to that lane.",
} as const;

export const DIRECTIVE_WORKSPACE_LEGAL_NEXT_SEAMS = {
  discovery: [
    "Use the existing Discovery front door on real sources and keep route approval explicit.",
    "Keep Research Engine handoff limited to source intelligence, Discovery notes, and queue truth; do not grant it route or adoption authority.",
    "Tighten Discovery truth only through queue/routing/evidence consistency and capability-gap linkage clarity.",
    "Do not add automatic downstream advancement or duplicate Engine routing/usefulness logic inside Discovery.",
  ],
  runtime: [
    "Directive-owned callable execution is now proven through the shared Runtime callable executor for the Scientify literature-access bundle and the code-normalizer transformation capability.",
    "Bounded Runtime execution records and markdown reports now land under runtime/callable-executions/ and are validated through the shared execution-surface checker.",
    "One bounded standalone-host consumption path is now proven for the promoted Scientify literature-access callable through the Runtime-owned executor without bypassing Runtime internals.",
    "Execution evidence now changes later Engine planning decisions in reviewable form, and bounded callable failure patterns can now open Architecture self-improvement pressure through the normal Discovery front door.",
    "Manual Runtime promotion records remain explicit bounded stops below registry acceptance.",
    "Further Runtime work should prioritize execution-evidence feedback and evidence-backed self-improvement, not host-parity expansion, automation, or broad orchestration.",
    "Do not treat follow-up/proof records as runtime surfaces.",
  ],
  architecture: [
    "Operational runtime evidence can now enter the normal Architecture chain through Discovery and reach one bounded implementation-result self-improvement loop without widening Runtime or automation.",
    "No required new structural seam is open for the current Architecture phase; use the existing chain for new bounded cases instead of redesigning it.",
    "Architecture infrastructure work should stay limited to truth/checking hardening or new real-case coverage through the existing path.",
    "Do not reopen Architecture flow design unless product truth is broken.",
  ],
  sharedEngineWholeProduct: [
    "Use engine/state/index.ts as the canonical read surface instead of building new ad hoc state readers.",
    "The recent negative-path hardening run is parked after the bounded broken-link, stale-status, and overstated-next-step slices; reopen it only when a new singular mismatch appears.",
    "Read-only lifecycle coordination may expose recurring live-case pressure; the bounded persistent coordination ledger adds cross-session memory but must not mutate queue/case truth or auto-advance workflow.",
    "Do not turn the anchor into a workflow engine, dashboard, or automation layer.",
  ],
} as const;

export const DIRECTIVE_WORKSPACE_PRODUCT_TRUTH = {
  hierarchy: [
    "Directive Workspace",
    "Engine",
    "Discovery lane",
    "Runtime lane",
    "Architecture lane",
  ],
  workflow: [
    "Source",
    "Analyze",
    "Route",
    "Extract",
    "Adapt",
    "Improve",
    "Prove",
    "Decide",
    "Integrate + Report",
  ],
  proven: [
    "Discovery front door artifactization",
    "Research Engine as a bounded Discovery-owned source-intelligence capability",
    "Shared Engine usefulness/routing persistence",
    "Discovery route approval into Architecture handoff",
    "Discovery route approval into Runtime follow-up",
    "Architecture bounded closeout / continuation / adoption / retained / integration / consumption / evaluation chain",
    "Architecture reopened re-entry and downstream reuse",
    "Runtime follow-up review/open boundary",
    "Runtime record proof-open boundary",
    "Runtime proof runtime-capability-boundary-open boundary",
    "Runtime runtime-capability-boundary promotion-readiness-open boundary",
    "Runtime runtime capability boundary (non-executing)",
    "Runtime promotion-readiness artifact (non-executing)",
    "Runtime manual promotion records (Scientify and OpenMOSS)",
    "Runtime directive-owned callable capability execution",
    "Runtime shared callable execution records and reports",
    "Runtime behavior-preserving transformation callable",
    "Directive-owned standalone-host consumption of a promoted Runtime callable",
    "Execution evidence changes later Engine planning decisions",
    "Operational-evidence Architecture self-improvement through the normal chain to implementation result",
    "Read-only lifecycle coordination over active cases",
    "Bounded persistent coordination via coordination snapshot ledger",
    "Architecture composition checker",
    "Directive Workspace state resolver and current-state report",
    "Directive Workspace whole-product composition checker",
  ],
  partiallyBuilt: [
    "Discovery is operational as a front door and approval boundary, including the bounded Research Engine source-intelligence import path, but still intentionally stops before automatic downstream work.",
    "Runtime is operational as a bounded execution lane with two Directive-owned callable capabilities, one shared execution surface, one bounded standalone-host consumption path, and manual promotion records, but registry acceptance and promotion automation remain closed.",
    "Read-only lifecycle coordination is operational over active cases, with one bounded persistent coordination primitive (coordination snapshot ledger) that adds cross-session staleness detection, cadence drift tracking, and case diff signals without mutating queue/case/workflow state.",
    "Architecture is operational as an Engine self-improvement lane, including one operational-evidence-backed improvement loop through implementation result, while retention and later post-implementation stages remain explicit bounded choices rather than automatic downstream work.",
  ],
  intentionallyMinimal: [
    "no promotion automation",
    "no automatic workflow advancement",
  ],
  notBuilt: [
    "promotion automation",
    "automatic downstream advancement",
  ],
  forbiddenScopeExpansion: [
    "new workflow advancement in truth/read/check/report work",
    "broad host integration or multi-host expansion beyond the bounded standalone-host consumption path",
    "promotion automation",
    "unbounded lifecycle engines or workflow orchestration beyond the coordination snapshot ledger",
    "dashboard expansion",
    "reconstruction of state through lane-local custom readers when the shared resolver already covers it",
  ],
  legalNextSeams: DIRECTIVE_WORKSPACE_LEGAL_NEXT_SEAMS,
  fieldInterpretation: DIRECTIVE_WORKSPACE_FIELD_INTERPRETATION,
} as const;

export type DirectiveWorkspaceProductTruth = typeof DIRECTIVE_WORKSPACE_PRODUCT_TRUTH;

export function buildDirectiveWorkspaceProductTruth() {
  return {
    hierarchy: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.hierarchy],
    workflow: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.workflow],
    proven: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.proven],
    partiallyBuilt: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.partiallyBuilt],
    intentionallyMinimal: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.intentionallyMinimal],
    notBuilt: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.notBuilt],
    forbiddenScopeExpansion: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.forbiddenScopeExpansion],
    legalNextSeams: {
      discovery: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.legalNextSeams.discovery],
      runtime: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.legalNextSeams.runtime],
      architecture: [...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.legalNextSeams.architecture],
      sharedEngineWholeProduct: [
        ...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.legalNextSeams.sharedEngineWholeProduct,
      ],
    },
    fieldInterpretation: {
      ...DIRECTIVE_WORKSPACE_PRODUCT_TRUTH.fieldInterpretation,
    },
  };
}

export function applyDirectiveWorkspaceIntegrityGate<
  T extends {
    inconsistentLinks: string[];
    artifactNextLegalStep: string;
    nextLegalStep: string;
  },
>(focus: T): T & { integrityState: "ok" | "broken" } {
  if (focus.inconsistentLinks.length === 0) {
    return {
      ...focus,
      integrityState: "ok",
    };
  }

  return {
    ...focus,
    integrityState: "broken",
    artifactNextLegalStep: DIRECTIVE_WORKSPACE_BLOCKED_ADVANCEMENT_MESSAGE,
    nextLegalStep: DIRECTIVE_WORKSPACE_BLOCKED_ADVANCEMENT_MESSAGE,
  };
}
