"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useObservability } from "@/components/observability-provider"
import { SectionHeader } from "@/components/ui-atoms"

type ConfigTab = "effective" | "raw" | "validation"

export function ConfigView() {
  const { config, reloadConfig, error } = useObservability()
  const [activeTab, setActiveTab] = useState<ConfigTab>("effective")
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["tracker", "polling", "agent", "runtime", "hooks"])
  )

  const effectiveConfig = useMemo(() => config?.effective_config ?? {}, [config])
  const configEntries = Object.entries(effectiveConfig)
  const validation = config?.validation

  const toggleSection = (key: string) => {
    setExpandedSections((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Effective runtime config derived from
            <span className="font-mono text-foreground"> WORKFLOW.md</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md",
              validation && Object.values(validation).every((value) => value === "ok")
                ? "text-running bg-running/15"
                : "text-warning bg-warning/15"
            )}
          >
            {validation && Object.values(validation).every((value) => value === "ok") ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {validation && Object.values(validation).every((value) => value === "ok")
              ? "Config valid"
              : "Validation issues"}
          </div>
          <button
            onClick={() => void reloadConfig()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-md transition-colors hover:bg-accent"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-xs text-error-foreground font-mono">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 w-fit">
        {([
          { key: "effective", label: "Effective Config", icon: Settings2 },
          { key: "raw", label: "WORKFLOW.md", icon: FileText },
          { key: "validation", label: "Validation", icon: CheckCircle2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              activeTab === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "effective" && (
        <div className="space-y-2">
          {configEntries.length === 0 ? (
            <div className="bg-card border border-border rounded-lg px-4 py-8 text-sm text-muted-foreground">
              Effective config unavailable.
            </div>
          ) : (
            configEntries.map(([sectionKey, sectionValue]) => {
              const isExpanded = expandedSections.has(sectionKey)
              const sectionObject =
                sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)
                  ? (sectionValue as Record<string, unknown>)
                  : null

              return (
                <div key={sectionKey} className="bg-card border border-border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                    onClick={() => toggleSection(sectionKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="font-mono text-sm font-medium text-foreground">{sectionKey}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {sectionObject ? `${Object.keys(sectionObject).length} keys` : "value"}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {sectionObject ? (
                        Object.entries(sectionObject).map(([key, value]) => (
                          <ConfigRow key={`${sectionKey}.${key}`} name={key} value={value} />
                        ))
                      ) : (
                        <ConfigRow name={sectionKey} value={sectionValue} />
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "raw" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm text-foreground">{config?.workflow.path || "WORKFLOW.md"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-running pulse-dot" />
              Live reload
            </div>
          </div>
          <pre className="px-4 py-4 text-xs font-mono text-foreground leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre-wrap">
            {config?.workflow.raw_markdown || "Workflow source unavailable."}
          </pre>
        </div>
      )}

      {activeTab === "validation" && (
        <div className="space-y-4">
          <div>
            <SectionHeader title="Dispatch Preflight Checks" />
            <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
              {validation ? (
                Object.entries(validation).map(([check, status]) => (
                  <div key={check} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-foreground">{check}</span>
                    <div className="flex items-center gap-1.5">
                      {status === "ok" ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-running" />
                          <span className="text-xs text-running">pass</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-error-foreground" />
                          <span className="text-xs text-error-foreground">fail</span>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-muted-foreground">Validation status unavailable.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigRow({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-accent/20 transition-colors">
      <span className="font-mono text-xs text-muted-foreground flex-shrink-0 min-w-[200px]">{name}</span>
      <div className="text-right flex-1">
        <ConfigValue value={value} />
      </div>
    </div>
  )
}

function ConfigValue({ value }: { value: unknown }) {
  if (value === null || typeof value === "undefined") {
    return <span className="text-muted-foreground text-xs">null</span>
  }

  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1 justify-end">
        {value.map((item) => (
          <span
            key={String(item)}
            className="text-[10px] font-mono bg-accent text-accent-foreground px-1.5 py-0.5 rounded border border-border"
          >
            {String(item)}
          </span>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    return (
      <pre className="text-xs font-mono text-foreground bg-muted rounded px-2 py-1.5 whitespace-pre-wrap text-left max-w-sm overflow-x-auto inline-block">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  if (typeof value === "number") {
    const pretty = value >= 60_000 ? `${Math.round(value / 60_000)}m` : value >= 1000 ? `${Math.round(value / 1000)}s` : `${value}`
    return (
      <span className="font-mono text-xs text-foreground">
        {pretty} <span className="text-muted-foreground">({value})</span>
      </span>
    )
  }

  return <span className="font-mono text-xs text-foreground">{String(value)}</span>
}
