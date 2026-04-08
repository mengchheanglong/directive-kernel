import {
  DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS,
  runDirectiveRuntimeActionByExplicitInvocation,
  type DirectiveRuntimeSharedInvocationInput,
  type DirectiveRuntimeSharedInvocationResult,
} from "./runtime-runner-invocation.ts";
import {
  DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS,
  runDirectiveRuntimeNamedSequenceByExplicitInvocation,
  type DirectiveRuntimeNamedSequenceInput,
  type DirectiveRuntimeNamedSequenceResult,
} from "./runtime-sequence-invocation.ts";

export const DIRECTIVE_RUNTIME_MANUAL_ACTION_KINDS =
  DIRECTIVE_RUNTIME_SHARED_INVOCATION_ACTIONS;

export const DIRECTIVE_RUNTIME_MANUAL_SEQUENCE_KINDS =
  DIRECTIVE_RUNTIME_NAMED_SEQUENCE_KINDS;

export type DirectiveRuntimeManualControlInput =
  | ({
    mode: "action";
  } & DirectiveRuntimeSharedInvocationInput)
  | ({
    mode: "sequence";
  } & DirectiveRuntimeNamedSequenceInput);

export type DirectiveRuntimeManualControlResult =
  | ({
    surface: "runtime_manual_control_cli";
    mode: "action";
  } & DirectiveRuntimeSharedInvocationResult)
  | ({
    surface: "runtime_manual_control_cli";
    mode: "sequence";
  } & DirectiveRuntimeNamedSequenceResult);

export function runDirectiveRuntimeManualControl(
  input: DirectiveRuntimeManualControlInput,
): DirectiveRuntimeManualControlResult {
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
