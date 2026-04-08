# Discovery Fast-Path Record Template

Use this by default.

Split into separate intake, triage, and routing records only when the candidate is complex, disputed, batched, rerouted, or being held in Discovery.

- Candidate id:
- Candidate name:
- Record date:
- Source type:
- Source reference:
- Source location on disk:
- Claimed value:
- First-pass summary:
- Stack language:
- Stack runtime:
- Stack framework:
- Stack package tool:
- Stack deployment:
- Stack external dependencies:
- Stack data model assumptions:
- Stack integration shape:
- Adoption target:
- Decision state:
- Route destination:
- Why this route:
- Why not the alternatives:
- Need bounded proof:
- Next artifact:
- Compaction profile (if compacted):
- Compaction status (`full | compacted | bypass`):
- Compaction reason (required if bypass):
- Re-entry trigger (if held):
- Review cadence (if held):
- Mission alignment (which active-mission objective does this serve):
- Addresses known capability gap (gap_id or n/a):
- Gap worklist rank (if selected from `discovery/gap-worklist.json`):

## Source-analysis preparation (when routing to Architecture)

Fill these when routing a source to Architecture. They accelerate the source-analysis-contract step.

- Initial value hypothesis:
- Initial baggage signals:
- Usefulness level hint: `direct` | `structural` | `meta`
- Next required Architecture artifact: `source-analysis-contract` → `adaptation-decision-contract`
