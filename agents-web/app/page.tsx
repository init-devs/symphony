"use client"

import {
  MOCK_SYSTEM_STATE,
  generateTokenHistory,
  generatePollHistory,
} from "@/lib/mock-data"
import { AppShell } from "@/components/app-shell"
import { StatCard, SectionHeader, PhaseBadge, RelativeTime, TokenCount, Countdown, SessionId } from "@/components/ui-atoms"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts"
import Link from "next/link"
import { ArrowRight, RefreshCw, AlertTriangle } from "lucide-react"
import { format } from "date-fns"

const tokenHistory = generateTokenHistory(48)
const pollHistory = generatePollHistory(24)

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

export default function OverviewPage() {
  const s = MOCK_SYSTEM_STATE
  const uptimeHours = Math.floor(s.service_uptime_seconds / 3600)
  const uptimeMins = Math.floor((s.service_uptime_seconds % 3600) / 60)

  return (
    <AppShell>
      <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">System Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live orchestrator state · polling every {s.poll_interval_ms / 1000}s
            </p>
          </div>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent">
            <RefreshCw className="w-3.5 h-3.5" />
            Force poll
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Running agents"
            value={s.counts.running}
            sub={`of ${s.max_concurrent_agents} max`}
            accent="running"
          />
          <StatCard
            label="Retry queue"
            value={s.counts.retrying}
            sub="awaiting retry"
            accent={s.counts.retrying > 0 ? "warning" : undefined}
          />
          <StatCard
            label="Completed today"
            value={s.completed_today}
            sub="successful sessions"
            accent="primary"
          />
          <StatCard
            label="Total tokens"
            value={<TokenCount value={s.codex_totals.total_tokens} />}
            sub={`${(s.codex_totals.input_tokens / 1000).toFixed(1)}K in · ${(s.codex_totals.output_tokens / 1000).toFixed(1)}K out`}
          />
          <StatCard
            label="Runtime"
            value={`${uptimeHours}h ${uptimeMins}m`}
            sub="service uptime"
          />
          <StatCard
            label="Slot utilization"
            value={`${Math.round((s.counts.running / s.max_concurrent_agents) * 100)}%`}
            sub={`${s.counts.running}/${s.max_concurrent_agents} slots`}
            accent="primary"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Token usage over time */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Consumption</div>
                <div className="text-lg font-semibold text-foreground mt-0.5">
                  <TokenCount value={s.codex_totals.total_tokens} /> total
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">24h rolling</span>
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
                  interval={7}
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
                  dataKey="tokens"
                  stroke="oklch(0.62 0.22 268)"
                  strokeWidth={1.5}
                  fill="url(#tokenGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Poll cycle activity */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Poll Cycle Activity</div>
                <div className="text-lg font-semibold text-foreground mt-0.5">Dispatches & completions</div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">24h rolling</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pollHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={5}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                  labelFormatter={(v) => formatTime(String(v))}
                />
                <Bar dataKey="dispatched" fill="oklch(0.62 0.22 268)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="completed" fill="oklch(0.72 0.19 155)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="failed" fill="oklch(0.52 0.21 27)" radius={[2, 2, 0, 0]} />
                <Legend
                  wrapperStyle={{ fontSize: "10px", color: "oklch(0.52 0.01 264)" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Running sessions */}
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
                {s.running.map((r, i) => (
                  <tr
                    key={r.issue_id}
                    className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/agents/${r.issue_identifier}`} className="flex flex-col gap-0.5 group">
                        <span className="font-mono text-xs text-primary group-hover:underline">{r.issue_identifier}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">{r.state}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <PhaseBadge phase={r.phase} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-foreground">{r.turn_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SessionId id={r.session_id} />
                    </td>
                    <td className="px-4 py-3">
                      <TokenCount value={r.tokens.total_tokens} />
                    </td>
                    <td className="px-4 py-3">
                      <RelativeTime iso={r.started_at} />
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="text-xs text-muted-foreground truncate block">{r.last_message}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Retry queue + Rate limits row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Retry queue */}
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
              {s.retrying.length === 0 ? (
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
                    {s.retrying.map((r) => (
                      <tr key={r.issue_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link href={`/agents/${r.issue_identifier}`} className="font-mono text-xs text-warning hover:underline">
                            {r.issue_identifier}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-foreground">#{r.attempt}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Countdown iso={r.due_at} />
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-[11px] text-muted-foreground font-mono truncate block">{r.error}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Rate limits */}
          <div>
            <SectionHeader title="Rate Limits" />
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              {s.rate_limits ? (
                <>
                  <RateLimitBar
                    label="Requests / min"
                    used={(s.rate_limits.requests_per_minute ?? 0) - (s.rate_limits.requests_remaining ?? 0)}
                    total={s.rate_limits.requests_per_minute ?? 60}
                  />
                  <RateLimitBar
                    label="Tokens / min"
                    used={(s.rate_limits.tokens_per_minute ?? 0) - (s.rate_limits.tokens_remaining ?? 0)}
                    total={s.rate_limits.tokens_per_minute ?? 180000}
                  />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                    <span>Resets in</span>
                    <Countdown iso={s.rate_limits.reset_at!} />
                  </div>
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
    </AppShell>
  )
}

function RateLimitBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100))
  const color = pct > 85 ? "bg-error" : pct > 60 ? "bg-warning" : "bg-primary"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {used >= 1000 ? `${(used / 1000).toFixed(1)}K` : used}
          {" / "}
          {total >= 1000 ? `${(total / 1000).toFixed(0)}K` : total}
          <span className="text-muted-foreground ml-1.5">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
