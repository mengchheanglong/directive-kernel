import { resolveDirectiveWorkspaceState } from "../../state/index.ts";
import type {
  DirectiveAutonomousLaneLoopAction,
  DirectiveAutonomousLaneLoopActionKind,
  DirectiveAutonomousLaneLoopPhaseReport,
} from "./autonomous-lane-loop-types.ts";

export function resolveFocusOrThrow(directiveRoot: string, artifactPath: string) {
  const resolved = resolveDirectiveWorkspaceState({
    directiveRoot,
    artifactPath,
    includeAnchors: false,
  }).focus;

  if (!resolved) {
    throw new Error(`invalid_state: unable to resolve current focus for ${artifactPath}`);
  }

  return resolved;
}

export function buildAction(input: {
  index: number;
  lane: "discovery" | "architecture" | "runtime";
  actionKind: DirectiveAutonomousLaneLoopActionKind;
  sourcePath: string;
  targetPath: string;
  created: boolean;
  stageBefore: string;
  directiveRoot: string;
}) {
  let after: ReturnType<typeof resolveDirectiveWorkspaceState>["focus"] = null;
  try {
    after = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: input.targetPath,
      includeAnchors: false,
    }).focus;
  } catch {
    after = null;
  }

  return {
    index: input.index,
    lane: input.lane,
    actionKind: input.actionKind,
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    created: input.created,
    stageBefore: input.stageBefore,
    stageAfter: after?.currentStage ?? null,
  } satisfies DirectiveAutonomousLaneLoopAction;
}

export function classifyDirectiveAutonomousFocusDisposition(input: {
  currentStage: string | null;
  nextLegalStep: string | null;
  integrityState: string | null | undefined;
}) {
  if (input.integrityState === "broken") {
    return "blocked" as const;
  }

  const currentStage = String(input.currentStage ?? "").trim().toLowerCase();
  const nextLegalStep = String(input.nextLegalStep ?? "").trim().toLowerCase();

  if (currentStage.includes("rejected") || currentStage.includes("deferred")) {
    return "rejected_or_deferred" as const;
  }

  if (
    nextLegalStep.startsWith("no automatic ")
    || currentStage === "discovery.monitor.active"
    || currentStage === "architecture.post_consumption_evaluation.keep"
    || currentStage === "architecture.bounded_result.stay_experimental"
  ) {
    return "stopped" as const;
  }

  return "continued" as const;
}

export function buildDirectiveAutonomousLaneLoopPhaseReports(input: {
  directiveRoot: string;
  actions: DirectiveAutonomousLaneLoopAction[];
}) {
  return input.actions.map((action) => {
    const focus = resolveDirectiveWorkspaceState({
      directiveRoot: input.directiveRoot,
      artifactPath: action.targetPath,
      includeAnchors: false,
    }).focus;

    return {
      index: action.index,
      actionKind: action.actionKind,
      lane: action.lane,
      sourcePath: action.sourcePath,
      targetPath: action.targetPath,
      stageBefore: action.stageBefore,
      stageAfter: action.stageAfter,
      currentHeadPath: focus?.currentHead.artifactPath ?? null,
      nextLegalStep: focus?.nextLegalStep ?? null,
      disposition: classifyDirectiveAutonomousFocusDisposition({
        currentStage: focus?.currentStage ?? null,
        nextLegalStep: focus?.nextLegalStep ?? null,
        integrityState: focus?.integrityState,
      }),
    } satisfies DirectiveAutonomousLaneLoopPhaseReport;
  });
}
