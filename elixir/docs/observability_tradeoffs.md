# Observability Dashboard Tradeoffs

This document captures known constraints in the current `agents-web` + Elixir observability setup.

## Current posture

- The dashboard is optimized for localhost and trusted-network development.
- Authn/authz is not enforced for `/api/v1/*`.
- API and UI are coupled through a same-origin proxy (`agents-web` rewrites to `SYMPHONY_API_ORIGIN`).

## Intentional deferrals

- **Authentication and authorization**
  - No session, token, or role checks are required yet.
  - Intended future work: API auth middleware and dashboard access controls.

- **Transport hardening**
  - The default setup assumes plain HTTP on localhost.
  - Intended future work: TLS termination guidance and stricter CORS/origin policy for non-local use.

- **SSE resilience**
  - Activity streaming uses browser `EventSource` with default reconnect behavior.
  - Keepalive events prevent idle disconnects, but there is no resumable cursor replay.
  - Intended future work: cursor-based resume and explicit backoff/retry telemetry.

- **Config and operational safeguards**
  - UI-level refresh and polling controls assume trusted operators.
  - Intended future work: rate limiting, audit trails, and permissioned mutating endpoints.

## API contract notes

- `elixir/priv/openapi/observability.v1.yaml` is the source-of-truth contract.
- `GET /api/v1/openapi.yaml` serves the runtime copy used by clients and tooling.
- Frontend runtime validation uses Zod schemas mirroring API payloads.

## Local validation checklist

- Start Elixir API on `127.0.0.1:4000`.
- Start `agents-web` with `SYMPHONY_API_ORIGIN=http://127.0.0.1:4000`.
- Confirm UI routes return 200: `/`, `/agents`, `/queue`, `/analytics`, `/config`, `/agents/<id>`.
- Confirm API proxy health through frontend:
  - `GET /api/v1/state`
  - `GET /api/v1/issues`
  - `GET /api/v1/config`
  - `GET /api/v1/openapi.yaml`
  - `POST /api/v1/refresh`
