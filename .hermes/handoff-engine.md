Task: Engine improvements — push mission health from C/69 to A-grade, accelerate earned autonomy

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/DIRECTIVE_GOAL.md (current mission)
- engine/mission/health.ts (constraint scoring: action verbs 2pt, non-generic tokens 1pt, max 5)
- engine/routing/earned-autonomy.ts (route class scoring)
- scripts/approve-routes.ts (batch reroute + review resolution)

Context:
Mission health is C/69 with 8 constraints and single Runtime lane. To reach A/80+, constraints need more specific action verbs at line start ("Limit", "Require", "Preserve", "Keep", "Avoid", "Review", "Restrict", "Validate" = 2pts each) plus non-generic tokens (= 1pt each). Lane clarity is already maxed (5/5 with single lane). Usefulness signals and objective specificity can also improve.

Earned autonomy is at 25/100. Each operator review decision in the decision-policy ledger builds the route class score. Running approve-routes.ts adds review resolutions.

Allowed files:
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/DIRECTIVE_GOAL.md (MODIFY)

Forbidden:
- Do not modify the engine scoring code.
- Do not modify the host or pipeline scripts.
- Do not change the mission ID.

Required implementation:
1. Rewrite DIRECTIVE_GOAL.md to maximize constraint scoring:
   - Keep 5-8 constraints, each starting with an action verb from the scoring list
   - Use domain-specific nouns (not generic tokens like "bounded", "capability", "system")
   - The engine's GENERIC_TOKENS list excludes: active, better, bounded, capability, current, directive, goal, improve, kernel, mission, product, quality, result, routing, signal, system, useful, workspace
   - Example strong constraint: "Limit capability promotion to 1 per 24 hours to isolate proof failures"
   - Example weak constraint: "Stay bounded" (uses generic token)

2. Update the Goal Statement to be more specific:
   - Current: broad capability bootstrap
   - New: concrete next phase (e.g., "Operationalize 5 cybersecurity capabilities through the full DK pipeline")

3. Update Success Signal to be measurable:
   - Current: "5 web-dev libraries operationalized" (done)
   - New: "5 cybersecurity capabilities registered with callable execution evidence"

4. Set Primary Lane to "Runtime" (already correct, keep it)

5. After rewriting, submit a test source to verify the health score:
   - Create a test submission JSON
   - Run: node ./dist/hosts/standalone-host/cli.js discovery-submit --process-with-engine
   - Check the engine run's missionHealth.overallScore — target A/80+

6. Run scripts/approve-routes.ts to add more review resolutions to the decision-policy ledger

Required command:
node ./dist/hosts/standalone-host/cli.js discovery-submit --directive-root C:/Users/User/AppData/Local/hermes/directive-root/directive-root --input-json-path <test-json> --process-with-engine

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| DIRECTIVE_GOAL.md has 5-8 constraints with action verbs | | |
| Zero constraints use generic tokens listed above | | |
| Test submission health score is B/70+ or A/80+ | | |
| Primary Lane is Runtime (single lane) | | |
| approve-routes.ts runs successfully | | |
| Earned autonomy score improved from baseline | | |

Final report must include:
1. New DIRECTIVE_GOAL.md content (full text)
2. Test submission health score (before vs after)
3. approve-routes.ts run results
4. Self-check table
