"""Tests for loopnet_address_fields (shared with backfill and Dagster asset)."""

from unittest.mock import MagicMock, patch

from zillow_pipeline.lib.loopnet_address_fields import build_address_fields_from_row, run_loopnet_address_backfill


class TestBuildAddressFieldsFromRow:
    def test_street_city_state_zip_concat(self):
        out = build_address_fields_from_row(
            "1532 Howard St",
            None,
            "San Francisco",
            "CA",
            "94103",
        )
        assert out["address_raw"] == "1532 Howard St, San Francisco, CA 94103"
        assert out["address_street"] == "1532 Howard St"
        assert out["address_city"] == "San Francisco"
        assert out["address_state"] == "CA"
        assert out["address_zip"] == "94103"

    def test_fallback_to_location_when_no_structured(self):
        out = build_address_fields_from_row("", "Oakland, CA 94612", "", "", "")
        assert out["address_raw"] == "Oakland, CA 94612"
        assert out["address_street"] == ""
        assert out["address_city"] == ""
        assert out["address_state"] == ""
        assert out["address_zip"] == ""

    def test_street_plus_location_when_no_city_state_zip(self):
        """Typical run 2: street in `address`, locality in `location` column."""
        out = build_address_fields_from_row(
            "1532 Howard St",
            "San Francisco, CA 94103",
            "",
            "",
            "",
        )
        assert out["address_raw"] == "1532 Howard St, San Francisco, CA 94103"
        assert out["address_street"] == "1532 Howard St"

    @patch("zillow_pipeline.lib.loopnet_address_fields.normalize_address_parts")
    def test_libpostal_overrides_city_state_zip(self, mock_norm):
        mock_norm.return_value = {
            "house_number": "1532",
            "road": "howard street",
            "city": "san francisco",
            "state": "ca",
            "postcode": "94103",
        }
        out = build_address_fields_from_row(
            "1532 Howard St",
            "San Francisco, CA 94103",
            "",
            "",
            "",
        )
        mock_norm.assert_called_once_with("1532 Howard St, San Francisco, CA 94103")
        assert out["address_city"] == "san francisco"
        assert out["address_state"] == "ca"
        assert out["address_zip"] == "94103"


def test_run_loopnet_address_backfill_updates_when_differs():
    rows = [
        {
            "id": "u1",
            "address": "1 Main",
            "location": "San Francisco, CA 94102",
            "city": "",
            "state": "",
            "zip": "",
            "address_raw": None,
            "address_street": None,
            "address_city": None,
            "address_state": None,
            "address_zip": None,
        }
    ]

    client = MagicMock()
    t = MagicMock()
    sel_exec = MagicMock()
    sel_exec.execute.return_value = MagicMock(data=rows)
    after_order = MagicMock()
    after_order.range.return_value = sel_exec
    select_result = MagicMock()
    select_result.order.return_value = after_order
    t.select.return_value = select_result
    upd_exec = MagicMock()
    upd_exec.execute.return_value = MagicMock(data=[])
    t.update.return_value.eq.return_value = upd_exec
    client.table.return_value = t

    stats = run_loopnet_address_backfill(client, page_size=50)

    assert stats["scanned"] == 1
    assert stats["updated"] == 1
    assert stats["unchanged"] == 0
    assert stats["skipped_empty"] == 0
    assert stats["errors"] == 0
    client.table.assert_called_with("loopnet_listing_details")
    t.update.assert_called_once()
    payload = t.update.call_args[0][0]
    assert payload["address_raw"] == "1 Main, San Francisco, CA 94102"
