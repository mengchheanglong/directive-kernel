# MCP-Driven Clean Pipeline — Next Session

When MCP tools are loaded after restart, execute these steps in order for shadcn/ui on the clean directive root.

## Prerequisites
- MCP tools loaded (66 directive-kernel tools available)
- Clean directive root at: C:/Users/User/AppData/Local/hermes/directive-root-clean/directive-root
- Source already submitted and engine-processed
- Follow-up artifact already created

## Pipeline Steps

### Step 0: Open Discovery Route
```
Tool: mcp_directive-kernel_discovery_open_route
Args: {
  "routingPath": "discovery/03-routing-log/routing-hermes-shadcn-clean.json",
  "approved": true
}
```
Creates the routing record linking Discovery → Runtime. Required before Runtime advancement.

### Step 1: Open Follow-up
```
Tool: mcp_directive-kernel_runtime_open_follow_up
Args: {
  "followUpPath": "runtime/00-follow-up/2026-06-10-hermes-shadcn-clean-runtime-follow-up-record.md",
  "approved": true
}
```
Advances follow-up → creates Runtime record.

### Step 2: Open Record Proof
```
Tool: mcp_directive-kernel_runtime_open_proof
Args: {
  "runtimeRecordPath": "<from_step_1>",
  "approved": true
}
```
Advances record → creates proof artifact.

### Step 3: Open Capability Boundary
```
Tool: mcp_directive-kernel_runtime_open_runtime_capability_boundary
Args: {
  "runtimeProofPath": "<from_step_2>",
  "approved": true
}
```
Advances proof → creates capability boundary.

### Step 4: Open Promotion Readiness
```
Tool: mcp_directive-kernel_runtime_open_promotion_readiness
Args: {
  "capabilityBoundaryPath": "<from_step_3>",
  "approved": true
}
```
Advances capability boundary → creates promotion readiness.

### Step 5: Seam Decision
```
Tool: mcp_directive-kernel_runtime_promotion_seam_decisions
Args: {
  "promotionReadinessPath": "<from_step_4>",
  "rationale": "Approved: shadcn/ui React component library (116K stars) ready for registry.",
  "approvedBy": "hermes-agent-operator"
}
```
Creates promotion record.

### Step 6: Selection Resolution
```
Tool: mcp_directive-kernel_runtime_selection_resolutions
Args: {
  "promotionReadinessPath": "<from_step_4>",
  "decision": "select_standalone",
  "rationale": "Deploy as standalone Hermes capability.",
  "reviewedBy": "hermes-agent-operator"
}
```

### Step 7: Registry Acceptance
```
Tool: mcp_directive-kernel_runtime_registry_acceptance_decisions
Args: {
  "promotionRecordPath": "<from_step_5>",
  "rationale": "Accepted: shadcn/ui capability proven and promoted to Hermes registry.",
  "acceptedBy": "hermes-agent-operator"
}
```
Final step — capability in registry.

### Step 8: Absorb as Hermes Skill
```
Tool: skill_manage
Args: {
  "action": "create",
  "name": "shadcn-ui-components",
  "category": "software-development",
  "content": "<SKILL.md with capability details>"
}
```

## Success Criteria
- All 7 steps return ok: true
- Registry directory contains the shadcn/ui entry
- skill_manage creates the Hermes skill
- UI dashboard shows the capability in Runtime registry

## Fallback
If any step fails, check the error message:
- "routing record" → ensure Step 0 completed
- "stale artifact" → check current head path, may need to start from correct stage
- "legacy_recorded" → use clean root, don't manually write to 07-promotion-records