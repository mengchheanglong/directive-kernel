# Control

This folder holds the minimal control surface that Directive Kernel still reads directly.

It intentionally ships only:
- `state/` for active machine-readable control data

Directive Kernel does not ship old workspace control history, empty illustrative folders, or unused control scaffolding.

If a consuming project later needs `logs/`, `reports/`, `runbook/`, `templates/`, or `policies/`, it should create them locally on purpose.
