from unittest.mock import patch

from zillow_pipeline.resources.supabase import (
    _POSTGREST_CLIENT_TIMEOUT_SEC,
    SupabaseResource,
)


@patch("zillow_pipeline.resources.supabase.create_client")
def test_supabase_resource_uses_long_postgrest_timeout(mock_create_client) -> None:
    SupabaseResource(url="https://x.supabase.co", service_key="k").get_client()
    mock_create_client.assert_called_once()
    opts = mock_create_client.call_args.kwargs["options"]
    assert opts.postgrest_client_timeout == _POSTGREST_CLIENT_TIMEOUT_SEC
