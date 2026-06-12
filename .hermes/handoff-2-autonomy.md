Task: Earned Autonomy Acceleration — batch review 51 held engine runs into the decision-policy ledger

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/resolve-reviews.ts (RUN — writes review resolutions for needs_human_review runs)
- scripts/approve-routes.ts (RUN — reroutes held runs + writes review resolutions)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/runtime/host-artifacts/engine-runs/ (79 engine run JSON files)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/engine/decision-policy-ledger.json (target — 16 raw events, 0 route class scores)
- C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/03-routing-log/ (routing records for review resolution)

Context:
There are 79 engine runs. 43 show needs_human_review=true, 8 are hold_in_discovery, 21 are already route_to_runtime_follow_up, 7 are accept_for_architecture. Total 51 held or needing review.

The decision-policy ledger has 16 raw review events but ZERO route classes with scores. Each review resolution written adds to the ledger and builds route class history. After enough clean decisions, route classes cross the earned-autonomy threshold and future runs auto-route.

Two scripts exist:
- resolve-reviews.ts: Finds runs with needsHumanReview=true, reads their routing records, writes review resolutions (confirm_runtime or confirm_architecture). Does NOT reroute.
- approve-routes.ts: Finds runs with hold_in_discovery or needs_human_review, reroutes them with answers, THEN writes review resolutions. Also reroutes.

Execution order: resolve-reviews.ts first (processes the 43 needs_human_review runs without rerouting), then approve-routes.ts (reroutes the 8 held runs + any remaining).

Both scripts lock the directive root. Kill any running dashboard or web host first. Both use createStandaloneFilesystemHost — no lock conflicts if run sequentially.

Allowed files:
- scripts/resolve-reviews.ts (RUN — do not modify)
- scripts/approve-routes.ts (RUN — do not modify)
- These scripts READ from runtime/host-artifacts/engine-runs/ and discovery/03-routing-log/, WRITE to discovery/03-routing-log/ (review resolutions) and engine/decision-policy-ledger.json

Forbidden:
- Do not modify resolve-reviews.ts or approve-routes.ts
- Do not manually write review resolutions or ledger entries
- Do not modify engine runs or routing records
- Do not touch runtime/ artifacts

Required implementation:

STEP 1: Kill any process holding the directive root lock
```bash
# Check if dashboard is running
curl -s http://localhost:3456/api/snapshot && echo "Dashboard running — kill it first" || echo "Dashboard not running"
```

STEP 2: Run resolve-reviews.ts
```bash
cd C:/Users/User/AppData/Local/hermes/systems/directive-kernel
npx tsx scripts/resolve-reviews.ts
```
Expected: processes 43 needs_human_review runs, writes ~40 review resolutions. Some may skip (already resolved or no routing record).

STEP 3: Run approve-routes.ts
```bash
npx tsx scripts/approve-routes.ts
```
Expected: processes 8 hold_in_discovery runs + any remaining, reroutes them, writes review resolutions.

STEP 4: Verify ledger growth
```bash
cd C:/Users/User/AppData/Local/hermes/directive-root/directive-root
python -c "
import json
with open('engine/decision-policy-ledger.json') as f:
    d = json.load(f)
events = d.get('events', [])
print(f'Ledger events: {len(events)}')
# Count by route class (sourceType + resolvedLaneId)
from collections import Counter
classes = Counter()
for e in events:
    st = e.get('sourceType', '?')
    rl = e.get('resolvedLaneId', '?')
    classes[f'{st}:{rl}'] += 1
print('Route class distribution:')
for cls, cnt in classes.most_common():
    print(f'  {cls}: {cnt}')
"
```

STEP 5: Count review resolution files created
```bash
ls discovery/03-routing-log/*review-resolution* 2>/dev/null | wc -l
```

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| resolve-reviews.ts completed without fatal errors | | |
| approve-routes.ts completed without fatal errors | | |
| Ledger events increased from baseline (16 → target 50+) | | |
| Review resolution .md files created in 03-routing-log/ | | |
| At least 3 distinct route classes have event counts | | |
| No runtime/ artifacts modified | | |

Final report must include:
1. resolve-reviews.ts output summary (processed, confirmed, skipped, errors)
2. approve-routes.ts output summary (processed, rerouted, errors)
3. Ledger event count before vs after
4. Review resolution files count
5. Route class distribution table
6. Self-check table
