import * as fc from "fast-check";

// Tagged union driving Property 5 (approval boundary classification consistency).
//
// The property test (`tests/property/approval-boundary.property.test.ts`,
// task 7.1) switches on `scenario.guard`, invokes the matching guard from
// `engine/approval-boundary.ts`, and asserts that the guard rejects iff
// `scenario.kind === "disallowed"` and accepts iff `scenario.kind === "allowed"`.
//
// Coverage notes:
//   * `explicitApproval` and `eligibleStatus` are pure value checks — both
//     `allowed` and `disallowed` sub-cases are generated here.
//   * `integrityForOpening` and `currentStageForOpening` resolve workspace
//     state from disk via `resolveDirectiveWorkspaceState`. The `allowed`
//     direction requires a seeded directive-root fixture, which is a
//     side-effect that does not belong inside an arbitrary. This file
//     therefore only generates `disallowed` scenarios for those two guards;
//     the property test (task 7.1) covers the `allowed` direction for them
//     via example-based tests built on an explicit temp-dir fixture.
export type ApprovalScenario =
  | {
      kind: "allowed" | "disallowed";
      guard: "explicitApproval";
      input: { approved?: boolean; action: string };
    }
  | {
      kind: "allowed" | "disallowed";
      guard: "eligibleStatus";
      input: {
        subject: string;
        currentStatus: string;
        allowedStatuses: string[];
        action: string;
      };
    }
  | {
      kind: "disallowed";
      guard: "integrityForOpening";
      input: { directiveRoot: string; artifactPath: string; subject: string };
    }
  | {
      kind: "disallowed";
      guard: "currentStageForOpening";
      input: {
        directiveRoot: string;
        artifactPath: string;
        subject: string;
        allowedCurrentStages: string[];
      };
    };

const nonEmptyText = fc.string({ minLength: 1, maxLength: 32 });

// `requireDirectiveExplicitApproval` accepts iff `approved === true`. Any
// other value (including `false` and `undefined`) is rejected. Generating
// over the `false` / `undefined` pair gives us a constrained, demonstrably
// disallowed surface.
const explicitApprovalAllowedArb: fc.Arbitrary<ApprovalScenario> = fc.record({
  approved: fc.constant(true),
  action: nonEmptyText,
}).map((input) => ({ kind: "allowed", guard: "explicitApproval", input }));

const explicitApprovalDisallowedArb: fc.Arbitrary<ApprovalScenario> = fc.record({
  approved: fc.constantFrom(false, undefined),
  action: nonEmptyText,
}).map((input) => ({ kind: "disallowed", guard: "explicitApproval", input }));

// `requireDirectiveEligibleStatus` accepts iff `currentStatus` is included
// in `allowedStatuses`. Generating both directions is straightforward: pick
// a non-empty allow-list, then either pick an in-list status (allowed) or
// pick a status guaranteed to fall outside it (disallowed).
const eligibleStatusAllowedArb: fc.Arbitrary<ApprovalScenario> = fc
  .record({
    subject: nonEmptyText,
    action: nonEmptyText,
    allowedStatuses: fc.uniqueArray(nonEmptyText, { minLength: 1, maxLength: 6 }),
  })
  .chain((base) =>
    fc.constantFrom(...base.allowedStatuses).map((currentStatus) => ({
      kind: "allowed" as const,
      guard: "eligibleStatus" as const,
      input: { ...base, currentStatus },
    })),
  );

const eligibleStatusDisallowedArb: fc.Arbitrary<ApprovalScenario> = fc
  .record({
    subject: nonEmptyText,
    action: nonEmptyText,
    allowedStatuses: fc.uniqueArray(nonEmptyText, { minLength: 1, maxLength: 6 }),
    candidate: nonEmptyText,
  })
  .map(({ candidate, allowedStatuses, ...rest }) => {
    // Force the candidate outside the allow list by appending a sentinel
    // suffix; this preserves shrinkability of the underlying string while
    // guaranteeing the disallowed classification.
    const currentStatus = allowedStatuses.includes(candidate)
      ? `${candidate}__not_allowed`
      : candidate;
    return {
      kind: "disallowed" as const,
      guard: "eligibleStatus" as const,
      input: { ...rest, allowedStatuses, currentStatus },
    };
  });

// For the two integrity-dependent guards, the disallowed surface includes
// any artifact path that does not match one of the resolver's supported
// prefixes (`discovery/03-routing-log/`, `discovery/04-monitor/`,
// `runtime/standalone-host/engine-runs/...json`, `architecture/`,
// `runtime/`). The resolver throws `unsupported artifact path` for anything
// else, which the guard rethrows. We pin `directiveRoot` to a non-existent
// path under the OS temp pattern to keep the scenario hermetic — even if
// the resolver short-circuits before a filesystem read, no real workspace
// is touched.
const unsupportedArtifactPath = fc
  .tuple(nonEmptyText, nonEmptyText)
  .map(([head, tail]) => `unsupported/${head}/${tail}.json`);

const phantomDirectiveRoot = nonEmptyText.map(
  (slug) => `/__directive_kernel_phantom__/${slug.replace(/[\\/]/g, "_")}`,
);

const integrityForOpeningDisallowedArb: fc.Arbitrary<ApprovalScenario> = fc
  .record({
    directiveRoot: phantomDirectiveRoot,
    artifactPath: unsupportedArtifactPath,
    subject: nonEmptyText,
  })
  .map((input) => ({ kind: "disallowed", guard: "integrityForOpening", input }));

const currentStageForOpeningDisallowedArb: fc.Arbitrary<ApprovalScenario> = fc
  .record({
    directiveRoot: phantomDirectiveRoot,
    artifactPath: unsupportedArtifactPath,
    subject: nonEmptyText,
    allowedCurrentStages: fc.uniqueArray(nonEmptyText, { minLength: 1, maxLength: 4 }),
  })
  .map((input) => ({ kind: "disallowed", guard: "currentStageForOpening", input }));

export const approvalStateArb: fc.Arbitrary<ApprovalScenario> = fc.oneof(
  explicitApprovalAllowedArb,
  explicitApprovalDisallowedArb,
  eligibleStatusAllowedArb,
  eligibleStatusDisallowedArb,
  integrityForOpeningDisallowedArb,
  currentStageForOpeningDisallowedArb,
);
