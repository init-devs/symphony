"use client"

import { cn } from "@/lib/utils"

type RunAttemptPhase = string
type AgentEvent = string
type OrchestratorClaim = string

// ---- Status badge helpers ----

export function PhaseBadge({ phase }: { phase: RunAttemptPhase | null | undefined }) {
  if (!phase) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Unknown</span>
  }

  const cfg =
    {
      PreparingWorkspace: { label: "Preparing", cls: "bg-muted text-muted-foreground" },
      BuildingPrompt: { label: "Building Prompt", cls: "bg-muted text-muted-foreground" },
      LaunchingAgentProcess: { label: "Launching", cls: "bg-primary/15 text-primary" },
      InitializingSession: { label: "Initializing", cls: "bg-primary/15 text-primary" },
      StreamingTurn: { label: "Streaming", cls: "bg-running/15 text-running" },
      Finishing: { label: "Finishing", cls: "bg-running/15 text-running" },
      Succeeded: { label: "Succeeded", cls: "bg-running/15 text-running" },
      Failed: { label: "Failed", cls: "bg-error/15 text-error-foreground" },
      TimedOut: { label: "Timed Out", cls: "bg-warning/15 text-warning" },
      Stalled: { label: "Stalled", cls: "bg-warning/15 text-warning" },
      CanceledByReconciliation: { label: "Canceled", cls: "bg-muted text-muted-foreground" },
    } as const

  const fallback = { label: phase || "Unknown", cls: "bg-muted text-muted-foreground" }
  const selected = cfg[phase as keyof typeof cfg] ?? fallback

  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", selected.cls)}>
      {(phase === "StreamingTurn" || phase === "Finishing") && (
        <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot" />
      )}
      {selected.label}
    </span>
  )
}

export function ClaimBadge({ status }: { status: OrchestratorClaim | null | undefined }) {
  if (!status) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Unknown</span>
  }

  const cfg = {
    Unclaimed: { label: "Unclaimed", cls: "bg-muted text-muted-foreground" },
    Claimed: { label: "Claimed", cls: "bg-primary/15 text-primary" },
    Running: { label: "Running", cls: "bg-running/15 text-running" },
    RetryQueued: { label: "Retry Queued", cls: "bg-warning/15 text-warning" },
    Released: { label: "Released", cls: "bg-muted text-muted-foreground" },
  } as const

  const fallback = { label: status || "Unknown", cls: "bg-muted text-muted-foreground" }
  const selected = cfg[status as keyof typeof cfg] ?? fallback

  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", selected.cls)}>
      {status === "Running" && <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot" />}
      {status === "RetryQueued" && <span className="w-1.5 h-1.5 rounded-full bg-warning" />}
      {selected.label}
    </span>
  )
}

export function EventBadge({ event }: { event: AgentEvent | null | undefined }) {
  if (!event) {
    return <span className="font-mono text-[11px] text-muted-foreground">unknown</span>
  }

  const cfg: Partial<Record<AgentEvent, { label: string; cls: string }>> = {
    session_started:        { label: "session_started", cls: "text-primary" },
    turn_completed:         { label: "turn_completed", cls: "text-running" },
    turn_failed:            { label: "turn_failed", cls: "text-error-foreground" },
    turn_cancelled:         { label: "turn_cancelled", cls: "text-warning" },
    turn_ended_with_error:  { label: "turn_ended_with_error", cls: "text-error-foreground" },
    startup_failed:         { label: "startup_failed", cls: "text-error-foreground" },
    turn_input_required:    { label: "turn_input_required", cls: "text-warning" },
    approval_auto_approved: { label: "approval_auto_approved", cls: "text-muted-foreground" },
    notification:           { label: "notification", cls: "text-muted-foreground" },
  }
  const def = cfg[event] ?? { label: event, cls: "text-muted-foreground" }
  return (
    <span className={cn("font-mono text-[11px]", def.cls)}>{def.label}</span>
  )
}

// ---- Priority indicator ----
export function PriorityDot({ priority }: { priority: number | null | undefined }) {
  if (typeof priority !== "number") {
    return <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
  }
  const colors = ["", "bg-error", "bg-warning", "bg-primary/60", "bg-muted-foreground/50"]
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0", colors[priority] ?? "bg-muted-foreground/30")} />
}

// ---- Token display ----
export function TokenCount({ value, label }: { value: number; label?: string }) {
  const fmt = value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : value >= 1_000
    ? `${(value / 1_000).toFixed(1)}K`
    : String(value)
  return (
    <span className="font-mono text-sm text-foreground">
      {fmt}
      {label && <span className="ml-1 text-[11px] text-muted-foreground">{label}</span>}
    </span>
  )
}

// ---- Relative time ----
export function RelativeTime({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="font-mono text-xs text-muted-foreground">n/a</span>

  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  let label: string
  if (diff < 60) label = `${diff}s ago`
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m ago`
  else label = `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`
  return <span className="font-mono text-xs text-muted-foreground">{label}</span>
}

// ---- Countdown ----
export function Countdown({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="font-mono text-xs text-warning">n/a</span>

  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 1000)
  if (diff <= 0) return <span className="font-mono text-xs text-warning">now</span>
  const mins = Math.floor(diff / 60)
  const secs = diff % 60
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  return <span className="font-mono text-xs text-warning">{label}</span>
}

// ---- Session ID truncation ----
export function SessionId({ id }: { id: string | null | undefined }) {
  if (!id) {
    return <span className="font-mono text-xs text-muted-foreground">n/a</span>
  }

  const parts = id.split("-")
  const short = parts.length >= 2 ? `${parts[0].slice(0, 8)}…${parts[parts.length - 1]}` : id.slice(0, 16)
  return (
    <span className="font-mono text-xs text-muted-foreground" title={id}>{short}</span>
  )
}

// ---- Stat card ----
export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: "running" | "warning" | "error" | "primary"
}) {
  const dotColor = {
    running: "bg-running",
    warning: "bg-warning",
    error: "bg-error",
    primary: "bg-primary",
  }
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {accent && <span className={cn("w-1.5 h-1.5 rounded-full", dotColor[accent], accent === "running" && "pulse-dot")} />}
        {label}
      </div>
      <div className="text-2xl font-semibold text-foreground leading-none">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

// ---- Section header ----
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {action}
    </div>
  )
}

// ---- Label chips ----
export function LabelChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-mono bg-accent text-accent-foreground px-2 py-0.5 rounded border border-border">
      {label}
    </span>
  )
}
