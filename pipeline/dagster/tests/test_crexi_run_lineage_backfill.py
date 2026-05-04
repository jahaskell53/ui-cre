"""Unit tests for crexi_run_lineage_backfill (OPE-237 / OPE-240)."""

from __future__ import annotations

from unittest.mock import MagicMock, call

import pytest

from zillow_pipeline.lib.crexi_run_lineage_backfill import run_crexi_lineage_backfill


def test_run_crexi_lineage_backfill_uses_rpc_keyset_and_upserts():
    client = MagicMock()

    def rpc_side_effect(name, payload):
        m = MagicMock()
        if name == "fetch_crexi_raw_lineage_backfill_page":
            m.execute.return_value.data = [
                {"crexi_id": "a", "updated_at": "2026-01-01T00:00:00Z"},
                {"crexi_id": "b", "updated_at": "2026-01-02T00:00:00Z"},
            ]
        elif name == "fetch_crexi_detail_lineage_backfill_page":
            m.execute.return_value.data = []
        else:
            pytest.fail(f"unexpected rpc {name}")
        return m

    client.rpc.side_effect = rpc_side_effect

    tables: dict[str, MagicMock] = {}

    def table_side_effect(name: str):
        if name not in tables:
            t = MagicMock()
            if name == "crexi_scrape_runs":
                t.insert.return_value.execute.return_value.data = [{"run_id": 42}]
            elif name == "crexi_api_comp_raw_json":
                t.upsert.return_value.execute.return_value = MagicMock()
            tables[name] = t
        return tables[name]

    client.table.side_effect = table_side_effect

    stats = run_crexi_lineage_backfill(client, dry_run=False, page_size=500)

    assert stats == {"raw_updated": 2, "detail_updated": 0, "errors": 0}

    assert client.rpc.call_args_list[0] == call(
        "fetch_crexi_raw_lineage_backfill_page",
        {"p_after_crexi_id": None, "p_limit": 500},
    )
    assert client.rpc.call_args_list[1] == call(
        "fetch_crexi_detail_lineage_backfill_page",
        {"p_after_crexi_id": None, "p_limit": 500},
    )

    tables["crexi_api_comp_raw_json"].upsert.assert_called_once()


def test_run_crexi_lineage_backfill_keyset_advances_after_full_page():
    client = MagicMock()

    raw_calls: list[dict] = []

    def rpc_side_effect(name, payload):
        m = MagicMock()
        if name == "fetch_crexi_raw_lineage_backfill_page":
            raw_calls.append(dict(payload))
            after = payload["p_after_crexi_id"]
            if after is None:
                m.execute.return_value.data = [{"crexi_id": "a", "updated_at": "t1"}]
            elif after == "a":
                m.execute.return_value.data = [{"crexi_id": "b", "updated_at": "t2"}]
            else:
                m.execute.return_value.data = []
        elif name == "fetch_crexi_detail_lineage_backfill_page":
            m.execute.return_value.data = []
        else:
            pytest.fail(f"unexpected rpc {name}")
        return m

    client.rpc.side_effect = rpc_side_effect

    tables: dict[str, MagicMock] = {}

    def table_side_effect(name: str):
        if name not in tables:
            t = MagicMock()
            if name == "crexi_scrape_runs":
                t.insert.return_value.execute.return_value.data = [{"run_id": 1}]
            elif name == "crexi_api_comp_raw_json":
                t.upsert.return_value.execute.return_value = MagicMock()
            tables[name] = t
        return tables[name]

    client.table.side_effect = table_side_effect

    stats = run_crexi_lineage_backfill(client, dry_run=False, page_size=1)

    assert stats["raw_updated"] == 2
    assert raw_calls[0]["p_after_crexi_id"] is None
    assert raw_calls[1]["p_after_crexi_id"] == "a"
    assert raw_calls[2]["p_after_crexi_id"] == "b"
