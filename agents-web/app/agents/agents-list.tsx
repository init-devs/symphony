"use client"

import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useObservability } from "@/components/observability-provider"
import {
  ClaimBadge,
  LabelChip,
  PhaseBadge,
  PriorityDot,
  RelativeTime,
  TokenCount,
} from "@/components/ui-atoms"

export function AgentsList() {
  const { issues, state, isLoading } = useObservability()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "running" | "retrying">("all")

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSearch =
        issue.issue_identifier.toLowerCase().includes(search.toLowerCase()) ||
        (issue.title || "").toLowerCase().includes(search.toLowerCase())

      const matchesFilter =
        filter === "all" ||
        (filter === "running" && issue.status === "Running") ||
        (filter === "retrying" && issue.status === "RetryQueued")

      return matchesSearch && matchesFilter
    })
  }, [issues, search, filter])

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Coding Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {state?.counts.running ?? 0} running · {state?.counts.retrying ?? 0} retrying · {state?.service.completed_count ?? 0} completed
          </p>
        </div>
      </div>

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
          {(["all", "running", "retrying"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                filter === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="bg-card border border-border rounded-lg px-6 py-12 text-center text-muted-foreground text-sm">
            Loading agents...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg px-6 py-12 text-center text-muted-foreground text-sm">
            No agents match your filters
          </div>
        ) : (
          filtered.map((issue) => <AgentRow key={issue.issue_identifier} issue={issue} />)
        )}
      </div>
    </div>
  )
}

function AgentRow({ issue }: { issue: ReturnType<typeof useObservability>["issues"][number] }) {
  const running = issue.running

  return (
    <Link href={`/agents/${issue.issue_identifier}`}>
      <div className="bg-card border border-border rounded-lg px-5 py-4 hover:bg-accent/30 transition-colors cursor-pointer group">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-2 min-w-[90px]">
            <PriorityDot priority={issue.priority} />
            <span className="font-mono text-sm text-primary">{issue.issue_identifier}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground truncate">{issue.title || issue.tracker_state || "Untitled issue"}</div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {issue.labels.map((label) => (
                <LabelChip key={label} label={label} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <ClaimBadge status={issue.status} />
            {running && <PhaseBadge phase={running.phase} />}
          </div>

          {running ? (
            <div className="grid grid-cols-3 gap-4 text-right flex-shrink-0 min-w-[280px]">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Turns</div>
                <div className="font-mono text-sm text-foreground">{running.turn_count}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tokens</div>
                <div className="font-mono text-sm">
                  <TokenCount value={running.tokens.total_tokens} />
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Started</div>
                <RelativeTime iso={running.started_at} />
              </div>
            </div>
          ) : issue.retry ? (
            <div className="grid grid-cols-2 gap-4 text-right flex-shrink-0 min-w-[180px]">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Attempt</div>
                <div className="font-mono text-sm text-foreground">#{issue.retry.attempt}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Error</div>
                <div className="text-[11px] text-warning font-mono truncate max-w-[140px]">{issue.last_error || "n/a"}</div>
              </div>
            </div>
          ) : (
            <div className="min-w-[180px]" />
          )}

          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
        </div>

        {running?.last_message && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{running.last_message}</span>
            <RelativeTime iso={running.last_event_at} />
          </div>
        )}

        {issue.last_error && !running && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
            <span className="text-xs text-muted-foreground font-mono truncate">{issue.last_error}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
