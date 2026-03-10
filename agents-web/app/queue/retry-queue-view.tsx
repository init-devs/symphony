"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, Clock, RotateCcw } from "lucide-react"
import { useMemo } from "react"
import { useObservability } from "@/components/observability-provider"
import { Countdown, SectionHeader, StatCard } from "@/components/ui-atoms"

function maxBackoffFromQueue(attempts: number[]) {
  if (attempts.length === 0) return 0

  return attempts.reduce((maxMs, attempt) => {
    const delayMs = Math.min(10_000 * Math.pow(2, Math.max(0, attempt - 1)), 300_000)
    return Math.max(maxMs, delayMs)
  }, 0)
}

export function RetryQueueView() {
  const { state, issues } = useObservability()
  const retrying = useMemo(() => state?.retrying ?? [], [state?.retrying])

  const attemptDistribution = useMemo(() => {
    return [
      { label: "Retry #1", count: retrying.filter((item) => item.attempt === 1).length },
      { label: "Retry #2", count: retrying.filter((item) => item.attempt === 2).length },
      { label: "Retry #3", count: retrying.filter((item) => item.attempt === 3).length },
      { label: "Retry #4+", count: retrying.filter((item) => item.attempt >= 4).length },
    ]
  }, [retrying])

  const runningWithRetries = issues.filter(
    (issue) => issue.status === "Running" && (issue.attempts.current_retry_attempt ?? 0) > 0
  ).length

  const maxBackoffMs = maxBackoffFromQueue(retrying.map((item) => item.attempt))

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Retry Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scheduled retries and backoff state for failed or stalled sessions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Queued retries"
          value={retrying.length}
          accent={retrying.length > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Max backoff"
          value={maxBackoffMs >= 60_000 ? `${Math.round(maxBackoffMs / 60_000)}m` : `${Math.round(maxBackoffMs / 1000)}s`}
          sub={maxBackoffMs > 0 ? `${maxBackoffMs}ms` : "n/a"}
        />
        <StatCard label="Backoff formula" value="Exponential" sub="10s × 2^(n-1)" />
        <StatCard
          label="Running w/ retries"
          value={runningWithRetries}
          sub="continuation runs"
          accent="primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Backoff Schedule</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((attempt) => {
            const delay = Math.min(10_000 * Math.pow(2, attempt - 1), 300_000)
            const label = delay >= 60_000 ? `${Math.round(delay / 60_000)}m` : `${delay / 1000}s`

            return (
              <div key={attempt} className="bg-muted rounded-md px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Attempt #{attempt}
                </div>
                <div className="font-mono text-sm text-foreground">{label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">10s × 2^{attempt - 1}</div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Continuation retries after a clean worker exit use a fixed 1s delay. Failure-driven retries
          follow exponential backoff capped at 5 minutes.
        </p>
      </div>

      <div>
        <SectionHeader title={`Active Retries (${retrying.length})`} />
        {retrying.length === 0 ? (
          <div className="bg-card border border-border rounded-lg px-4 py-10 text-center">
            <RotateCcw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No retries currently queued</p>
          </div>
        ) : (
          <div className="space-y-2">
            {retrying.map((retry) => {
              const issue = issues.find((item) => item.issue_identifier === retry.issue_identifier)
              const diffMs = retry.due_at ? new Date(retry.due_at).getTime() - Date.now() : 0
              const totalBackoffMs = Math.min(10_000 * Math.pow(2, Math.max(0, retry.attempt - 1)), 300_000)
              const progressPct =
                totalBackoffMs > 0
                  ? Math.max(0, Math.min(100, 100 - (diffMs / totalBackoffMs) * 100))
                  : 0

              return (
                <div key={retry.issue_id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/agents/${retry.issue_identifier}`} className="font-mono text-sm text-warning hover:underline">
                            {retry.issue_identifier}
                          </Link>
                          <span className="text-xs text-muted-foreground">attempt #{retry.attempt}</span>
                        </div>
                        {issue?.title && <p className="text-xs text-muted-foreground mb-2">{issue.title}</p>}
                        {retry.error && (
                          <div className="font-mono text-xs bg-muted px-2.5 py-1.5 rounded text-muted-foreground">
                            {retry.error}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Next retry</div>
                      <Countdown iso={retry.due_at} />
                      <Link
                        href={`/agents/${retry.issue_identifier}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 justify-end transition-colors"
                      >
                        Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Backoff progress</span>
                      <span className="font-mono">{Math.round(progressPct)}% elapsed</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <SectionHeader title="Attempt Distribution" />
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="space-y-3">
            {attemptDistribution.map((item) => {
              const maxCount = Math.max(...attemptDistribution.map((entry) => entry.count), 1)
              const pct = (item.count / maxCount) * 100

              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary/60 rounded" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="font-mono text-xs text-foreground w-6 text-right">{item.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
