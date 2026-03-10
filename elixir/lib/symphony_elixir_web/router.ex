defmodule SymphonyElixirWeb.Router do
  @moduledoc """
  Router for Symphony's observability API.
  """

  use Phoenix.Router

  scope "/", SymphonyElixirWeb do
    get("/api/v1/state", ObservabilityApiController, :state)
    get("/api/v1/issues", ObservabilityApiController, :issues)
    get("/api/v1/activity", ObservabilityApiController, :activity)
    get("/api/v1/activity/stream", ObservabilityApiController, :activity_stream)
    get("/api/v1/config", ObservabilityApiController, :config)
    get("/api/v1/openapi.yaml", ObservabilityApiController, :openapi)
    post("/api/v1/refresh", ObservabilityApiController, :refresh)

    match(:*, "/api/v1/state", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/issues", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/activity", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/activity/stream", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/config", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/openapi.yaml", ObservabilityApiController, :method_not_allowed)
    match(:*, "/api/v1/refresh", ObservabilityApiController, :method_not_allowed)

    get("/api/v1/:issue_identifier", ObservabilityApiController, :issue)
    match(:*, "/api/v1/:issue_identifier", ObservabilityApiController, :method_not_allowed)
    match(:*, "/*path", ObservabilityApiController, :not_found)
  end
end
