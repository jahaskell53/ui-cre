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


def test_backfill_partition_scrapes_zillow_and_updates_exclusions():
    client = MagicMock()
    apify = MagicMock()
    apify.run_zillow_property_lookup.return_value = [
        {
            "zpid": "zpid-1",
            "detailUrl": "https://www.zillow.com/homedetails/123-Main/1_zpid/",
            "addressStreet": "123 Main St",
            "addressCity": "Oakland",
            "addressState": "CA",
            "addressZipcode": "94601",
            "homeType": "CONDO",
        }
    ]

    crexi_table = MagicMock()
    xref_table = MagicMock()
    client.table.side_effect = lambda table_name: {
        "crexi_api_comps": crexi_table,
        "crexi_zillow_condo_xrefs": xref_table,
    }[table_name]

    query = crexi_table.update.return_value
    query.gte.return_value = query
    query.lt.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [{"id": 3001}, {"id": 3002}]
    candidate_rpc = MagicMock()
    candidate_rpc.execute.return_value.data = [
        {
            "run_id": "run-1",
            "crexi_comp_id": 3003,
            "crexi_id": "crexi-1",
            "address_street": "123 Main St",
            "city": "Oakland",
            "state": "CA",
            "zip": "94601",
            "query_address": "123 Main St, Oakland, CA, 94601",
        }
    ]
    exclusion_rpc = MagicMock()
    exclusion_rpc.execute.return_value.data = [{"updated_count": 3}]
    client.rpc.side_effect = [candidate_rpc, exclusion_rpc]
    xref_table.upsert.return_value.execute.return_value = MagicMock()

    stats = backfill_crexi_sales_trends_exclusion_partition(client, apify, "000003", batch_size=1000)

    assert stats == {
        "start_id": 3001,
        "end_id": 4000,
        "updated": 5,
        "one_unit_updated": 2,
        "zillow_condo_updated": 3,
        "zillow_scraped": 1,
        "zillow_matched": 1,
    }
    assert client.table.call_args_list == [call("crexi_api_comps"), call("crexi_zillow_condo_xrefs")]
    crexi_table.update.assert_called_once_with({"exclude_from_sales_trends": True})
    assert query.gte.call_args_list == [call("id", 3001)]
    assert query.lt.call_args_list == [call("id", 4001)]
    assert query.eq.call_args_list == [
        call("is_sales_comp", True),
        call("exclude_from_sales_trends", False),
        call("num_units", 1),
    ]
    query.execute.assert_called_once()
    assert client.rpc.call_args_list == [
        call(
            "get_crexi_zillow_condo_scrape_candidates",
            {"p_start_id": 3001, "p_end_id_exclusive": 4001, "p_limit": 1000},
        ),
        call(
            "backfill_crexi_zillow_condo_sales_trends_exclusions",
            {"p_start_id": 3001, "p_end_id_exclusive": 4001},
        ),
    ]
    apify.run_zillow_property_lookup.assert_called_once_with("123 Main St, Oakland, CA, 94601")
    xref_table.upsert.assert_called_once()
    assert xref_table.upsert.call_args.args[0]["is_condo"] is True


def test_partitioned_asset_returns_updated_count_metadata():
    supabase = MagicMock()
    apify = MagicMock()
    client = MagicMock()
    supabase.get_client.return_value = client
    query = client.table.return_value.update.return_value
    query.gte.return_value = query
    query.lt.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [{"id": 1}]
    candidate_rpc = MagicMock()
    candidate_rpc.execute.return_value.data = []
    exclusion_rpc = MagicMock()
    exclusion_rpc.execute.return_value.data = [{"updated_count": 2}]
    client.rpc.side_effect = [candidate_rpc, exclusion_rpc]

    with build_asset_context(partition_key="000000") as context:
        output = crexi_sales_trends_exclusion_backfill(context=context, apify=apify, supabase=supabase)

    assert output.value == 3
    assert output.metadata["partition_key"].value == "000000"
    assert output.metadata["start_id"].value == 1
    assert output.metadata["end_id"].value == 1000
    assert output.metadata["one_unit_updated"].value == 1
    assert output.metadata["zillow_scraped"].value == 0
    assert output.metadata["zillow_matched"].value == 0
    assert output.metadata["zillow_condo_updated"].value == 2
