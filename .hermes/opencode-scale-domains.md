Task: Scale domains — batch auto-ingest for multiple technology domains

Repository:
C:\Users\User\AppData\Local\hermes\systems\directive-kernel

Primary specs:
- scripts/auto-ingest.ts (single-domain ingest — working)
- scripts/auto-ingest.sh (single-arg bash wrapper — working)
- scripts/pipeline.ts (one-shot pipeline — working)

Context:
auto-ingest.sh currently takes one query argument and discovers + registers repos for that domain. The goal is to run it for multiple domains in sequence, with a delay between batches to respect GitHub API rate limits.

Allowed files:
- scripts/auto-ingest.sh (MODIFY — add multi-domain loop)
- scripts/domains.txt (NEW — list of domains to ingest)

Forbidden:
- Do not modify auto-ingest.ts or pipeline.ts.
- Do not modify any kernel code.
- Do not make GitHub API calls that would trigger rate limiting (use 60s delay between domains).

Required implementation:
1. Create scripts/domains.txt with these lines (one domain per line):
   fastapi express graphql nestjs backend frameworks
   apache spark airflow dbt data engineering
   langchain llamaindex vector database ai ml
   kubernetes terraform ansible docker devops
   react vue svelte angular frontend frameworks

2. Modify scripts/auto-ingest.sh to:
   a. If called with no arguments: read domains from scripts/domains.txt, run auto-ingest for each domain
   b. If called with one argument: run auto-ingest for that single domain (existing behavior preserved)
   c. Add a 60-second delay between domains to respect API rate limits
   d. Print a running total: domains processed, repos registered so far
   e. Print final summary at the end

3. The script must:
   - Handle errors gracefully — if one domain fails, continue to the next
   - Print clear section headers between domains
   - Exit with the number of failed domains as exit code

Required command:
bash scripts/auto-ingest.sh  (no args — reads domains.txt)

Self-check before final:
| Check | Pass/Fail | Evidence |
| --- | --- | --- |
| domains.txt exists with 5+ domains | | |
| Running without args reads domains.txt | | |
| Running with arg preserves single-domain behavior | | |
| 60-second delay between domains | | |
| Errors in one domain don't stop others | | |
| Final summary shows total processed and registered | | |

Final report must include:
1. Files changed (with line counts)
2. Example output from running `bash scripts/auto-ingest.sh` with no args
3. Total repos registered across all domains
4. Self-check table
5. Anything not completed and why
