"use client"

import { MOCK_SYSTEM_STATE, MOCK_AGENT_DETAIL } from "@/lib/mock-data"
import { PhaseBadge, ClaimBadge, PriorityDot, TokenCount, RelativeTime, LabelChip, SectionHeader } from "@/components/ui-atoms"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import { useState } from "react"

const allAgents = Object.values(MOCK_AGENT_DETAIL)

export function AgentsList() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "running" | "retrying">("all")

  const filtered = allAgents.filter((a) => {
    const matchesSearch =
      a.issue_identifier.toLowerCase().includes(search.toLowerCase()) ||
      a.title.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === "all" ||
      (filter === "running" && a.status === "Running") ||
      (filter === "retrying" && a.status === "RetryQueued")
    return matchesSearch && matchesFilter
  })

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Coding Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {MOCK_SYSTEM_STATE.counts.running} running · {MOCK_SYSTEM_STATE.counts.retrying} retrying · {MOCK_SYSTEM_STATE.completed_today} completed today
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          {(["all", "running", "retrying"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                filter === f
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Agent cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg px-6 py-12 text-center text-muted-foreground text-sm">
            No agents match your filters
          </div>
        ) : (
          filtered.map((agent) => (
            <AgentRow key={agent.issue_identifier} agent={agent} />
          ))
        )}
      </div>
    </div>
  )
}

function AgentRow({ agent }: { agent: ReturnType<typeof Object.values<typeof MOCK_AGENT_DETAIL>[number]> }) {
  const running = agent.running
  return (
    <Link href={`/agents/${agent.issue_identifier}`}>
      <div className="bg-card border border-border rounded-lg px-5 py-4 hover:bg-accent/30 transition-colors cursor-pointer group">
        <div className="flex items-start gap-4">
          {/* Priority + identifier */}
          <div className="flex items-center gap-2 min-w-[90px]">
            <PriorityDot priority={agent.priority} />
            <span className="font-mono text-sm text-primary">{agent.issue_identifier}</span>
          </div>

          {/* Title + labels */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{agent.title}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {agent.labels.map((l) => <LabelChip key={l} label={l} />)}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ClaimBadge status={agent.status} />
            {running && <PhaseBadge phase={running.phase} />}
          </div>

          {/* Metrics */}
          {running ? (
            <div className="grid grid-cols-3 gap-4 text-right flex-shrink-0 min-w-[280px]">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Turns</div>
                <div className="font-mono text-sm text-foreground">{running.turn_count}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tokens</div>
                <div className="font-mono text-sm"><TokenCount value={running.tokens.total_tokens} /></div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Started</div>
                <RelativeTime iso={running.started_at} />
              </div>
            </div>
          ) : agent.retry ? (
            <div className="grid grid-cols-2 gap-4 text-right flex-shrink-0 min-w-[180px]">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Attempt</div>
                <div className="font-mono text-sm text-foreground">#{agent.retry.attempt}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Error</div>
                <div className="text-[11px] text-warning font-mono truncate max-w-[120px]">{agent.last_error}</div>
              </div>
            </div>
          ) : (
            <div className="min-w-[180px]" />
          )}

          {/* Arrow */}
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
        </div>

        {/* Last message */}
        {running?.last_message && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{running.last_message}</span>
            {running.last_event_at && <RelativeTime iso={running.last_event_at} />}
          </div>
        )}
        {agent.last_error && !running && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
            <span className="text-xs text-muted-foreground font-mono truncate">{agent.last_error}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
