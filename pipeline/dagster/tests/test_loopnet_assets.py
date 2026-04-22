"""Tests for LoopNet scrape assets."""
from unittest.mock import MagicMock, patch

import pytest
from apify_client.errors import ApifyApiError
from dagster import build_asset_context, Failure

from zillow_pipeline.assets.loopnet_search_scrape import raw_loopnet_search_scrapes, LoopnetSearchScrapeConfig
from zillow_pipeline.assets.loopnet_detail_scrape import raw_loopnet_detail_scrapes, LoopnetDetailScrapeConfig


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_supabase():
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    return mock, client


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


# ─── raw_loopnet_detail_scrapes ──────────────────────────────────────────────

class TestRawLoopnetDetailScrapes:
    def _make_search_rows(self, urls: list[str]):
        return [
            {"raw_json": [{"url": u, "name": f"Listing {i}"} for i, u in enumerate(urls)]}
        ]

    def test_no_search_scrapes_returns_zero(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 0
        apify.run_loopnet_detail.assert_not_called()

    def test_uses_explicit_run_id_from_config(self):
        supabase, client = make_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(["https://www.loopnet.com/Listing/1/"])
        already_mock = MagicMock()
        already_mock.data = []
        # loopnet_listing_details returns empty (no existing details)
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock
        apify.run_loopnet_detail.return_value = [{"address": "123 Main"}]

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="explicit-run-id"),
                apify=apify,
                supabase=supabase,
            )

        assert meta(output, "run_id") == "explicit-run-id"
        client.table.return_value.select.return_value.order.assert_not_called()

    def test_deduplicates_listing_urls(self):
        supabase, client = make_supabase()
        apify = make_apify()

        dup_url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = [
            {"raw_json": [{"url": dup_url}, {"url": dup_url}]},
        ]
        already_mock = MagicMock()
        already_mock.data = []
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock
        apify.run_loopnet_detail.return_value = [{"address": "123 Main"}]

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_called_once_with(dup_url)
        assert meta(output, "listings_found") == 1

    def test_skips_already_scraped_listings(self):
        supabase, client = make_supabase()
        apify = make_apify()

        url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows([url])
        already_mock = MagicMock()
        already_mock.data = [{"listing_url": url}]
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_not_called()
        assert meta(output, "skipped") == 1
        assert meta(output, "inserted") == 0

    def test_skips_listings_already_in_details_table(self):
        """New listings already in loopnet_listing_details are skipped (no Apify call)."""
        supabase, client = make_supabase()
        apify = make_apify()

        url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows([url])
        already_mock = MagicMock()
        already_mock.data = []  # not in raw_loopnet_detail_scrapes
        details_mock = MagicMock()
        details_mock.data = [{"listing_url": url}]  # already in details

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_not_called()
        assert meta(output, "skipped") == 1

    def test_credit_limit_raises_failure_no_retry(self):
        supabase, client = make_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(["https://www.loopnet.com/Listing/1/"])
        already_mock = MagicMock()
        already_mock.data = []
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock
        apify.run_loopnet_detail.side_effect = make_apify_rate_limit_error(status_code=402)

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                raw_loopnet_detail_scrapes(
                    context=ctx,
                    config=LoopnetDetailScrapeConfig(run_id="run-1"),
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_individual_failure_continues_and_raises_at_end(self):
        supabase, client = make_supabase()
        apify = make_apify()

        urls = [
            "https://www.loopnet.com/Listing/1/",
            "https://www.loopnet.com/Listing/2/",
        ]
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows(urls)
        already_mock = MagicMock()
        already_mock.data = []
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock
        apify.run_loopnet_detail.side_effect = [RuntimeError("timeout"), [{"address": "456 Oak"}]]

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="1 detail pages failed"):
                raw_loopnet_detail_scrapes(
                    context=ctx,
                    config=LoopnetDetailScrapeConfig(run_id="run-1"),
                    apify=apify,
                    supabase=supabase,
                )

        assert apify.run_loopnet_detail.call_count == 2

    def test_skips_listings_without_url(self):
        supabase, client = make_supabase()
        apify = make_apify()

        search_rows_mock = MagicMock()
        search_rows_mock.data = [{"raw_json": [{"name": "No URL listing"}]}]
        already_mock = MagicMock()
        already_mock.data = []
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        apify.run_loopnet_detail.assert_not_called()
        assert meta(output, "listings_found") == 0

    def test_sanitizes_null_bytes_before_insert(self):
        supabase, client = make_supabase()
        apify = make_apify()

        url = "https://www.loopnet.com/Listing/1/"
        search_rows_mock = MagicMock()
        search_rows_mock.data = self._make_search_rows([url])
        already_mock = MagicMock()
        already_mock.data = []
        details_mock = MagicMock()
        details_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            search_rows_mock, already_mock
        ]
        client.table.return_value.select.return_value.range.return_value.execute.return_value = details_mock
        apify.run_loopnet_detail.return_value = [
            {
                "title": "A\x00B",
                "nested": {"desc": "Hello\x00World"},
                "arr": ["x\x00y", 1, None],
            }
        ]

        with build_asset_context() as ctx:
            output = raw_loopnet_detail_scrapes(
                context=ctx,
                config=LoopnetDetailScrapeConfig(run_id="run-1"),
                apify=apify,
                supabase=supabase,
            )

        inserted_payload = client.table.return_value.insert.call_args[0][0]
        inserted_raw_json = inserted_payload["raw_json"]
        assert inserted_raw_json[0]["title"] == "AB"
        assert inserted_raw_json[0]["nested"]["desc"] == "HelloWorld"
        assert inserted_raw_json[0]["arr"][0] == "xy"
        assert output.value == 1
