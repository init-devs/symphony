defmodule SymphonyElixirWeb.Presenter do
  @moduledoc """
  Shared projections for the observability API and dashboard.
  """

  alias SymphonyElixir.{Config, Orchestrator, StatusDashboard, Workflow}

  @issue_activity_limit 500

  @spec state_payload(GenServer.name(), timeout()) :: map()
  def state_payload(orchestrator, snapshot_timeout_ms) do
    generated_at = now_iso8601()

    case Orchestrator.snapshot(orchestrator, snapshot_timeout_ms) do
      %{} = snapshot ->
        running = snapshot |> Map.get(:running, []) |> Enum.map(&running_entry_payload/1)
        retrying = snapshot |> Map.get(:retrying, []) |> Enum.map(&retry_entry_payload/1)
        poll_interval_ms = snapshot |> Map.get(:polling) |> polling_interval_ms()
        max_concurrent_agents = Map.get(snapshot, :max_concurrent_agents) || Config.max_concurrent_agents()
        service_uptime_seconds = uptime_seconds(Map.get(snapshot, :started_at))
        completed_count = Map.get(snapshot, :completed_count) || 0

        %{
          generated_at: generated_at,
          counts: %{
            running: length(running),
            retrying: length(retrying)
          },
          running: running,
          retrying: retrying,
          codex_totals: codex_totals_payload(Map.get(snapshot, :codex_totals)),
          rate_limits: Map.get(snapshot, :rate_limits),
          polling: polling_payload(Map.get(snapshot, :polling)),
          service: %{
            started_at: iso8601(Map.get(snapshot, :started_at)),
            uptime_seconds: service_uptime_seconds,
            completed_count: completed_count
          },
          poll_interval_ms: poll_interval_ms,
          max_concurrent_agents: max_concurrent_agents,
          service_uptime_seconds: service_uptime_seconds,
          completed_count: completed_count
        }

      :timeout ->
        %{generated_at: generated_at, error: %{code: "snapshot_timeout", message: "Snapshot timed out"}}

      :unavailable ->
        %{generated_at: generated_at, error: %{code: "snapshot_unavailable", message: "Snapshot unavailable"}}
    end
  end

  @spec issues_payload(GenServer.name(), timeout()) :: map()
  def issues_payload(orchestrator, snapshot_timeout_ms) do
    generated_at = now_iso8601()

    case Orchestrator.snapshot(orchestrator, snapshot_timeout_ms) do
      %{} = snapshot ->
        running = snapshot |> Map.get(:running, []) |> Enum.map(&running_issue_summary_payload/1)
        retrying = snapshot |> Map.get(:retrying, []) |> Enum.map(&retry_issue_summary_payload/1)

        issues =
          (running ++ retrying)
          |> Enum.sort_by(fn issue ->
            {
              issue_priority_rank(issue.priority),
              issue.issue_identifier || "",
              issue.status
            }
          end)

        %{
          generated_at: generated_at,
          counts: %{
            running: length(running),
            retrying: length(retrying),
            total: length(issues)
          },
          issues: issues
        }

      :timeout ->
        %{generated_at: generated_at, error: %{code: "snapshot_timeout", message: "Snapshot timed out"}}

      :unavailable ->
        %{generated_at: generated_at, error: %{code: "snapshot_unavailable", message: "Snapshot unavailable"}}
    end
  end

  @spec issue_payload(String.t(), GenServer.name(), timeout()) :: {:ok, map()} | {:error, :issue_not_found}
  def issue_payload(issue_identifier, orchestrator, snapshot_timeout_ms) when is_binary(issue_identifier) do
    with %{} = snapshot <- Orchestrator.snapshot(orchestrator, snapshot_timeout_ms),
         running <- snapshot |> Map.get(:running, []) |> Enum.find(&(&1.identifier == issue_identifier)),
         retry <- snapshot |> Map.get(:retrying, []) |> Enum.find(&(&1.identifier == issue_identifier)),
         false <- is_nil(running) and is_nil(retry) do
      issue = issue_from_entries(running, retry)
      activity_events = issue_activity_events(orchestrator, issue_identifier)

      {:ok,
       %{
         issue_identifier: issue_identifier,
         issue_id: issue_id_from_entries(running, retry),
         title: issue_field(issue, :title),
         description: issue_field(issue, :description),
         tracker_state: issue_tracker_state(issue, running, retry),
         priority: issue_field(issue, :priority),
         labels: issue_labels(issue),
         url: issue_field(issue, :url),
         status: issue_status(running, retry),
         workspace: %{
           path: Path.join(Config.workspace_root(), issue_identifier)
         },
         attempts: %{
           restart_count: restart_count(running, retry),
           current_retry_attempt: current_retry_attempt(running, retry)
         },
         running: running && running_issue_payload(running),
         retry: retry && retry_issue_payload(retry),
         recent_events: Enum.map(activity_events, &activity_event_payload/1),
         token_history: token_history_payload(activity_events, running),
         last_error: retry && retry.error,
         logs: %{
           codex_session_logs: []
         },
         tracked: %{}
       }}
    else
      false ->
        {:error, :issue_not_found}

      _ ->
        {:error, :issue_not_found}
    end
  end

  @spec refresh_payload(GenServer.name()) :: {:ok, map()} | {:error, :unavailable}
  def refresh_payload(orchestrator) do
    case Orchestrator.request_refresh(orchestrator) do
      :unavailable ->
        {:error, :unavailable}

      payload ->
        {:ok, Map.update!(payload, :requested_at, &DateTime.to_iso8601/1)}
    end
  end

  @spec activity_payload(GenServer.name(), pos_integer(), String.t() | nil) :: map()
  def activity_payload(orchestrator, limit, issue_identifier \\ nil)
      when is_integer(limit) and limit > 0 do
    generated_at = now_iso8601()

    case Orchestrator.recent_activity(orchestrator, limit) do
      :unavailable ->
        %{generated_at: generated_at, error: %{code: "snapshot_unavailable", message: "Snapshot unavailable"}}

      activity_events when is_list(activity_events) ->
        events =
          activity_events
          |> maybe_filter_activity_events(issue_identifier)
          |> Enum.map(&activity_event_payload/1)

        %{generated_at: generated_at, events: events}
    end
  end

  @spec activity_payload_event(map()) :: map()
  def activity_payload_event(event) when is_map(event), do: activity_event_payload(event)

  @spec config_payload() :: map()
  def config_payload do
    generated_at = now_iso8601()
    tracker_kind = Config.tracker_kind()
    workflow_path = Workflow.workflow_file_path()

    workflow_result = Config.current_workflow()

    {workflow_prompt, workflow_front_matter} =
      case workflow_result do
        {:ok, workflow} -> {workflow.prompt_template, workflow.config}
        _ -> {nil, %{}}
      end

    raw_workflow =
      case File.read(workflow_path) do
        {:ok, content} -> content
        {:error, _reason} -> nil
      end

    validation = %{
      workflow_file: status_for(match?({:ok, _}, workflow_result)),
      tracker_kind: status_for(tracker_kind in ["linear", "memory"]),
      tracker_api_key: status_for(tracker_kind != "linear" or is_binary(Config.linear_api_token())),
      tracker_scope: status_for(tracker_kind != "linear" or not is_nil(Config.linear_scope())),
      runtime_provider: status_for(Config.runtime_provider() == "opencode"),
      runtime_command: status_for(valid_non_empty_string?(Config.runtime_command()))
    }

    %{
      generated_at: generated_at,
      workflow: %{
        path: workflow_path,
        prompt_template: workflow_prompt,
        raw_markdown: raw_workflow,
        front_matter: workflow_front_matter
      },
      effective_config: %{
        tracker: %{
          kind: tracker_kind,
          endpoint: Config.linear_endpoint(),
          api_key: tracker_api_key_payload(workflow_front_matter),
          project_slug: Config.linear_project_slug(),
          team_key: Config.linear_team_key(),
          assignee: Config.linear_assignee(),
          actionable_label: Config.linear_actionable_label(),
          active_states: Config.linear_active_states(),
          terminal_states: Config.linear_terminal_states()
        },
        polling: %{
          interval_ms: Config.poll_interval_ms()
        },
        workspace: %{
          root: Config.workspace_root()
        },
        hooks: Config.workspace_hooks(),
        agent: %{
          max_concurrent_agents: Config.max_concurrent_agents(),
          max_turns: Config.agent_max_turns(),
          max_retry_backoff_ms: Config.max_retry_backoff_ms()
        },
        runtime: Config.runtime_settings(),
        observability: %{
          dashboard_enabled: Config.observability_enabled?(),
          refresh_ms: Config.observability_refresh_ms(),
          render_interval_ms: Config.observability_render_interval_ms()
        },
        server: %{
          host: Config.server_host(),
          port: Config.server_port()
        }
      },
      validation: validation
    }
  end

  defp running_issue_summary_payload(entry) do
    issue = Map.get(entry, :issue)
    retry_attempt = running_retry_attempt(entry)

    %{
      issue_identifier: entry.identifier,
      issue_id: entry.issue_id,
      title: issue_field(issue, :title),
      description: issue_field(issue, :description),
      tracker_state: issue_field(issue, :state) || entry.state,
      priority: issue_field(issue, :priority),
      labels: issue_labels(issue),
      url: issue_field(issue, :url),
      status: "Running",
      workspace: %{path: Path.join(Config.workspace_root(), entry.identifier)},
      attempts: %{
        restart_count: max(retry_attempt - 1, 0),
        current_retry_attempt: if(retry_attempt > 0, do: retry_attempt, else: nil)
      },
      running: running_issue_payload(entry),
      retry: nil,
      last_error: nil
    }
  end

  defp retry_issue_summary_payload(entry) do
    issue = Map.get(entry, :issue)

    %{
      issue_identifier: entry.identifier,
      issue_id: entry.issue_id,
      title: issue_field(issue, :title),
      description: issue_field(issue, :description),
      tracker_state: issue_field(issue, :state),
      priority: issue_field(issue, :priority),
      labels: issue_labels(issue),
      url: issue_field(issue, :url),
      status: "RetryQueued",
      workspace: %{path: Path.join(Config.workspace_root(), entry.identifier)},
      attempts: %{
        restart_count: max((entry.attempt || 0) - 1, 0),
        current_retry_attempt: entry.attempt
      },
      running: nil,
      retry: retry_issue_payload(entry),
      last_error: entry.error
    }
  end

  defp issue_activity_events(orchestrator, issue_identifier) do
    case Orchestrator.recent_activity(orchestrator, @issue_activity_limit) do
      activity_events when is_list(activity_events) ->
        activity_events
        |> maybe_filter_activity_events(issue_identifier)
        |> Enum.take(@issue_activity_limit)

      _ ->
        []
    end
  end

  defp token_history_payload(activity_events, running) do
    history =
      activity_events
      |> Enum.reverse()
      |> Enum.map(fn event ->
        %{
          at: iso8601(event[:at]),
          total_tokens: get_in(event, [:tokens, :total_tokens]) || 0
        }
      end)
      |> Enum.reject(&is_nil(&1.at))

    case history do
      [] ->
        running_fallback_token_history(running)

      _ ->
        history
    end
  end

  defp running_fallback_token_history(nil), do: []

  defp running_fallback_token_history(running) do
    case iso8601(running.started_at) do
      nil -> []
      started_at -> [%{at: started_at, total_tokens: running.codex_total_tokens || 0}]
    end
  end

  defp issue_from_entries(running, retry),
    do: (running && Map.get(running, :issue)) || (retry && Map.get(retry, :issue))

  defp issue_id_from_entries(running, retry),
    do: (running && running.issue_id) || (retry && retry.issue_id)

  defp issue_tracker_state(issue, running, retry) do
    issue_field(issue, :state) ||
      (running && running.state) ||
      (retry && issue_field(Map.get(retry, :issue), :state))
  end

  defp issue_status(_running, nil), do: "running"
  defp issue_status(nil, _retry), do: "retrying"
  defp issue_status(_running, _retry), do: "running"

  defp restart_count(running, retry) do
    max(current_retry_attempt(running, retry) - 1, 0)
  end

  defp current_retry_attempt(running, retry) do
    cond do
      is_map(retry) and is_integer(retry.attempt) ->
        retry.attempt

      is_map(running) ->
        running_retry_attempt(running)

      true ->
        0
    end
  end

  defp running_retry_attempt(running) do
    case Map.get(running, :retry_attempt) do
      attempt when is_integer(attempt) and attempt > 0 -> attempt
      _ -> 0
    end
  end

  defp running_entry_payload(entry) do
    issue = Map.get(entry, :issue)

    %{
      issue_id: entry.issue_id,
      issue_identifier: entry.identifier,
      title: issue_field(issue, :title),
      description: issue_field(issue, :description),
      tracker_state: issue_field(issue, :state) || entry.state,
      priority: issue_field(issue, :priority),
      labels: issue_labels(issue),
      url: issue_field(issue, :url),
      state: entry.state,
      session_id: entry.session_id,
      turn_count: Map.get(entry, :turn_count, 0),
      last_event: event_name(entry.last_codex_event),
      last_message: summarize_message(entry.last_codex_message),
      started_at: iso8601(entry.started_at),
      last_event_at: iso8601(entry.last_codex_timestamp),
      runtime_seconds: Map.get(entry, :runtime_seconds),
      phase: running_phase(entry),
      workspace_path: Path.join(Config.workspace_root(), entry.identifier),
      attempt: running_retry_attempt(entry),
      tokens: %{
        input_tokens: entry.codex_input_tokens,
        output_tokens: entry.codex_output_tokens,
        total_tokens: entry.codex_total_tokens
      }
    }
  end

  defp retry_entry_payload(entry) do
    issue = Map.get(entry, :issue)

    %{
      issue_id: entry.issue_id,
      issue_identifier: entry.identifier,
      title: issue_field(issue, :title),
      description: issue_field(issue, :description),
      tracker_state: issue_field(issue, :state),
      priority: issue_field(issue, :priority),
      labels: issue_labels(issue),
      url: issue_field(issue, :url),
      attempt: entry.attempt,
      due_at: due_at_iso8601(entry.due_in_ms),
      due_in_ms: entry.due_in_ms,
      error: entry.error
    }
  end

  defp running_issue_payload(running) do
    %{
      session_id: running.session_id,
      turn_count: Map.get(running, :turn_count, 0),
      state: running.state,
      started_at: iso8601(running.started_at),
      last_event: event_name(running.last_codex_event),
      last_message: summarize_message(running.last_codex_message),
      last_event_at: iso8601(running.last_codex_timestamp),
      phase: running_phase(running),
      workspace_path: Path.join(Config.workspace_root(), running.identifier),
      attempt: running_retry_attempt(running),
      tokens: %{
        input_tokens: running.codex_input_tokens,
        output_tokens: running.codex_output_tokens,
        total_tokens: running.codex_total_tokens
      }
    }
  end

  defp retry_issue_payload(retry) do
    %{
      attempt: retry.attempt,
      due_at: due_at_iso8601(retry.due_in_ms),
      due_in_ms: retry.due_in_ms,
      error: retry.error
    }
  end

  defp maybe_filter_activity_events(events, issue_identifier) when is_binary(issue_identifier) do
    Enum.filter(events, fn event -> event[:issue_identifier] == issue_identifier end)
  end

  defp maybe_filter_activity_events(events, _issue_identifier), do: events

  defp activity_event_payload(event) when is_map(event) do
    %{
      issue_id: event[:issue_id],
      issue_identifier: event[:issue_identifier],
      session_id: event[:session_id],
      event: event_name(event[:event]),
      at: iso8601(event[:at]),
      message: summarize_message(event[:message]),
      tokens: codex_totals_payload(event[:tokens])
    }
  end

  defp codex_totals_payload(nil), do: %{input_tokens: 0, output_tokens: 0, total_tokens: 0}

  defp codex_totals_payload(codex_totals) when is_map(codex_totals) do
    %{
      input_tokens: Map.get(codex_totals, :input_tokens) || Map.get(codex_totals, "input_tokens") || 0,
      output_tokens: Map.get(codex_totals, :output_tokens) || Map.get(codex_totals, "output_tokens") || 0,
      total_tokens: Map.get(codex_totals, :total_tokens) || Map.get(codex_totals, "total_tokens") || 0,
      seconds_running: Map.get(codex_totals, :seconds_running) || Map.get(codex_totals, "seconds_running") || 0
    }
    |> Map.reject(fn {_key, value} -> is_nil(value) end)
  end

  defp codex_totals_payload(_), do: %{input_tokens: 0, output_tokens: 0, total_tokens: 0}

  defp polling_payload(%{} = polling) do
    %{
      checking: polling_checking?(polling),
      poll_interval_ms: polling_interval_ms(polling),
      next_poll_in_ms: Map.get(polling, :next_poll_in_ms)
    }
  end

  defp polling_payload(_polling) do
    %{
      checking: false,
      poll_interval_ms: Config.poll_interval_ms(),
      next_poll_in_ms: nil
    }
  end

  defp polling_checking?(polling), do: Map.get(polling, :checking?) == true

  defp polling_interval_ms(%{} = polling), do: Map.get(polling, :poll_interval_ms) || Config.poll_interval_ms()
  defp polling_interval_ms(_polling), do: Config.poll_interval_ms()

  defp tracker_api_key_payload(workflow_config) when is_map(workflow_config) do
    configured_value =
      workflow_config
      |> workflow_map_get("tracker")
      |> workflow_map_get("api_key")

    case configured_value do
      "$" <> env_name ->
        %{source: "env", env_var: env_name, configured: true}

      value when is_binary(value) and value != "" ->
        %{source: "literal", env_var: nil, configured: true}

      _ ->
        %{source: "env", env_var: "LINEAR_API_KEY", configured: is_binary(Config.linear_api_token())}
    end
  end

  defp tracker_api_key_payload(_), do: %{source: "env", env_var: "LINEAR_API_KEY", configured: is_binary(Config.linear_api_token())}

  defp issue_field(nil, _field), do: nil

  defp issue_field(issue, field) do
    Map.get(issue, field) || Map.get(issue, Atom.to_string(field))
  end

  defp issue_labels(issue) do
    case issue_field(issue, :labels) do
      labels when is_list(labels) -> labels
      _ -> []
    end
  end

  defp issue_priority_rank(priority) when is_integer(priority) and priority > 0, do: priority
  defp issue_priority_rank(_priority), do: 9_999

  defp running_phase(entry) do
    event = event_name(entry.last_codex_event)

    cond do
      event in ["startup_failed", "turn_failed", "turn_cancelled", "turn_ended_with_error"] ->
        "Failed"

      event in ["turn_completed"] ->
        "Finishing"

      is_binary(entry.session_id) and String.trim(entry.session_id) != "" ->
        "StreamingTurn"

      true ->
        "InitializingSession"
    end
  end

  defp event_name(nil), do: nil
  defp event_name(event) when is_atom(event), do: Atom.to_string(event)
  defp event_name(event) when is_binary(event), do: event
  defp event_name(event), do: to_string(event)

  defp summarize_message(nil), do: nil
  defp summarize_message(message), do: StatusDashboard.humanize_codex_message(message)

  defp due_at_iso8601(due_in_ms) when is_integer(due_in_ms) do
    DateTime.utc_now()
    |> DateTime.add(div(due_in_ms, 1_000), :second)
    |> DateTime.truncate(:second)
    |> DateTime.to_iso8601()
  end

  defp due_at_iso8601(_due_in_ms), do: nil

  defp uptime_seconds(%DateTime{} = started_at) do
    max(DateTime.diff(DateTime.utc_now(), started_at, :second), 0)
  rescue
    _error -> 0
  end

  defp uptime_seconds(_started_at), do: 0

  defp now_iso8601 do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> DateTime.to_iso8601()
  end

  defp status_for(true), do: "ok"
  defp status_for(false), do: "error"

  defp valid_non_empty_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp valid_non_empty_string?(_value), do: false

  defp workflow_map_get(nil, _key), do: nil

  defp workflow_map_get(map, key) when is_map(map), do: Map.get(map, key)

  defp workflow_map_get(_value, _key), do: nil

  defp iso8601(%DateTime{} = datetime) do
    datetime
    |> DateTime.truncate(:second)
    |> DateTime.to_iso8601()
  end

  defp iso8601(_datetime), do: nil
end
