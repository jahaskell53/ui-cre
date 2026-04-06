"""Asset-level tests using mocked Supabase/Apify resources."""
from unittest.mock import MagicMock, patch

import pytest
from apify_client.errors import ApifyApiError
from dagster import build_asset_context, Failure

from zillow_pipeline.assets.zip_codes import ba_zip_codes
from zillow_pipeline.assets.zillow_scrape import raw_zillow_scrapes
from zillow_pipeline.assets.cleaned_listings import cleaned_listings, CleaningConfig
from zillow_pipeline.assets.zillow_building_scrape import raw_building_scrapes, BuildingScrapeConfig
from zillow_pipeline.assets.cleaned_building_units import cleaned_building_units, CleanedBuildingUnitsConfig


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_supabase():
    """Build a mock SupabaseResource whose get_client() returns a fluent mock."""
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    return mock, client


def make_apify():
    return MagicMock()


def meta(output, key):
    """Extract the raw value from a Dagster metadata entry."""
    return output.metadata[key].value


def make_apify_rate_limit_error(status_code: int = 402, error_type: str = "hard_limit", message: str = "Credit limit exceeded"):
    """Construct an ApifyApiError with the given attributes without hitting the real constructor."""
    err = ApifyApiError.__new__(ApifyApiError)
    Exception.__init__(err, message)
    err.status_code = status_code
    err.type = error_type
    err.message = message
    return err


# ─── ba_zip_codes ────────────────────────────────────────────────────────────

class TestBaZipCodes:
    def test_returns_active_zip_codes(self):
        supabase, client = make_supabase()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"zip": "94102"},
            {"zip": "94103"},
            {"zip": "94110"},
        ]
        result = ba_zip_codes(supabase=supabase)
        assert result == ["94102", "94103", "94110"]

    def test_empty_table_returns_empty_list(self):
        supabase, client = make_supabase()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        result = ba_zip_codes(supabase=supabase)
        assert result == []

    def test_queries_active_eq_true(self):
        supabase, client = make_supabase()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        ba_zip_codes(supabase=supabase)
        client.table.return_value.select.return_value.eq.assert_called_with("active", True)


# ─── raw_zillow_scrapes ──────────────────────────────────────────────────────

class TestRawZillowScrapes:
    def test_inserts_all_zip_codes(self):
        supabase, client = make_supabase()
        apify = make_apify()

        # No already-scraped zip codes
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        apify.run_zillow_search.return_value = [{"zpid": "123"}]

        with build_asset_context() as ctx:
            output = raw_zillow_scrapes(
                context=ctx,
                ba_zip_codes=["94102", "94103"],
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 2
        assert meta(output, "inserted") == 2
        assert meta(output, "failed") == 0

    def test_skips_already_scraped_zip_codes(self):
        supabase, client = make_supabase()
        apify = make_apify()

        # "94102" already scraped in a previous attempt
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
            {"zip_code": "94102"}
        ]

        with build_asset_context() as ctx:
            output = raw_zillow_scrapes(
                context=ctx,
                ba_zip_codes=["94102", "94103"],
                apify=apify,
                supabase=supabase,
            )

        # Only 94103 should be scraped
        apify.run_zillow_search.assert_called_once_with("94103")
        assert output.value == 2

    def test_credit_limit_error_raises_failure_no_retry(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        apify.run_zillow_search.side_effect = make_apify_rate_limit_error(status_code=402)

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                raw_zillow_scrapes(
                    context=ctx,
                    ba_zip_codes=["94102"],
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_hard_limit_in_type_also_raises_failure_no_retry(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        # 403 status but hard_limit in type string
        apify.run_zillow_search.side_effect = make_apify_rate_limit_error(status_code=403, error_type="actor_hard_limit_exceeded")

        with build_asset_context() as ctx:
            with pytest.raises(Failure) as exc_info:
                raw_zillow_scrapes(
                    context=ctx,
                    ba_zip_codes=["94102"],
                    apify=apify,
                    supabase=supabase,
                )

        assert exc_info.value.allow_retries is False

    def test_generic_error_records_failure_and_raises(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        apify.run_zillow_search.side_effect = RuntimeError("network timeout")

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="zip codes failed"):
                raw_zillow_scrapes(
                    context=ctx,
                    ba_zip_codes=["94102"],
                    apify=apify,
                    supabase=supabase,
                )

    def test_one_failure_does_not_stop_remaining_zips(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        # First zip fails, second succeeds
        apify.run_zillow_search.side_effect = [RuntimeError("timeout"), [{"zpid": "456"}]]

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="1 zip codes failed"):
                raw_zillow_scrapes(
                    context=ctx,
                    ba_zip_codes=["94102", "94103"],
                    apify=apify,
                    supabase=supabase,
                )

        # Both zips were attempted
        assert apify.run_zillow_search.call_count == 2


# ─── cleaned_listings ────────────────────────────────────────────────────────

class TestCleanedListings:
    def test_no_raw_scrapes_returns_zero(self):
        supabase, client = make_supabase()
        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = cleaned_listings(
                context=ctx,
                config=CleaningConfig(),
                supabase=supabase,
            )

        assert output.value == 0

    def test_uses_explicit_run_id_from_config(self):
        supabase, client = make_supabase()

        # With run_id set, skips the "latest run" query; eq().execute() returns empty rows
        client.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = cleaned_listings(
                context=ctx,
                config=CleaningConfig(run_id="run-abc-123"),
                supabase=supabase,
            )

        assert output.value == 0
        # Should NOT have called the "latest run" order query
        client.table.return_value.select.return_value.order.assert_not_called()

    def test_limit_config_caps_listings_processed(self):
        supabase, client = make_supabase()

        latest_mock = MagicMock()
        latest_mock.data = [{"run_id": "run-1", "scraped_at": "2024-01-01T00:00:00Z"}]

        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [
            {
                "id": "row-1",
                "zip_code": "94102",
                "scraped_at": "2024-01-01T00:00:00Z",
                "raw_json": [{"zpid": str(i), "address": "123 Main St"} for i in range(10)],
            }
        ]

        order_chain = MagicMock()
        order_chain.limit.return_value.execute.return_value = latest_mock
        eq_chain = MagicMock()
        eq_chain.execute.return_value = raw_rows_mock
        select_mock = MagicMock()
        select_mock.order.return_value = order_chain
        select_mock.eq.return_value = eq_chain

        client.table.return_value.select.return_value = select_mock
        client.rpc.return_value.execute.return_value = MagicMock()

        with patch("zillow_pipeline.assets.cleaned_listings.normalize_address",
                   return_value={"house_number": "123", "road": "Main St", "city": "SF", "state": "CA"}):
            with build_asset_context() as ctx:
                output = cleaned_listings(
                    context=ctx,
                    config=CleaningConfig(limit=3),
                    supabase=supabase,
                )

        assert meta(output, "total_processed") == 3

    def test_individual_listing_failure_does_not_abort_run(self):
        supabase, client = make_supabase()

        latest_mock = MagicMock()
        latest_mock.data = [{"run_id": "run-1", "scraped_at": "2024-01-01T00:00:00Z"}]

        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [
            {
                "id": "row-1",
                "zip_code": "94102",
                "scraped_at": "2024-01-01T00:00:00Z",
                "raw_json": [{"zpid": "1", "address": "123 Main St"}, {"zpid": "2", "address": "456 Oak Ave"}],
            }
        ]

        order_chain = MagicMock()
        order_chain.limit.return_value.execute.return_value = latest_mock
        eq_chain = MagicMock()
        eq_chain.execute.return_value = raw_rows_mock
        select_mock = MagicMock()
        select_mock.order.return_value = order_chain
        select_mock.eq.return_value = eq_chain
        client.table.return_value.select.return_value = select_mock

        # First RPC call fails, second succeeds
        client.rpc.return_value.execute.side_effect = [RuntimeError("DB error"), MagicMock()]

        with patch("zillow_pipeline.assets.cleaned_listings.normalize_address",
                   return_value={"house_number": "123", "road": "Main St"}):
            with build_asset_context() as ctx:
                output = cleaned_listings(
                    context=ctx,
                    config=CleaningConfig(),
                    supabase=supabase,
                )

        assert meta(output, "inserted") == 1
        assert meta(output, "failed") == 1


# ─── raw_building_scrapes ────────────────────────────────────────────────────

class TestRawBuildingScrapes:
    def test_deduplicates_buildings_by_detail_url(self):
        supabase, client = make_supabase()
        apify = make_apify()

        # Latest run_id query (order → limit path)
        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {"run_id": "run-1"}
        ]

        duplicate_building = {"isBuilding": True, "zpid": "B1", "detailUrl": "https://zillow.com/b/1"}
        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [
            {"raw_json": [duplicate_building]},
            {"raw_json": [duplicate_building]},  # same detailUrl
        ]
        already_mock = MagicMock()
        already_mock.data = []

        # Both eq().execute() calls go through the same chain (consecutive calls)
        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            raw_rows_mock, already_mock
        ]
        apify.run_zillow_detail.return_value = [{"unit": "A"}]

        with build_asset_context() as ctx:
            output = raw_building_scrapes(
                context=ctx,
                config=BuildingScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        apify.run_zillow_detail.assert_called_once()
        assert meta(output, "buildings_found") == 1

    def test_skips_non_buildings(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {"run_id": "run-1"}
        ]

        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [{"raw_json": [{"isBuilding": False, "zpid": "L1", "detailUrl": "https://zillow.com/l/1"}]}]
        already_mock = MagicMock()
        already_mock.data = []

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            raw_rows_mock, already_mock
        ]

        with build_asset_context() as ctx:
            output = raw_building_scrapes(
                context=ctx,
                config=BuildingScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        apify.run_zillow_detail.assert_not_called()
        assert meta(output, "buildings_found") == 0

    def test_no_raw_scrapes_returns_zero(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = raw_building_scrapes(
                context=ctx,
                config=BuildingScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        assert output.value == 0
        apify.run_zillow_detail.assert_not_called()

    def test_skips_already_scraped_buildings(self):
        supabase, client = make_supabase()
        apify = make_apify()

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = [
            {"run_id": "run-1"}
        ]

        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [
            {"raw_json": [{"isBuilding": True, "zpid": "B1", "detailUrl": "https://zillow.com/b/1"}]}
        ]
        already_mock = MagicMock()
        already_mock.data = [{"detail_url": "https://zillow.com/b/1"}]

        client.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
            raw_rows_mock, already_mock
        ]

        with build_asset_context() as ctx:
            output = raw_building_scrapes(
                context=ctx,
                config=BuildingScrapeConfig(),
                apify=apify,
                supabase=supabase,
            )

        apify.run_zillow_detail.assert_not_called()
        assert meta(output, "skipped") == 1
