# Runtime Adapter Architecture

This document describes the runtime abstraction introduced for Symphony Elixir and the
current OpenCode backend implementation.

## Overview

Symphony now routes agent execution through a runtime adapter boundary:

- `SymphonyElixir.Runtime.Adapter` (behaviour)
- `SymphonyElixir.Runtime` (provider selection)
- `SymphonyElixir.Runtime.OpenCode` (OpenCode `serve` backend)

`AgentRunner` no longer talks directly to a Codex app-server client. It resolves the
configured runtime provider and invokes adapter callbacks (`start_session`, `run_turn`,
`stop_session`).

## OpenCode Backend Lifecycle

For each issue workspace run:

1. Start OpenCode server process from `runtime.command` in the workspace cwd.
2. Parse server stdout to discover the listening URL.
3. Create an OpenCode session scoped to the workspace directory.
4. For each turn:
   - open a global SSE stream (`/global/event`),
   - submit prompt via `POST /session/:id/message`,
   - normalize runtime events into Symphony worker updates,
   - close stream when turn completes.
5. Stop server process when session ends.

## Event Normalization

OpenCode SSE payload types (for example `message.part.updated`, `session.status`) are mapped
to Symphony worker events and emitted with timestamps. Token usage is normalized into:

- `input_tokens`
- `output_tokens`
- `total_tokens`

These updates feed existing orchestrator token accounting and status rendering.

## Real-Time Activity Interface

Symphony now records a bounded in-memory activity history in the orchestrator and publishes
activity events over PubSub.

API additions:

- `GET /api/v1/activity` - recent normalized activity events (JSON)
- `GET /api/v1/activity/stream` - SSE stream for real-time frontend consumption

The stream sends:

- initial `snapshot` event
- ongoing `activity` events
- periodic keep-alive comments

## Workflow Config Migration

Runtime settings now live under `runtime.*`:

```yaml
runtime:
  provider: opencode
  command: opencode serve --hostname 127.0.0.1 --port 0
  model: openai/gpt-5.3-codex
  agent: build
  variant: xhigh
```

`codex.command` is no longer used as a runtime command source.

## Known Non-Preservable Differences

Because OpenCode `serve` is not Codex app-server JSON-RPC, exact protocol parity is not
possible. Current intentional differences:

- No thread/start or turn/start JSON-RPC handshake.
- Approval-policy/sandbox knobs from `codex.*` are not part of `runtime.*` behavior.
- Event taxonomy differs and is normalized best-effort.
- Token/rate-limit signals depend on OpenCode event payloads and may differ from Codex fields.
