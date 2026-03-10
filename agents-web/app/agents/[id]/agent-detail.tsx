"use client"

import type { IssueDetail } from "@/lib/mock-data"
import {
  PhaseBadge,
  ClaimBadge,
  PriorityDot,
  TokenCount,
  RelativeTime,
  Countdown,
  LabelChip,
  EventBadge,
  SessionId,
  SectionHeader,
  StatCard,
} from "@/components/ui-atoms"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Terminal, Clock, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { format } from "date-fns"

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

export function AgentDetail({ agent }: { agent: IssueDetail }) {
  const r = agent.running

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
      {/* Back + header */}
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
                <ClaimBadge status={agent.status} />
                {r && <PhaseBadge phase={r.phase} />}
              </div>
              <h1 className="text-base font-medium text-foreground mt-1 leading-snug max-w-2xl">
                {agent.title}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {agent.labels.map((l) => <LabelChip key={l} label={l} />)}
                <span className="text-[10px] text-muted-foreground font-mono ml-1">{agent.tracker_state}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent">
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Linear
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Issue Description</div>
        <p className="text-sm text-foreground leading-relaxed">{agent.description}</p>
      </div>

      {/* Metrics row */}
      {r ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Current turn"
            value={r.turn_count}
            sub="turns in session"
            accent="running"
          />
          <StatCard
            label="Total tokens"
            value={<TokenCount value={r.tokens.total_tokens} />}
            sub={`${(r.tokens.input_tokens / 1000).toFixed(1)}K in · ${(r.tokens.output_tokens / 1000).toFixed(1)}K out`}
          />
          <StatCard
            label="Session started"
            value={<RelativeTime iso={r.started_at} />}
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

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Event stream */}
        <div className="lg:col-span-2 space-y-4">
          {/* Token history chart */}
          {agent.token_history.length > 1 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Usage Over Time</div>
                {r && (
                  <TokenCount value={r.tokens.total_tokens} label="total" />
                )}
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
                    contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
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

          {/* Event stream */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Event Stream</span>
              </div>
              {r && (
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
                agent.recent_events.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      <EventIcon event={ev.event} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventBadge event={ev.event} />
                        <RelativeTime iso={ev.at} />
                      </div>
                      {ev.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono leading-relaxed">{ev.message}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Session details */}
        <div className="space-y-4">
          {/* Session info */}
          {r && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Session</div>
              <InfoRow label="Session ID" value={<SessionId id={r.session_id} />} />
              <InfoRow label="Phase" value={<PhaseBadge phase={r.phase} />} />
              <InfoRow label="Last event" value={<RelativeTime iso={r.last_event_at} />} />
              <InfoRow label="Turns" value={<span className="font-mono text-sm">{r.turn_count}</span>} />
            </div>
          )}

          {/* Workspace */}
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

          {/* Error state */}
          {agent.last_error && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-error-foreground" />
                <span className="text-xs font-medium text-error-foreground uppercase tracking-wider">Last Error</span>
              </div>
              <p className="text-xs font-mono text-error-foreground/90 leading-relaxed">{agent.last_error}</p>
            </div>
          )}

          {/* Retry info */}
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

          {/* Token breakdown */}
          {r && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Breakdown</div>
              <TokenBreakdown
                label="Input"
                value={r.tokens.input_tokens}
                total={r.tokens.total_tokens}
                color="oklch(0.62 0.22 268)"
              />
              <TokenBreakdown
                label="Output"
                value={r.tokens.output_tokens}
                total={r.tokens.total_tokens}
                color="oklch(0.72 0.19 155)"
              />
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

function EventIcon({ event }: { event: string }) {
  if (event === "turn_completed" || event === "session_started") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-running" />
  }
  if (event.includes("failed") || event.includes("error")) {
    return <AlertTriangle className="w-3.5 h-3.5 text-error-foreground" />
  }
  if (event === "turn_input_required") {
    return <AlertTriangle className="w-3.5 h-3.5 text-warning" />
  }
  if (event === "approval_auto_approved") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
  }
  return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
}
