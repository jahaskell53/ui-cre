"""Tests for the refresh_unit_breakdown_views asset."""
from unittest.mock import MagicMock

from dagster import build_asset_context

from zillow_pipeline.assets.refresh_unit_breakdown_views import refresh_unit_breakdown_views


def make_supabase():
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    return mock, client


class TestRefreshUnitBreakdownViews:
    def test_calls_rpc_and_returns_none(self):
        supabase, client = make_supabase()

        with build_asset_context() as ctx:
            output = refresh_unit_breakdown_views(context=ctx, supabase=supabase)

        client.rpc.assert_called_once_with("refresh_unit_breakdown_views", {})
        client.rpc.return_value.execute.assert_called_once()
        assert output.value is None

    def test_metadata_contains_status_refreshed(self):
        supabase, client = make_supabase()

        with build_asset_context() as ctx:
            output = refresh_unit_breakdown_views(context=ctx, supabase=supabase)

        assert output.metadata["status"].value == "refreshed"

    def test_rpc_exception_propagates(self):
        supabase, client = make_supabase()
        client.rpc.return_value.execute.side_effect = Exception("DB error")

        import pytest
        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="DB error"):
                refresh_unit_breakdown_views(context=ctx, supabase=supabase)
