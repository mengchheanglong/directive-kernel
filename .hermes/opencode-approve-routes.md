Task: Process routing reviews — approve Discovery routes to build earned autonomy

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- engine/routing/earned-autonomy.ts (scoring: routes with clean history get auto-approved)
- engine/decision-policy-ledger.ts (append-only record of routing decisions)
- hosts/standalone-host/cli.ts (CLI commands for routing review)

Context:
The directive root at C:/Users/User/AppData/Local/hermes/directive-root/directive-root has 24 engine runs. Most are at "hold_in_discovery" or "needs_human_review" because the route class has zero earned autonomy. The task: approve the routing reviews so earned autonomy starts building.

Allowed files:
- scripts/approve-routes.ts (NEW — create this file)
- No other files may be modified

Forbidden:
- Do not modify files outside the allowed list.
- Do not modify the CLI or any kernel logic.
- Do not change the directive root artifacts directly.
- Do not submit new sources.
- Do not change mission or goal files.

Required implementation:
1. Create scripts/approve-routes.ts that:
   a. Uses createStandaloneFilesystemHost to initialize a host on the directive root
   b. Reads all engine runs from runtime/host-artifacts/engine-runs/*.json
   c. For each run that has decisionState "hold_in_discovery" or "needs_human_review":
      - Build a reroute request that answers the follow-up questions (set primaryAdoptionTarget to "runtime", set improvesDirectiveWorkspace to false)
      - Call host.reRouteEngineRunWithAnswers() to reroute
      - Read the resulting decision — if it changed, log it
   d. Print a summary: total runs processed, how many rerouted, new decision states

2. The script must:
   - Import from the compiled dist version: createStandaloneFilesystemHost from ../hosts/standalone-host/filesystem-host.ts
   - Handle the lock properly (the host manages it internally)
   - Print progress per run: candidate_id, old decision, new decision

3. For web-dev sources (hermes-webdev-*, wd-*), set:
   - source.primaryAdoptionTarget = "runtime"
   - source.containsExecutableCode = "true"

4. For cybersecurity sources (cybersec-*), set:
   - source.primaryAdoptionTarget = "runtime"  
   - source.containsExecutableCode = "true"

5. For test/health sources (health-*, shadcn-prod, final-test-*, direct-final, shadcn-direct), set:
   - source.primaryAdoptionTarget = "architecture"
   - source.improvesDirectiveWorkspace = "true"

Required command:
pnpm run typecheck

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| Script runs without errors | | |
| Routes processed for all 24 engine runs | | |
| Web-dev sources routed to runtime | | |
| Cybersecurity sources routed to runtime | | |
| Health/test sources rerouted with improved answers | | |
| Earned autonomy shows non-zero scores for route classes | | |
| No files modified outside scripts/approve-routes.ts | | |
| pnpm run typecheck passes | | |

Final report must include:
1. Files changed
2. Total runs processed and rerouted
3. Decision state changes (how many moved from hold_in_discovery → runtime, etc.)
4. Self-check table
5. Anything not completed and why
