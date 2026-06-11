Task: Architecture lane — pipeline self-improvement via the kernel's own workflow

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- architecture/lib/experiments/handoff-start.ts (start from Discovery handoff)
- architecture/lib/experiments/closeout.ts (bounded closeout)
- architecture/lib/adoption/result-adoption.ts (adopt into lifecycle)
- architecture/lib/materialization/ (implementation → retention → integration → consumption → evaluation)
- engine/orchestration/autonomous-lane-loop/architecture.ts (autonomous loop)

Context:
The Architecture lane handles long-horizon system improvement. The pipeline has proven itself for web-dev and cybersec domains. Now it should improve itself — use the Architecture lane to formalize pipeline improvements as tracked Architecture artifacts.

The intake queue has 51 entries with no Architecture-routed items. The goal is to submit a source about improving the pipeline itself, route it through Architecture, and demonstrate the full Architecture lifecycle.

Allowed files:
- scripts/arch-improvement.ts (NEW — submit pipeline self-improvement to Architecture)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/DIRECTIVE_GOAL.md (add Architecture improvement goal)

Forbidden:
- Do not modify engine/, discovery/, runtime/, or architecture/ kernel code.
- Do not modify existing scripts or pipeline.
- Do not modify the web host or CLI.

Required implementation:
1. Create scripts/arch-improvement.ts that:
   a. Submits a source to Discovery about pipeline self-improvement:
      - Name: "Directive Kernel Pipeline Hardening"
      - Description: "Improve the one-shot pipeline by adding auto-pruning of stale intake queue entries, automatic inbox poller delivery fix, and earned autonomy acceleration via batch review resolution."
      - Type: "internal-signal"
      - Adoption target: "architecture"
   b. Creates a routing record routing to Architecture lane
   c. Opens the route to Architecture (creates handoff)
   d. Creates a bounded closeout for the Architecture experiment
   e. Reports: handoff path, closeout result, adoption path

2. Add a secondary goal to DIRECTIVE_GOAL.md:
   ```
   ## Architecture Improvement Goal
   
   Improve Directive Kernel's own pipeline infrastructure by:
   - Auto-pruning stale intake queue entries (duplicates of registered capabilities)
   - Fixing the inbox poller cron delivery mechanism
   - Accelerating earned autonomy through batch review resolution
   
   Success: One Architecture adoption artifact documenting the improvement.
   ```

3. The script must:
   - Use createStandaloneFilesystemHost for proper lock management
   - Follow the Architecture lifecycle: handoff → closeout → adoption
   - Print clear per-stage output
   - Handle errors gracefully

Required command:
npx tsx scripts/arch-improvement.ts

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| Source submitted with architecture adoption target | | |
| Routing record created for Architecture lane | | |
| Architecture handoff artifact created | | |
| Bounded closeout completed | | |
| Adoption artifact written | | |
| pnpm run typecheck passes | | |

Final report must include:
1. Files created (with line counts)
2. Architecture artifact paths created
3. Self-check table
4. Example output from running the script
