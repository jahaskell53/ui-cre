"""Tests for zillow_pipeline.lib.loopnet_geom."""
from unittest.mock import MagicMock, patch

import pytest

from zillow_pipeline.lib.loopnet_geom import (
    _geocode,
    _geom_wkt,
    run_loopnet_geom_backfill,
)
from zillow_pipeline.assets.cleaned_loopnet_listings import _make_geom as asset_make_geom


# ─── _geom_wkt ────────────────────────────────────────────────────────────────

class TestGeomWkt:
    def test_format(self):
        assert _geom_wkt(-122.416294, 37.772812) == "POINT(-122.416294 37.772812)"

    def test_positive_lng(self):
        assert _geom_wkt(10.5, 48.3) == "POINT(10.5 48.3)"


# ─── _make_geom (from cleaned_loopnet_listings asset) ────────────────────────

class TestAssetMakeGeom:
    def test_valid_coords(self):
        result = asset_make_geom(-122.416294, 37.772812)
        assert result == "POINT(-122.416294 37.772812)"

    def test_none_lng(self):
        assert asset_make_geom(None, 37.77) is None

    def test_none_lat(self):
        assert asset_make_geom(-122.4, None) is None

    def test_both_none(self):
        assert asset_make_geom(None, None) is None

    def test_string_coords(self):
        result = asset_make_geom("-122.416294", "37.772812")
        assert result == "POINT(-122.416294 37.772812)"

    def test_invalid_value(self):
        assert asset_make_geom("not-a-number", 37.77) is None


# ─── _geocode ─────────────────────────────────────────────────────────────────

class TestGeocode:
    def test_returns_lat_lng_on_success(self):
        fake_response = MagicMock()
        fake_response.read.return_value = b'{"features": [{"center": [-122.416, 37.772]}]}'
        fake_response.__enter__ = lambda s: s
        fake_response.__exit__ = MagicMock(return_value=False)

        with patch("zillow_pipeline.lib.loopnet_geom.urllib.request.urlopen", return_value=fake_response):
            lat, lng = _geocode("1532 Howard St, San Francisco, CA 94103")

        assert lat == pytest.approx(37.772)
        assert lng == pytest.approx(-122.416)

    def test_returns_none_on_empty_features(self):
        fake_response = MagicMock()
        fake_response.read.return_value = b'{"features": []}'
        fake_response.__enter__ = lambda s: s
        fake_response.__exit__ = MagicMock(return_value=False)

        with patch("zillow_pipeline.lib.loopnet_geom.urllib.request.urlopen", return_value=fake_response):
            lat, lng = _geocode("Unknown Address")

        assert lat is None
        assert lng is None

    def test_returns_none_on_network_error(self):
        with patch("zillow_pipeline.lib.loopnet_geom.urllib.request.urlopen", side_effect=OSError("timeout")):
            lat, lng = _geocode("Some address")
        assert lat is None
        assert lng is None

    def test_empty_address_returns_none(self):
        lat, lng = _geocode("")
        assert lat is None
        assert lng is None

    def test_none_address_returns_none(self):
        lat, lng = _geocode(None)
        assert lat is None
        assert lng is None


# ─── run_loopnet_geom_backfill ────────────────────────────────────────────────

def _make_client():
    client = MagicMock()
    # Default: empty pages for both passes
    client.table.return_value.select.return_value \
        .is_.return_value \
        .not_.return_value.is_.return_value \
        .not_.return_value.is_.return_value \
        .order.return_value.eq.return_value \
        .range.return_value.execute.return_value.data = []
    return client


class TestRunLoopnetGeomBackfill:
    def test_pass1_updates_geom_from_coords(self):
        client = MagicMock()

        pass1_rows = [{"id": "uuid-1", "latitude": 37.772812, "longitude": -122.416294}]
        pass1_mock = MagicMock()
        pass1_mock.data = pass1_rows

        pass2_mock = MagicMock()
        pass2_mock.data = []

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            # Pass 1 query chain: is_("geom","null").not_.is_("latitude","null") ...
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value = pass1_mock
            # Pass 2 query chain: is_("geom","null").is_("latitude","null") ...
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value = pass2_mock
            # update chain
            tbl.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            return tbl

        client.table.side_effect = _table_side_effect

        stats = run_loopnet_geom_backfill(client, dry_run=False)

        assert stats["updated_from_coords"] == 1
        assert stats["errors"] == 0

    def test_pass1_dry_run_does_not_update(self):
        client = MagicMock()
        pass1_rows = [{"id": "uuid-1", "latitude": 37.772812, "longitude": -122.416294}]

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value.data = pass1_rows
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value.data = []
            return tbl

        client.table.side_effect = _table_side_effect

        stats = run_loopnet_geom_backfill(client, dry_run=True)

        assert stats["updated_from_coords"] == 1
        # No actual DB update calls in dry-run
        for call in client.table.return_value.update.call_args_list:
            pass  # Should be empty

    def test_pass2_geocodes_and_updates(self):
        client = MagicMock()

        pass1_mock = MagicMock()
        pass1_mock.data = []

        pass2_rows_page1 = [{"id": "uuid-2", "address_raw": "1532 Howard St, SF CA", "address": "", "location": ""}]
        pass2_page1_mock = MagicMock()
        pass2_page1_mock.data = pass2_rows_page1
        pass2_page2_mock = MagicMock()
        pass2_page2_mock.data = []

        update_mock = MagicMock()
        update_mock.data = []

        call_count = {"p2": 0}

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value = pass1_mock
            # Second pass yields one page then empty
            def pass2_range(start, end):
                m = MagicMock()
                if call_count["p2"] == 0:
                    m.execute.return_value = pass2_page1_mock
                else:
                    m.execute.return_value = pass2_page2_mock
                call_count["p2"] += 1
                return m
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.side_effect = pass2_range
            tbl.update.return_value.eq.return_value.execute.return_value = update_mock
            return tbl

        client.table.side_effect = _table_side_effect

        fake_geocode_response = (37.772, -122.416)

        with patch("zillow_pipeline.lib.loopnet_geom._geocode", return_value=fake_geocode_response), \
             patch("zillow_pipeline.lib.loopnet_geom.time.sleep"):
            stats = run_loopnet_geom_backfill(client, dry_run=False)

        assert stats["geocoded"] == 1
        assert stats["geocode_failed"] == 0

    def test_pass2_skips_when_no_address(self):
        client = MagicMock()

        pass1_mock = MagicMock()
        pass1_mock.data = []
        pass2_row = [{"id": "uuid-3", "address_raw": "", "address": "", "location": ""}]
        pass2_mock = MagicMock()
        pass2_mock.data = pass2_row
        pass2_empty = MagicMock()
        pass2_empty.data = []

        call_count = {"p2": 0}

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value = pass1_mock
            def pass2_range(start, end):
                m = MagicMock()
                if call_count["p2"] == 0:
                    m.execute.return_value = pass2_mock
                else:
                    m.execute.return_value = pass2_empty
                call_count["p2"] += 1
                return m
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.side_effect = pass2_range
            return tbl

        client.table.side_effect = _table_side_effect

        with patch("zillow_pipeline.lib.loopnet_geom.time.sleep"):
            stats = run_loopnet_geom_backfill(client, dry_run=False)

        assert stats["skipped_no_address"] == 1
        assert stats["geocoded"] == 0

    def test_pass2_counts_geocode_failures(self):
        client = MagicMock()

        pass1_mock = MagicMock()
        pass1_mock.data = []
        pass2_row = [{"id": "uuid-4", "address_raw": "Gibberish", "address": "", "location": ""}]
        pass2_mock = MagicMock()
        pass2_mock.data = pass2_row
        pass2_empty = MagicMock()
        pass2_empty.data = []

        call_count = {"p2": 0}

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value = pass1_mock
            def pass2_range(start, end):
                m = MagicMock()
                if call_count["p2"] == 0:
                    m.execute.return_value = pass2_mock
                else:
                    m.execute.return_value = pass2_empty
                call_count["p2"] += 1
                return m
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.side_effect = pass2_range
            return tbl

        client.table.side_effect = _table_side_effect

        with patch("zillow_pipeline.lib.loopnet_geom._geocode", return_value=(None, None)), \
             patch("zillow_pipeline.lib.loopnet_geom.time.sleep"):
            stats = run_loopnet_geom_backfill(client, dry_run=False)

        assert stats["geocode_failed"] == 1
        assert stats["geocoded"] == 0

    def test_limit_is_respected(self):
        client = MagicMock()

        rows = [
            {"id": f"uuid-{i}", "latitude": 37.0 + i, "longitude": -122.0}
            for i in range(10)
        ]
        pass1_mock = MagicMock()
        pass1_mock.data = rows
        pass2_mock = MagicMock()
        pass2_mock.data = []

        def _table_side_effect(*args, **kwargs):
            tbl = MagicMock()
            tbl.select.return_value.is_.return_value.not_.is_.return_value.not_.is_.return_value.order.return_value.range.return_value.execute.return_value = pass1_mock
            tbl.select.return_value.is_.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value = pass2_mock
            tbl.update.return_value.eq.return_value.execute.return_value.data = []
            return tbl

        client.table.side_effect = _table_side_effect

        stats = run_loopnet_geom_backfill(client, dry_run=False, limit=3)

        assert stats["scanned"] == 3
        assert stats["updated_from_coords"] == 3
