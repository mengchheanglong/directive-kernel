# Cron Setup: Autonomous 12-Hour Domain Ingestion

## Prerequisites

1. `scripts/auto-ingest.sh` must exist and be functional (`bash scripts/cron-test.sh`).
2. The Hermes cron gateway must be running. If not installed:
   ```
   hermes gateway install
   ```
3. All paths in cron prompts must be **absolute** because cron jobs run from the Hermes home directory, not the kernel repo.

## Verify Environment

```bash
bash C:/Users/User/AppData/Local/hermes/systems/directive-kernel/scripts/cron-test.sh
```

Expected output: `CRON_READY`

---

## Cron Job 1: Auto-Ingest Pipeline (every 12 hours)

Runs multi-domain auto-ingest to discover and register new capabilities across cybersecurity, devops, and data engineering domains.

```bash
hermes cron create "every 12h" \
  --name "Auto-Ingest Pipeline" \
  --prompt "Run the multi-domain auto-ingest. For each domain listed below, call the auto-ingest script and report results. Use absolute paths since cron runs from the Hermes home directory.

  Domain 1 (cybersecurity):
  bash C:/Users/User/AppData/Local/hermes/systems/directive-kernel/scripts/auto-ingest.sh \"cybersecurity open source tools stars:>5000\"

  Wait 30 seconds.

  Domain 2 (devops):
  bash C:/Users/User/AppData/Local/hermes/systems/directive-kernel/scripts/auto-ingest.sh \"devops automation infrastructure tools stars:>5000\"

  Wait 30 seconds.

  Domain 3 (data engineering):
  bash C:/Users/User/AppData/Local/hermes/systems/directive-kernel/scripts/auto-ingest.sh \"data engineering etl pipeline tools stars:>5000\"

  Report:
  - Domains processed (count)
  - Repos found per domain
  - Repos registered per domain
  - Any failures and which domain
  - Total new capabilities registered"
```

---

## Cron Job 2: Pipeline Health Check (every 6 hours)

Monitors queue size, registry size, and engine run counts to detect stalls or anomalies.

```bash
hermes cron create "every 6h" \
  --name "Pipeline Health Check" \
  --prompt "Check the directive kernel health at C:/Users/User/AppData/Local/hermes/directive-root/directive-root.

  Run these checks using absolute paths:

  1. Queue size:
  python -c \"import json; q=json.load(open('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/intake-queue.json')); total=len(q['entries']); pending=sum(1 for e in q['entries'] if e['status']=='pending'); print(f'Queue: {total} entries ({pending} pending)')\"

  2. Registry size:
  python -c \"import os,glob; reg=glob.glob('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/runtime/08-registry/*.md'); print(f'Registry: {len(reg)} entries')\"

  3. Engine runs:
  python -c \"import os; runs=os.listdir('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/runtime/host-artifacts/engine-runs'); jsons=[f for f in runs if f.endswith('.json')]; print(f'Engine runs: {len(jsons)} records')\"

  4. Intake queue status distribution:
  python -c \"import json; q=json.load(open('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/intake-queue.json')); from collections import Counter; statuses=Counter(e['status'] for e in q['entries']); [print(f'  {s}: {c}') for s,c in sorted(statuses.items())]\"

  Report:
  - Queue total + pending count
  - Registry total
  - Engine run count
  - Status distribution
  - Any anomalies (e.g., growing pending queue with zero registry growth = pipeline stalled)"
```

---

## Viewing and Managing Cron Jobs

```bash
# List all cron jobs
hermes cron list

# View job details
hermes cron show "Auto-Ingest Pipeline"

# View recent runs
hermes cron history "Auto-Ingest Pipeline"

# Remove a cron job
hermes cron delete "Auto-Ingest Pipeline"
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Cron job never runs | Gateway not installed | `hermes gateway install` |
| Auto-ingest returns 0 results | GitHub API rate limited | Wait 1 hour; unauthenticated limit is 10 req/min |
| Cron can't find bash | WSL/Git Bash not in PATH | Install Git Bash or use WSL; ensure `bash` resolves |
| Pipeline failures in cron | Directive root locked | Check for stale lock files in the directive root |
