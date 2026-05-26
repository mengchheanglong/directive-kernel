import {
  DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS,
  runDirectiveRuntimeActionByExplicitInvocation,
  type RuntimeSharedInvocationInput,
  type RuntimeSharedInvocationResult,
} from "../runners/runner-invocation.ts";
import {
  DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS,
  runDirectiveRuntimeNamedSequenceByExplicitInvocation,
  type RuntimeNamedSequenceInput,
  type RuntimeNamedSequenceResult,
} from "../sequences/sequence-invocation.ts";

export const DIRECTIVE_RUNTIME_MANUAL_ACTION_KINDS =
  DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS;

export const DIRECTIVE_RUNTIME_MANUAL_SEQUENCE_KINDS =
  DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS;

export type RuntimeManualControlInput =
  | ({
    mode: "action";
  } & RuntimeSharedInvocationInput)
  | ({
    mode: "sequence";
  } & RuntimeNamedSequenceInput);

export type RuntimeManualControlResult =
  | ({
    surface: "runtime_manual_control_cli";
    mode: "action";
  } & RuntimeSharedInvocationResult)
  | ({
    surface: "runtime_manual_control_cli";
    mode: "sequence";
  } & RuntimeNamedSequenceResult);

export function runDirectiveRuntimeManualControl(
  input: RuntimeManualControlInput,
): RuntimeManualControlResult {
  switch (input.mode) {
    case "action":
      return {
        surface: "runtime_manual_control_cli",
        mode: "action",
        ...runDirectiveRuntimeActionByExplicitInvocation(input),
      };
    case "sequence":
      return {
        surface: "runtime_manual_control_cli",
        mode: "sequence",
        ...runDirectiveRuntimeNamedSequenceByExplicitInvocation(input),
      };
    default: {
      const exhaustiveCheck: never = input;
      throw new Error(`invalid_input: unsupported manual control mode: ${String(exhaustiveCheck)}`);
    }
  }
}
