Task: Improve earned autonomy — review resolution + decision ledger

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/approve-routes.ts (reroutes held/review sources — working)
- engine/routing/earned-autonomy.ts (scoring for auto-approval)
- engine/decision-policy-ledger.ts (append-only decision record)
- hosts/standalone-host/cli.ts (CLI commands)

Context:
The approve-routes.ts script reroutes sources from "hold_in_discovery" to "route_to_runtime_follow_up" but doesn't write operator review decisions to the decision-policy ledger. The kernel needs formal review resolutions to build earned autonomy. Without review decisions, the route class stays at 0 operator agreement rate even after 52 runs.

For earned autonomy to reach auto-approval threshold (typically 70+), the decision-policy ledger needs:
- Review resolutions for each route class
- Operator agreement data (did the operator agree with the engine's recommendation?)
- Clean routing outcomes

Allowed files:
- scripts/approve-routes.ts (MODIFY — add review resolution writing)
- scripts/resolve-reviews.ts (NEW — writes formal review decisions)

Forbidden:
- Do not modify any kernel code.
- Do not modify the CLI or web host.
- Do not modify routing logic.

Required implementation:
1. Create scripts/resolve-reviews.ts that:
   a. Reads all engine runs from runtime/host-artifacts/engine-runs/*.json
   b. For each run that has a non-null runId and needs review:
      - Calls host.openDiscoveryRoute() or host.resolveRoutingReview() (use the host's methods)
      - Logs the decision: confirmed, redirected, or rejected
   c. Uses the standard actor "hermes-agent-operator"
   d. Prints summary: total reviews, confirmed, redirected, rejected

2. Modify scripts/approve-routes.ts to:
   a. After rerouting, also write a review resolution to the decision-policy ledger
   b. Use writeDiscoveryRoutingReviewResolution() from the host
   c. Set decision to "confirm_runtime" for web-dev/cybersec sources, "confirm_architecture" for engine-improvement sources
   d. Print the review resolution result

3. Both scripts must:
   - Use createStandaloneFilesystemHost for proper lock management
   - Handle errors gracefully (log and continue)
   - Print clear per-run output

Required command:
pnpm run typecheck

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| resolve-reviews.ts compiles and runs | | |
| Review resolutions written to decision-policy ledger | | |
| Operator agreement data recorded | | |
| approve-routes.ts writes review resolutions | | |
| Both scripts use the host for lock management | | |
| pnpm run typecheck passes | | |

Final report must include:
1. Files changed (with line counts)
2. Number of review resolutions written
3. Decision breakdown: how many confirmed_runtime, confirmed_architecture, etc.
4. Before/after earned autonomy score for a route class
5. Self-check table
6. Anything not completed and why
