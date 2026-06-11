Task: Cron setup — autonomous 12-hour domain ingestion

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/auto-ingest.sh (multi-domain ingestion — being built by Task 1)
- Hermes cron system (cronjob tool available to the agent)

Context:
Once auto-ingest.sh can process multiple domains, a cron job should run it every 12 hours. This keeps the pipeline autonomously discovering and registering new capabilities without manual intervention.

Allowed files:
- scripts/cron-setup.md (NEW — instructions for the Hermes agent to set up cron)
- scripts/cron-test.sh (NEW — tests that auto-ingest runs correctly in cron context)

Forbidden:
- Do not modify any kernel code.
- Do not modify auto-ingest.sh or auto-ingest.ts.
- Do not directly modify Hermes config files.

Required implementation:
1. Create scripts/cron-setup.md with exact instructions for setting up cron jobs:
   ```
   # Cron job: auto-ingest every 12 hours
   hermes cron create "every 12h" \
     --name "Auto-Ingest Pipeline" \
     --prompt "Run the multi-domain auto-ingest: bash C:/Users/User/AppData/Local/hermes/systems/directive-kernel/scripts/auto-ingest.sh. Report: domains processed, repos found, repos registered. If any domain fails, note which one and continue."
   
   # Cron job: dashboard health check every 6 hours  
   hermes cron create "every 6h" \
     --name "Pipeline Health Check" \
     --prompt "Check the directive kernel dashboard at C:/Users/User/AppData/Local/hermes/directive-root/directive-root. Run: python -c \"import json; q=json.load(open('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/discovery/intake-queue.json')); print(f'Queue: {len(q[\\\"entries\\\"])} entries'); import os,glob; reg=glob.glob('C:/Users/User/AppData/Local/hermes/directive-root/directive-root/runtime/08-registry/*.md'); print(f'Registry: {len(reg)} entries')\". Report queue size, registry size, and any anomalies."
   ```

2. Create scripts/cron-test.sh that:
   a. Verifies auto-ingest.sh exists and is executable
   b. Verifies the directive root exists
   c. Verifies the pipeline script exists
   d. Prints "CRON_READY" if all checks pass, or "CRON_FAIL" with details
   e. This is used to verify the environment before setting up cron

3. The cron instructions must:
   - Include the exact command the user runs
   - Include the exact --prompt text
   - Note that cron runs in the Hermes home directory, so paths must be absolute
   - Note that cron jobs need the gateway running (hermes gateway install if not already)

Required command:
bash scripts/cron-test.sh

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| cron-setup.md contains exact hermes cron commands | | |
| cron-test.sh passes all environment checks | | |
| Auto-ingest path is absolute in cron prompt | | |
| Cron prompt includes reporting instructions | | |
| Health check cron uses absolute paths | | |

Final report must include:
1. Files created (with line counts)
2. Output of `bash scripts/cron-test.sh`
3. The exact cron commands the user should run
4. Self-check table
5. Anything not completed and why
