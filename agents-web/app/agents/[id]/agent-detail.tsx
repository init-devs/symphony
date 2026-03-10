"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ExternalLink,
  RefreshCw,
  Terminal,
  CheckCircle2,
} from "lucide-react"
import { format } from "date-fns"
import { fetchIssueDetail } from "@/lib/api/client"
import type { IssueDetail as IssueDetailPayload } from "@/lib/api/schemas"
import {
  ClaimBadge,
  Countdown,
  EventBadge,
  LabelChip,
  PhaseBadge,
  PriorityDot,
  RelativeTime,
  SessionId,
  StatCard,
  TokenCount,
} from "@/components/ui-atoms"

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

export function AgentDetail({ issueIdentifier }: { issueIdentifier: string }) {
  const [agent, setAgent] = useState<IssueDetailPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadIssue = useCallback(async () => {
    try {
      const payload = await fetchIssueDetail(issueIdentifier)
      setAgent(payload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading issue detail")
    } finally {
      setIsLoading(false)
    }
  }, [issueIdentifier])

  useEffect(() => {
    setIsLoading(true)
    void loadIssue()

    const interval = setInterval(() => {
      void loadIssue()
    }, 5000)

    return () => clearInterval(interval)
  }, [loadIssue])

  if (isLoading) {
    return <div className="px-6 py-10 text-sm text-muted-foreground">Loading issue detail...</div>
  }

  if (!agent) {
    return (
      <div className="px-6 py-10">
        <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-sm text-error-foreground">
          {error || "Issue not found"}
        </div>
      </div>
    )
  }

  const running = agent.running

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All agents
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <PriorityDot priority={agent.priority} />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-lg font-semibold text-primary">{agent.issue_identifier}</span>
                <ClaimBadge status={agent.status === "running" ? "Running" : "RetryQueued"} />
                {running && <PhaseBadge phase={running.phase} />}
              </div>
              <h1 className="text-base font-medium text-foreground mt-1 leading-snug max-w-2xl">
                {agent.title || agent.tracker_state || "Untitled issue"}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {agent.labels.map((label) => (
                  <LabelChip key={label} label={label} />
                ))}
                {agent.tracker_state && (
                  <span className="text-[10px] text-muted-foreground font-mono ml-1">
                    {agent.tracker_state}
                  </span>
                )}
              </div>
            </div>
          </div>
          {agent.url && (
            <a
              href={agent.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Linear
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-xs text-error-foreground font-mono">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Issue Description</div>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {agent.description || "No description available."}
        </p>
      </div>

      {running ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Current turn" value={running.turn_count} sub="turns in session" accent="running" />
          <StatCard
            label="Total tokens"
            value={<TokenCount value={running.tokens.total_tokens} />}
            sub={`${(running.tokens.input_tokens / 1000).toFixed(1)}K in · ${(running.tokens.output_tokens / 1000).toFixed(1)}K out`}
          />
          <StatCard
            label="Session started"
            value={<RelativeTime iso={running.started_at} />}
            sub={`attempt ${agent.attempts.current_retry_attempt ?? "first"}`}
          />
          <StatCard
            label="Restarts"
            value={agent.attempts.restart_count}
            sub="total session restarts"
            accent={agent.attempts.restart_count > 0 ? "warning" : undefined}
          />
        </div>
      ) : agent.retry ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Retry attempt" value={`#${agent.retry.attempt}`} accent="warning" />
          <StatCard label="Next retry" value={<Countdown iso={agent.retry.due_at} />} />
          <StatCard label="Restarts" value={agent.attempts.restart_count} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {agent.token_history.length > 1 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Usage Over Time</div>
                {running && <TokenCount value={running.tokens.total_tokens} label="total" />}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={agent.token_history} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="agentTokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.72 0.19 155)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.72 0.19 155)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
                  <XAxis
                    dataKey="at"
                    tickFormatter={formatTime}
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.155 0.01 264)",
                      border: "1px solid oklch(0.24 0.012 264)",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                    labelFormatter={(v) => formatTime(String(v))}
                    formatter={(v: number) => [`${(v / 1000).toFixed(1)}K tokens`, "Total"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="total_tokens"
                    stroke="oklch(0.72 0.19 155)"
                    strokeWidth={1.5}
                    fill="url(#agentTokenGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Event Stream</span>
              </div>
              {running && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot" />
                  Live
                </div>
              )}
            </div>
            <div className="divide-y divide-border">
              {agent.recent_events.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No events recorded</div>
              ) : (
                agent.recent_events.map((event, index) => (
                  <div key={`${event.at}-${index}`} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      <EventIcon event={event.event} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventBadge event={event.event} />
                        <RelativeTime iso={event.at} />
                      </div>
                      {event.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono leading-relaxed">
                          {event.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {running && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Session</div>
              <InfoRow label="Session ID" value={<SessionId id={running.session_id} />} />
              <InfoRow label="Phase" value={<PhaseBadge phase={running.phase} />} />
              <InfoRow label="Last event" value={<RelativeTime iso={running.last_event_at} />} />
              <InfoRow label="Turns" value={<span className="font-mono text-sm">{running.turn_count}</span>} />
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Workspace</div>
            <div className="font-mono text-xs text-foreground bg-muted rounded px-2.5 py-2 break-all">
              {agent.workspace.path}
            </div>
            <InfoRow label="Restarts" value={<span className="font-mono text-sm">{agent.attempts.restart_count}</span>} />
            {agent.attempts.current_retry_attempt !== null && (
              <InfoRow
                label="Retry attempt"
                value={<span className="font-mono text-sm text-warning">#{agent.attempts.current_retry_attempt}</span>}
              />
            )}
          </div>

          {agent.last_error && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-error-foreground" />
                <span className="text-xs font-medium text-error-foreground uppercase tracking-wider">Last Error</span>
              </div>
              <p className="text-xs font-mono text-error-foreground/90 leading-relaxed">{agent.last_error}</p>
            </div>
          )}

          {agent.retry && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-medium text-warning uppercase tracking-wider">Retry Scheduled</span>
              </div>
              <InfoRow label="Attempt" value={<span className="font-mono text-sm text-warning">#{agent.retry.attempt}</span>} />
              <InfoRow label="Due in" value={<Countdown iso={agent.retry.due_at} />} />
            </div>
          )}

          {running && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Breakdown</div>
              <TokenBreakdown label="Input" value={running.tokens.input_tokens} total={running.tokens.total_tokens} color="oklch(0.62 0.22 268)" />
              <TokenBreakdown label="Output" value={running.tokens.output_tokens} total={running.tokens.total_tokens} color="oklch(0.72 0.19 155)" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{value}</div>
    </div>
  )
}

function TokenBreakdown({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          <TokenCount value={value} />
          <span className="text-muted-foreground ml-1">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function EventIcon({ event }: { event: string | null | undefined }) {
  if (event === "turn_completed" || event === "session_started") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-running" />
  }

  if (event?.includes("failed") || event?.includes("error")) {
    return <AlertTriangle className="w-3.5 h-3.5 text-error-foreground" />
  }

  if (event === "turn_input_required") {
    return <AlertTriangle className="w-3.5 h-3.5 text-warning" />
  }

  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
}
