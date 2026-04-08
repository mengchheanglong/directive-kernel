# Browser Smoke Guard Contract

Purpose:
- enforce bounded browser-smoke evidence on Runtime promotion records before callable browser-lane claims
- ensure browser-lane promotions capture explicit smoke report artifacts, flow results, screenshot evidence, and rollback scope

Scope:
- applies to Runtime promotion records whose `Quality gate profile` is `browser_smoke_guard/v1`
- applies to linked proof artifacts referenced by `Proof path`

Canonical profile:
- `browser_smoke_guard/v1`

Canonical family:
- `bounded_browser_smoke`

Canonical proof shape:
- `ui_smoke_snapshot/v1`

Primary host checker:
- `npm run check:directive-puppeteer-runtime`

Baseline thresholds:
- smoke report `ok` must be `true`
- failed flows must equal `0`
- every flow must record a screenshot path
- issue leakage count must equal `0`

Required evidence:
- promotion record declares `Quality gate profile: browser_smoke_guard/v1`
- promotion record declares `Promotion profile family: bounded_browser_smoke`
- promotion record declares `Proof shape: ui_smoke_snapshot/v1`
- promotion record declares `Primary host checker: npm run check:directive-puppeteer-runtime`
- promotion record links the host smoke runner and proof artifact
- proof artifact records:
  - smoke report path
  - smoke archive path
  - base URL
  - passed flows
  - failed flows
  - expected flow ids
  - screenshot artifact paths
  - gate outcomes for:
    - `npm run ui:smoke`
    - `npm run check:ui-smoke`
    - `npm run check:directive-puppeteer-runtime`
    - `npm run check:ops-stack`

Decision rules:
1. A bounded browser lane may claim `pass` only when the linked smoke report passes with zero failed flows and zero issue leaks.
2. A bounded browser lane must remain scoped to smoke validation and screenshot/report artifacts; it does not imply broad destructive browser automation privileges.
3. Rollback may remove slice-specific Runtime artifacts and checker wiring while keeping generic host smoke scripts if they remain independently useful.

Validation hooks:
- `npm run check:directive-puppeteer-runtime`
- `npm run check:ops-stack`

Canonical inventory:
- `runtime/meta/PROMOTION_PROFILES.json`
