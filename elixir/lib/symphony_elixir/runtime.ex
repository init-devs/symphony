defmodule SymphonyElixir.Runtime do
  @moduledoc """
  Runtime adapter selection.
  """

  alias SymphonyElixir.Config
  alias SymphonyElixir.Runtime.OpenCode

  @type adapter_module :: module()

  @spec adapter_module() :: adapter_module()
  def adapter_module do
    case Config.runtime_provider() do
      "opencode" -> OpenCode
      _ -> OpenCode
    end
  end
end
