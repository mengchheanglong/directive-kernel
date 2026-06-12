Task: Architecture Lane Bootstrap — create first Architecture lifecycle artifact via new script

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/pipeline.ts (reference — follow same patterns, different lane target)
- scripts/arch-improvement.ts (NEW — create from scratch)
- architecture/lib/experiments/handoff-start.ts (Architecture handoff creation)
- architecture/lib/experiments/closeout.ts (bounded closeout)
- hosts/standalone-host/filesystem-host.ts (host API)
- discovery/lib/routing/record-writer.ts (renderDiscoveryRoutingRecord)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/ (directive root)

Context:
The Architecture lane handles long-horizon system improvement. The Runtime lane has 36 registry entries. The Architecture lane has ZERO artifacts. The engine has already routed 7 runs to Architecture (accept_for_architecture state), but no Architecture handoff or adoption artifacts were created. The auto-ingest pipeline is proven. The inbox poller is erroring. The intake queue has 51 stale entries. These are real system improvement opportunities — ideal first Architecture lane candidates.

The Architecture lifecycle is:
1. Discovery handoff (source → Discovery → routing → Architecture handoff artifact)
2. Bounded closeout (document the experiment scope and results)
3. Adoption (formalize the result as an Architecture adoption artifact)
4. Materialization (implementation → retention → integration → consumption → evaluation)

For this first bootstrap, focus on stages 1-3. The materialization stage is for when we actually implement the fix.

The script should submit a source about DK self-improvement and route it through Architecture (not Runtime). It follows the same pattern as pipeline.ts but with route_destination: "architecture" and Architecture-specific artifacts.

Allowed files:
- scripts/arch-improvement.ts (CREATE — new file)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/architecture/ (WRITE — new Architecture artifacts)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/ (READ — intake queue, routing log)

Forbidden:
- Do not modify pipeline.ts or any existing scripts
- Do not modify engine/, discovery/, runtime/, or architecture/ kernel source code
- Do not modify the web host or CLI
- Do not modify DIRECTIVE_GOAL.md (handled by handoff-1)
- Do not touch existing registry entries

Required implementation:

Create scripts/arch-improvement.ts that:

1. Imports the same core modules as pipeline.ts:
   - createStandaloneFilesystemHost from "../hosts/standalone-host/filesystem-host.ts"
   - renderDiscoveryRoutingRecord from "../discovery/lib/routing/record-writer.ts"
   - fs, path from node

2. Defines the directive root as:
   const ROOT = "C:/Users/User/AppData/Local/hermes/directive-root/directive-root";

3. Submits a source about DK self-improvement with Architecture as the adoption target:
   - Name: "Directive Kernel Pipeline Self-Improvement"
   - Description: "Harden DK's own infrastructure: auto-prune stale intake entries, fix inbox poller delivery, accelerate earned autonomy through batch review resolution. This is the first Architecture lane artifact — proving the system can improve itself."
   - Type: "internal-signal"
   - Adoption target: "architecture"  ← KEY DIFFERENCE from pipeline.ts

4. Gets the engine run and creates a routing record with:
   - route_destination: "architecture"  ← KEY DIFFERENCE
   - adoption_target: "architecture"
   - decision_state: "adopt"

5. Opens the Discovery route (same as pipeline.ts — host.openDiscoveryRoute handles both Runtime and Architecture routing)

6. Creates Architecture handoff artifact at:
   architecture/01-experiments/{date}-{cid}-architecture-handoff.md
   Content: markdown with candidate info, scope, bounded closeout plan, success criteria.
   Format (minimum required fields):
   ```
   # Architecture Handoff: {name}
   - Candidate ID: {cid}
   - Handoff date: {date}
   - Source type: internal-signal
   - Lane: architecture
   - Bounded scope: {description}
   - Experiment duration: 1 session
   - Success criteria: Architecture adoption artifact created
   - Rollback: delete handoff and closeout artifacts
   - Owner: hermes-agent-operator
   ```

7. Creates bounded closeout artifact at:
   architecture/04-materialization/{date}-{cid}-architecture-closeout.md
   Content:
   ```
   # Architecture Closeout: {name}
   - Candidate ID: {cid}
   - Closeout date: {date}
   - Experiment result: completed
   - What was learned: Architecture lane bootstrap successful — first self-improvement source routed through full Architecture lifecycle
   - Adoption recommendation: adopt as Architecture lane reference implementation
   - Artifacts created: handoff, closeout, adoption record
   ```

8. Creates adoption artifact at:
   architecture/02-adopted/{date}-{cid}-architecture-adoption.md
   Content:
   ```
   # Architecture Adoption: {name}
   - Candidate ID: {cid}
   - Adoption date: {date}
   - Adopted from: architecture/01-experiments/{date}-{cid}-architecture-handoff.md
   - Closeout reference: architecture/04-materialization/{date}-{cid}-architecture-closeout.md
   - Adopted scope: Bootstrap the Architecture lane with a tracked self-improvement artifact
   - Materialization plan: Implement auto-pruning, inbox poller fix, and earned autonomy acceleration in follow-up work
   - Owner: hermes-agent-operator
   - Status: adopted
   ```

9. Prints clear per-stage output:
   ```
   === Architecture Lane Bootstrap ===
   1. Submitting source... OK — runId: xxx
   2. Routing record... OK — discovery/03-routing-log/xxx
   3. Open route... OK — routed to architecture
   4. Architecture handoff... OK — architecture/01-experiments/xxx
   5. Bounded closeout... OK — architecture/04-materialization/xxx
   6. Adoption... OK — architecture/02-adopted/xxx
   === Architecture lane bootstrapped! ===
   ```

10. Handles errors gracefully — if any stage fails, report the error and what was completed so far.

Required command:
```bash
cd C:/Users/User/AppData/Local/hermes/systems/directive-kernel
npx tsx scripts/arch-improvement.ts
```

After running, verify:
```bash
cd C:/Users/User/AppData/Local/hermes/directive-root/directive-root
echo "=== Architecture artifacts ===" && find architecture/ -name "*.md" -newer DIRECTIVE_GOAL.md 2>/dev/null
echo "=== New routing record ===" && ls -t discovery/03-routing-log/ | head -3
echo "=== New engine run ===" && ls -t runtime/host-artifacts/engine-runs/*.json | head -1
```

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| arch-improvement.ts exists and is valid TypeScript | | |
| Script runs without fatal errors | | |
| Engine run created with architecture routing | | |
| Routing record exists with route_destination: architecture | | |
| Architecture handoff artifact created in 01-experiments/ | | |
| Bounded closeout artifact created in 04-materialization/ | | |
| Adoption artifact created in 02-adopted/ | | |
| pnpm run typecheck passes (scripts/arch-improvement.ts only — pre-existing errors in other scripts are OK) | | |

Final report must include:
1. arch-improvement.ts file (line count)
2. Full output from running the script
3. List of Architecture artifacts created (with paths)
4. Engine run ID and routing record path
5. Self-check table

Implementation notes for the AI:
- Use `(host as any).submitDiscoveryEntryWithEngine(...)` with `adoption_target: "architecture"` — the same function pipeline.ts uses, just with different parameters
- Use renderDiscoveryRoutingRecord with route_destination: "architecture" and adoption_target: "architecture" 
- The host.openDiscoveryRoute function should handle Architecture routing (if it doesn't, create the routing record and handoff manually)
- If host.openDiscoveryRoute fails for architecture routing, create the routing record and handoff artifacts manually — the key deliverable is the Architecture artifacts, not a fully automated pipeline
- Create parent directories with fs.mkdirSync(dir, { recursive: true })
- Close the host with host.close() in a finally block
- The candidate ID should use a timestamp suffix like pipeline.ts: `arch-{slug}-{Date.now().toString(36)}`
