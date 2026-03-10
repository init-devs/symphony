defmodule SymphonyElixir.Runtime.Adapter do
  @moduledoc """
  Behaviour for pluggable agent runtime backends.
  """

  @type session :: map()

  @callback start_session(Path.t()) :: {:ok, session()} | {:error, term()}
  @callback run_turn(session(), String.t(), map(), keyword()) :: {:ok, map()} | {:error, term()}
  @callback stop_session(session()) :: :ok
end
