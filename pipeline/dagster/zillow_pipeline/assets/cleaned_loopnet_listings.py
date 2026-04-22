import re
from datetime import datetime, timezone
from typing import Optional

from dagster import AssetExecutionContext, Backoff, Config, Output, RetryPolicy, asset
from dateutil.parser import parse as parse_date

from zillow_pipeline.resources.supabase import SupabaseResource
from zillow_pipeline.assets.loopnet_detail_scrape import raw_loopnet_detail_scrapes
from zillow_pipeline.lib.loopnet_address_fields import build_address_fields_from_row


class CleanedLoopnetListingsConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest run


def _make_geom(lng, lat) -> str | None:
    """Return a WKT Point string accepted by Supabase PostGIS, or None."""
    try:
        if lng is None or lat is None:
            return None
        return f"POINT({float(lng)} {float(lat)})"
    except (TypeError, ValueError):
        return None


def _parse_date(val: str | None) -> str | None:
    """Convert MM/DD/YYYY or ISO strings to YYYY-MM-DD, or return None."""
    if not val:
        return None
    val = val.strip()
    if not val:
        return None

    try:
        if re.fullmatch(r"\d{2}/\d{2}/\d{4}", val):
            first = int(val[:2])
            second = int(val[3:5])
            if first > 12 and second <= 12:
                return parse_date(val, dayfirst=True, yearfirst=False, fuzzy=False).date().isoformat()
            return parse_date(val, dayfirst=False, yearfirst=False, fuzzy=False).date().isoformat()

        return parse_date(val, dayfirst=False, yearfirst=True, fuzzy=False).date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        cleaned = str(val).replace(",", "").replace("$", "").strip()
        return int(float(cleaned)) if cleaned else None
    except (ValueError, TypeError):
        return None


def _get(d: dict, *keys, default=None):
    """Safely traverse nested dict keys."""
    for key in keys:
        if not isinstance(d, dict):
            return default
        d = d.get(key, default)
    return d


def _build_record(item: dict, run_id: str, scraped_at: str) -> dict | None:
    """Map a raw Phase 2 detail item to a loopnet_listing_details row. Returns None if no listing URL."""
    listing_url = item.get("inputUrl") or item.get("listingUrl") or ""
    if not listing_url:
        return None

    pf = item.get("propertyFacts") or {}
    summary = item.get("summary") or {}
    header = item.get("header") or {}
    lot = item.get("lotDetails") or {}

    # Broker / agent
    broker_details = item.get("brokerDetails") or []
    primary_broker = broker_details[0] if broker_details else {}

    # Price — prefer numeric, fall back to parsing formatted string
    price_numeric = _safe_int(item.get("priceNumeric"))
    price_str = pf.get("Price") or item.get("price") or ""

    # Cap rate — propertyFacts first, then description parsing
    cap_rate = pf.get("CapRate") or item.get("capRate") or ""

    # Dates
    date_on_market = _parse_date(item.get("date_market"))
    date_listed = _parse_date(summary.get("createdDate"))
    date_last_updated = _parse_date(summary.get("lastUpdated"))

    # Zoning
    zoning_raw = ""
    zoning_district = summary.get("zoningDistrict") or ""
    zoning_description = summary.get("zoningDescription") or ""
    zoning_list = item.get("zoning") or []
    if zoning_list:
        zoning_raw = "; ".join(f"{z.get('Key','')}: {z.get('Value','')}" for z in zoning_list if isinstance(z, dict))

    # Property subtype — join array if present
    prop_subtypes = summary.get("propertySubTypes") or []
    property_subtype = pf.get("PropertySubtype") or (", ".join(prop_subtypes) if prop_subtypes else "")

    # Images — strip thumbnail template placeholders, keep structured list
    images = [
        {"url": img.get("url"), "caption": img.get("caption"), "type": img.get("type")}
        for img in (item.get("images") or [])
        if img.get("url")
    ]
    # thumbnail: use first image or the top-level image field
    thumbnail_url = images[0]["url"].replace("{s}", "106") if images else None

    # Broker logo
    broker_logo_url = item.get("logoUrl") or _get(primary_broker, "companyLogo") or None

    # Email from brokerDetails
    broker_email = primary_broker.get("email") or None

    street_line = (item.get("address") or header.get("headerAddress") or "").strip()
    zip_code = (item.get("zip") or "").strip()
    addr_fields = build_address_fields_from_row(
        street_line,
        header.get("location") or "",
        zip_code,
    )

    return {
        "listing_url":          listing_url,
        "thumbnail_url":        thumbnail_url,
        "broker_logo_url":      broker_logo_url,
        "address":              street_line,
        **addr_fields,
        "headline":             header.get("subtext") or "",
        "location":             header.get("location") or "",
        "zip":                  zip_code,
        "price":                price_str,
        "price_numeric":        price_numeric,
        "cap_rate":             cap_rate,
        "building_category":    pf.get("PropertySubtype") or property_subtype or "",
        "square_footage":       item.get("buildingSize") or pf.get("BuildingSize") or "",
        "latitude":             item.get("latitude"),
        "longitude":            item.get("longitude"),
        "geom":                 _make_geom(item.get("longitude"), item.get("latitude")),
        "description":          item.get("description") or "",
        "date_on_market":       date_on_market,
        "date_listed":          date_listed,
        "date_last_updated":    date_last_updated,
        "price_per_unit":       pf.get("PricePerUnit") or "",
        "grm":                  None,
        "num_units":            _safe_int(pf.get("NoUnits") or item.get("numberOfUnits") or summary.get("numUnits")),
        "property_type":        item.get("propertyType") or summary.get("propertyType") or "",
        "property_subtype":     property_subtype,
        "apartment_style":      pf.get("ApartmentStyle") or summary.get("apartmentStyle") or "",
        "building_class":       pf.get("BuildingClass") or summary.get("buildingClass") or "",
        "lot_size":             pf.get("LotSize") or lot.get("lotSize") or "",
        "building_size":        item.get("buildingSize") or pf.get("BuildingSize") or "",
        "num_stories":          _safe_int(pf.get("NoStories") or summary.get("stories")),
        "year_built":           _safe_int(pf.get("YearBuilt") or summary.get("yearBuilt")),
        "year_renovated":       _safe_int(summary.get("yearRenovated")),
        "construction_status":  summary.get("constructionStatus") or "",
        "zoning":               zoning_raw,
        "zoning_district":      zoning_district,
        "zoning_description":   zoning_description,
        "parcel_number":        pf.get("ParcelNumber") or summary.get("parcelNumber") or "",
        "opportunity_zone":     summary.get("opportunityZone") or False,
        "is_auction":           item.get("isAuction") or False,
        "sale_type":            pf.get("SaleType") or summary.get("saleType") or "",
        "broker_name":          item.get("brokerName") or item.get("agent_fullName") or primary_broker.get("name") or "",
        "broker_company":       item.get("brokerCompany") or item.get("Broker") or primary_broker.get("company") or "",
        "broker_phone":         item.get("phone") or primary_broker.get("phone") or "",
        "broker_email":         broker_email,
        "agent_profile_url":    item.get("agent_profileUrl") or primary_broker.get("profileUrl") or "",
        "agent_photo_url":      item.get("agent_photoUrl") or primary_broker.get("photoUrl") or "",
        "submarket_id":         _safe_int(item.get("submarketId")),
        "investment_highlights": item.get("investmentHighlights") or [],
        "highlights":           item.get("highlights") or [],
        "amenities":            [a.get("name") for a in (item.get("amenities") or []) if a.get("name")],
        "unit_mix":             item.get("unitMix") or [],
        "images":               images,
        "attachments":          item.get("attachments") or [],
        "links":                item.get("links") or [],
        "broker_details":       broker_details,
        "property_taxes":       item.get("propertyTaxes") or {},
        "scraped_at":           scraped_at,
    }


def _extract_snapshot(record: dict) -> dict:
    """Extract the volatile fields for loopnet_listing_snapshots."""
    return {
        "listing_url":      record["listing_url"],
        "price":            record.get("price"),
        "price_numeric":    record.get("price_numeric"),
        "price_per_unit":   record.get("price_per_unit"),
        "cap_rate":         record.get("cap_rate"),
        "grm":              record.get("grm"),
        "date_last_updated": record.get("date_last_updated"),
        "scraped_at":       record["scraped_at"],
        "run_id":           None,  # set by caller
    }


@asset(
    deps=[raw_loopnet_detail_scrapes],
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def cleaned_loopnet_listings(
    context: AssetExecutionContext,
    config: CleanedLoopnetListingsConfig,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.get_client()

    if config.run_id:
        dagster_run_id = config.run_id
    else:
        result = (
            client.table("raw_loopnet_detail_scrapes")
            .select("run_id")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            context.log.warning("No raw_loopnet_detail_scrapes found.")
            return Output(value=0, metadata={"inserted": 0, "failed": 0})
        dagster_run_id = result.data[0]["run_id"]

    context.log.info(f"Cleaning LoopNet detail scrapes for run_id: {dagster_run_id}")

    raw_rows = (
        client.table("raw_loopnet_detail_scrapes")
        .select("raw_json")
        .eq("run_id", dagster_run_id)
        .execute()
    ).data

    # Determine next integer run_id for snapshots
    run_id_result = (
        client.table("loopnet_listing_snapshots")
        .select("run_id")
        .order("run_id", desc=True)
        .limit(1)
        .execute()
    )
    last_run_id = _safe_int(run_id_result.data[0].get("run_id")) if run_id_result.data else None
    int_run_id = (last_run_id or 0) + 1
    context.log.info(f"Using snapshot run_id: {int_run_id}")

    scraped_at = datetime.now(timezone.utc).isoformat()
    detail_inserted = detail_updated = snapshot_inserted = failed = skipped = 0
    detail_records = []
    snapshot_records = []

    for row in raw_rows:
        for item in row.get("raw_json") or []:
            record = _build_record(item, dagster_run_id, scraped_at)
            if record is None:
                skipped += 1
                continue
            detail_records.append(record)
            snap = _extract_snapshot(record)
            snap["run_id"] = int_run_id
            snapshot_records.append(snap)

    context.log.info(f"Built {len(detail_records)} records (skipped {skipped} without URL)")

    # Upsert details (one row per listing_url, update on conflict)
    batch_size = 100
    for start in range(0, len(detail_records), batch_size):
        batch = detail_records[start : start + batch_size]
        try:
            response = (
                client.table("loopnet_listing_details")
                .upsert(batch, on_conflict="listing_url")
                .execute()
            )
            count = len(response.data or [])
            detail_inserted += count
            context.log.info(
                f"Detail upsert rows {start + 1}–{start + len(batch)}: {count} written"
            )
        except Exception as e:
            context.log.error(f"Detail batch {start}–{start + len(batch)} failed: {e}")
            failed += len(batch)

    # Insert snapshots
    for start in range(0, len(snapshot_records), batch_size):
        batch = snapshot_records[start : start + batch_size]
        try:
            response = (
                client.table("loopnet_listing_snapshots")
                .upsert(batch, on_conflict="listing_url,run_id", ignore_duplicates=True)
                .execute()
            )
            count = len(response.data or [])
            snapshot_inserted += count
            context.log.info(
                f"Snapshot upsert rows {start + 1}–{start + len(batch)}: {count} written"
            )
        except Exception as e:
            context.log.error(f"Snapshot batch {start}–{start + len(batch)} failed: {e}")
            failed += len(batch)

    total = len(detail_records) + len(snapshot_records)
    if total > 0 and failed / total > 0.33:
        raise Exception(
            f"{failed}/{total} records failed to insert. "
            f"(details={detail_inserted}, snapshots={snapshot_inserted}). Check logs."
        )

    return Output(
        value=detail_inserted,
        metadata={
            "dagster_run_id": dagster_run_id,
            "loopnet_run_id": int_run_id,
            "records_built": len(detail_records),
            "detail_inserted": detail_inserted,
            "snapshot_inserted": snapshot_inserted,
            "failed": failed,
            "skipped": skipped,
        },
    )
