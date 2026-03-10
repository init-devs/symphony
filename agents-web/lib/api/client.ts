import { z } from "zod"
import {
  activityResponseSchema,
  apiErrorSchema,
  configResponseSchema,
  issueDetailSchema,
  issuesResponseSchema,
  refreshResponseSchema,
  stateSnapshotSchema,
  type ActivityResponse,
  type ConfigResponse,
  type IssueDetail,
  type IssuesResponse,
  type RefreshResponse,
  type StateSnapshot,
} from "./schemas"

export class SymphonyApiError extends Error {
  code: string
  status: number

  constructor(message: string, code = "unknown_error", status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function requestJson<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit
): Promise<z.output<S>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })

  const body = await response.json().catch(() => ({}))
  const maybeApiError = apiErrorSchema.safeParse(body)

  if (!response.ok || maybeApiError.success) {
    const code = maybeApiError.success ? maybeApiError.data.error.code : "request_failed"
    const message = maybeApiError.success ? maybeApiError.data.error.message : `Request failed (${response.status})`
    throw new SymphonyApiError(message, code, response.status)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new SymphonyApiError("Invalid API response payload", "invalid_payload", response.status)
  }

  return parsed.data
}

export async function fetchStateSnapshot(): Promise<StateSnapshot> {
  return requestJson("/api/v1/state", stateSnapshotSchema)
}

export async function fetchIssueSummaries(): Promise<IssuesResponse> {
  return requestJson("/api/v1/issues", issuesResponseSchema)
}

export async function fetchIssueDetail(issueIdentifier: string): Promise<IssueDetail> {
  return requestJson(`/api/v1/${encodeURIComponent(issueIdentifier)}`, issueDetailSchema)
}

export async function fetchActivity(params?: {
  issueIdentifier?: string
  limit?: number
}): Promise<ActivityResponse> {
  const query = new URLSearchParams()

  if (params?.issueIdentifier) {
    query.set("issue_identifier", params.issueIdentifier)
  }

  if (typeof params?.limit === "number") {
    query.set("limit", String(params.limit))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return requestJson(`/api/v1/activity${suffix}`, activityResponseSchema)
}

export async function fetchConfig(): Promise<ConfigResponse> {
  return requestJson("/api/v1/config", configResponseSchema)
}

export async function requestRefresh(): Promise<RefreshResponse> {
  return requestJson("/api/v1/refresh", refreshResponseSchema, { method: "POST" })
}

export function activityStreamUrl(params?: {
  issueIdentifier?: string
  limit?: number
}): string {
  const query = new URLSearchParams()

  if (params?.issueIdentifier) {
    query.set("issue_identifier", params.issueIdentifier)
  }

  if (typeof params?.limit === "number") {
    query.set("limit", String(params.limit))
  }

  const suffix = query.toString() ? `?${query.toString()}` : ""
  return `/api/v1/activity/stream${suffix}`
}
