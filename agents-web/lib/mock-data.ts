// Symphony mock data — mirrors the /api/v1/state and /api/v1/:identifier API shapes

export type RunAttemptPhase =
  | "PreparingWorkspace"
  | "BuildingPrompt"
  | "LaunchingAgentProcess"
  | "InitializingSession"
  | "StreamingTurn"
  | "Finishing"
  | "Succeeded"
  | "Failed"
  | "TimedOut"
  | "Stalled"
  | "CanceledByReconciliation"

export type OrchestratorClaim = "Unclaimed" | "Claimed" | "Running" | "RetryQueued" | "Released"

export type AgentEvent =
  | "session_started"
  | "startup_failed"
  | "turn_completed"
  | "turn_failed"
  | "turn_cancelled"
  | "turn_ended_with_error"
  | "turn_input_required"
  | "approval_auto_approved"
  | "unsupported_tool_call"
  | "notification"
  | "other_message"
  | "malformed"

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface RunningSession {
  issue_id: string
  issue_identifier: string
  state: string
  session_id: string
  turn_count: number
  last_event: AgentEvent
  last_message: string
  started_at: string
  last_event_at: string
  tokens: TokenUsage
  phase: RunAttemptPhase
  workspace_path: string
  attempt: number | null
}

export interface RetryEntry {
  issue_id: string
  issue_identifier: string
  attempt: number
  due_at: string
  error: string | null
}

export interface CodexTotals {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  seconds_running: number
}

export interface RateLimit {
  requests_per_minute: number | null
  tokens_per_minute: number | null
  requests_remaining: number | null
  tokens_remaining: number | null
  reset_at: string | null
}

export interface SystemState {
  generated_at: string
  counts: { running: number; retrying: number }
  running: RunningSession[]
  retrying: RetryEntry[]
  codex_totals: CodexTotals
  rate_limits: RateLimit | null
  poll_interval_ms: number
  max_concurrent_agents: number
  service_uptime_seconds: number
  completed_today: number
}

export interface RecentEvent {
  at: string
  event: AgentEvent
  message: string
}

export interface IssueDetail {
  issue_identifier: string
  issue_id: string
  title: string
  description: string
  tracker_state: string
  priority: number | null
  labels: string[]
  status: OrchestratorClaim
  workspace: { path: string }
  attempts: { restart_count: number; current_retry_attempt: number | null }
  running: RunningSession | null
  retry: RetryEntry | null
  recent_events: RecentEvent[]
  last_error: string | null
  token_history: { at: string; total_tokens: number }[]
}

// ---- Mock data generation ----

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 1000).toISOString()
}
function secondsAgo(n: number): string {
  return new Date(Date.now() - n * 1000).toISOString()
}

export const MOCK_SYSTEM_STATE: SystemState = {
  generated_at: new Date().toISOString(),
  counts: { running: 4, retrying: 2 },
  poll_interval_ms: 30000,
  max_concurrent_agents: 10,
  service_uptime_seconds: 18340,
  completed_today: 11,
  running: [
    {
      issue_id: "abc-001",
      issue_identifier: "ENG-421",
      state: "In Progress",
      session_id: "th_aX9r-tu_002",
      turn_count: 9,
      last_event: "notification",
      last_message: "Running tests for the authentication module",
      started_at: minutesAgo(23),
      last_event_at: secondsAgo(14),
      tokens: { input_tokens: 14200, output_tokens: 6820, total_tokens: 21020 },
      phase: "StreamingTurn",
      workspace_path: "/tmp/symphony_workspaces/ENG-421",
      attempt: null,
    },
    {
      issue_id: "abc-002",
      issue_identifier: "ENG-398",
      state: "In Progress",
      session_id: "th_bY7s-tu_001",
      turn_count: 3,
      last_event: "approval_auto_approved",
      last_message: "Applying patch to database migration script",
      started_at: minutesAgo(8),
      last_event_at: secondsAgo(42),
      tokens: { input_tokens: 5100, output_tokens: 2340, total_tokens: 7440 },
      phase: "StreamingTurn",
      workspace_path: "/tmp/symphony_workspaces/ENG-398",
      attempt: null,
    },
    {
      issue_id: "abc-003",
      issue_identifier: "ENG-445",
      state: "Todo",
      session_id: "th_cZ1t-tu_001",
      turn_count: 1,
      last_event: "session_started",
      last_message: "Initializing workspace environment",
      started_at: minutesAgo(2),
      last_event_at: secondsAgo(88),
      tokens: { input_tokens: 1820, output_tokens: 310, total_tokens: 2130 },
      phase: "InitializingSession",
      workspace_path: "/tmp/symphony_workspaces/ENG-445",
      attempt: null,
    },
    {
      issue_id: "abc-004",
      issue_identifier: "ENG-412",
      state: "In Progress",
      session_id: "th_dW4u-tu_005",
      turn_count: 12,
      last_event: "turn_completed",
      last_message: "PR draft created, waiting on CI verification",
      started_at: minutesAgo(47),
      last_event_at: secondsAgo(3),
      tokens: { input_tokens: 28400, output_tokens: 11200, total_tokens: 39600 },
      phase: "Finishing",
      workspace_path: "/tmp/symphony_workspaces/ENG-412",
      attempt: 1,
    },
  ],
  retrying: [
    {
      issue_id: "def-001",
      issue_identifier: "ENG-388",
      attempt: 3,
      due_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
      error: "turn_timeout after 3600s",
    },
    {
      issue_id: "def-002",
      issue_identifier: "ENG-401",
      attempt: 1,
      due_at: new Date(Date.now() + 55 * 1000).toISOString(),
      error: "startup_failed: codex not found in PATH",
    },
  ],
  codex_totals: {
    input_tokens: 198_420,
    output_tokens: 82_340,
    total_tokens: 280_760,
    seconds_running: 18340,
  },
  rate_limits: {
    requests_per_minute: 60,
    tokens_per_minute: 180_000,
    requests_remaining: 48,
    tokens_remaining: 142_000,
    reset_at: new Date(Date.now() + 28 * 1000).toISOString(),
  },
}

export const MOCK_AGENT_DETAIL: Record<string, IssueDetail> = {
  "ENG-421": {
    issue_identifier: "ENG-421",
    issue_id: "abc-001",
    title: "Refactor authentication token refresh logic",
    description: "The current token refresh handler in `auth/refresh.ts` has a race condition when multiple requests arrive simultaneously. Implement proper mutex-based locking and add tests.",
    tracker_state: "In Progress",
    priority: 1,
    labels: ["backend", "security", "p1"],
    status: "Running",
    workspace: { path: "/tmp/symphony_workspaces/ENG-421" },
    attempts: { restart_count: 0, current_retry_attempt: null },
    running: MOCK_SYSTEM_STATE.running[0],
    retry: null,
    recent_events: [
      { at: secondsAgo(14), event: "notification", message: "Running tests for the authentication module" },
      { at: secondsAgo(62), event: "approval_auto_approved", message: "Auto-approved: write /src/auth/refresh.test.ts" },
      { at: minutesAgo(2), event: "turn_completed", message: "Turn 8 completed successfully" },
      { at: minutesAgo(3), event: "notification", message: "Writing unit tests for mutex locking" },
      { at: minutesAgo(5), event: "approval_auto_approved", message: "Auto-approved: exec jest --testPathPattern auth" },
      { at: minutesAgo(7), event: "notification", message: "Implementing AsyncMutex wrapper class" },
      { at: minutesAgo(9), event: "turn_completed", message: "Turn 7 completed successfully" },
      { at: minutesAgo(12), event: "notification", message: "Analyzing race condition in refresh handler" },
    ],
    last_error: null,
    token_history: Array.from({ length: 20 }, (_, i) => ({
      at: minutesAgo(20 - i),
      total_tokens: Math.floor(1000 + (i * 1050) + Math.random() * 200),
    })),
  },
  "ENG-398": {
    issue_identifier: "ENG-398",
    issue_id: "abc-002",
    title: "Add index to users.email column in production migration",
    description: "Query profiling shows full table scans on `users` for email lookups. Add a btree index via a new migration file and verify rollback path.",
    tracker_state: "In Progress",
    priority: 2,
    labels: ["database", "performance"],
    status: "Running",
    workspace: { path: "/tmp/symphony_workspaces/ENG-398" },
    attempts: { restart_count: 0, current_retry_attempt: null },
    running: MOCK_SYSTEM_STATE.running[1],
    retry: null,
    recent_events: [
      { at: secondsAgo(42), event: "approval_auto_approved", message: "Auto-approved: write db/migrations/20260310_add_email_index.sql" },
      { at: minutesAgo(2), event: "notification", message: "Verifying migration rollback procedure" },
      { at: minutesAgo(4), event: "turn_completed", message: "Turn 2 completed" },
      { at: minutesAgo(6), event: "notification", message: "Drafting migration SQL with CONCURRENTLY option" },
    ],
    last_error: null,
    token_history: Array.from({ length: 10 }, (_, i) => ({
      at: minutesAgo(8 - i),
      total_tokens: Math.floor(500 + i * 750),
    })),
  },
  "ENG-445": {
    issue_identifier: "ENG-445",
    issue_id: "abc-003",
    title: "Implement rate limiting on /api/v1/search endpoint",
    description: "The search endpoint has no rate limiting. Implement per-IP sliding window rate limiting using Redis and return 429 with proper Retry-After headers.",
    tracker_state: "Todo",
    priority: 2,
    labels: ["api", "security"],
    status: "Running",
    workspace: { path: "/tmp/symphony_workspaces/ENG-445" },
    attempts: { restart_count: 0, current_retry_attempt: null },
    running: MOCK_SYSTEM_STATE.running[2],
    retry: null,
    recent_events: [
      { at: secondsAgo(88), event: "session_started", message: "Session th_cZ1t initialized" },
    ],
    last_error: null,
    token_history: Array.from({ length: 3 }, (_, i) => ({
      at: minutesAgo(2 - i),
      total_tokens: Math.floor(300 + i * 910),
    })),
  },
  "ENG-412": {
    issue_identifier: "ENG-412",
    issue_id: "abc-004",
    title: "Migrate deprecated lodash methods to native ES2024 equivalents",
    description: "Remove lodash dependency from the core bundle. Replace `_.groupBy`, `_.mapValues`, `_.pick`, `_.omit` and `_.merge` with native implementations across the codebase.",
    tracker_state: "In Progress",
    priority: 3,
    labels: ["refactor", "dependencies", "frontend"],
    status: "Running",
    workspace: { path: "/tmp/symphony_workspaces/ENG-412" },
    attempts: { restart_count: 1, current_retry_attempt: 1 },
    running: MOCK_SYSTEM_STATE.running[3],
    retry: null,
    recent_events: [
      { at: secondsAgo(3), event: "turn_completed", message: "Turn 12 completed — PR draft created" },
      { at: minutesAgo(3), event: "approval_auto_approved", message: "Auto-approved: exec git push origin ENG-412" },
      { at: minutesAgo(8), event: "notification", message: "Creating PR with changelog summary" },
      { at: minutesAgo(12), event: "turn_completed", message: "Turn 11 completed" },
      { at: minutesAgo(15), event: "notification", message: "Replacing _.merge with structured clone" },
      { at: minutesAgo(20), event: "approval_auto_approved", message: "Auto-approved: write src/utils/merge.ts" },
      { at: minutesAgo(25), event: "turn_completed", message: "Turn 10 completed" },
      { at: minutesAgo(30), event: "notification", message: "Migrating _.pick and _.omit usages" },
      { at: minutesAgo(35), event: "approval_auto_approved", message: "Auto-approved: exec grep -r \"_.groupBy\" src/" },
      { at: minutesAgo(40), event: "notification", message: "Scanning codebase for lodash imports" },
    ],
    last_error: null,
    token_history: Array.from({ length: 25 }, (_, i) => ({
      at: minutesAgo(47 - i * 2),
      total_tokens: Math.floor(2000 + i * 1560 + Math.random() * 400),
    })),
  },
  "ENG-388": {
    issue_identifier: "ENG-388",
    issue_id: "def-001",
    title: "Fix memory leak in WebSocket connection pool",
    description: "Connections are not being properly cleaned up when clients disconnect unexpectedly. Implement heartbeat mechanism and cleanup routine.",
    tracker_state: "In Progress",
    priority: 1,
    labels: ["backend", "websocket", "p1"],
    status: "RetryQueued",
    workspace: { path: "/tmp/symphony_workspaces/ENG-388" },
    attempts: { restart_count: 2, current_retry_attempt: 3 },
    running: null,
    retry: MOCK_SYSTEM_STATE.retrying[0],
    recent_events: [
      { at: minutesAgo(5), event: "turn_failed", message: "turn_timeout after 3600s" },
      { at: minutesAgo(10), event: "notification", message: "Profiling connection pool under load" },
      { at: minutesAgo(65), event: "turn_failed", message: "turn_timeout after 3600s (attempt 2)" },
    ],
    last_error: "turn_timeout after 3600s",
    token_history: Array.from({ length: 8 }, (_, i) => ({
      at: minutesAgo(70 - i * 8),
      total_tokens: Math.floor(8000 + i * 1200),
    })),
  },
  "ENG-401": {
    issue_identifier: "ENG-401",
    issue_id: "def-002",
    title: "Add OpenTelemetry tracing to gRPC handlers",
    description: "Integrate OTEL span creation for all incoming gRPC requests. Include baggage propagation and error span recording.",
    tracker_state: "In Progress",
    priority: 2,
    labels: ["observability", "grpc"],
    status: "RetryQueued",
    workspace: { path: "/tmp/symphony_workspaces/ENG-401" },
    attempts: { restart_count: 0, current_retry_attempt: 1 },
    running: null,
    retry: MOCK_SYSTEM_STATE.retrying[1],
    recent_events: [
      { at: minutesAgo(3), event: "startup_failed", message: "startup_failed: codex not found in PATH" },
    ],
    last_error: "startup_failed: codex not found in PATH",
    token_history: [],
  },
}

// Token usage sparkline data (24h history)
export function generateTokenHistory(points = 48) {
  let val = 20000
  return Array.from({ length: points }, (_, i) => {
    val += Math.floor(Math.random() * 8000 - 1000)
    val = Math.max(5000, val)
    return {
      time: new Date(Date.now() - (points - i) * 30 * 60 * 1000).toISOString(),
      tokens: val,
      running: Math.floor(Math.random() * 8) + 1,
    }
  })
}

export function generatePollHistory(points = 24) {
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(Date.now() - (points - i) * 30 * 60 * 1000).toISOString(),
    dispatched: Math.floor(Math.random() * 5),
    completed: Math.floor(Math.random() * 4),
    failed: Math.floor(Math.random() * 2),
  }))
}
