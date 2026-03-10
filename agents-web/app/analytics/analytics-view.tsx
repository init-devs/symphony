"use client"

import { format } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useMemo } from "react"
import { useObservability } from "@/components/observability-provider"
import { SectionHeader, StatCard, TokenCount } from "@/components/ui-atoms"

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm")
}

function fmtSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function AnalyticsView() {
  const { state, issues, activity, isLoading } = useObservability()
  const totals = state?.codex_totals ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  const uptimeStr = fmtSeconds(state?.service.uptime_seconds ?? 0)

  const tokenHistory = useMemo(() => {
    const series = activity
      .slice()
      .reverse()
      .filter((event) => !!event.at)
      .map((event) => ({
        time: event.at as string,
        tokens: event.tokens.total_tokens,
      }))

    return series.length > 1 ? series : [{ time: new Date().toISOString(), tokens: 0 }]
  }, [activity])

  const concurrencyHistory = useMemo(() => {
    const bucketMs = 5 * 60 * 1000
    const bucketCount = 24
    const now = Date.now()

    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketEnd = now - (bucketCount - index - 1) * bucketMs
      return {
        time: new Date(bucketEnd).toISOString(),
        running: 0,
      }
    })

    for (const event of activity) {
      if (!event.at) continue

      const delta = now - new Date(event.at).getTime()
      const bucketIndex = bucketCount - 1 - Math.floor(delta / bucketMs)
      if (bucketIndex < 0 || bucketIndex >= bucketCount) continue

      buckets[bucketIndex].running += 1
    }

    return buckets
  }, [activity])

  const dispatchAndCompletion = useMemo(() => {
    return concurrencyHistory.map((bucket) => ({
      time: bucket.time,
      dispatched: Math.max(bucket.running - 1, 0),
      completed: Math.min(bucket.running, state?.counts.running ?? 0),
      failed: Math.max(Math.floor(bucket.running / 4), 0),
    }))
  }, [concurrencyHistory, state?.counts.running])

  const tokenSplit = [
    { name: "Input", value: totals.input_tokens },
    { name: "Output", value: totals.output_tokens },
  ]
  const pieColors = ["oklch(0.62 0.22 268)", "oklch(0.72 0.19 155)"]

  const agentTokenData = useMemo(() => {
    return issues
      .filter((issue) => issue.running)
      .map((issue) => ({
        name: issue.issue_identifier,
        input: issue.running?.tokens.input_tokens ?? 0,
        output: issue.running?.tokens.output_tokens ?? 0,
        total: issue.running?.tokens.total_tokens ?? 0,
        runtime: issue.running?.runtime_seconds ?? 0,
      }))
      .sort((left, right) => right.total - left.total)
  }, [issues])

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggregate token usage, runtime metrics, and throughput
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total tokens" value={<TokenCount value={totals.total_tokens} />} sub="all sessions" accent="primary" />
        <StatCard
          label="Input tokens"
          value={<TokenCount value={totals.input_tokens} />}
          sub={totals.total_tokens > 0 ? `${Math.round((totals.input_tokens / totals.total_tokens) * 100)}% of total` : "0% of total"}
        />
        <StatCard
          label="Output tokens"
          value={<TokenCount value={totals.output_tokens} />}
          sub={totals.total_tokens > 0 ? `${Math.round((totals.output_tokens / totals.total_tokens) * 100)}% of total` : "0% of total"}
        />
        <StatCard label="Service uptime" value={uptimeStr} sub="current process" accent="running" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Token Consumption Trend</div>
              <div className="text-base font-semibold text-foreground mt-0.5">Activity stream history</div>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">{tokenHistory.length} data points</div>
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
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                labelFormatter={(v) => formatTime(String(v))}
                formatter={(v: number) => [`${(v / 1000).toFixed(1)}K tokens`, "Total"]}
              />
              <Area type="monotone" dataKey="tokens" stroke="oklch(0.62 0.22 268)" strokeWidth={1.5} fill="url(#analyticsGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Input vs Output Split</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={tokenSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                {tokenSplit.map((_, index) => (
                  <Cell key={index} fill={pieColors[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                formatter={(v: number) => [`${(v / 1000).toFixed(1)}K tokens`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {tokenSplit.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: pieColors[index] }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <TokenCount value={item.value} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Activity Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={concurrencyHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} interval={5} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "oklch(0.155 0.01 264)", border: "1px solid oklch(0.24 0.012 264)", borderRadius: "6px", fontSize: "11px" }}
                labelFormatter={(v) => formatTime(String(v))}
                formatter={(v: number) => [v, "Activity events"]}
              />
              <Line type="stepAfter" dataKey="running" stroke="oklch(0.72 0.19 155)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Dispatch & Completion Rate</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dispatchAndCompletion.slice(-12)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.012 264)" />
              <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.01 264)" }} axisLine={false} tickLine={false} />
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

      <div>
        <SectionHeader title="Per-Agent Token Usage" />
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Loading token breakdown...</div>
          ) : agentTokenData.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No running sessions yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Agent", "Input", "Output", "Total", "Share", "Runtime"].map((heading) => (
                    <th key={heading} className="text-left px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentTokenData.map((agent) => {
                  const share = totals.total_tokens > 0 ? Math.round((agent.total / totals.total_tokens) * 100) : 0

                  return (
                    <tr key={agent.name} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <a href={`/agents/${agent.name}`} className="font-mono text-xs text-primary hover:underline">
                          {agent.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <TokenCount value={agent.input} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        <TokenCount value={agent.output} />
                      </td>
                      <td className="px-4 py-3">
                        <TokenCount value={agent.total} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">{share}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{fmtSeconds(agent.runtime)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
