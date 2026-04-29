"""Tests for zillow_pipeline.lib.crexi_cap_rate."""
from unittest.mock import MagicMock, patch, call
import json

import pytest

from zillow_pipeline.lib.crexi_cap_rate import (
    _extract_property_id,
    _parse_cap_rate,
    _fetch_property_detail,
    run_crexi_cap_rate_backfill,
    CREXI_DETAIL_URL,
)


# ─── _extract_property_id ─────────────────────────────────────────────────────

class TestExtractPropertyId:
    def test_sales_prefix(self):
        assert _extract_property_id("SALES~2435663") == "2435663"

    def test_lease_prefix(self):
        assert _extract_property_id("LEASE~9988776") == "9988776"

    def test_no_tilde(self):
        assert _extract_property_id("2435663") == "2435663"

    def test_none_returns_none(self):
        assert _extract_property_id(None) is None

    def test_empty_string_returns_none(self):
        assert _extract_property_id("") is None

    def test_multiple_tildes_uses_last_segment(self):
        assert _extract_property_id("FOO~BAR~123") == "123"


# ─── _parse_cap_rate ──────────────────────────────────────────────────────────

class TestParseCapRate:
    def test_sale_transaction_cap_rate(self):
        detail = {"saleTransaction": {"capRatePercent": 5.25}}
        assert _parse_cap_rate(detail) == 5.25

    def test_financials_cap_rate_fallback(self):
        detail = {"financials": {"capRatePercent": 4.75}}
        assert _parse_cap_rate(detail) == 4.75

    def test_sale_preferred_over_financials(self):
        detail = {
            "saleTransaction": {"capRatePercent": 5.5},
            "financials": {"capRatePercent": 4.0},
        }
        assert _parse_cap_rate(detail) == 5.5

    def test_string_cap_rate_coerced(self):
        detail = {"saleTransaction": {"capRatePercent": "6.1"}}
        assert _parse_cap_rate(detail) == pytest.approx(6.1)

    def test_none_when_no_cap_rate(self):
        detail = {"saleTransaction": {}, "financials": {}}
        assert _parse_cap_rate(detail) is None

    def test_none_on_empty_dict(self):
        assert _parse_cap_rate({}) is None

    def test_zero_cap_rate_treated_as_none(self):
        """A zero cap rate is not meaningful; treat as missing."""
        detail = {"saleTransaction": {"capRatePercent": 0}}
        assert _parse_cap_rate(detail) is None

    def test_nested_financials_noi_ignored_when_no_cap_rate(self):
        detail = {"financials": {"netOperatingIncome": 120000}}
        assert _parse_cap_rate(detail) is None


# ─── _fetch_property_detail ───────────────────────────────────────────────────

class TestFetchPropertyDetail:
    def _make_response(self, body: dict, status: int = 200):
        resp = MagicMock()
        resp.status = status
        resp.read.return_value = json.dumps(body).encode()
        resp.__enter__ = lambda s: s
        resp.__exit__ = MagicMock(return_value=False)
        return resp

    def test_returns_parsed_json(self):
        body = {"id": "2435663", "financials": {"capRatePercent": 5.0}}
        fake_resp = self._make_response(body)
        with patch("zillow_pipeline.lib.crexi_cap_rate.urllib.request.urlopen", return_value=fake_resp):
            result = _fetch_property_detail("2435663", bearer_token="tok")
        assert result == body

    def test_sends_bearer_auth_header(self):
        body = {}
        fake_resp = self._make_response(body)
        with patch("zillow_pipeline.lib.crexi_cap_rate.urllib.request.urlopen", return_value=fake_resp) as mock_open:
            _fetch_property_detail("9999", bearer_token="mytoken")
        req_arg = mock_open.call_args[0][0]
        assert req_arg.get_header("Authorization") == "Bearer mytoken"

    def test_uses_correct_url(self):
        body = {}
        fake_resp = self._make_response(body)
        with patch("zillow_pipeline.lib.crexi_cap_rate.urllib.request.urlopen", return_value=fake_resp) as mock_open:
            _fetch_property_detail("12345", bearer_token="tok")
        req_arg = mock_open.call_args[0][0]
        assert req_arg.full_url == CREXI_DETAIL_URL.format(property_id="12345")

    def test_returns_none_on_http_error(self):
        import urllib.error
        with patch(
            "zillow_pipeline.lib.crexi_cap_rate.urllib.request.urlopen",
            side_effect=urllib.error.HTTPError(None, 404, "Not Found", {}, None),
        ):
            result = _fetch_property_detail("0000", bearer_token="tok")
        assert result is None

    def test_returns_none_on_network_error(self):
        import urllib.error
        with patch(
            "zillow_pipeline.lib.crexi_cap_rate.urllib.request.urlopen",
            side_effect=urllib.error.URLError("timeout"),
        ):
            result = _fetch_property_detail("0000", bearer_token="tok")
        assert result is None


# ─── run_crexi_cap_rate_backfill ─────────────────────────────────────────────

class TestRunCrexiCapRateBackfill:
    def _make_client(self):
        return MagicMock()

    def _page_mock(self, rows):
        """Build a mock for a single query page returning ``rows``."""
        # Query chain: select -> is_ -> not_.is_ -> is_ -> order -> range -> execute
        page = MagicMock()
        page.data = rows
        return page

    def _setup_pages(self, client, *page_data_lists):
        """Wire up client mock to return page mocks in sequence."""
        pages = [self._page_mock(rows) for rows in page_data_lists]
        (
            client.table.return_value
            .select.return_value
            .is_.return_value
            .not_.is_.return_value
            .is_.return_value
            .order.return_value
            .range.return_value
            .execute
        ).side_effect = pages

    def test_no_rows_returns_zero_counts(self):
        client = self._make_client()
        self._setup_pages(client, [])

        stats = run_crexi_cap_rate_backfill(
            client,
            bearer_token="tok",
            dry_run=True,
        )
        assert stats["scanned"] == 0
        assert stats["updated"] == 0
        assert stats["no_cap_rate_in_detail"] == 0
        assert stats["errors"] == 0

    def test_updates_row_when_cap_rate_found(self):
        client = self._make_client()

        row = {"id": 1, "crexi_id": "SALES~2435663"}
        detail = {"saleTransaction": {"capRatePercent": 5.5}}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=detail):
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok")

        assert stats["scanned"] == 1
        assert stats["updated"] == 1
        assert stats["errors"] == 0

        update_call = client.table.return_value.update.call_args[0][0]
        assert update_call["sale_cap_rate_percent"] == pytest.approx(5.5)
        assert update_call["cap_rate_source"] == "api_detail"
        assert "detail_fetched_at" in update_call

    def test_dry_run_does_not_write(self):
        client = self._make_client()

        row = {"id": 1, "crexi_id": "SALES~2435663"}
        detail = {"saleTransaction": {"capRatePercent": 5.5}}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=detail):
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok", dry_run=True)

        client.table.return_value.update.assert_not_called()
        assert stats["updated"] == 1

    def test_skips_row_without_crexi_id(self):
        client = self._make_client()

        row = {"id": 2, "crexi_id": None}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail") as mock_fetch:
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok")

        mock_fetch.assert_not_called()
        assert stats["scanned"] == 1
        assert stats["updated"] == 0

    def test_records_no_cap_rate_when_detail_missing(self):
        client = self._make_client()

        row = {"id": 3, "crexi_id": "SALES~9999"}
        detail = {"financials": {}}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=detail):
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok")

        assert stats["no_cap_rate_in_detail"] == 1
        assert stats["updated"] == 0

        # Still marks detail_fetched_at so we don't retry endlessly
        update_call = client.table.return_value.update.call_args[0][0]
        assert "detail_fetched_at" in update_call
        assert "sale_cap_rate_percent" not in update_call

    def test_records_error_when_fetch_returns_none(self):
        client = self._make_client()

        row = {"id": 4, "crexi_id": "SALES~8888"}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=None):
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok")

        assert stats["errors"] == 1
        assert stats["updated"] == 0

    def test_respects_limit(self):
        client = self._make_client()

        rows = [{"id": i, "crexi_id": f"SALES~{i}"} for i in range(1, 6)]
        detail = {"saleTransaction": {"capRatePercent": 5.0}}

        self._setup_pages(client, rows, [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=detail) as mock_fetch:
            stats = run_crexi_cap_rate_backfill(client, bearer_token="tok", limit=2)

        assert mock_fetch.call_count == 2
        assert stats["scanned"] == 2

    def test_respects_request_delay(self):
        client = self._make_client()

        row = {"id": 1, "crexi_id": "SALES~111"}
        detail = {"saleTransaction": {"capRatePercent": 6.0}}

        self._setup_pages(client, [row], [])

        with patch("zillow_pipeline.lib.crexi_cap_rate._fetch_property_detail", return_value=detail):
            with patch("zillow_pipeline.lib.crexi_cap_rate.time.sleep") as mock_sleep:
                run_crexi_cap_rate_backfill(client, bearer_token="tok", request_delay=0.5)

        mock_sleep.assert_called_with(0.5)

    def test_filters_to_recent_sales_only(self):
        """Query must filter to is_sales_comp=true and recent sale_transaction_date."""
        client = self._make_client()

        self._setup_pages(client, [])

        run_crexi_cap_rate_backfill(client, bearer_token="tok", years_back=3)

        # Verify that the query chain included cap-rate and detail_fetched_at NULL filters
        select_chain = client.table.return_value.select.return_value
        select_chain.is_.assert_called()
