export type FrontendCurrentHead = {
  artifact_path: string;
  artifact_kind: string;
  artifact_stage: string;
  artifact_lane: string;
  view_path: string;
};

export type FrontendHandoffStub = {
  kind:
    | "architecture_handoff"
    | "architecture_handoff_invalid"
    | "runtime_follow_up"
    | "runtime_follow_up_legacy"
    | "runtime_handoff_legacy";
  lane: "architecture" | "runtime";
  relativePath: string;
  candidateId: string;
  title: string;
  status: string;
  startRelativePath: string | null;
  warning: string | null;
};

export type FrontendGapPressureDetail = {
  openGapCount: number;
  gapAlignmentScore: number | null;
  matchedGapId: string | null;
  matchedGapRank: number | null;
  matchedGapPriority: string | null;
  matchedGapDescription: string | null;
  relatedMissionObjective: string | null;
  currentState: string | null;
  desiredState: string | null;
};

export type FrontendLaneAnchor = {
  label: string;
  artifactPath: string;
  currentStage: string;
  nextLegalStep: string;
  candidateId: string | null;
  candidateName: string | null;
};

export type FrontendLaneCaseStripInput = {
  tone: "runtime" | "architecture";
  title: string;
  summary: string;
  tags: Array<{
    value: string;
    tone: "default" | "runtime" | "architecture" | "warning";
  }>;
  cards: Array<{
    label: string;
    value: unknown;
  }>;
  boundaryNote: unknown;
  action?: {
    href: string;
    label: string;
  } | null;
};
