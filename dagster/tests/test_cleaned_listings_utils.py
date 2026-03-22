"""Tests for pure utility functions in cleaned_listings.py."""
import pytest
from zillow_pipeline.assets.cleaned_listings import is_sfr, parse_price, parse_int, parse_float


# ─── is_sfr ──────────────────────────────────────────────────────────────────

class TestIsSfr:
    def test_status_text_house_for_rent(self):
        assert is_sfr({"statusText": "House for rent"}) is True

    def test_status_text_single_family(self):
        assert is_sfr({"statusText": "Single family home"}) is True

    def test_status_text_single_family_hyphenated(self):
        assert is_sfr({"statusText": "Single-family home"}) is True

    def test_status_text_townhouse_for_rent(self):
        assert is_sfr({"statusText": "Townhouse for rent"}) is True

    def test_home_type_single_family(self):
        assert is_sfr({"hdpData": {"homeInfo": {"homeType": "SINGLE_FAMILY"}}}) is True

    def test_home_type_case_insensitive(self):
        assert is_sfr({"hdpData": {"homeInfo": {"homeType": "single_family"}}}) is True

    def test_apartment_is_not_sfr(self):
        assert is_sfr({"statusText": "Apartment for rent", "hdpData": {"homeInfo": {"homeType": "APARTMENT"}}}) is False

    def test_empty_listing_is_not_sfr(self):
        assert is_sfr({}) is False

    def test_missing_hpd_data_falls_back_to_status_text(self):
        assert is_sfr({"statusText": "House for rent", "hdpData": None}) is True

    def test_status_text_case_insensitive(self):
        assert is_sfr({"statusText": "HOUSE FOR RENT"}) is True


# ─── parse_price ─────────────────────────────────────────────────────────────

class TestParsePrice:
    def test_unformatted_price(self):
        assert parse_price({"unformattedPrice": 2500}) == 2500

    def test_unformatted_price_as_string(self):
        assert parse_price({"unformattedPrice": "2500"}) == 2500

    def test_falls_back_to_hdp_data_price(self):
        assert parse_price({"hdpData": {"homeInfo": {"price": 3000}}}) == 3000

    def test_falls_back_to_formatted_price_string(self):
        assert parse_price({"price": "$2,500/mo"}) == 2500

    def test_formatted_price_strips_non_digits(self):
        assert parse_price({"price": "$1,200+"}) == 1200

    def test_unformatted_price_takes_priority_over_hdp(self):
        listing = {"unformattedPrice": 1000, "hdpData": {"homeInfo": {"price": 2000}}}
        assert parse_price(listing) == 1000

    def test_returns_none_when_all_missing(self):
        assert parse_price({}) is None

    def test_returns_none_when_price_string_has_no_digits(self):
        assert parse_price({"price": "Contact for price"}) is None

    def test_unformatted_price_none_falls_through(self):
        assert parse_price({"unformattedPrice": None, "price": "$900/mo"}) == 900

    def test_invalid_unformatted_price_falls_through(self):
        assert parse_price({"unformattedPrice": "N/A", "price": "$900/mo"}) == 900


# ─── parse_int ───────────────────────────────────────────────────────────────

class TestParseInt:
    def test_integer_passthrough(self):
        assert parse_int(3) == 3

    def test_string_digits(self):
        assert parse_int("3") == 3

    def test_float_truncates(self):
        assert parse_int(3.9) == 3

    def test_none_returns_none(self):
        assert parse_int(None) is None

    def test_non_numeric_string_returns_none(self):
        assert parse_int("N/A") is None

    def test_zero(self):
        assert parse_int(0) == 0


# ─── parse_float ─────────────────────────────────────────────────────────────

class TestParseFloat:
    def test_float_passthrough(self):
        assert parse_float(1.5) == 1.5

    def test_int_to_float(self):
        assert parse_float(2) == 2.0

    def test_string_digits(self):
        assert parse_float("1.5") == 1.5

    def test_none_returns_none(self):
        assert parse_float(None) is None

    def test_non_numeric_string_returns_none(self):
        assert parse_float("N/A") is None
