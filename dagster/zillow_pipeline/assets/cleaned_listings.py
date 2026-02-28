import re
from typing import Optional

from dagster import AssetExecutionContext, Backoff, Config, Output, RetryPolicy, asset
from postal.parser import parse_address

from zillow_pipeline.resources.supabase import SupabaseResource

SFR_KEYWORDS = {"house for rent", "single family", "single-family", "townhouse for rent"}


def is_sfr(listing: dict) -> bool:
    status_text = (listing.get("statusText") or "").lower()
    home_type = (
        (listing.get("hdpData") or {})
        .get("homeInfo", {})
        .get("homeType", "")
        .lower()
    )
    return (
        any(kw in status_text for kw in SFR_KEYWORDS)
        or home_type == "single_family"
    )


def parse_price(listing: dict) -> Optional[int]:
    price = listing.get("unformattedPrice")
    if price is not None:
        try:
            return int(price)
        except (ValueError, TypeError):
            pass
    price = (listing.get("hdpData") or {}).get("homeInfo", {}).get("price")
    if price is not None:
        try:
            return int(price)
        except (ValueError, TypeError):
            pass
    digits = re.sub(r"[^\d]", "", listing.get("price") or "")
    return int(digits) if digits else None


def parse_int(value) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def parse_float(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def normalize_address(raw: str) -> dict:
    parts = parse_address(raw)
    return {label: value for value, label in parts}


class CleaningConfig(Config):
    run_id: Optional[str] = None   # if None, cleans the latest run
    limit: Optional[int] = None    # smoke test: cap total listings processed


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def cleaned_listings(
    context: AssetExecutionContext,
    config: CleaningConfig,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.get_client()

    # Resolve run_id
    if config.run_id:
        run_id = config.run_id
        scraped_at = None
    else:
        result = (
            client.table("raw_zillow_scrapes")
            .select("run_id, scraped_at")
            .order("scraped_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            context.log.warning("No raw scrapes found.")
            return Output(value=0, metadata={"inserted": 0})
        run_id = result.data[0]["run_id"]
        scraped_at = result.data[0]["scraped_at"]

    context.log.info(f"Cleaning run_id: {run_id}")

    raw_rows = (
        client.table("raw_zillow_scrapes")
        .select("id, zip_code, scraped_at, raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data

    context.log.info(f"Found {len(raw_rows)} zip rows for run {run_id}")

    inserted = failed = total_processed = 0

    for raw_row in raw_rows:
        raw_scrape_id = raw_row["id"]
        zip_code = raw_row["zip_code"]
        row_scraped_at = raw_row["scraped_at"]
        listings = raw_row["raw_json"] or []

        for listing in listings:
            if config.limit and total_processed >= config.limit:
                break
            total_processed += 1

            try:
                zpid = str(listing.get("zpid") or "")
                address_raw = listing.get("address") or listing.get("addressStreet") or ""
                parsed_addr = normalize_address(address_raw) if address_raw else {}

                lat_long = listing.get("latLong") or {}
                home_info = (listing.get("hdpData") or {}).get("homeInfo", {})
                lat = lat_long.get("latitude") or home_info.get("latitude")
                lng = lat_long.get("longitude") or home_info.get("longitude")

                facts = listing.get("factsAndFeatures") or {}
                avail_raw = listing.get("availabilityDate")

                client.rpc(
                    "insert_cleaned_listing",
                    {
                        "p_run_id": run_id,
                        "p_scraped_at": row_scraped_at,
                        "p_zip_code": zip_code,
                        "p_zpid": zpid,
                        "p_address_raw": address_raw,
                        "p_address_street": (" ".join(filter(None, [parsed_addr.get("house_number"), parsed_addr.get("road")])) or "").title() or None,
                        "p_address_city": listing.get("addressCity") or parsed_addr.get("city"),
                        "p_address_state": listing.get("addressState") or parsed_addr.get("state"),
                        "p_address_zip": listing.get("addressZipcode") or parsed_addr.get("postcode"),
                        "p_price": parse_price(listing),
                        "p_beds": parse_int(listing.get("beds") or home_info.get("bedrooms")),
                        "p_baths": parse_float(listing.get("baths") or home_info.get("bathrooms")),
                        "p_area": parse_int(listing.get("area") or home_info.get("livingArea")),
                        "p_availability_date": avail_raw[:10] if avail_raw else None,
                        "p_has_fireplace": facts.get("hasFireplace"),
                        "p_has_ac": facts.get("hasAirConditioning"),
                        "p_has_spa": facts.get("hasSpa"),
                        "p_has_pool": facts.get("hasPool"),
                        "p_lat": float(lat) if lat is not None else None,
                        "p_lng": float(lng) if lng is not None else None,
                        "p_is_sfr": is_sfr(listing),
                        "p_raw_scrape_id": raw_scrape_id,
                    },
                ).execute()
                inserted += 1

            except Exception as e:
                context.log.error(f"Failed zpid={listing.get('zpid')} in {zip_code}: {e}")
                failed += 1

        if config.limit and total_processed >= config.limit:
            context.log.info(f"Reached smoke test limit of {config.limit} listings.")
            break

    context.log.info(f"Done. inserted={inserted}, failed={failed}")

    return Output(
        value=inserted,
        metadata={
            "run_id": run_id,
            "raw_zip_rows": len(raw_rows),
            "total_processed": total_processed,
            "inserted": inserted,
            "failed": failed,
        },
    )
