"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  activityStreamUrl,
  fetchActivity,
  fetchConfig,
  fetchIssueSummaries,
  fetchStateSnapshot,
  requestRefresh,
} from "@/lib/api/client"
import {
  activityEventSchema,
  activityResponseSchema,
  type ActivityEvent,
  type ConfigResponse,
  type IssueSummary,
  type StateSnapshot,
} from "@/lib/api/schemas"

type StreamStatus = "connecting" | "open" | "error" | "closed"

type ObservabilityContextValue = {
  state: StateSnapshot | null
  issues: IssueSummary[]
  activity: ActivityEvent[]
  config: ConfigResponse | null
  isLoading: boolean
  isRefreshing: boolean
  streamStatus: StreamStatus
  error: string | null
  refreshNow: () => Promise<void>
  reloadConfig: () => Promise<void>
}

const ObservabilityContext = createContext<ObservabilityContextValue | null>(null)

export function ObservabilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StateSnapshot | null>(null)
  const [issues, setIssues] = useState<IssueSummary[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting")
  const [error, setError] = useState<string | null>(null)

  const loadStateAndIssues = useCallback(async () => {
    const [nextState, nextIssues] = await Promise.all([
      fetchStateSnapshot(),
      fetchIssueSummaries(),
    ])

    setState(nextState)
    setIssues(nextIssues.issues)
  }, [])

  const loadActivity = useCallback(async () => {
    const response = await fetchActivity({ limit: 200 })
    setActivity(response.events)
  }, [])

  const loadConfig = useCallback(async () => {
    const response = await fetchConfig()
    setConfig(response)
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      setError(null)
      await Promise.all([loadStateAndIssues(), loadActivity(), loadConfig()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading observability data")
    } finally {
      setIsLoading(false)
    }
  }, [loadActivity, loadConfig, loadStateAndIssues])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const refreshNow = useCallback(async () => {
    setIsRefreshing(true)

    try {
      setError(null)
      await requestRefresh()
      await Promise.all([loadStateAndIssues(), loadActivity()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh")
    } finally {
      setIsRefreshing(false)
    }
  }, [loadActivity, loadStateAndIssues])

  useEffect(() => {
    const pollIntervalMs = Math.max(state?.polling.poll_interval_ms ?? 10_000, 3_000)

    const interval = setInterval(() => {
      void loadStateAndIssues().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to update state")
      })
    }, pollIntervalMs)

    return () => clearInterval(interval)
  }, [loadStateAndIssues, state?.polling.poll_interval_ms])

  useEffect(() => {
    const interval = setInterval(() => {
      void loadConfig().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to update config")
      })
    }, 30_000)

    return () => clearInterval(interval)
  }, [loadConfig])

  useEffect(() => {
    const source = new EventSource(activityStreamUrl({ limit: 200 }))
    setStreamStatus("connecting")

    source.onopen = () => {
      setStreamStatus("open")
      setError(null)
    }

    source.addEventListener("snapshot", (evt) => {
      try {
        const payload = activityResponseSchema.safeParse(JSON.parse(evt.data))
        if (payload.success) {
          setActivity(payload.data.events)
        }
      } catch {
        // Ignore invalid event frames
      }
    })

    source.addEventListener("activity", (evt) => {
      try {
        const payload = activityEventSchema.safeParse(JSON.parse(evt.data))
        if (payload.success) {
          setActivity((current) => [payload.data, ...current].slice(0, 500))
        }
      } catch {
        // Ignore invalid event frames
      }
    })

    source.onerror = () => {
      setStreamStatus("error")
    }

    return () => {
      source.close()
      setStreamStatus("closed")
    }
  }, [])

  const value = useMemo<ObservabilityContextValue>(
    () => ({
      state,
      issues,
      activity,
      config,
      isLoading,
      isRefreshing,
      streamStatus,
      error,
      refreshNow,
      reloadConfig: loadConfig,
    }),
    [
      state,
      issues,
      activity,
      config,
      isLoading,
      isRefreshing,
      streamStatus,
      error,
      refreshNow,
      loadConfig,
    ]
  )

  return <ObservabilityContext.Provider value={value}>{children}</ObservabilityContext.Provider>
}

export function useObservability() {
  const context = useContext(ObservabilityContext)

  if (!context) {
    throw new Error("useObservability must be used within ObservabilityProvider")
  }

  return context
}
