defmodule SymphonyElixir.Runtime.OpenCode do
  @moduledoc """
  Runtime adapter for OpenCode's `serve` HTTP/SSE interface.
  """

  @behaviour SymphonyElixir.Runtime.Adapter

  require Logger

  alias SymphonyElixir.Config

  @minimum_server_start_timeout_ms 15_000
  @port_line_bytes 1_048_576
  @max_stream_log_bytes 1_000

  @type session :: %{
          port: port(),
          metadata: map(),
          base_url: String.t(),
          remote_session_id: String.t(),
          workspace: Path.t()
        }

  @spec run(Path.t(), String.t(), map(), keyword()) :: {:ok, map()} | {:error, term()}
  def run(workspace, prompt, issue, opts \\ []) do
    with {:ok, session} <- start_session(workspace) do
      try do
        run_turn(session, prompt, issue, opts)
      after
        stop_session(session)
      end
    end
  end

  @impl true
  @spec start_session(Path.t()) :: {:ok, session()} | {:error, term()}
  def start_session(workspace) do
    with :ok <- validate_workspace_cwd(workspace),
         {:ok, port} <- start_port(workspace) do
      with {:ok, base_url} <- await_server_base_url(port),
           {:ok, remote_session_id} <- create_remote_session(base_url, workspace) do
        {:ok,
         %{
           port: port,
           metadata: port_metadata(port),
           base_url: base_url,
           remote_session_id: remote_session_id,
           workspace: Path.expand(workspace)
         }}
      else
        {:error, reason} ->
          stop_port(port)
          {:error, reason}
      end
    end
  end

  @impl true
  @spec run_turn(session(), String.t(), map(), keyword()) :: {:ok, map()} | {:error, term()}
  def run_turn(
        %{base_url: base_url, remote_session_id: remote_session_id, metadata: metadata} = _session,
        prompt,
        issue,
        opts \\ []
      ) do
    on_message = Keyword.get(opts, :on_message, &default_on_message/1)
    turn_id = "turn_#{System.unique_integer([:positive])}"
    runtime_session_id = "#{remote_session_id}-#{turn_id}"

    Logger.info("Runtime session started for #{issue_context(issue)} session_id=#{runtime_session_id}")

    emit_message(
      on_message,
      :session_started,
      %{session_id: runtime_session_id, thread_id: remote_session_id, turn_id: turn_id},
      metadata
    )

    event_streamer = start_event_stream(base_url, remote_session_id, runtime_session_id, on_message, metadata)

    try do
      case post_prompt(base_url, remote_session_id, prompt) do
        {:ok, response_body} ->
          usage = usage_from_message_response(response_body)

          emit_message(
            on_message,
            :turn_completed,
            %{payload: response_body, usage: usage, session_id: runtime_session_id},
            metadata
          )

          Logger.info("Runtime session completed for #{issue_context(issue)} session_id=#{runtime_session_id}")

          {:ok,
           %{
             result: response_body,
             session_id: runtime_session_id,
             thread_id: remote_session_id,
             turn_id: turn_id
           }}

        {:error, reason} ->
          Logger.warning("Runtime session ended with error for #{issue_context(issue)} session_id=#{runtime_session_id}: #{inspect(reason)}")

          emit_message(
            on_message,
            :turn_ended_with_error,
            %{session_id: runtime_session_id, reason: reason},
            metadata
          )

          {:error, reason}
      end
    after
      stop_event_stream(event_streamer)
    end
  end

  @impl true
  @spec stop_session(session()) :: :ok
  def stop_session(%{port: port}) when is_port(port) do
    stop_port(port)
  end

  defp post_prompt(base_url, remote_session_id, prompt) do
    url = "#{base_url}/session/#{remote_session_id}/message"
    body = prompt_request_body(prompt)

    task =
      Task.async(fn ->
        Req.post(url,
          json: body,
          connect_options: [timeout: Config.runtime_read_timeout_ms()]
        )
      end)

    case Task.yield(task, Config.runtime_turn_timeout_ms()) || Task.shutdown(task, :brutal_kill) do
      {:ok, {:ok, %Req.Response{status: status, body: response_body}}}
      when status in 200..299 and is_map(response_body) ->
        {:ok, response_body}

      {:ok, {:ok, %Req.Response{status: status, body: response_body}}} ->
        {:error, {:http_error, status, response_body}}

      {:ok, {:error, reason}} ->
        {:error, {:request_failed, reason}}

      nil ->
        {:error, :turn_timeout}
    end
  end

  defp prompt_request_body(prompt) do
    %{}
    |> Map.put(:parts, [%{type: "text", text: prompt}])
    |> maybe_put(:model, runtime_model_payload(Config.runtime_model()))
    |> maybe_put(:agent, Config.runtime_agent())
    |> maybe_put(:variant, Config.runtime_variant())
  end

  defp runtime_model_payload(nil), do: nil

  defp runtime_model_payload(model) when is_binary(model) do
    case String.split(String.trim(model), "/", parts: 2) do
      [provider_id, model_id] when provider_id != "" and model_id != "" ->
        %{providerID: provider_id, modelID: model_id}

      _ ->
        Logger.warning("Invalid runtime.model value #{inspect(model)}; expected provider/model")
        nil
    end
  end

  defp runtime_model_payload(_model), do: nil

  defp maybe_put(map, _key, value) when value in [nil, ""], do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp start_event_stream(base_url, remote_session_id, runtime_session_id, on_message, metadata) do
    spawn(fn ->
      stream_events(base_url, remote_session_id, runtime_session_id, on_message, metadata)
    end)
  end

  defp stop_event_stream(pid) when is_pid(pid) do
    send(pid, :stop)
    :ok
  end

  defp stream_events(base_url, remote_session_id, runtime_session_id, on_message, metadata) do
    _ = Application.ensure_all_started(:inets)

    url = to_charlist("#{base_url}/global/event")

    case :httpc.request(:get, {url, []}, [], [{:sync, false}, {:stream, self()}]) do
      {:ok, request_id} ->
        stream_events_loop(request_id, "", remote_session_id, runtime_session_id, on_message, metadata)

      {:error, reason} ->
        emit_message(on_message, :event_stream_error, %{reason: reason}, metadata)
    end
  end

  defp stream_events_loop(request_id, pending, remote_session_id, runtime_session_id, on_message, metadata) do
    receive do
      :stop ->
        :httpc.cancel_request(request_id)
        :ok

      {:http, {^request_id, :stream_start, _headers}} ->
        stream_events_loop(request_id, pending, remote_session_id, runtime_session_id, on_message, metadata)

      {:http, {^request_id, :stream, chunk}} ->
        {next_pending, events} = parse_sse_chunks(pending <> to_string(chunk))

        Enum.each(events, fn raw_event ->
          maybe_emit_runtime_event(raw_event, remote_session_id, runtime_session_id, on_message, metadata)
        end)

        stream_events_loop(request_id, next_pending, remote_session_id, runtime_session_id, on_message, metadata)

      {:http, {^request_id, :stream_end, _headers}} ->
        :ok

      {:http, {^request_id, {:error, reason}}} ->
        maybe_emit_event_stream_error(on_message, reason, metadata)

      _message ->
        stream_events_loop(request_id, pending, remote_session_id, runtime_session_id, on_message, metadata)
    after
      250 ->
        stream_events_loop(request_id, pending, remote_session_id, runtime_session_id, on_message, metadata)
    end
  end

  defp parse_sse_chunks(buffer) when is_binary(buffer) do
    separator = ~r/\r?\n\r?\n/
    segments = Regex.split(separator, buffer)

    case segments do
      [] ->
        {"", []}

      [single] ->
        {single, []}

      _ ->
        complete_events = Enum.slice(segments, 0, length(segments) - 1)
        remainder = List.last(segments) || ""
        events = Enum.map(complete_events, &sse_event_data/1) |> Enum.reject(&(&1 == ""))
        {remainder, events}
    end
  end

  defp sse_event_data(segment) when is_binary(segment) do
    segment
    |> String.split(~r/\r?\n/)
    |> Enum.reduce([], fn
      "data: " <> data, acc -> [data | acc]
      "data:" <> data, acc -> [String.trim_leading(data) | acc]
      _line, acc -> acc
    end)
    |> Enum.reverse()
    |> Enum.join("\n")
  end

  defp maybe_emit_runtime_event(raw_event, remote_session_id, runtime_session_id, on_message, metadata)
       when is_binary(raw_event) do
    case Jason.decode(raw_event) do
      {:ok, %{"payload" => payload} = full_payload} when is_map(payload) ->
        if event_session_id(payload) == remote_session_id do
          details =
            %{
              payload: full_payload,
              raw: raw_event,
              session_id: runtime_session_id
            }
            |> maybe_put_usage(usage_from_event_payload(payload))

          emit_message(on_message, map_event_name(payload), details, metadata)
        end

      _ ->
        :ok
    end
  end

  defp maybe_emit_runtime_event(_raw_event, _remote_session_id, _runtime_session_id, _on_message, _metadata),
    do: :ok

  defp maybe_put_usage(details, nil), do: details
  defp maybe_put_usage(details, usage), do: Map.put(details, :usage, usage)

  defp map_event_name(%{"type" => "server.connected"}), do: :event_stream_connected
  defp map_event_name(%{"type" => "session.status"}), do: :session_status
  defp map_event_name(%{"type" => "message.part.delta"}), do: :message_part_delta

  defp map_event_name(%{"type" => "message.part.updated", "properties" => %{"part" => part}})
       when is_map(part) do
    case Map.get(part, "type") do
      "tool" -> map_tool_event_name(part)
      "step-start" -> :turn_step_started
      "step-finish" -> :turn_step_finished
      "text" -> :text_updated
      "reasoning" -> :reasoning_updated
      _ -> :message_part_updated
    end
  end

  defp map_event_name(%{"type" => "message.updated"} = payload) do
    case get_in(payload, ["properties", "info", "time", "completed"]) do
      completed when is_integer(completed) -> :assistant_message_completed
      _ -> :message_updated
    end
  end

  defp map_event_name(_payload), do: :notification

  defp map_tool_event_name(part) when is_map(part) do
    status = get_in(part, ["state", "status"])

    case status do
      "pending" -> :tool_call_pending
      "running" -> :tool_call_running
      "completed" -> :tool_call_completed
      "failed" -> :tool_call_failed
      _ -> :tool_call_updated
    end
  end

  defp event_session_id(payload) when is_map(payload) do
    get_in(payload, ["properties", "sessionID"]) ||
      get_in(payload, ["properties", "info", "sessionID"]) ||
      get_in(payload, ["properties", "part", "sessionID"]) ||
      get_in(payload, ["properties", "message", "sessionID"])
  end

  defp usage_from_message_response(%{"info" => %{"tokens" => tokens}}),
    do: normalize_usage(tokens)

  defp usage_from_message_response(_payload), do: nil

  defp usage_from_event_payload(%{"type" => "message.part.updated", "properties" => %{"part" => part}})
       when is_map(part) do
    case part do
      %{"type" => "step-finish", "tokens" => tokens} -> normalize_usage(tokens)
      _ -> nil
    end
  end

  defp usage_from_event_payload(%{"type" => "message.updated", "properties" => %{"info" => info}})
       when is_map(info) do
    normalize_usage(Map.get(info, "tokens"))
  end

  defp usage_from_event_payload(_payload), do: nil

  defp normalize_usage(tokens) when is_map(tokens) do
    input = token_value(tokens, ["input", "input_tokens", "inputTokens", :input, :input_tokens, :inputTokens])

    output =
      token_value(tokens, ["output", "output_tokens", "outputTokens", :output, :output_tokens, :outputTokens])

    total = token_value(tokens, ["total", "total_tokens", "totalTokens", :total, :total_tokens, :totalTokens])

    if is_integer(input) or is_integer(output) or is_integer(total) do
      %{
        "input_tokens" => input || 0,
        "output_tokens" => output || 0,
        "total_tokens" => total || 0
      }
    end
  end

  defp normalize_usage(_tokens), do: nil

  defp token_value(tokens, keys) when is_map(tokens) and is_list(keys) do
    Enum.find_value(keys, fn key -> integer_like(Map.get(tokens, key)) end)
  end

  defp token_value(_tokens, _keys), do: nil

  defp integer_like(value) when is_integer(value) and value >= 0, do: value

  defp integer_like(value) when is_binary(value) do
    case Integer.parse(String.trim(value)) do
      {parsed, _} when parsed >= 0 -> parsed
      _ -> nil
    end
  end

  defp integer_like(_value), do: nil

  defp validate_workspace_cwd(workspace) when is_binary(workspace) do
    workspace_path = Path.expand(workspace)
    workspace_root = Path.expand(Config.workspace_root())

    root_prefix = workspace_root <> "/"

    cond do
      workspace_path == workspace_root ->
        {:error, {:invalid_workspace_cwd, :workspace_root, workspace_path}}

      not String.starts_with?(workspace_path <> "/", root_prefix) ->
        {:error, {:invalid_workspace_cwd, :outside_workspace_root, workspace_path, workspace_root}}

      true ->
        :ok
    end
  end

  defp start_port(workspace) do
    executable = System.find_executable("bash")

    if is_nil(executable) do
      {:error, :bash_not_found}
    else
      port =
        Port.open(
          {:spawn_executable, String.to_charlist(executable)},
          [
            :binary,
            :exit_status,
            :stderr_to_stdout,
            args: [~c"-lc", String.to_charlist(Config.runtime_command())],
            cd: String.to_charlist(workspace),
            line: @port_line_bytes
          ]
        )

      {:ok, port}
    end
  end

  defp await_server_base_url(port) do
    timeout_ms = max(Config.runtime_read_timeout_ms(), @minimum_server_start_timeout_ms)
    await_server_base_url(port, timeout_ms, "")
  end

  defp await_server_base_url(port, timeout_ms, pending_line) do
    receive do
      {^port, {:data, {:eol, chunk}}} ->
        line = pending_line <> to_string(chunk)
        handle_server_output_line(port, timeout_ms, line)

      {^port, {:data, {:noeol, chunk}}} ->
        await_server_base_url(port, timeout_ms, pending_line <> to_string(chunk))

      {^port, {:exit_status, status}} ->
        {:error, {:port_exit, status}}
    after
      timeout_ms ->
        {:error, :server_start_timeout}
    end
  end

  defp handle_server_output_line(port, timeout_ms, line) do
    trimmed = String.trim(line)

    maybe_log_server_line(trimmed)

    case Regex.run(~r|https?://[^\s]+|, trimmed) do
      [base_url | _] ->
        {:ok, String.trim_trailing(base_url, "/")}

      _ ->
        await_server_base_url(port, timeout_ms, "")
    end
  end

  defp maybe_log_server_line(""), do: :ok

  defp maybe_log_server_line(line) when is_binary(line) do
    text = String.slice(line, 0, @max_stream_log_bytes)

    if String.match?(text, ~r/\b(error|warn|warning|failed|fatal|panic|exception)\b/i) do
      Logger.warning("Runtime server output: #{text}")
    else
      Logger.debug("Runtime server output: #{text}")
    end
  end

  defp create_remote_session(base_url, workspace) do
    query = URI.encode_query(%{directory: Path.expand(workspace)})
    url = "#{base_url}/session?#{query}"

    case Req.post(url, json: %{}, connect_options: [timeout: Config.runtime_read_timeout_ms()]) do
      {:ok, %Req.Response{status: status, body: %{"id" => session_id}}}
      when status in 200..299 and is_binary(session_id) ->
        {:ok, session_id}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, {:session_create_failed, status, body}}

      {:error, reason} ->
        {:error, {:session_create_failed, reason}}
    end
  end

  defp port_metadata(port) when is_port(port) do
    case :erlang.port_info(port, :os_pid) do
      {:os_pid, os_pid} ->
        %{
          runtime_backend_pid: to_string(os_pid),
          codex_app_server_pid: to_string(os_pid)
        }

      _ ->
        %{}
    end
  end

  defp stop_port(port) when is_port(port) do
    case :erlang.port_info(port) do
      :undefined ->
        :ok

      _ ->
        try do
          Port.close(port)
          :ok
        rescue
          ArgumentError ->
            :ok
        end
    end
  end

  defp emit_message(on_message, event, details, metadata) when is_function(on_message, 1) do
    message = metadata |> Map.merge(details) |> Map.put(:event, event) |> Map.put(:timestamp, DateTime.utc_now())
    on_message.(message)
  end

  defp maybe_emit_event_stream_error(on_message, reason, metadata) do
    unless benign_event_stream_error?(reason) do
      emit_message(on_message, :event_stream_error, %{reason: reason}, metadata)
    end
  end

  defp benign_event_stream_error?(reason) do
    reason in [:closed, :normal, :shutdown, :cancelled] or
      (is_tuple(reason) and tuple_size(reason) > 0 and elem(reason, 0) == :shutdown)
  end

  defp default_on_message(_message), do: :ok

  defp issue_context(%{id: issue_id, identifier: identifier}) do
    "issue_id=#{issue_id} issue_identifier=#{identifier}"
  end
end
