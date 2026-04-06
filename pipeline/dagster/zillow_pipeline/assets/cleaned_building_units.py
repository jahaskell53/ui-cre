import re
from typing import Optional

from dagster import AssetExecutionContext, Backoff, Config, Output, RetryPolicy, asset

from zillow_pipeline.resources.supabase import SupabaseResource

BATCH_SIZE = 500


def _parse_unit_price(value) -> Optional[int]:
    if value is None:
        return None
    digits = re.sub(r"[^\d]", "", str(value))
    return int(digits) if digits else None


def _parse_int(value) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def _parse_float(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def _normalize_address(raw: str) -> dict:
    from postal.parser import parse_address
    parts = parse_address(raw)
    return {label: value for value, label in parts}


def _flush_batch(client, batch: list) -> tuple[int, int]:
    try:
        client.rpc("insert_cleaned_listings_bulk", {"rows": batch}).execute()
        return len(batch), 0
    except Exception as e:
        return 0, len(batch)


class CleanedBuildingUnitsConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest run from raw_zillow_scrapes


@asset(
    deps=["raw_building_scrapes"],
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def cleaned_building_units(
    context: AssetExecutionContext,
    config: CleanedBuildingUnitsConfig,
    supabase: SupabaseResource,
) -> Output[int]:
    client = supabase.get_client()

    # Resolve run_id
    if config.run_id:
        run_id = config.run_id
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

    context.log.info(f"Cleaning building units for run_id: {run_id}")

    building_rows = []
    page_size = 100
    offset = 0
    while True:
        page = (
            client.table("raw_building_details")
            .select("*")
            .eq("run_id", run_id)
            .range(offset, offset + page_size - 1)
            .execute()
        ).data
        building_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    context.log.info(f"Fetched {len(building_rows)} building detail rows")

    # Also need scraped_at from raw_zillow_scrapes for this run if not already set
    if not config.run_id:
        pass  # scraped_at already set above
    else:
        result = (
            client.table("raw_zillow_scrapes")
            .select("scraped_at")
            .eq("run_id", run_id)
            .limit(1)
            .execute()
        )
        scraped_at = result.data[0]["scraped_at"] if result.data else building_rows[0]["scraped_at"] if building_rows else None

    # Also need zip_code from raw_zillow_scrapes to look up each building's zip
    zip_rows = []
    offset = 0
    while True:
        page = (
            client.table("raw_zillow_scrapes")
            .select("zip_code, raw_json")
            .eq("run_id", run_id)
            .range(offset, offset + page_size - 1)
            .execute()
        ).data
        zip_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    context.log.info(f"Fetched {len(zip_rows)} zip rows")

    # Build a lookup: building_zpid -> (zip_code, listing dict from raw_zillow_scrapes)
    building_meta: dict[str, dict] = {}
    for zrow in zip_rows:
        for listing in zrow["raw_json"] or []:
            if listing.get("isBuilding"):
                zpid = str(listing.get("zpid") or "")
                if zpid and zpid not in building_meta:
                    building_meta[zpid] = {
                        "zip_code": zrow["zip_code"],
                        "listing": listing,
                    }

    context.log.info(f"Built metadata for {len(building_meta)} buildings. Starting inserts...")

    inserted = failed = 0
    batch: list[dict] = []

    def _extract_laundry(attrs: dict) -> Optional[str]:
        appliances = attrs.get("appliances") or []
        if any(a in appliances for a in ("Washer", "Dryer")):
            return "in_unit"
        shared = attrs.get("hasSharedLaundry")
        if shared is True:
            return "shared"
        if shared is False:
            return "none"
        return None

    def _make_row(zpid, scraped_at, zip_code, address_raw, address_street, address_city,
                  address_state, address_zip, price, beds, baths, area, lat, lng,
                  img_src, detail_url, is_building, building_zpid, laundry=None) -> dict:
        return {
            "run_id": run_id,
            "scraped_at": scraped_at,
            "zip_code": zip_code,
            "zpid": zpid,
            "address_raw": address_raw,
            "address_street": address_street,
            "address_city": address_city,
            "address_state": address_state,
            "address_zip": address_zip,
            "price": price,
            "beds": beds,
            "baths": baths,
            "area": area,
            "availability_date": None,
            "lat": float(lat) if lat is not None else None,
            "lng": float(lng) if lng is not None else None,
            "raw_scrape_id": None,
            "img_src": img_src,
            "detail_url": detail_url,
            "is_building": is_building,
            "building_zpid": building_zpid,
            "home_type": "APARTMENT",
            "laundry": laundry,
        }

    def flush():
        nonlocal inserted, failed, batch
        if not batch:
            return
        ins, fail = _flush_batch(client, batch)
        inserted += ins
        failed += fail
        if fail:
            context.log.error(f"Batch of {len(batch)} failed to insert")
        batch = []

    for building_row in building_rows:
        building_zpid = building_row["building_zpid"]
        detail_url = building_row["detail_url"]
        raw_json = building_row["raw_json"] or []
        row_scraped_at = building_row["scraped_at"]

        meta = building_meta.get(building_zpid, {})
        zip_code = meta.get("zip_code", "")
        parent_listing = meta.get("listing", {})

        address_raw = parent_listing.get("address") or parent_listing.get("addressStreet") or ""
        parsed_addr = _normalize_address(address_raw) if address_raw else {}
        address_street = (
            " ".join(filter(None, [parsed_addr.get("house_number"), parsed_addr.get("road")])) or ""
        ).title() or None
        address_city = parent_listing.get("addressCity") or parsed_addr.get("city")
        address_state = parent_listing.get("addressState") or parsed_addr.get("state")
        address_zip = parent_listing.get("addressZipcode") or parsed_addr.get("postcode")

        lat_long = parent_listing.get("latLong") or {}
        home_info = (parent_listing.get("hdpData") or {}).get("homeInfo", {})
        lat = lat_long.get("latitude") or home_info.get("latitude")
        lng = lat_long.get("longitude") or home_info.get("longitude")
        img_src = parent_listing.get("imgSrc")

        # Extract building-level attributes (laundry applies to all units)
        building_attrs = {}
        for result_item in raw_json:
            if result_item.get("buildingAttributes"):
                building_attrs = result_item["buildingAttributes"]
                break
        laundry = _extract_laundry(building_attrs)

        # Parent building row
        batch.append(_make_row(
            zpid=building_zpid, scraped_at=row_scraped_at, zip_code=zip_code,
            address_raw=address_raw, address_street=address_street,
            address_city=address_city, address_state=address_state, address_zip=address_zip,
            price=None, beds=None, baths=None, area=None,
            lat=lat, lng=lng, img_src=img_src, detail_url=detail_url,
            is_building=True, building_zpid=None, laundry=laundry,
        ))

        # Unit rows
        for result_item in raw_json:
            floor_plans = result_item.get("floorPlans") or []
            if not floor_plans:
                for idx, unit in enumerate(result_item.get("units") or []):
                    unit_zpid = str(unit.get("zpid") or "") or f"{building_zpid}_u{idx}"
                    batch.append(_make_row(
                        zpid=unit_zpid, scraped_at=row_scraped_at, zip_code=zip_code,
                        address_raw=address_raw, address_street=address_street,
                        address_city=address_city, address_state=address_state, address_zip=address_zip,
                        price=_parse_unit_price(unit.get("price") or unit.get("unformattedPrice")),
                        beds=_parse_int(unit.get("beds") or unit.get("bedrooms")),
                        baths=_parse_float(unit.get("baths") or unit.get("bathrooms")),
                        area=_parse_int(unit.get("area") or unit.get("livingArea")),
                        lat=lat, lng=lng, img_src=img_src, detail_url=detail_url,
                        is_building=False, building_zpid=building_zpid, laundry=laundry,
                    ))
                continue

            for fp_idx, floor_plan in enumerate(floor_plans):
                beds = _parse_int(floor_plan.get("beds") or floor_plan.get("bedrooms"))
                baths = _parse_float(floor_plan.get("baths") or floor_plan.get("bathrooms"))
                area = _parse_int(floor_plan.get("sqft") or floor_plan.get("area") or floor_plan.get("livingArea"))
                fp_units = floor_plan.get("units") or []

                if fp_units:
                    for u_idx, unit in enumerate(fp_units):
                        unit_zpid = str(unit.get("zpid") or "") or f"{building_zpid}_{fp_idx}bd_{u_idx}"
                        price = _parse_unit_price(
                            unit.get("price") or unit.get("unformattedPrice") or floor_plan.get("price")
                        )
                        batch.append(_make_row(
                            zpid=unit_zpid, scraped_at=row_scraped_at, zip_code=zip_code,
                            address_raw=address_raw, address_street=address_street,
                            address_city=address_city, address_state=address_state, address_zip=address_zip,
                            price=price, beds=beds, baths=baths, area=area,
                            lat=lat, lng=lng, img_src=img_src, detail_url=detail_url,
                            is_building=False, building_zpid=building_zpid, laundry=laundry,
                        ))
                else:
                    unit_zpid = f"{building_zpid}_fp{fp_idx}"
                    price = _parse_unit_price(floor_plan.get("price") or floor_plan.get("minPrice"))
                    batch.append(_make_row(
                        zpid=unit_zpid, scraped_at=row_scraped_at, zip_code=zip_code,
                        address_raw=address_raw, address_street=address_street,
                        address_city=address_city, address_state=address_state, address_zip=address_zip,
                        price=price, beds=beds, baths=baths, area=area,
                        lat=lat, lng=lng, img_src=img_src, detail_url=detail_url,
                        is_building=False, building_zpid=building_zpid, laundry=laundry,
                    ))

        if len(batch) >= BATCH_SIZE:
            flush()

    flush()  # flush remaining

    context.log.info(f"Done. inserted={inserted}, failed={failed}")

    if failed > 0:
        raise Exception(f"{failed} rows failed to insert. Check logs for details.")

    return Output(
        value=inserted,
        metadata={
            "run_id": run_id,
            "buildings_processed": len(building_rows),
            "inserted": inserted,
            "failed": failed,
        },
    )
