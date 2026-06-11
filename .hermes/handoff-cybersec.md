Task: Cybersecurity operationalization — advance 5 queued sources through full pipeline

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/pipeline.ts (one-shot pipeline — USE THIS, not manual stages)
- ENGINE RUNS: cybersec-wazuh, cybersec-safeline, cybersec-x64dbg, cybersec-security-checklist, cybersec-ai-skills are already in intake queue and have engine runs at runtime/host-artifacts/engine-runs/

Context:
All 5 cybersec sources were submitted earlier and have engine runs. Wazuh was fully registered via manual pipeline. The remaining 4 need to go through the one-shot pipeline. Some may already have partial artifacts from earlier attempts — use fresh candidate IDs to avoid stale state.

Allowed files:
- scripts/pipeline.ts (USE — do not modify)
- scripts/domains.txt (add cybersecurity domain if not present)

Forbidden:
- Do not modify pipeline.ts.
- Do not manually create routing records, follow-ups, or any pipeline artifacts.
- Do not use CLI write commands or web host API directly.
- Do not touch existing artifacts in the directive root.

Required implementation:
1. Run the one-shot pipeline for each remaining cybersecurity source:
   ```
   npx tsx scripts/pipeline.ts "Wazuh XDR/SIEM" "https://github.com/wazuh/wazuh" "github-repo"
   npx tsx scripts/pipeline.ts "SafeLine WAF" "https://github.com/chaitin/SafeLine" "github-repo"
   npx tsx scripts/pipeline.ts "x64dbg Debugger" "https://github.com/x64dbg/x64dbg" "github-repo"
   npx tsx scripts/pipeline.ts "Security Checklist" "https://github.com/lissy93/personal-security-checklist" "github-repo"
   npx tsx scripts/pipeline.ts "AI Cybersecurity Skills" "https://github.com/mukul975/Anthropic-Cybersecurity-Skills" "github-repo"
   ```

2. After each pipeline run:
   - Confirm "*** REGISTERED! ***" appears in output
   - Log the registry entry path
   - Create matching Hermes skill via skill_manage

3. Add "cybersecurity tools stars:>5000" to scripts/domains.txt if not already present

4. Report: how many registered, registry paths, skills created

Required command:
npx tsx scripts/pipeline.ts "Wazuh XDR/SIEM" "https://github.com/wazuh/wazuh" "github-repo"

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| All 5 pipeline runs complete with REGISTERED | | |
| Registry has cybersec entries (check runtime/08-registry/) | | |
| domains.txt includes cybersecurity query | | |
| Hermes skills created for each | | |

Final report must include:
1. Each pipeline run result (REGISTERED or FAILED)
2. Registry entry count after all 5
3. Skills created
4. Self-check table
