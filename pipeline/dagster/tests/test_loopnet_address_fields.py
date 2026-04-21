"""Tests for loopnet_address_fields (shared with backfill and Dagster asset)."""

from unittest.mock import patch

from zillow_pipeline.lib.loopnet_address_fields import build_address_fields_from_row


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
