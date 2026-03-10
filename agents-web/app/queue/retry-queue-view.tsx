"use client"

import { MOCK_SYSTEM_STATE, MOCK_AGENT_DETAIL } from "@/lib/mock-data"
import { Countdown, RelativeTime, SectionHeader, StatCard } from "@/components/ui-atoms"
import Link from "next/link"
import { AlertTriangle, RotateCcw, Clock, ArrowRight } from "lucide-react"

// Build a combined history: running + retrying + recently released
const allHistory = [
  ...MOCK_SYSTEM_STATE.running.map((r) => ({
    identifier: r.issue_identifier,
    status: "running" as const,
    title: MOCK_AGENT_DETAIL[r.issue_identifier]?.title ?? "",
    attempt: r.attempt,
    error: null as string | null,
    due_at: null as string | null,
    started_at: r.started_at,
    turn_count: r.turn_count,
  })),
  ...MOCK_SYSTEM_STATE.retrying.map((r) => ({
    identifier: r.issue_identifier,
    status: "retrying" as const,
    title: MOCK_AGENT_DETAIL[r.issue_identifier]?.title ?? "",
    attempt: r.attempt,
    error: r.error,
    due_at: r.due_at,
    started_at: null as string | null,
    turn_count: null as number | null,
  })),
]

const errorCategories: Record<string, number> = {}
for (const item of allHistory) {
  if (item.error) {
    const cat = item.error.split(":")[0].trim()
    errorCategories[cat] = (errorCategories[cat] ?? 0) + 1
  }
}

const attemptDistribution = [
  { label: "First run", count: allHistory.filter((i) => !i.attempt || i.attempt === null).length },
  { label: "Retry #1", count: allHistory.filter((i) => i.attempt === 1).length },
  { label: "Retry #2", count: allHistory.filter((i) => i.attempt === 2).length },
  { label: "Retry #3+", count: allHistory.filter((i) => i.attempt !== null && i.attempt >= 3).length },
]

export function RetryQueueView() {
  const retrying = MOCK_SYSTEM_STATE.retrying

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Retry Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scheduled retries and backoff state for failed or stalled sessions
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Queued retries"
          value={retrying.length}
          accent={retrying.length > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Max backoff"
          value="5m"
          sub="300s ceiling"
        />
        <StatCard
          label="Backoff formula"
          value="Exponential"
          sub="10s × 2^(n-1)"
        />
        <StatCard
          label="Running w/ retries"
          value={MOCK_SYSTEM_STATE.running.filter((r) => r.attempt !== null).length}
          sub="continuation runs"
          accent="primary"
        />
      </div>

      {/* Backoff formula explanation */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Backoff Schedule</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map((n) => {
            const delay = Math.min(10000 * Math.pow(2, n - 1), 300000)
            const label = delay >= 60000 ? `${delay/60000}m` : `${delay/1000}s`
            return (
              <div key={n} className="bg-muted rounded-md px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Attempt #{n}</div>
                <div className="font-mono text-sm text-foreground">{label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  10s × 2^{n-1}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Normal continuation retries after a clean worker exit use a fixed 1s delay. Failure-driven retries follow exponential backoff capped at 5 minutes.
        </p>
      </div>

      {/* Active retry queue */}
      <div>
        <SectionHeader title={`Active Retries (${retrying.length})`} />
        {retrying.length === 0 ? (
          <div className="bg-card border border-border rounded-lg px-4 py-10 text-center">
            <RotateCcw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No retries currently queued</p>
          </div>
        ) : (
          <div className="space-y-2">
            {retrying.map((r) => {
              const detail = MOCK_AGENT_DETAIL[r.issue_identifier]
              const diffMs = new Date(r.due_at).getTime() - Date.now()
              const totalBackoffMs = Math.min(10000 * Math.pow(2, r.attempt - 1), 300000)
              const progressPct = Math.max(0, Math.min(100, 100 - (diffMs / totalBackoffMs) * 100))

              return (
                <div key={r.issue_id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/agents/${r.issue_identifier}`}
                            className="font-mono text-sm text-warning hover:underline"
                          >
                            {r.issue_identifier}
                          </Link>
                          <span className="text-xs text-muted-foreground">attempt #{r.attempt}</span>
                        </div>
                        {detail && (
                          <p className="text-xs text-muted-foreground mb-2">{detail.title}</p>
                        )}
                        {r.error && (
                          <div className="font-mono text-xs bg-muted px-2.5 py-1.5 rounded text-muted-foreground">
                            {r.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Next retry</div>
                      <Countdown iso={r.due_at} />
                      <Link
                        href={`/agents/${r.issue_identifier}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 justify-end transition-colors"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Backoff progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Backoff progress</span>
                      <span className="font-mono">{Math.round(progressPct)}% elapsed</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-warning transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Attempt distribution */}
      <div>
        <SectionHeader title="Attempt Distribution (Current Session)" />
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="space-y-3">
            {attemptDistribution.map((d) => {
              const maxCount = Math.max(...attemptDistribution.map((x) => x.count), 1)
              const pct = (d.count / maxCount) * 100
              return (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{d.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded flex items-center px-2"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    >
                    </div>
                  </div>
                  <span className="font-mono text-xs text-foreground w-6 text-right">{d.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error categories */}
      {Object.keys(errorCategories).length > 0 && (
        <div>
          <SectionHeader title="Error Categories" />
          <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
            {Object.entries(errorCategories).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between px-4 py-3">
                <span className="font-mono text-xs text-foreground">{cat}</span>
                <span className="font-mono text-xs bg-error/15 text-error-foreground px-2 py-0.5 rounded">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
