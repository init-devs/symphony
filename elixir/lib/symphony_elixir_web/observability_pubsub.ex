defmodule SymphonyElixirWeb.ObservabilityPubSub do
  @moduledoc """
  PubSub helpers for observability dashboard updates.
  """

  @pubsub SymphonyElixir.PubSub
  @dashboard_topic "observability:dashboard"
  @activity_topic "observability:activity"
  @update_message :observability_updated

  @spec subscribe() :: :ok | {:error, term()}
  def subscribe do
    Phoenix.PubSub.subscribe(@pubsub, @dashboard_topic)
  end

  @spec subscribe_activity() :: :ok | {:error, term()}
  def subscribe_activity do
    Phoenix.PubSub.subscribe(@pubsub, @activity_topic)
  end

  @spec broadcast_update() :: :ok
  def broadcast_update do
    case Process.whereis(@pubsub) do
      pid when is_pid(pid) ->
        Phoenix.PubSub.broadcast(@pubsub, @dashboard_topic, @update_message)

      _ ->
        :ok
    end
  end

  @spec broadcast_activity(map()) :: :ok
  def broadcast_activity(%{} = activity_event) do
    case Process.whereis(@pubsub) do
      pid when is_pid(pid) ->
        Phoenix.PubSub.broadcast(@pubsub, @activity_topic, {:observability_activity, activity_event})

      _ ->
        :ok
    end
  end

  def broadcast_activity(_activity_event), do: :ok
end
