# Symphony Elixir

This directory contains the current Elixir/OTP implementation of Symphony, based on
[`SPEC.md`](../SPEC.md) at the repository root.

> [!WARNING]
> Symphony Elixir is prototype software intended for evaluation only and is presented as-is.
> We recommend implementing your own hardened version based on `SPEC.md`.

## Screenshot

![Symphony Elixir screenshot](../.github/media/elixir-screenshot.png)

## How it works

1. Polls Linear for candidate work
2. Creates an isolated workspace per issue
3. Launches the configured runtime backend (default: OpenCode `serve`) inside the workspace
4. Sends a workflow prompt to the runtime
5. Keeps the runtime working on the issue until the work is done

If a claimed issue moves to a terminal state (`Done`, `Closed`, `Cancelled`, or `Duplicate`),
Symphony stops the active agent for that issue and cleans up matching workspaces.

## How to use it

1. Make sure your codebase is set up to work well with agents: see
   [Harness engineering](https://openai.com/index/harness-engineering/).
2. Get a new personal token in Linear via Settings → Security & access → Personal API keys, and
   set it as the `LINEAR_API_KEY` environment variable.
3. Copy this directory's `WORKFLOW.md` to your repo.
4. Optionally copy the `commit`, `push`, `pull`, `land`, and `linear` skills to your repo.
   - The `linear` skill expects Symphony's `linear_graphql` app-server tool for raw Linear GraphQL
     operations such as comment editing or upload flows.
5. Customize the copied `WORKFLOW.md` file for your project.
   - To use project-scoped polling, get your project's slug by right-clicking the project and
     copying its URL.
   - To use team-scoped polling, set the team's key (for example `ES`).
   - When creating a workflow based on this repo, note that it depends on non-standard Linear
     issue statuses: "Rework", "Human Review", and "Merging". You can customize them in
     Team Settings → Workflow in Linear.
6. Follow the instructions below to install the required runtime dependencies and start the service.

## Prerequisites

We recommend using [mise](https://mise.jdx.dev/) to manage Elixir/Erlang versions.

```bash
mise install
mise exec -- elixir --version
```

## Run

```bash
git clone https://github.com/openai/symphony
cd symphony/elixir
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build
mise exec -- ./bin/symphony ./WORKFLOW.md
```

## Configuration

Pass a custom workflow file path to `./bin/symphony` when starting the service:

```bash
./bin/symphony /path/to/custom/WORKFLOW.md
```

If no path is passed, Symphony defaults to `./WORKFLOW.md`.

Optional flags:

- `--logs-root` tells Symphony to write logs under a different directory (default: `./log`)
- `--port` also starts the Phoenix observability service (default: disabled)

The `WORKFLOW.md` file uses YAML front matter for configuration, plus a Markdown body used as the
runtime session prompt.

Minimal example:

```md
---
tracker:
  kind: linear
  project_slug: "..."
workspace:
  root: ~/code/workspaces
hooks:
  after_create: |
    git clone git@github.com:your-org/your-repo.git .
agent:
  max_concurrent_agents: 10
  max_turns: 20
runtime:
  provider: opencode
  command: opencode serve --hostname 127.0.0.1 --port 0
---

You are working on a Linear issue {{ issue.identifier }}.

Title: {{ issue.title }} Body: {{ issue.description }}
```

Scope examples:

Project scoped (existing):

```yaml
tracker:
  kind: linear
  project_slug: "es-foundation-df8f5b414e47"
```

Team scoped (new):

```yaml
tracker:
  kind: linear
  team_key: "ES"
```

Notes:

- If a value is missing, defaults are used.
- For `tracker.kind: linear`, set at least one scope: `tracker.project_slug` or
  `tracker.team_key`.
- If both are set, `tracker.project_slug` takes precedence.
- `tracker.assignee` optionally filters candidate issues by assignee (`me` or a Linear user ID).
- `tracker.actionable_label` optionally filters candidate issues to only those containing the label.
- When both `tracker.assignee` and `tracker.actionable_label` are set, both filters apply.
- Assignee precedence is non-empty `tracker.assignee` first, then `LINEAR_ASSIGNEE`; empty values are treated as unset.
- `runtime.provider` currently supports `opencode`.
- `runtime.command` defaults to `opencode serve --hostname 127.0.0.1 --port 0`.
- Optional OpenCode request fields can be set with `runtime.model`, `runtime.agent`, and `runtime.variant`.
- `agent.max_turns` caps how many back-to-back runtime turns Symphony will run in a single agent
  invocation when a turn completes normally but the issue is still in an active state. Default: `20`.
- If the Markdown body is blank, Symphony uses a default prompt template that includes the issue
  identifier, title, and body.
- Use `hooks.after_create` to bootstrap a fresh workspace. For a Git-backed repo, you can run
  `git clone ... .` there, along with any other setup commands you need.
- If a hook needs `mise exec` inside a freshly cloned workspace, trust the repo config and fetch
  the project dependencies in `hooks.after_create` before invoking `mise` later from other hooks.
- `tracker.api_key` reads from `LINEAR_API_KEY` when unset or when value is `$LINEAR_API_KEY`.
- For path values, `~` is expanded to the home directory.
- For env-backed path values, use `$VAR`. `workspace.root` resolves `$VAR` before path handling,
  while `runtime.command` stays a shell command string and any `$VAR` expansion there happens in the
  launched shell.

```yaml
tracker:
  api_key: $LINEAR_API_KEY
workspace:
  root: $SYMPHONY_WORKSPACE_ROOT
hooks:
  after_create: |
    git clone --depth 1 "$SOURCE_REPO_URL" .
runtime:
  command: "$OPENCODE_BIN serve --hostname 127.0.0.1 --port 0"
```

- If `WORKFLOW.md` is missing or has invalid YAML, startup and scheduling are halted until fixed.
- `server.port` or CLI `--port` enables the optional Phoenix HTTP API at `/api/v1/*`.

## Observability API and dashboard

The Elixir service exposes a JSON/SSE API for observability under `/api/v1/*`:

- `GET /api/v1/state`
- `GET /api/v1/issues`
- `GET /api/v1/<issue_identifier>`
- `POST /api/v1/refresh`
- `GET /api/v1/activity`
- `GET /api/v1/activity/stream` (SSE)
- `GET /api/v1/config`
- `GET /api/v1/openapi.yaml`

`agents-web` is the primary dashboard. Run it separately and point it at this service:

```bash
cd ../agents-web
npm install
SYMPHONY_API_ORIGIN=http://127.0.0.1:4000 npm run dev
```

The frontend proxies `/api/v1/*` through Next.js rewrites, so browser calls stay same-origin.

## Project Layout

- `lib/`: application code and Mix tasks
- `test/`: ExUnit coverage for runtime behavior
- `WORKFLOW.md`: in-repo workflow contract used by local runs
- `../.codex/`: repository-local skills and setup helpers
- `docs/runtime_adapter.md`: runtime abstraction, OpenCode backend, and activity stream details
- `docs/observability_tradeoffs.md`: dashboard security/deployment tradeoffs and deferred hardening

## Testing

```bash
make all
```

## FAQ

### Why Elixir?

Elixir is built on Erlang/BEAM/OTP, which is great for supervising long-running processes. It has an
active ecosystem of tools and libraries. It also supports hot code reloading without stopping
actively running subagents, which is very useful during development.

### What's the easiest way to set this up for my own codebase?

Launch your preferred coding runtime in your repo, give it the URL to the Symphony repo, and ask it to set things up for you.

## License

This project is licensed under the [Apache License 2.0](../LICENSE).
