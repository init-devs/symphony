"use client"

import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { AppShell } from "@/components/app-shell"
import { useObservability } from "@/components/observability-provider"
import {
  Countdown,
  PhaseBadge,
  RelativeTime,
  SectionHeader,
  SessionId,
  StatCard,
  TokenCount,
} from "@/components/ui-atoms"
import type { ActivityEvent } from "@/lib/api/schemas"

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

function tokenTrend(activity: ActivityEvent[]) {
  const series = activity
    .slice()
    .reverse()
    .filter((event) => !!event.at)
    .map((event) => ({
      time: event.at as string,
      tokens: event.tokens.total_tokens,
    }))

  if (series.length > 1) {
    return series
  }

  const now = new Date().toISOString()
  return [{ time: now, tokens: 0 }, { time: now, tokens: 0 }]
}

function pollTrend(activity: ActivityEvent[]) {
  const bucketSizeMs = 5 * 60 * 1000
  const bucketCount = 12
  const now = Date.now()

  const buckets = Array.from({ length: bucketCount }, (_, idx) => {
    const end = now - (bucketCount - idx - 1) * bucketSizeMs
    return {
      time: new Date(end).toISOString(),
      dispatched: 0,
      completed: 0,
      failed: 0,
    }
  })

  for (const event of activity) {
    if (!event.at) continue

    const delta = now - new Date(event.at).getTime()
    if (delta < 0) continue

    const bucketIndex = bucketCount - 1 - Math.floor(delta / bucketSizeMs)
    if (bucketIndex < 0 || bucketIndex >= bucketCount) continue

    const name = event.event || ""
    if (name.includes("session_started")) buckets[bucketIndex].dispatched += 1
    if (name.includes("completed")) buckets[bucketIndex].completed += 1
    if (name.includes("failed") || name.includes("error") || name.includes("cancelled")) {
      buckets[bucketIndex].failed += 1
    }
  }

  return buckets
}

function parseRateLimits(rateLimits: unknown) {
  if (!rateLimits || typeof rateLimits !== "object") return null
  const asMap = rateLimits as Record<string, unknown>
  const primary = asMap.primary as Record<string, unknown> | undefined
  const secondary = asMap.secondary as Record<string, unknown> | undefined

  const primaryLimit = typeof primary?.limit === "number" ? primary.limit : 0
  const primaryRemaining = typeof primary?.remaining === "number" ? primary.remaining : 0
  const secondaryLimit = typeof secondary?.limit === "number" ? secondary.limit : 0
  const secondaryRemaining = typeof secondary?.remaining === "number" ? secondary.remaining : 0

  const primaryReset =
    typeof primary?.reset_in_seconds === "number" ? primary.reset_in_seconds : null

  return {
    primaryLimit,
    primaryUsed: Math.max(primaryLimit - primaryRemaining, 0),
    secondaryLimit,
    secondaryUsed: Math.max(secondaryLimit - secondaryRemaining, 0),
    primaryReset,
  }
}

export default function OverviewPage() {
  return (
    <AppShell>
      <OverviewContent />
    </AppShell>
  )
}

function OverviewContent() {
  const { state, activity, isLoading, isRefreshing, refreshNow, error } = useObservability()

  const tokenHistory = tokenTrend(activity)
  const pollHistory = pollTrend(activity)
  const rateLimits = parseRateLimits(state?.rate_limits)
  const uptimeHours = Math.floor((state?.service.uptime_seconds ?? 0) / 3600)
  const uptimeMins = Math.floor(((state?.service.uptime_seconds ?? 0) % 3600) / 60)

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">System Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live orchestrator state
              {state ? ` · polling every ${Math.round(state.polling.poll_interval_ms / 1000)}s` : ""}
            </p>
          </div>
          <button
            onClick={() => void refreshNow()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing" : "Force poll"}
          </button>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-xs text-error-foreground font-mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Running agents"
            value={state?.counts.running ?? 0}
            sub={`of ${state?.max_concurrent_agents ?? 0} max`}
            accent="running"
          />
          <StatCard
            label="Retry queue"
            value={state?.counts.retrying ?? 0}
            sub="awaiting retry"
            accent={(state?.counts.retrying ?? 0) > 0 ? "warning" : undefined}
          />
          <StatCard
            label="Completed"
            value={state?.service.completed_count ?? 0}
            sub="current service lifetime"
            accent="primary"
          />
          <StatCard
            label="Total tokens"
            value={<TokenCount value={state?.codex_totals.total_tokens ?? 0} />}
            sub={`${((state?.codex_totals.input_tokens ?? 0) / 1000).toFixed(1)}K in · ${((state?.codex_totals.output_tokens ?? 0) / 1000).toFixed(1)}K out`}
          />
          <StatCard label="Runtime" value={`${uptimeHours}h ${uptimeMins}m`} sub="service uptime" />
          <StatCard
            label="Slot utilization"
            value={`${
              state?.max_concurrent_agents
                ? Math.round((state.counts.running / state.max_concurrent_agents) * 100)
                : 0
            }%`}
            sub={`${state?.counts.running ?? 0}/${state?.max_concurrent_agents ?? 0} slots`}
            accent="primary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Consumption</div>
                <div className="text-lg font-semibold text-foreground mt-0.5">
                  <TokenCount value={state?.codex_totals.total_tokens ?? 0} /> total
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">activity stream</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={tokenHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.22 268)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.62 0.22 268)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
                <XAxis
                  dataKey="time"
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
                  dataKey="tokens"
                  stroke="oklch(0.62 0.22 268)"
                  strokeWidth={1.5}
                  fill="url(#tokenGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Activity Volume</div>
                <div className="text-lg font-semibold text-foreground mt-0.5">Last 60 minutes</div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">5m buckets</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pollHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={7}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.155 0.01 264)",
                    border: "1px solid oklch(0.24 0.012 264)",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}
                  labelFormatter={(v) => formatTime(String(v))}
                />
                <Bar dataKey="dispatched" fill="oklch(0.62 0.22 268)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="completed" fill="oklch(0.72 0.19 155)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="failed" fill="oklch(0.52 0.21 27)" radius={[2, 2, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: "10px", color: "oklch(0.52 0.01 264)" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <SectionHeader
            title="Active Sessions"
            action={
              <Link href="/agents" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            }
          />
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">Loading sessions...</div>
            ) : state && state.running.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Issue", "Phase", "Turns", "Session", "Tokens", "Started", "Last Event"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.running.map((running) => (
                    <tr key={running.issue_id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/agents/${running.issue_identifier}`} className="flex flex-col gap-0.5 group">
                          <span className="font-mono text-xs text-primary group-hover:underline">{running.issue_identifier}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[220px]">{running.title || running.state || "Untitled issue"}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <PhaseBadge phase={running.phase} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-foreground">{running.turn_count}</span>
                      </td>
                      <td className="px-4 py-3">
                        <SessionId id={running.session_id} />
                      </td>
                      <td className="px-4 py-3">
                        <TokenCount value={running.tokens.total_tokens} />
                      </td>
                      <td className="px-4 py-3">
                        <RelativeTime iso={running.started_at} />
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="text-xs text-muted-foreground truncate block">{running.last_message || running.last_event || "No recent event"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-8 text-sm text-muted-foreground">No active sessions</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <SectionHeader
              title="Retry Queue"
              action={
                <Link href="/queue" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              }
            />
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {!state || state.retrying.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No retries queued</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Issue", "Attempt", "Due in", "Error"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.retrying.map((retry) => (
                      <tr key={retry.issue_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/agents/${retry.issue_identifier}`} className="font-mono text-xs text-warning hover:underline">
                            {retry.issue_identifier}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-foreground">#{retry.attempt}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Countdown iso={retry.due_at} />
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <span className="text-[11px] text-muted-foreground font-mono truncate block">{retry.error || "n/a"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <SectionHeader title="Rate Limits" />
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              {rateLimits ? (
                <>
                  <RateLimitBar label="Primary bucket" used={rateLimits.primaryUsed} total={rateLimits.primaryLimit || 1} />
                  <RateLimitBar label="Secondary bucket" used={rateLimits.secondaryUsed} total={rateLimits.secondaryLimit || 1} />
                  {typeof rateLimits.primaryReset === "number" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <span>Primary reset in</span>
                      <Countdown iso={new Date(Date.now() + rateLimits.primaryReset * 1000).toISOString()} />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  No rate limit data available
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}

function RateLimitBar({ label, used, total }: { label: string; used: number; total: number }) {
  const safeTotal = Math.max(total, 1)
  const pct = Math.min(100, Math.round((used / safeTotal) * 100))
  const color = pct > 85 ? "bg-error" : pct > 60 ? "bg-warning" : "bg-primary"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {used} / {safeTotal}
          <span className="text-muted-foreground ml-1.5">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
