"use client"

import {
  MOCK_SYSTEM_STATE,
  MOCK_AGENT_DETAIL,
  generateTokenHistory,
  generatePollHistory,
} from "@/lib/mock-data"
import { TokenCount, StatCard, SectionHeader } from "@/components/ui-atoms"
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
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts"
import { format } from "date-fns"

const tokenHistory = generateTokenHistory(48)
const pollHistory = generatePollHistory(24)

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

// Per-agent token data
const agentTokenData = Object.values(MOCK_AGENT_DETAIL)
  .filter((a) => a.running)
  .map((a) => ({
    name: a.issue_identifier,
    input: a.running!.tokens.input_tokens,
    output: a.running!.tokens.output_tokens,
    total: a.running!.tokens.total_tokens,
  }))
  .sort((a, b) => b.total - a.total)

// Token split for pie
const tokenSplit = [
  { name: "Input", value: MOCK_SYSTEM_STATE.codex_totals.input_tokens },
  { name: "Output", value: MOCK_SYSTEM_STATE.codex_totals.output_tokens },
]
const PIE_COLORS = ["oklch(0.62 0.22 268)", "oklch(0.72 0.19 155)"]

// Runtime per agent
const runtimeData = Object.values(MOCK_AGENT_DETAIL)
  .filter((a) => a.running)
  .map((a) => {
    const elapsed = (Date.now() - new Date(a.running!.started_at).getTime()) / 1000
    return { name: a.issue_identifier, seconds: Math.round(elapsed) }
  })
  .sort((a, b) => b.seconds - a.seconds)

function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export function AnalyticsView() {
  const totals = MOCK_SYSTEM_STATE.codex_totals
  const uptimeStr = fmtSeconds(totals.seconds_running)

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggregate token usage, runtime metrics, and throughput
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total tokens"
          value={<TokenCount value={totals.total_tokens} />}
          sub="all sessions"
          accent="primary"
        />
        <StatCard
          label="Input tokens"
          value={<TokenCount value={totals.input_tokens} />}
          sub={`${Math.round((totals.input_tokens / totals.total_tokens) * 100)}% of total`}
        />
        <StatCard
          label="Output tokens"
          value={<TokenCount value={totals.output_tokens} />}
          sub={`${Math.round((totals.output_tokens / totals.total_tokens) * 100)}% of total`}
        />
        <StatCard
          label="Aggregate runtime"
          value={uptimeStr}
          sub="across all sessions"
          accent="running"
        />
      </div>

      {/* Row 1: Token trend + token split pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Consumption Trend</div>
              <div className="text-base font-semibold text-foreground mt-0.5">24-hour rolling window</div>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">48 data points</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={tokenHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.62 0.22 268)" stopOpacity={0.25} />
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
                fill="url(#analyticsGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Input vs Output Split</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={tokenSplit}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {tokenSplit.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                formatter={(v: number) => [`${(v / 1000).toFixed(1)}K tokens`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {tokenSplit.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <TokenCount value={d.value} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Active agents chart + Concurrency over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Concurrency Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={tokenHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
                domain={[0, 10]}
                tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                labelFormatter={(v) => formatTime(String(v))}
                formatter={(v: number) => [v, "Running agents"]}
              />
              <Line
                type="stepAfter"
                dataKey="running"
                stroke="oklch(0.72 0.19 155)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Dispatch & Completion Rate</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pollHistory.slice(-12)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }}
                axisLine={false}
                tickLine={false}
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
              <Bar dataKey="dispatched" fill="oklch(0.62 0.22 268)" radius={[2, 2, 0, 0]} name="Dispatched" />
              <Bar dataKey="completed" fill="oklch(0.72 0.19 155)" radius={[2, 2, 0, 0]} name="Completed" />
              <Bar dataKey="failed" fill="oklch(0.52 0.21 27)" radius={[2, 2, 0, 0]} name="Failed" />
              <Legend wrapperStyle={{ fontSize: "10px", color: "oklch(0.52 0.01 264)" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-agent token breakdown */}
      <div>
        <SectionHeader title="Per-Agent Token Usage" />
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Agent", "Input", "Output", "Total", "Share", "Runtime"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentTokenData.map((a) => {
                const share = Math.round((a.total / totals.total_tokens) * 100)
                const runtime = runtimeData.find((r) => r.name === a.name)
                return (
                  <tr key={a.name} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <a href={`/agents/${a.name}`} className="font-mono text-xs text-primary hover:underline">{a.name}</a>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <TokenCount value={a.input} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <TokenCount value={a.output} />
                    </td>
                    <td className="px-4 py-3">
                      <TokenCount value={a.total} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">{share}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {runtime ? fmtSeconds(runtime.seconds) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
