"""Tests for the cleaned_loopnet_listings asset and helper functions."""
from unittest.mock import MagicMock, call

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.cleaned_loopnet_listings import (
    cleaned_loopnet_listings,
    CleanedLoopnetListingsConfig,
    _build_record,
    _parse_date,
    _safe_int,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_supabase():
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    return mock, client


def meta(output, key):
    return output.metadata[key].value


SAMPLE_ITEM = {
    "inputUrl": "https://www.loopnet.com/Listing/1532-Howard-St-San-Francisco-CA/38729368/",
    "address": "1532 Howard St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94103",
    "latitude": 37.772812,
    "longitude": -122.416294,
    "description": "15-unit multifamily property.",
    "investmentHighlights": ["Great location", "Cash flowing"],
    "highlights": ["Highlight A"],
    "amenities": [{"name": "Air Conditioning"}, {"name": "Heating"}],
    "unitMix": [{"description": "0+", "count": "15", "rent": "$2.6K", "sqft": "321-421 SF"}],
    "images": [{"url": "https://images1.loopnet.com/i2/abc/{s}/image.jpg", "caption": "Front", "type": 0}],
    "attachments": [{"link": "https://example.com/doc.pdf", "description": "Floorplan"}],
    "links": [{"url": "https://example.com/om", "description": "Offering Memo"}],
    "propertyFacts": {
        "CapRate": "6.84%",
        "Price": "$4,895,000",
        "ApartmentStyle": "Mid-Rise",
        "PricePerUnit": "$326,333",
        "BuildingClass": "C",
        "SaleType": "Investment",
        "LotSize": "0.05 AC",
        "NoUnits": "15",
        "BuildingSize": "8,225 SF",
        "NoStories": "6",
        "PropertySubtype": "Apartment",
        "YearBuilt": "2020",
        "ParcelNumber": "3511-015",
    },
    "summary": {
        "propertyType": "Build-to-Rent",
        "propertySubTypes": ["Apartments"],
        "buildingClass": "C",
        "apartmentStyle": "Mid-Rise",
        "zoningDistrict": "SLR",
        "zoningDescription": "Sea Level Rise Overlay",
        "constructionStatus": "Existing",
        "yearBuilt": "2020",
        "stories": "6",
        "numUnits": "15",
        "opportunityZone": False,
        "saleType": "Investment",
        "createdDate": "2025-12-10T12:00:00-05:00",
        "lastUpdated": "07/04/2026",
        "parcelNumber": "3511-015",
    },
    "header": {
        "headerAddress": "1532 Howard St",
        "subtext": "15 Unit Apartments | $4.895M",
        "location": "San Francisco, CA 94103",
    },
    "priceNumeric": 4895000,
    "isAuction": False,
    "propertyType": "Multifamily",
    "buildingSize": "8,225 SF",
    "date_market": "12/10/2025",
    "brokerName": "Antoine Crumeyrolle",
    "brokerCompany": "Compass",
    "phone": "+1 628-800-0285",
    "agent_profileUrl": "https://www.loopnet.com/brokers/antoine",
    "agent_photoUrl": "https://images1.loopnet.com/photo.jpg",
    "brokerDetails": [
        {
            "name": "Antoine Crumeyrolle",
            "company": "Compass",
            "phone": "+1 628-800-0285",
            "email": "antoine@compass.com",
            "profileUrl": "https://www.loopnet.com/brokers/antoine",
            "photoUrl": "https://images1.loopnet.com/photo.jpg",
        }
    ],
    "propertyTaxes": {
        "parcelNumber": "3511-015",
        "landAssessment": "$925,730 (2025)",
        "improvementsAssessment": "$4,852,494 (2025)",
        "totalAssessment": "$5,778,224 (2025)",
    },
    "submarketId": 9957,
    "zoning": [{"Key": "Zoning Code", "Value": "SLR (Sea Level Rise Overlay)"}],
    "logoUrl": "https://images1.loopnet.com/logo.jpg",
}


# ─── Unit tests for helper functions ─────────────────────────────────────────

class TestParseDate:
    def test_mm_dd_yyyy(self):
        assert _parse_date("12/10/2025") == "2025-12-10"

    def test_iso_date(self):
        assert _parse_date("2025-12-10T12:00:00-05:00") == "2025-12-10"

    def test_plain_iso(self):
        assert _parse_date("2025-12-10") == "2025-12-10"

    def test_none_returns_none(self):
        assert _parse_date(None) is None

    def test_empty_string_returns_none(self):
        assert _parse_date("") is None


class TestSafeInt:
    def test_plain_int(self):
        assert _safe_int("15") == 15

    def test_float_string(self):
        assert _safe_int("8,225") == 8225

    def test_none(self):
        assert _safe_int(None) is None

    def test_already_int(self):
        assert _safe_int(4895000) == 4895000

    def test_empty_string(self):
        assert _safe_int("") is None


# ─── Unit tests for _build_record ────────────────────────────────────────────

class TestBuildRecord:
    def test_returns_none_when_no_url(self):
        assert _build_record({}, "run-1", "2025-01-01T00:00:00Z") is None

    def test_maps_basic_fields(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record is not None
        assert record["listing_url"] == SAMPLE_ITEM["inputUrl"]
        assert record["address"] == "1532 Howard St"
        assert record["city"] == "San Francisco"
        assert record["state"] == "CA"
        assert record["zip"] == "94103"
        assert record["latitude"] == 37.772812
        assert record["longitude"] == -122.416294

    def test_maps_price_fields(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["price_numeric"] == 4895000
        assert record["cap_rate"] == "6.84%"
        assert record["price_per_unit"] == "$326,333"

    def test_maps_property_facts(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["num_units"] == 15
        assert record["num_stories"] == 6
        assert record["year_built"] == 2020
        assert record["building_class"] == "C"
        assert record["apartment_style"] == "Mid-Rise"
        assert record["lot_size"] == "0.05 AC"
        assert record["building_size"] == "8,225 SF"
        assert record["parcel_number"] == "3511-015"
        assert record["sale_type"] == "Investment"

    def test_maps_broker_fields(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["broker_name"] == "Antoine Crumeyrolle"
        assert record["broker_company"] == "Compass"
        assert record["broker_email"] == "antoine@compass.com"
        assert "antoine" in record["agent_profile_url"]

    def test_maps_zoning(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["zoning_district"] == "SLR"
        assert "Sea Level Rise" in record["zoning_description"]
        assert "SLR" in record["zoning"]

    def test_maps_jsonb_arrays(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert len(record["investment_highlights"]) == 2
        assert len(record["unit_mix"]) == 1
        assert len(record["images"]) == 1
        assert record["images"][0]["caption"] == "Front"
        assert len(record["amenities"]) == 2
        assert "Air Conditioning" in record["amenities"]

    def test_maps_dates(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["date_on_market"] == "2025-12-10"
        assert record["date_listed"] == "2025-12-10"

    def test_opportunity_zone_boolean(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["opportunity_zone"] is False

    def test_is_auction_boolean(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["is_auction"] is False

    def test_submarket_id(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["submarket_id"] == 9957

    def test_property_taxes_preserved(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["property_taxes"]["parcelNumber"] == "3511-015"

    def test_broker_logo_url(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["broker_logo_url"] == "https://images1.loopnet.com/logo.jpg"

    def test_thumbnail_from_images(self):
        record = _build_record(SAMPLE_ITEM, "run-1", "2025-01-01T00:00:00Z")
        assert record["thumbnail_url"] is not None
        assert "{s}" not in record["thumbnail_url"]


# ─── Asset-level tests ───────────────────────────────────────────────────────

class TestCleanedLoopnetListings:
    def _setup_client(self, client, raw_data, last_run_id=0):
        """
        When run_id is passed explicitly in the config, the asset skips the
        'latest dagster run_id' order query and only calls order().limit() once
        to fetch the last loopnet integer run_id.
        """
        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [{"raw_json": raw_data}]

        loopnet_run_id_mock = MagicMock()
        loopnet_run_id_mock.data = [{"run_id": last_run_id}] if last_run_id else []

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = loopnet_run_id_mock
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = raw_rows_mock

    def test_no_detail_scrapes_returns_zero(self):
        supabase, client = make_supabase()
        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value.data = []

        with build_asset_context() as ctx:
            output = cleaned_loopnet_listings(
                context=ctx,
                config=CleanedLoopnetListingsConfig(),
                supabase=supabase,
            )

        assert output.value == 0

    def test_inserts_valid_records(self):
        supabase, client = make_supabase()
        self._setup_client(client, [SAMPLE_ITEM])

        with build_asset_context() as ctx:
            output = cleaned_loopnet_listings(
                context=ctx,
                config=CleanedLoopnetListingsConfig(run_id="dagster-run-1"),
                supabase=supabase,
            )

        assert output.value == 1
        assert meta(output, "inserted") == 1
        assert meta(output, "failed") == 0

    def test_skips_items_without_url(self):
        supabase, client = make_supabase()
        self._setup_client(client, [{"address": "No URL item"}, SAMPLE_ITEM])

        with build_asset_context() as ctx:
            output = cleaned_loopnet_listings(
                context=ctx,
                config=CleanedLoopnetListingsConfig(run_id="dagster-run-1"),
                supabase=supabase,
            )

        assert meta(output, "skipped") == 1
        assert meta(output, "inserted") == 1

    def test_increments_integer_run_id(self):
        supabase, client = make_supabase()
        self._setup_client(client, [SAMPLE_ITEM], last_run_id=5)

        with build_asset_context() as ctx:
            output = cleaned_loopnet_listings(
                context=ctx,
                config=CleanedLoopnetListingsConfig(run_id="dagster-run-1"),
                supabase=supabase,
            )

        assert meta(output, "loopnet_run_id") == 6

    def test_batch_insert_failure_raises(self):
        supabase, client = make_supabase()
        self._setup_client(client, [SAMPLE_ITEM])
        client.table.return_value.insert.return_value.execute.side_effect = RuntimeError("DB error")

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="records failed to insert"):
                cleaned_loopnet_listings(
                    context=ctx,
                    config=CleanedLoopnetListingsConfig(run_id="dagster-run-1"),
                    supabase=supabase,
                )

    def test_uses_explicit_run_id(self):
        supabase, client = make_supabase()

        raw_rows_mock = MagicMock()
        raw_rows_mock.data = [{"raw_json": [SAMPLE_ITEM]}]
        run_id_mock = MagicMock()
        run_id_mock.data = []

        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.return_value = run_id_mock
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = raw_rows_mock

        with build_asset_context() as ctx:
            output = cleaned_loopnet_listings(
                context=ctx,
                config=CleanedLoopnetListingsConfig(run_id="explicit-run-abc"),
                supabase=supabase,
            )

        assert meta(output, "dagster_run_id") == "explicit-run-abc"
        client.table.return_value.select.return_value.order.return_value.limit.return_value.execute.assert_called_once()
