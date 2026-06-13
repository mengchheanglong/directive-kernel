import { describe, expect, it } from "vitest";

import {
  deriveSourceOperationalizationDecision,
  type SourceOperationalizationInput,
} from "../../engine/routing/source-operationalization.ts";

function makeInput(
  overrides: Partial<SourceOperationalizationInput> = {},
): SourceOperationalizationInput {
  return {
    source: {
      sourceId: "source-1",
      sourceType: "paper",
      sourceRef: "paper://source-1",
      title: "Routing-aware workflow source",
      summary: "Improves Hermes routing and evaluation workflow.",
      missionAlignmentHint: "routing evaluation workflow",
      notes: ["bounded experiment", "measure latency"],
    },
    mission: {
      currentObjective: "Improve Hermes routing evaluation workflow",
      usefulnessSignals: ["routing", "workflow", "evaluation"],
      capabilityLanes: ["architecture"],
    },
    signals: {},
    ...overrides,
  };
}

describe("deriveSourceOperationalizationDecision", () => {
  it("routes a system-layer paper with a local patch path to architecture_experiment", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "paper-to-patch",
        sourceType: "paper",
        sourceRef: "paper://paper-to-patch",
        title: "Paper-to-patch routing compression experiment",
        summary: "Describes a local workflow method for routing and context compression inside Hermes.",
        missionAlignmentHint: "routing context compression evaluation",
        notes: ["measure token usage", "workflow experiment"],
        primaryAdoptionTarget: "architecture",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
      signals: {
        citationCount: 42,
        localSystemPatchPossible: true,
        measurableExperiment: true,
        hasKillCriteria: true,
        experimentKillCriteria: "Kill if token savings stay below 10 percent after two runs.",
      },
    }));

    expect(result.decision).toBe("architecture_experiment");
    expect(result.recommended_lane).toBe("architecture");
    expect(result.kill_criteria).toContain("Kill if token savings");
    expect(result.rationale).toContain("bounded local system-layer experiment");
    expect(result.hermes_relevance_score).toBeGreaterThanOrEqual(40);
    expect(result.actionability_score).toBeGreaterThanOrEqual(50);
  });

  it("routes model-architecture and pretraining papers to training_lab_only", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "pretraining-paper",
        sourceType: "paper",
        sourceRef: "paper://pretraining-paper",
        title: "New transformer architecture for pretraining frontier models",
        summary: "Changes base model architecture and tokenizer design for large-scale post-training.",
        missionAlignmentHint: "assistant quality research",
      },
      signals: {
        citationCount: 120,
        requiresModelArchitectureChange: true,
        requiresPretraining: true,
        requiresTokenizerChange: true,
      },
    }));

    expect(result.decision).toBe("training_lab_only");
    expect(result.recommended_lane).toBe("external");
    expect(result.requires_model_training).toBe(true);
    expect(result.rationale).toContain("requires base-model training work");
  });

  it("routes a strong callable repo to capability_candidate", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "html-md-tool",
        sourceType: "github-repo",
        sourceRef: "https://github.com/example/html-md-tool",
        title: "HTML to Markdown CLI and API",
        summary: "Installable package with CLI, API, and SDK for document conversion.",
        missionAlignmentHint: "document conversion ingestion workflow",
        notes: ["npm package", "production CLI"],
        primaryAdoptionTarget: "runtime",
        containsExecutableCode: true,
      },
      mission: {
        currentObjective: "Improve document conversion ingestion workflow",
        usefulnessSignals: ["conversion", "ingestion", "workflow"],
        capabilityLanes: ["runtime"],
      },
      signals: {
        repoStars: 6400,
        hasCallableCli: true,
        hasCallableApi: true,
        hasInstallablePackage: true,
        hasRunnableExample: true,
      },
    }));

    expect(result.decision).toBe("capability_candidate");
    expect(result.recommended_lane).toBe("runtime");
    expect(result.next_artifact).toBe("runtime/capabilities/html-md-tool");
    expect(result.community_signal_score).toBeGreaterThanOrEqual(70);
    expect(result.actionability_score).toBeGreaterThanOrEqual(60);
  });

  it("routes reference-only documentation to note_only", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "api-docs",
        sourceType: "product-doc",
        sourceRef: "docs://api-docs",
        title: "API reference and integration guide",
        summary: "Reference overview for operators integrating an external service.",
        missionAlignmentHint: "integration reference",
      },
      mission: {
        currentObjective: "Improve integration reference coverage",
        usefulnessSignals: ["integration", "reference"],
        capabilityLanes: ["discovery"],
      },
      signals: {
        documentationOnly: true,
        referenceCount: 8,
        noteTarget: "obsidian://docs/api-docs",
      },
    }));

    expect(result.decision).toBe("note_only");
    expect(result.recommended_lane).toBe("external");
    expect(result.note_target).toBe("obsidian://docs/api-docs");
    expect(result.next_artifact).toBe("obsidian://docs/api-docs");
  });

  it("rejects low-signal irrelevant sources", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "irrelevant-post",
        sourceType: "technical-essay",
        sourceRef: "essay://irrelevant-post",
        title: "Personal thoughts on weekend desk setups",
        summary: "A lifestyle post with no callable tool, experiment, or Hermes mission connection.",
      },
      mission: {
        currentObjective: "Improve routing and capability verification",
        usefulnessSignals: ["routing", "verification"],
        capabilityLanes: ["runtime", "architecture"],
      },
      signals: {},
    }));

    expect(result.decision).toBe("reject");
    expect(result.recommended_lane).toBe("discovery");
    expect(result.hermes_relevance_score).toBeLessThan(25);
    expect(result.community_signal_score).toBeLessThan(25);
    expect(result.actionability_score).toBeLessThan(25);
  });

  it("routes fine-tune and dataset-only sources to fine_tune_later", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "alignment-dataset",
        sourceType: "paper",
        sourceRef: "paper://alignment-dataset",
        title: "Preference dataset for instruction tuning assistants",
        summary: "Synthetic data recipe for fine-tuning assistant responses.",
        missionAlignmentHint: "assistant quality",
        capabilityGapId: "gap-assistant-quality",
      },
      mission: {
        currentObjective: "Improve assistant quality",
        usefulnessSignals: ["assistant", "quality"],
        capabilityLanes: ["discovery"],
      },
      signals: {
        citationCount: 26,
        requiresFineTuningData: true,
        fineTuneOnly: true,
      },
    }));

    expect(result.decision).toBe("fine_tune_later");
    expect(result.recommended_lane).toBe("discovery");
    expect(result.requires_model_training).toBe(false);
    expect(result.rationale).toContain("dataset or fine-tuning recipe");
  });

  it("returns populated rationale and bounded score fields", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "score-check",
        sourceType: "github-repo",
        sourceRef: "https://github.com/example/score-check",
        title: "Callable routing tool",
        summary: "CLI for routing evaluation experiments.",
        missionAlignmentHint: "routing evaluation",
        containsExecutableCode: true,
      },
      signals: {
        repoStars: 1200,
        hasCallableCli: true,
      },
    }));

    expect(result.rationale.length).toBeGreaterThan(20);
    expect(result.classification.length).toBeGreaterThan(5);
    expect(result.actionability_score).toBeGreaterThanOrEqual(0);
    expect(result.actionability_score).toBeLessThanOrEqual(100);
    expect(result.community_signal_score).toBeGreaterThanOrEqual(0);
    expect(result.community_signal_score).toBeLessThanOrEqual(100);
    expect(result.hermes_relevance_score).toBeGreaterThanOrEqual(0);
    expect(result.hermes_relevance_score).toBeLessThanOrEqual(100);
  });

  it("allows architecture_experiment when training-like research is explicitly adapted to a local workflow", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "tokenizer-adaptation",
        sourceType: "paper",
        sourceRef: "paper://tokenizer-adaptation",
        title: "Tokenizer paper adapted into local retrieval chunking workflow",
        summary: "Use tokenizer findings as a local routing chunking heuristic, with benchmark and rollback.",
        missionAlignmentHint: "retrieval routing workflow",
        notes: ["benchmark recall", "rollback if precision drops"],
        primaryAdoptionTarget: "architecture",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
        workflowBoundaryShape: "bounded_protocol",
      },
      signals: {
        citationCount: 55,
        localWorkflowAdaptation: true,
        localSystemPatchPossible: true,
        measurableExperiment: true,
        hasKillCriteria: true,
        experimentKillCriteria: "Kill if retrieval precision drops by more than 2 percent.",
      },
    }));

    expect(result.decision).toBe("architecture_experiment");
    expect(result.requires_model_training).toBe(false);
    expect(result.recommended_lane).toBe("architecture");
  });

  it("does not promote a system-layer paper without kill criteria to architecture_experiment", () => {
    const result = deriveSourceOperationalizationDecision(makeInput({
      source: {
        sourceId: "missing-kill-criteria",
        sourceType: "paper",
        sourceRef: "paper://missing-kill-criteria",
        title: "Workflow ranking idea",
        summary: "Interesting routing workflow idea with no explicit stop condition.",
        missionAlignmentHint: "routing workflow",
        primaryAdoptionTarget: "architecture",
        containsWorkflowPattern: true,
        improvesDirectiveWorkspace: true,
      },
      signals: {
        citationCount: 18,
        localSystemPatchPossible: true,
        measurableExperiment: true,
      },
    }));

    expect(result.decision).toBe("note_only");
    expect(result.rationale).not.toContain("bounded local system-layer experiment");
    expect(result.kill_criteria).toBeUndefined();
  });
});
