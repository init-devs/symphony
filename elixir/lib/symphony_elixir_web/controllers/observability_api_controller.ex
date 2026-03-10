defmodule SymphonyElixirWeb.ObservabilityApiController do
  @moduledoc """
  JSON API for Symphony observability data.
  """

  use Phoenix.Controller, formats: [:json]

  alias Plug.Conn
  alias SymphonyElixirWeb.{Endpoint, ObservabilityPubSub, Presenter}

  @spec state(Conn.t(), map()) :: Conn.t()
  def state(conn, _params) do
    json(conn, Presenter.state_payload(orchestrator(), snapshot_timeout_ms()))
  end

  @spec issue(Conn.t(), map()) :: Conn.t()
  def issue(conn, %{"issue_identifier" => issue_identifier}) do
    case Presenter.issue_payload(issue_identifier, orchestrator(), snapshot_timeout_ms()) do
      {:ok, payload} ->
        json(conn, payload)

      {:error, :issue_not_found} ->
        error_response(conn, 404, "issue_not_found", "Issue not found")
    end
  end

  @spec refresh(Conn.t(), map()) :: Conn.t()
  def refresh(conn, _params) do
    case Presenter.refresh_payload(orchestrator()) do
      {:ok, payload} ->
        conn
        |> put_status(202)
        |> json(payload)

      {:error, :unavailable} ->
        error_response(conn, 503, "orchestrator_unavailable", "Orchestrator is unavailable")
    end
  end

  @spec activity(Conn.t(), map()) :: Conn.t()
  def activity(conn, params) do
    limit = parse_limit(Map.get(params, "limit"), 100)
    issue_identifier = Map.get(params, "issue_identifier")
    json(conn, Presenter.activity_payload(orchestrator(), limit, issue_identifier))
  end

  @spec activity_stream(Conn.t(), map()) :: Conn.t()
  def activity_stream(conn, params) do
    limit = parse_limit(Map.get(params, "limit"), 100)
    issue_identifier = Map.get(params, "issue_identifier")

    with :ok <- ObservabilityPubSub.subscribe_activity(),
         {:ok, conn} <- start_activity_stream(conn, limit, issue_identifier) do
      stream_activity(conn, issue_identifier)
    else
      {:error, reason} ->
        error_response(conn, 503, "activity_stream_unavailable", "Activity stream unavailable: #{inspect(reason)}")
    end
  end

  @spec method_not_allowed(Conn.t(), map()) :: Conn.t()
  def method_not_allowed(conn, _params) do
    error_response(conn, 405, "method_not_allowed", "Method not allowed")
  end

  @spec not_found(Conn.t(), map()) :: Conn.t()
  def not_found(conn, _params) do
    error_response(conn, 404, "not_found", "Route not found")
  end

  defp error_response(conn, status, code, message) do
    conn
    |> put_status(status)
    |> json(%{error: %{code: code, message: message}})
  end

  defp orchestrator do
    Endpoint.config(:orchestrator) || SymphonyElixir.Orchestrator
  end

  defp snapshot_timeout_ms do
    Endpoint.config(:snapshot_timeout_ms) || 15_000
  end

  defp parse_limit(nil, default), do: default

  defp parse_limit(raw, default) do
    case Integer.parse(to_string(raw)) do
      {limit, _} when limit > 0 -> min(limit, 500)
      _ -> default
    end
  end

  defp start_activity_stream(conn, limit, issue_identifier) do
    initial = Presenter.activity_payload(orchestrator(), limit, issue_identifier)

    conn =
      conn
      |> put_resp_content_type("text/event-stream")
      |> put_resp_header("cache-control", "no-cache")
      |> put_resp_header("x-accel-buffering", "no")
      |> Conn.send_chunked(200)

    case Conn.chunk(conn, "event: snapshot\ndata: #{Jason.encode!(initial)}\n\n") do
      {:ok, conn} -> {:ok, conn}
      {:error, reason} -> {:error, reason}
    end
  end

  defp stream_activity(conn, issue_identifier) do
    receive do
      {:observability_activity, activity_event} ->
        if is_binary(issue_identifier) and activity_event[:issue_identifier] != issue_identifier do
          stream_activity(conn, issue_identifier)
        else
          payload = Presenter.activity_payload_event(activity_event)

          case Conn.chunk(conn, "event: activity\ndata: #{Jason.encode!(payload)}\n\n") do
            {:ok, conn} -> stream_activity(conn, issue_identifier)
            {:error, _reason} -> conn
          end
        end
    after
      15_000 ->
        case Conn.chunk(conn, ": keep-alive\n\n") do
          {:ok, conn} -> stream_activity(conn, issue_identifier)
          {:error, _reason} -> conn
        end
    end
  end
end
