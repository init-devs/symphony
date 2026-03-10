"use client"

import { useState } from "react"
import { SectionHeader } from "@/components/ui-atoms"
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, FileText, Settings2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock effective config derived from a WORKFLOW.md
const MOCK_CONFIG = {
  tracker: {
    kind: "linear",
    endpoint: "https://api.linear.app/graphql",
    api_key: "$LINEAR_API_KEY",
    project_slug: "eng-platform",
    active_states: ["Todo", "In Progress"],
    terminal_states: ["Closed", "Cancelled", "Canceled", "Duplicate", "Done"],
  },
  polling: {
    interval_ms: 30000,
  },
  workspace: {
    root: "/tmp/symphony_workspaces",
  },
  hooks: {
    after_create: "git clone $REPO_URL . && npm ci",
    before_run: "git fetch origin && git reset --hard origin/main",
    after_run: null,
    before_remove: null,
    timeout_ms: 60000,
  },
  agent: {
    max_concurrent_agents: 10,
    max_retry_backoff_ms: 300000,
    max_turns: 20,
    max_concurrent_agents_by_state: {},
  },
  codex: {
    command: "codex app-server",
    approval_policy: "auto-approve-except-destroy",
    thread_sandbox: "workspace-only",
    turn_sandbox_policy: "workspace-only",
    turn_timeout_ms: 3600000,
    read_timeout_ms: 5000,
    stall_timeout_ms: 300000,
  },
  server: {
    port: 4000,
  },
}

const MOCK_WORKFLOW_MD = `---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: eng-platform
  active_states: [Todo, In Progress]

polling:
  interval_ms: 30000

workspace:
  root: /tmp/symphony_workspaces

hooks:
  after_create: |
    git clone $REPO_URL . && npm ci
  before_run: |
    git fetch origin && git reset --hard origin/main
  timeout_ms: 60000

agent:
  max_concurrent_agents: 10
  max_turns: 20
  max_retry_backoff_ms: 300000

codex:
  command: codex app-server
  approval_policy: auto-approve-except-destroy
  thread_sandbox: workspace-only
  turn_timeout_ms: 3600000
  stall_timeout_ms: 300000

server:
  port: 4000
---

You are a senior software engineer working on the **{{ issue.identifier }}** issue.

## Task
**{{ issue.title }}**

{% if issue.description %}
{{ issue.description }}
{% endif %}

{% if attempt %}
> This is retry attempt #{{ attempt }}. Review previous work in the workspace before continuing.
{% endif %}

## Instructions
1. Understand the full scope of the task from the issue description
2. Examine existing code structure before making changes
3. Write clean, well-tested code following project conventions
4. Run tests to verify correctness before finishing
5. Create a pull request with a clear description of changes made

## Labels
{% for label in issue.labels %}
- {{ label }}
{% endfor %}

When complete, transition the issue to **Human Review** state.`

const VALIDATION_STATUS = {
  workflow_file: "ok" as const,
  tracker_kind: "ok" as const,
  tracker_api_key: "ok" as const,
  tracker_project_slug: "ok" as const,
  codex_command: "ok" as const,
}

export function ConfigView() {
  const [activeTab, setActiveTab] = useState<"effective" | "raw" | "validation">("effective")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["tracker", "polling", "agent", "codex"])
  )

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Effective runtime config derived from{" "}
            <span className="font-mono text-foreground">WORKFLOW.md</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-running bg-running/15 px-2.5 py-1.5 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Config valid
          </div>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent">
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 w-fit">
        {([
          { key: "effective", label: "Effective Config", icon: Settings2 },
          { key: "raw", label: "WORKFLOW.md", icon: FileText },
          { key: "validation", label: "Validation", icon: CheckCircle2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              activeTab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Effective config */}
      {activeTab === "effective" && (
        <div className="space-y-2">
          {Object.entries(MOCK_CONFIG).map(([sectionKey, sectionValue]) => {
            const isExpanded = expandedSections.has(sectionKey)
            return (
              <div key={sectionKey} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                  onClick={() => toggleSection(sectionKey)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="font-mono text-sm font-medium text-foreground">{sectionKey}</span>
                    {sectionKey === "tracker" && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-mono ml-1">
                        {(sectionValue as typeof MOCK_CONFIG.tracker).kind}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {Object.keys(sectionValue as object).length} keys
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {Object.entries(sectionValue as object).map(([k, v]) => (
                      <ConfigRow key={k} k={`${sectionKey}.${k}`} v={v} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Raw WORKFLOW.md */}
      {activeTab === "raw" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm text-foreground">WORKFLOW.md</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot" />
              Watching for changes
            </div>
          </div>
          <pre className="px-4 py-4 text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre-wrap">
            <WorkflowMarkdown content={MOCK_WORKFLOW_MD} />
          </pre>
        </div>
      )}

      {/* Validation */}
      {activeTab === "validation" && (
        <div className="space-y-4">
          {/* Preflight checks */}
          <div>
            <SectionHeader title="Dispatch Preflight Checks" />
            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
              {Object.entries({
                "Workflow file readable": VALIDATION_STATUS.workflow_file,
                "tracker.kind present & supported": VALIDATION_STATUS.tracker_kind,
                "tracker.api_key resolved": VALIDATION_STATUS.tracker_api_key,
                "tracker.project_slug present": VALIDATION_STATUS.tracker_project_slug,
                "codex.command non-empty": VALIDATION_STATUS.codex_command,
              }).map(([check, status]) => (
                <div key={check} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground">{check}</span>
                  <div className="flex items-center gap-1.5">
                    {status === "ok" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-running" />
                        <span className="text-xs text-running">pass</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-error-foreground" />
                        <span className="text-xs text-error-foreground">fail</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* State configuration */}
          <div>
            <SectionHeader title="State Configuration" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active States</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOCK_CONFIG.tracker.active_states.map((s) => (
                    <span key={s} className="text-xs font-mono bg-running/15 text-running px-2 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Terminal States</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOCK_CONFIG.tracker.terminal_states.map((s) => (
                    <span key={s} className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Timeout overview */}
          <div>
            <SectionHeader title="Timeouts" />
            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
              {[
                { label: "Turn timeout", ms: MOCK_CONFIG.codex.turn_timeout_ms, note: "Hard per-turn limit" },
                { label: "Stall timeout", ms: MOCK_CONFIG.codex.stall_timeout_ms, note: "Inactivity detection" },
                { label: "Read timeout", ms: MOCK_CONFIG.codex.read_timeout_ms, note: "Startup handshake" },
                { label: "Hook timeout", ms: MOCK_CONFIG.hooks.timeout_ms, note: "All workspace hooks" },
                { label: "Max retry backoff", ms: MOCK_CONFIG.agent.max_retry_backoff_ms, note: "Backoff ceiling" },
              ].map(({ label, ms, note }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{note}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">
                      {ms >= 60000 ? `${ms / 60000}m` : ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">({ms}ms)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigRow({ k, v }: { k: string; v: unknown }) {
  const isSecret = k.includes("api_key") || k.includes("token") || k.includes("secret")
  const displayVal = (): React.ReactNode => {
    if (v === null) return <span className="text-muted-foreground">null</span>
    if (isSecret && typeof v === "string" && v.startsWith("$")) {
      return (
        <span className="font-mono text-xs">
          <span className="text-warning">{v}</span>
          <span className="text-muted-foreground ml-2">(env var)</span>
        </span>
      )
    }
    if (Array.isArray(v)) {
      return (
        <div className="flex flex-wrap gap-1">
          {v.map((item) => (
            <span key={item} className="text-[10px] font-mono bg-accent text-accent-foreground px-1.5 py-0.5 rounded border border-border">
              {String(item)}
            </span>
          ))}
        </div>
      )
    }
    if (typeof v === "object") {
      return <span className="text-muted-foreground text-xs">{"{ }"} (empty map)</span>
    }
    if (typeof v === "number") {
      const formatted = v >= 60000 ? `${v / 60000}m` : v >= 1000 ? `${v / 1000}s` : String(v)
      return <span className="font-mono text-xs text-foreground">{formatted} <span className="text-muted-foreground">({v})</span></span>
    }
    if (typeof v === "string" && v.includes("\n")) {
      return (
        <pre className="text-xs font-mono text-foreground bg-muted rounded px-2 py-1.5 whitespace-pre-wrap text-left max-w-sm overflow-x-auto">
          {v}
        </pre>
      )
    }
    return <span className="font-mono text-xs text-foreground">{String(v)}</span>
  }

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-accent/20 transition-colors">
      <span className="font-mono text-xs text-muted-foreground flex-shrink-0 min-w-[200px]">
        {k.split(".").pop()}
      </span>
      <div className="text-right flex-1">{displayVal()}</div>
    </div>
  )
}

function WorkflowMarkdown({ content }: { content: string }) {
  // Syntax-highlight the front matter and markdown body
  const [frontMatter, body] = (() => {
    if (!content.startsWith("---")) return ["", content]
    const end = content.indexOf("---", 3)
    if (end === -1) return ["", content]
    return [content.slice(0, end + 3), content.slice(end + 3)]
  })()

  return (
    <>
      <span className="text-muted-foreground">{frontMatter}</span>
      <span className="text-foreground">{body}</span>
    </>
  )
}
