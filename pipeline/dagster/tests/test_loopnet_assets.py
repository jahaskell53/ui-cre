"""Tests for LoopNet scrape assets."""
from unittest.mock import MagicMock

import pytest
from apify_client.errors import ApifyApiError
from dagster import build_asset_context, Failure

from zillow_pipeline.assets.loopnet_search_scrape import raw_loopnet_search_scrapes, LoopnetSearchScrapeConfig
from zillow_pipeline.assets.loopnet_detail_scrape import loopnet_listing_details, LoopnetListingDetailsConfig


# ─── Helpers ─────────────────────────────────────────────────────────────────


def make_supabase():
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    return mock, client


def make_routed_supabase():
    """Return supabase mock, client, and dict of table_name -> table mock."""
    mock, client = make_supabase()
    tables: dict[str, MagicMock] = {}

    def table(name: str):
        if name not in tables:
            tables[name] = MagicMock()
        return tables[name]

    client.table.side_effect = table
    for _t in ("raw_loopnet_search_scrapes", "loopnet_listing_details", "loopnet_listings"):
        table(_t)
    return mock, client, tables


def make_apify():
    return MagicMock()


def meta(output, key):
    return output.metadata[key].value


def make_apify_rate_limit_error(status_code: int = 402, error_type: str = "hard_limit", message: str = "Credit limit exceeded"):
    err = ApifyApiError.__new__(ApifyApiError)
    Exception.__init__(err, message)
    err.status_code = status_code
    err.type = error_type
    err.message = message
    return err


# ─── raw_loopnet_search_scrapes ──────────────────────────────────────────────


class TestRawLoopnetSearchScrapes:
    def test_inserts_results_and_returns_count(self):
        supabase, client = make_supabase()
        apify = make_apify()
        apify.run_loopnet_search.return_value = [
            {"url": "https://www.loopnet.com/Listing/1/", "name": "123 Main St"},
            {"url": "https://www.loopnet.com/Listing/2/", "name": "456 Oak Ave"},
        ]
        # No existing row for this run_id
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = raw_loopnet_search_scrapes(
                context=ctx,
                config=LoopnetSearchScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 2
        assert meta(output, "listings_found") == 2
        client.table.return_value.insert.assert_called_once()

    def test_empty_results_inserts_empty_list(self):
        supabase, client = make_supabase()
        apify = make_apify()
        apify.run_loopnet_search.return_value = []
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = raw_loopnet_search_scrapes(
                context=ctx,
                config=LoopnetSearchScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 0
        assert meta(output, "listings_found") == 0

    def test_skips_apify_call_when_already_scraped_for_run_id(self):
        supabase, client = make_supabase()
        apify = make_apify()

        existing_id_mock = MagicMock()
        existing_id_mock.data = [{"id": "row-1"}]
        existing_json_mock = MagicMock()
        existing_json_mock.data = [
            {"raw_json": [{"url": "https://www.loopnet.com/Listing/1/"}, {"url": "https://www.loopnet.com/Listing/2/"}]}
        ]
        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            existing_id_mock,
            existing_json_mock,
        ]

        with build_asset_context() as ctx:
            output = raw_loopnet_search_scrapes(
                context=ctx,
                config=LoopnetSearchScrapeConfig(run_id="old-run-id"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_search.assert_not_called()
        assert output.value == 2
        assert meta(output, "run_id") == "old-run-id"

    def test_credit_limit_raises_failure_no_retry(self):
        supabase, client = make_supabase()
        apify = make_apify()
        apify.run_loopnet_search.side_effect = make_apify_rate_limit_error(status_code=402)
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                raw_loopnet_search_scrapes(
                    context=ctx,
                    config=LoopnetSearchScrapeConfig(),
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_hard_limit_in_type_also_raises_failure_no_retry(self):
        supabase, client = make_supabase()
        apify = make_apify()
        apify.run_loopnet_search.side_effect = make_apify_rate_limit_error(
            status_code=403, error_type="actor_hard_limit_exceeded"
        )
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                raw_loopnet_search_scrapes(
                    context=ctx,
                    config=LoopnetSearchScrapeConfig(),
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_generic_apify_error_propagates(self):
        supabase, client = make_supabase()
        apify = make_apify()
        apify.run_loopnet_search.side_effect = RuntimeError("network timeout")
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            with pytest.raises(RuntimeError, match="network timeout"):
                raw_loopnet_search_scrapes(
                    context=ctx,
                    config=LoopnetSearchScrapeConfig(),
                    apify=apify,
                    supabase=supabase,
                )


# ─── loopnet_listing_details ───────────────────────────────────────────────────


class TestLoopnetListingDetails:
    def _make_search_rows(self, urls: list[str]):
        return [
            {"raw_json": [{"url": u, "name": f"Listing {i}"} for i, u in enumerate(urls)]}
        ]

    def test_no_search_scrapes_returns_zero(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        tables["raw_loopnet_search_scrapes"].select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(),
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 0
        apify.run_loopnet_detail.assert_not_called()

    def test_uses_explicit_run_id_from_config(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(["https://www.loopnet.com/Listing/1/"])
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        apify.run_loopnet_detail.return_value = [{"address": "123 Main"}]

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(run_id="explicit-run-id"),
                apify=apify,
                supabase=supabase,
            )

        assert meta(output, "search_run_id") == "explicit-run-id"
        tables["raw_loopnet_search_scrapes"].select.return_value.order.assert_not_called()

    def test_deduplicates_listing_urls(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        dup_url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = [
            {"raw_json": [{"url": dup_url}, {"url": dup_url}]},
        ]
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        apify.run_loopnet_detail.return_value = [{"address": "123 Main"}]

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_called_once_with(dup_url)
        assert meta(output, "listings_found") == 1

    def test_skips_apify_when_row_exists_in_loopnet_listing_details(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows([url])
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"listing_url": url}]
        )

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_not_called()
        assert meta(output, "skipped_existing_detail") == 1
        assert meta(output, "apify_calls") == 0

    def test_credit_limit_raises_failure_no_retry(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(["https://www.loopnet.com/Listing/1/"])
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        apify.run_loopnet_detail.side_effect = make_apify_rate_limit_error(status_code=402)

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                loopnet_listing_details(
                    context=ctx,
                    config=LoopnetListingDetailsConfig(run_id="run-1"),
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_individual_failure_continues_and_raises_at_end(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        urls = [
            "https://www.loopnet.com/Listing/1/",
            "https://www.loopnet.com/Listing/2/",
        ]
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(urls)
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        apify.run_loopnet_detail.side_effect = [RuntimeError("timeout"), [{"address": "456 Oak"}]]

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="1 detail pages failed"):
                loopnet_listing_details(
                    context=ctx,
                    config=LoopnetListingDetailsConfig(run_id="run-1"),
                    apify=apify,
                    supabase=supabase,
                )

        assert apify.run_loopnet_detail.call_count == 2

    def test_skips_listings_without_url(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = [{"raw_json": [{"name": "No URL listing"}]}]
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_not_called()
        assert meta(output, "listings_found") == 0

    def test_sanitizes_null_bytes_before_upsert(self):
        supabase, client, tables = make_routed_supabase()
        apify = make_apify()

        url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows([url])
        tables["raw_loopnet_search_scrapes"].select.return_value.eq.return_value.execute.return_value = search_rows_mock
        tables["loopnet_listing_details"].select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        apify.run_loopnet_detail.return_value = [
            {
                "title": "A\x00B",
                "nested": {"desc": "Hello\x00World"},
                "arr": ["x\x00y", 1, None],
            }
        ]

        with build_asset_context() as ctx:
            output = loopnet_listing_details(
                context=ctx,
                config=LoopnetListingDetailsConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        upsert_payload = tables["loopnet_listing_details"].upsert.call_args[0][0]
        upsert_raw_json = upsert_payload["raw_json"]
        assert upsert_raw_json[0]["title"] == "AB"
        assert upsert_raw_json[0]["nested"]["desc"] == "HelloWorld"
        assert upsert_raw_json[0]["arr"][0] == "xy"
        assert output.value == 1
