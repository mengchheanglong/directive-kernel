import path from "node:path";
import { requireRuntimeWriterString } from "./runtime-writer-support.ts";

function normalizeChecks(
  values?: Array<{
    check_name: string;
    result: "pass" | "fail";
  }> | null,
) {
  return (values ?? []).map((value) => ({
    check_name: requireRuntimeWriterString(value.check_name, "regression_checks.check_name"),
    result: value.result,
  }));
}

export type RuntimeTransformationType =
  | "speed"
  | "cost"
  | "reliability"
  | "maintainability"
  | "correctness"
  | "runtime-fit"
  | "quality";

export type RuntimeTransformationMeasurement = {
  metric: string;
  value: string | number;
  measurement_method: string;
};

export type RuntimeTransformationProofRequest = {
  candidate_id: string;
  candidate_name?: string | null;
  proof_date: string;
  transformation_type: RuntimeTransformationType;
  preservation_claim: string;
  baseline_measurement: RuntimeTransformationMeasurement;
  result_measurement: RuntimeTransformationMeasurement;
  comparison_summary: string;
  rollback_verification: string;
  regression_checks?: Array<{
    check_name: string;
    result: "pass" | "fail";
  }> | null;
  output_relative_path?: string | null;
};

export function resolveRuntimeTransformationProofPath(input: {
  candidate_id: string;
  proof_date: string;
  output_relative_path?: string | null;
}) {
  if (input.output_relative_path && input.output_relative_path.trim().length > 0) {
    return input.output_relative_path.trim();
  }
  return path
    .join(
      "runtime",
      "03-proof",
      `${input.proof_date}-${input.candidate_id}-transformation-proof.json`,
    )
    .replace(/\\/g, "/");
}

export function renderRuntimeTransformationProof(
  request: RuntimeTransformationProofRequest,
) {
  return {
    candidate_id: requireRuntimeWriterString(request.candidate_id, "candidate_id"),
    transformation_type: requireRuntimeWriterString(
      request.transformation_type,
      "transformation_type",
    ),
    preservation_claim: requireRuntimeWriterString(
      request.preservation_claim,
      "preservation_claim",
    ),
    baseline_measurement: {
      metric: requireRuntimeWriterString(
        request.baseline_measurement.metric,
        "baseline_measurement.metric",
      ),
      value: request.baseline_measurement.value,
      measurement_method: requireRuntimeWriterString(
        request.baseline_measurement.measurement_method,
        "baseline_measurement.measurement_method",
      ),
    },
    result_measurement: {
      metric: requireRuntimeWriterString(
        request.result_measurement.metric,
        "result_measurement.metric",
      ),
      value: request.result_measurement.value,
      measurement_method: requireRuntimeWriterString(
        request.result_measurement.measurement_method,
        "result_measurement.measurement_method",
      ),
    },
    comparison_summary: requireRuntimeWriterString(
      request.comparison_summary,
      "comparison_summary",
    ),
    rollback_verification: requireRuntimeWriterString(
      request.rollback_verification,
      "rollback_verification",
    ),
    regression_checks: normalizeChecks(request.regression_checks),
  };
}
