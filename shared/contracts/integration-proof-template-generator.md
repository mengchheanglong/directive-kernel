# Integration/Proof Template Generator Contract

Purpose:
- generate minimal `IntegrationContractArtifact` and `ProofChecklistArtifact` skeletons from experiment design artifacts
- reduce manual contract drift during Architecture-to-Runtime handoff preparation

Profile:
- `integration_proof_template_generator/v1`

Input:
- experiment artifact markdown path
- adoption target (optional override)
- integration mode (optional override)
- owner (optional override)

Required extracted fields from experiment artifact:
- `Candidate id`
- `Objective`
- `Validation Gates` commands
- `Required Output Artifact(s)` references
- `Rollback / No-op` summary

Output:
- one IntegrationContractArtifact markdown
- one ProofChecklistArtifact markdown

Rules:
- do not infer runtime-callable state
- preserve extracted gates verbatim when available
- if required gates are missing, apply fallback baseline:
  - `npm run check:directive-v0`
  - `npm run check:ops-stack`

Validation hooks:
- `npm run check:directive-integration-artifact-templates`
- `npm run check:ops-stack`
