# Standalone Host API Auth Guard

This contract defines the bounded API auth rule for the standalone reference host.

Purpose:
- prevent the reference API host from remaining fully open once it is used beyond throwaway local testing
- keep auth minimal, explicit, and product-owned
- avoid pretending the reference host already has a full production auth/session system

Supported mode:
- `static_bearer`

Public route:
- `GET /health`

Protected routes when `auth.mode = static_bearer`:
- `GET /api/runtime/status`
- `GET /api/discovery/overview`
- `POST /api/discovery/submissions`

Auth requirements:
- requests must send `Authorization: Bearer <token>`
- the token may come from config or an environment variable referenced by config
- the token must never be exposed through runtime status, boot logs, or access logs

Boundary:
- no user/session system
- no RBAC
- no refresh tokens
- no host identity provider integration

This is a reference-host hardening guard, not a full production auth architecture.
