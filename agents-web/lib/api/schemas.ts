import { z } from "zod"

const nullableString = z.string().nullable().optional()

export const tokenUsageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
    seconds_running: z.number().nonnegative().optional(),
  })
  .passthrough()

export const runningSessionSchema = z
  .object({
    issue_id: z.string().optional(),
    issue_identifier: z.string().optional(),
    title: nullableString,
    description: nullableString,
    tracker_state: nullableString,
    priority: z.number().int().nullable().optional(),
    labels: z.array(z.string()).optional().default([]),
    url: nullableString,
    state: nullableString,
    session_id: nullableString,
    turn_count: z.number().int().nonnegative(),
    last_event: nullableString,
    last_message: nullableString,
    started_at: nullableString,
    last_event_at: nullableString,
    runtime_seconds: z.number().int().nullable().optional(),
    phase: nullableString,
    workspace_path: nullableString,
    attempt: z.number().int().nullable().optional(),
    tokens: tokenUsageSchema,
  })
  .passthrough()

export const retryEntrySchema = z
  .object({
    issue_id: z.string(),
    issue_identifier: z.string(),
    title: nullableString,
    description: nullableString,
    tracker_state: nullableString,
    priority: z.number().int().nullable().optional(),
    labels: z.array(z.string()).optional().default([]),
    url: nullableString,
    attempt: z.number().int().nonnegative(),
    due_at: nullableString,
    due_in_ms: z.number().int().nullable().optional(),
    error: nullableString,
  })
  .passthrough()

export const stateSnapshotSchema = z
  .object({
    generated_at: z.string(),
    counts: z.object({
      running: z.number().int().nonnegative(),
      retrying: z.number().int().nonnegative(),
    }),
    running: z.array(runningSessionSchema),
    retrying: z.array(retryEntrySchema),
    codex_totals: tokenUsageSchema,
    rate_limits: z.unknown().nullable().optional(),
    polling: z
      .object({
        checking: z.boolean(),
        poll_interval_ms: z.number().int().nonnegative(),
        next_poll_in_ms: z.number().int().nullable().optional(),
      })
      .passthrough(),
    service: z
      .object({
        started_at: nullableString,
        uptime_seconds: z.number().int().nonnegative(),
        completed_count: z.number().int().nonnegative(),
      })
      .passthrough(),
    poll_interval_ms: z.number().int().nonnegative().optional(),
    max_concurrent_agents: z.number().int().positive(),
    service_uptime_seconds: z.number().int().nonnegative().optional(),
    completed_count: z.number().int().nonnegative().optional(),
  })
  .passthrough()

export const issueSummarySchema = z
  .object({
    issue_identifier: z.string(),
    issue_id: z.string(),
    title: nullableString,
    description: nullableString,
    tracker_state: nullableString,
    priority: z.number().int().nullable().optional(),
    labels: z.array(z.string()).optional().default([]),
    url: nullableString,
    status: z.string(),
    workspace: z.object({ path: z.string() }).passthrough(),
    attempts: z
      .object({
        restart_count: z.number().int().nonnegative(),
        current_retry_attempt: z.number().int().nullable(),
      })
      .passthrough(),
    running: runningSessionSchema.nullable(),
    retry: retryEntrySchema.nullable(),
    last_error: nullableString,
  })
  .passthrough()

export const issuesResponseSchema = z
  .object({
    generated_at: z.string(),
    counts: z.object({
      running: z.number().int().nonnegative(),
      retrying: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    issues: z.array(issueSummarySchema),
  })
  .passthrough()

export const activityEventSchema = z
  .object({
    issue_id: z.string(),
    issue_identifier: z.string(),
    session_id: nullableString,
    event: nullableString,
    at: nullableString,
    message: nullableString,
    tokens: tokenUsageSchema,
  })
  .passthrough()

export const activityResponseSchema = z
  .object({
    generated_at: z.string(),
    events: z.array(activityEventSchema),
  })
  .passthrough()

export const issueDetailSchema = z
  .object({
    issue_identifier: z.string(),
    issue_id: z.string(),
    title: nullableString,
    description: nullableString,
    tracker_state: nullableString,
    priority: z.number().int().nullable().optional(),
    labels: z.array(z.string()).optional().default([]),
    url: nullableString,
    status: z.string(),
    workspace: z.object({ path: z.string() }).passthrough(),
    attempts: z
      .object({
        restart_count: z.number().int().nonnegative(),
        current_retry_attempt: z.number().int().nullable(),
      })
      .passthrough(),
    running: runningSessionSchema.nullable(),
    retry: retryEntrySchema.nullable(),
    recent_events: z.array(activityEventSchema),
    token_history: z
      .array(
        z.object({
          at: z.string(),
          total_tokens: z.number().int().nonnegative(),
        })
      )
      .default([]),
    last_error: nullableString,
    logs: z.record(z.unknown()).optional().default({}),
    tracked: z.record(z.unknown()).optional().default({}),
  })
  .passthrough()

export const refreshResponseSchema = z
  .object({
    queued: z.boolean(),
    coalesced: z.boolean(),
    requested_at: z.string(),
    operations: z.array(z.string()),
  })
  .passthrough()

export const configResponseSchema = z
  .object({
    generated_at: z.string(),
    workflow: z
      .object({
        path: z.string(),
        prompt_template: nullableString,
        raw_markdown: nullableString,
        front_matter: z.record(z.unknown()),
      })
      .passthrough(),
    effective_config: z.record(z.unknown()),
    validation: z
      .object({
        workflow_file: z.enum(["ok", "error"]),
        tracker_kind: z.enum(["ok", "error"]),
        tracker_api_key: z.enum(["ok", "error"]),
        tracker_scope: z.enum(["ok", "error"]),
        runtime_provider: z.enum(["ok", "error"]),
        runtime_command: z.enum(["ok", "error"]),
      })
      .passthrough(),
  })
  .passthrough()

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type StateSnapshot = z.infer<typeof stateSnapshotSchema>
export type IssueSummary = z.infer<typeof issueSummarySchema>
export type IssuesResponse = z.infer<typeof issuesResponseSchema>
export type IssueDetail = z.infer<typeof issueDetailSchema>
export type ActivityEvent = z.infer<typeof activityEventSchema>
export type ActivityResponse = z.infer<typeof activityResponseSchema>
export type ConfigResponse = z.infer<typeof configResponseSchema>
export type RefreshResponse = z.infer<typeof refreshResponseSchema>
