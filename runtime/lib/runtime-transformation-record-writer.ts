import path from "node:path";
import {
  optionalRuntimeWriterString,
  requireRuntimeWriterString,
} from "./writers/runtime-writer-support.ts";

export type RuntimeTransformationRecordRequest = {
  candidate_id: string;
  candidate_name: string;
  record_date: string;
  transformation_type: string;
  discovery_intake_path: string;
  component: string;
  current_implementation: string;
  baseline_metric: string;
  baseline_value: string;
  baseline_measurement_method: string;
  proposed_change: string;
  preservation_claim: string;
  expected_improvement_metric: string;
  expected_target_value: string;
  expected_measurement_method: string;
  evaluator_type: string;
  evaluator_command?: string | null;
  comparison_mode: string;
  baseline_artifact_path: string;
  result_artifact_path: string;
  correctness_preserved: string;
  metric_improvement_measured: string;
  rollback_path: string;
  rollback_tested: string;
  decision_state: string;
  promotion_record?: string | null;
  mission_alignment: string;
  capability_gap_id: string;
  output_relative_path?: string | null;
};

export function resolveRuntimeTransformationRecordPath(input: {
  candidate_id: string;
  record_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "02-records",
      `${input.record_date}-${input.candidate_id}-transformation-record.md`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeTransformationRecord(
  request: RuntimeTransformationRecordRequest,
) {
  const promotionRecord = optionalRuntimeWriterString(request.promotion_record);

  return `# Transformation Record: ${requireRuntimeWriterString(request.candidate_name, "candidate_name")}

- Candidate id: ${requireRuntimeWriterString(request.candidate_id, "candidate_id")}
- Candidate name: ${requireRuntimeWriterString(request.candidate_name, "candidate_name")}
- Record date: ${requireRuntimeWriterString(request.record_date, "record_date")}
- Transformation type: ${requireRuntimeWriterString(request.transformation_type, "transformation_type")}
- Discovery intake path: \`${requireRuntimeWriterString(request.discovery_intake_path, "discovery_intake_path")}\`

## Before State

- Component: ${requireRuntimeWriterString(request.component, "component")}
- Current implementation: ${requireRuntimeWriterString(request.current_implementation, "current_implementation")}
- Measured baseline:
  - metric: ${requireRuntimeWriterString(request.baseline_metric, "baseline_metric")}
  - value: ${requireRuntimeWriterString(request.baseline_value, "baseline_value")}
  - measurement method: ${requireRuntimeWriterString(request.baseline_measurement_method, "baseline_measurement_method")}

## After State

- Proposed change: ${requireRuntimeWriterString(request.proposed_change, "proposed_change")}
- Preservation claim: ${requireRuntimeWriterString(request.preservation_claim, "preservation_claim")}
- Expected improvement:
  - metric: ${requireRuntimeWriterString(request.expected_improvement_metric, "expected_improvement_metric")}
  - target value: ${requireRuntimeWriterString(request.expected_target_value, "expected_target_value")}
  - measurement method: ${requireRuntimeWriterString(request.expected_measurement_method, "expected_measurement_method")}

## Evaluator

- Evaluator type: ${requireRuntimeWriterString(request.evaluator_type, "evaluator_type")}
- Evaluator command (if automated): ${optionalRuntimeWriterString(request.evaluator_command) ?? "n/a"}
- Comparison mode: ${requireRuntimeWriterString(request.comparison_mode, "comparison_mode")}
- Baseline artifact path: \`${requireRuntimeWriterString(request.baseline_artifact_path, "baseline_artifact_path")}\`
- Result artifact path: \`${requireRuntimeWriterString(request.result_artifact_path, "result_artifact_path")}\`

## Proof

- Correctness preserved: ${requireRuntimeWriterString(request.correctness_preserved, "correctness_preserved")}
- Metric improvement measured: ${requireRuntimeWriterString(request.metric_improvement_measured, "metric_improvement_measured")}
- Rollback path: ${requireRuntimeWriterString(request.rollback_path, "rollback_path")}
- Rollback tested: ${requireRuntimeWriterString(request.rollback_tested, "rollback_tested")}

## Decision

- Decision state: ${requireRuntimeWriterString(request.decision_state, "decision_state")}
- Adoption target: Runtime
- Promotion record (if promoted): ${promotionRecord ? `\`${promotionRecord}\`` : "n/a"}
- Mission alignment (which active-mission objective does this serve): ${requireRuntimeWriterString(request.mission_alignment, "mission_alignment")}
- Addresses known capability gap (gap_id or n/a): ${requireRuntimeWriterString(request.capability_gap_id, "capability_gap_id")}
`;
}
