"""Tests for the Crexi sales-trends exclusion partitioned backfill."""

from __future__ import annotations

from unittest.mock import MagicMock, call

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.crexi_sales_trends_exclusion_backfill import crexi_sales_trends_exclusion_backfill
from zillow_pipeline.lib.crexi_sales_trends_exclusion_backfill import (
    backfill_crexi_sales_trends_exclusion_partition,
    partition_key_to_id_range,
)


def test_partition_key_to_id_range_uses_zero_based_batches():
    assert partition_key_to_id_range("000003", batch_size=1000) == (3001, 4001)


def test_partition_key_to_id_range_rejects_invalid_key():
    with pytest.raises(ValueError, match="Invalid partition key"):
        partition_key_to_id_range("batch-1")


def test_backfill_partition_updates_only_one_unit_included_rows():
    client = MagicMock()
    query = client.table.return_value.update.return_value
    query.gte.return_value = query
    query.lt.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [{"id": 3001}, {"id": 3002}]

    stats = backfill_crexi_sales_trends_exclusion_partition(client, "000003", batch_size=1000)

    assert stats == {"start_id": 3001, "end_id": 4000, "updated": 2}
    client.table.assert_called_once_with("crexi_api_comps")
    client.table.return_value.update.assert_called_once_with({"exclude_from_sales_trends": True})
    assert query.gte.call_args_list == [call("id", 3001)]
    assert query.lt.call_args_list == [call("id", 4001)]
    assert query.eq.call_args_list == [
        call("is_sales_comp", True),
        call("exclude_from_sales_trends", False),
        call("num_units", 1),
    ]
    query.execute.assert_called_once()


def test_partitioned_asset_returns_updated_count_metadata():
    supabase = MagicMock()
    client = MagicMock()
    supabase.get_client.return_value = client
    query = client.table.return_value.update.return_value
    query.gte.return_value = query
    query.lt.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [{"id": 1}]

    with build_asset_context(partition_key="000000") as context:
        output = crexi_sales_trends_exclusion_backfill(context=context, supabase=supabase)

    assert output.value == 1
    assert output.metadata["partition_key"].value == "000000"
    assert output.metadata["start_id"].value == 1
    assert output.metadata["end_id"].value == 1000
