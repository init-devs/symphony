"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Bot,
  RotateCcw,
  BarChart3,
  Settings,
  Activity,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ObservabilityProvider, useObservability } from "@/components/observability-provider"

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/queue", icon: RotateCcw, label: "Retry Queue" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/config", icon: Settings, label: "Config" },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ObservabilityProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </ObservabilityProvider>
  )
}

function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { state, streamStatus } = useObservability()
  const running = state?.counts.running ?? 0
  const retrying = state?.counts.retrying ?? 0
  const pollIntervalSeconds = Math.round((state?.polling.poll_interval_ms ?? 0) / 1000)
  const serviceLabel = streamStatus === "open" ? "Live stream" : streamStatus === "error" ? "Stream reconnecting" : "Connecting"

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 border border-primary/30">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Symphony</span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v1</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {label === "Agents" && running > 0 && (
                  <span className="text-[10px] font-mono bg-running/20 text-running px-1.5 py-0.5 rounded-full">
                    {running}
                  </span>
                )}
                {label === "Retry Queue" && retrying > 0 && (
                  <span className="text-[10px] font-mono bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
                    {retrying}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Service health footer */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot flex-shrink-0" />
            <span>{serviceLabel}</span>
          </div>
          {pollIntervalSeconds > 0 && (
            <div className="mt-1 text-[10px] font-mono text-muted-foreground/60">
              Poll: {pollIntervalSeconds}s interval
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 border-b border-border bg-background/80 backdrop-blur-sm gap-2">
          <Breadcrumb pathname={pathname} />
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">{running}</span>
              <span>running</span>
              <span className="mx-1 text-border">·</span>
              <span className="font-mono">{retrying}</span>
              <span>retrying</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="text-xs text-muted-foreground font-mono">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) {
    return <span className="text-sm font-medium text-foreground">Overview</span>
  }
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={cn(
            i === segments.length - 1 ? "text-foreground font-medium" : "text-muted-foreground capitalize"
          )}>
            {seg}
          </span>
        </span>
      ))}
    </div>
  )
}
