"""Tests for pure utility functions in cleaned_building_units.py."""
import pytest
from zillow_pipeline.assets.cleaned_building_units import _parse_unit_price, _parse_int, _parse_float


# ─── _parse_unit_price ───────────────────────────────────────────────────────

class TestParseUnitPrice:
    def test_formatted_price_string(self):
        assert _parse_unit_price("$2,500/mo") == 2500

    def test_plain_int(self):
        assert _parse_unit_price(1800) == 1800

    def test_plain_string_digits(self):
        assert _parse_unit_price("1800") == 1800

    def test_price_with_plus(self):
        assert _parse_unit_price("$1,200+") == 1200

    def test_none_returns_none(self):
        assert _parse_unit_price(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_unit_price("") is None

    def test_non_digit_string_returns_none(self):
        assert _parse_unit_price("Contact for price") is None

    def test_zero(self):
        assert _parse_unit_price(0) == 0


# ─── _parse_int ──────────────────────────────────────────────────────────────

class TestInternalParseInt:
    def test_integer_passthrough(self):
        assert _parse_int(3) == 3

    def test_string_digits(self):
        assert _parse_int("2") == 2

    def test_float_truncates(self):
        assert _parse_int(2.9) == 2

    def test_none_returns_none(self):
        assert _parse_int(None) is None

    def test_non_numeric_returns_none(self):
        assert _parse_int("N/A") is None


# ─── _parse_float ────────────────────────────────────────────────────────────

class TestInternalParseFloat:
    def test_float_passthrough(self):
        assert _parse_float(2.5) == 2.5

    def test_int_to_float(self):
        assert _parse_float(2) == 2.0

    def test_string_digits(self):
        assert _parse_float("2.5") == 2.5

    def test_none_returns_none(self):
        assert _parse_float(None) is None

    def test_non_numeric_returns_none(self):
        assert _parse_float("N/A") is None
