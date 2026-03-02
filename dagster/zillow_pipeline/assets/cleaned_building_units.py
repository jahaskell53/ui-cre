import re
from typing import Optional

from dagster import AssetExecutionContext, Backoff, Config, Output, RetryPolicy, asset

from zillow_pipeline.resources.supabase import SupabaseResource


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


class CleanedBuildingUnitsConfig(Config):
    run_id: Optional[str] = None  # if None, uses the latest run from raw_zillow_scrapes


@asset(
    retry_policy=RetryPolicy(
        max_retries=3,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    )
)
def cleaned_building_units(
    context: AssetExecutionContext,
    raw_building_scrapes: int,
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

    building_rows = (
        client.table("raw_building_details")
        .select("*")
        .eq("run_id", run_id)
        .execute()
    ).data

    context.log.info(f"Found {len(building_rows)} building detail rows")

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
    zip_rows = (
        client.table("raw_zillow_scrapes")
        .select("zip_code, raw_json")
        .eq("run_id", run_id)
        .execute()
    ).data

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

    inserted = failed = 0

    for building_row in building_rows:
        building_zpid = building_row["building_zpid"]
        detail_url = building_row["detail_url"]
        raw_json = building_row["raw_json"] or []
        row_scraped_at = building_row["scraped_at"]

        meta = building_meta.get(building_zpid, {})
        zip_code = meta.get("zip_code", "")
        parent_listing = meta.get("listing", {})

        # Parse address from parent listing
        address_raw = parent_listing.get("address") or parent_listing.get("addressStreet") or ""
        parsed_addr = _normalize_address(address_raw) if address_raw else {}
        address_street = (
            " ".join(filter(None, [parsed_addr.get("house_number"), parsed_addr.get("road")])) or ""
        ).title() or None

        lat_long = parent_listing.get("latLong") or {}
        home_info = (parent_listing.get("hdpData") or {}).get("homeInfo", {})
        lat = lat_long.get("latitude") or home_info.get("latitude")
        lng = lat_long.get("longitude") or home_info.get("longitude")
        img_src = parent_listing.get("imgSrc")

        # Insert parent building row (is_building=true)
        try:
            client.rpc(
                "insert_cleaned_listing",
                {
                    "p_run_id": run_id,
                    "p_scraped_at": row_scraped_at,
                    "p_zip_code": zip_code,
                    "p_zpid": building_zpid,
                    "p_address_raw": address_raw,
                    "p_address_street": address_street,
                    "p_address_city": parent_listing.get("addressCity") or parsed_addr.get("city"),
                    "p_address_state": parent_listing.get("addressState") or parsed_addr.get("state"),
                    "p_address_zip": parent_listing.get("addressZipcode") or parsed_addr.get("postcode"),
                    "p_price": None,
                    "p_beds": None,
                    "p_baths": None,
                    "p_area": None,
                    "p_availability_date": None,
                    "p_has_fireplace": None,
                    "p_has_ac": None,
                    "p_has_spa": None,
                    "p_has_pool": None,
                    "p_lat": float(lat) if lat is not None else None,
                    "p_lng": float(lng) if lng is not None else None,
                    "p_is_sfr": False,
                    "p_raw_scrape_id": None,
                    "p_img_src": img_src,
                    "p_detail_url": detail_url,
                    "p_is_building": True,
                    "p_building_zpid": None,
                },
            ).execute()
            inserted += 1
        except Exception as e:
            context.log.error(f"Failed parent building zpid={building_zpid}: {e}")
            failed += 1

        # Insert individual unit rows
        # The detail scraper returns a list of results; each result may have floorPlans or units
        for result_item in raw_json:
            floor_plans = result_item.get("floorPlans") or []
            if not floor_plans:
                # Fallback: treat the item itself as a unit if it has price data
                units_data = result_item.get("units") or []
                for idx, unit in enumerate(units_data):
                    unit_zpid = str(unit.get("zpid") or "") or f"{building_zpid}_u{idx}"
                    try:
                        client.rpc(
                            "insert_cleaned_listing",
                            {
                                "p_run_id": run_id,
                                "p_scraped_at": row_scraped_at,
                                "p_zip_code": zip_code,
                                "p_zpid": unit_zpid,
                                "p_address_raw": address_raw,
                                "p_address_street": address_street,
                                "p_address_city": parent_listing.get("addressCity") or parsed_addr.get("city"),
                                "p_address_state": parent_listing.get("addressState") or parsed_addr.get("state"),
                                "p_address_zip": parent_listing.get("addressZipcode") or parsed_addr.get("postcode"),
                                "p_price": _parse_unit_price(unit.get("price") or unit.get("unformattedPrice")),
                                "p_beds": _parse_int(unit.get("beds") or unit.get("bedrooms")),
                                "p_baths": _parse_float(unit.get("baths") or unit.get("bathrooms")),
                                "p_area": _parse_int(unit.get("area") or unit.get("livingArea")),
                                "p_availability_date": None,
                                "p_has_fireplace": None,
                                "p_has_ac": None,
                                "p_has_spa": None,
                                "p_has_pool": None,
                                "p_lat": float(lat) if lat is not None else None,
                                "p_lng": float(lng) if lng is not None else None,
                                "p_is_sfr": False,
                                "p_raw_scrape_id": None,
                                "p_img_src": img_src,
                                "p_detail_url": detail_url,
                                "p_is_building": False,
                                "p_building_zpid": building_zpid,
                            },
                        ).execute()
                        inserted += 1
                    except Exception as e:
                        context.log.error(f"Failed unit {unit_zpid} for building {building_zpid}: {e}")
                        failed += 1
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
                        try:
                            client.rpc(
                                "insert_cleaned_listing",
                                {
                                    "p_run_id": run_id,
                                    "p_scraped_at": row_scraped_at,
                                    "p_zip_code": zip_code,
                                    "p_zpid": unit_zpid,
                                    "p_address_raw": address_raw,
                                    "p_address_street": address_street,
                                    "p_address_city": parent_listing.get("addressCity") or parsed_addr.get("city"),
                                    "p_address_state": parent_listing.get("addressState") or parsed_addr.get("state"),
                                    "p_address_zip": parent_listing.get("addressZipcode") or parsed_addr.get("postcode"),
                                    "p_price": price,
                                    "p_beds": beds,
                                    "p_baths": baths,
                                    "p_area": area,
                                    "p_availability_date": None,
                                    "p_has_fireplace": None,
                                    "p_has_ac": None,
                                    "p_has_spa": None,
                                    "p_has_pool": None,
                                    "p_lat": float(lat) if lat is not None else None,
                                    "p_lng": float(lng) if lng is not None else None,
                                    "p_is_sfr": False,
                                    "p_raw_scrape_id": None,
                                    "p_img_src": img_src,
                                    "p_detail_url": detail_url,
                                    "p_is_building": False,
                                    "p_building_zpid": building_zpid,
                                },
                            ).execute()
                            inserted += 1
                        except Exception as e:
                            context.log.error(f"Failed unit {unit_zpid} for building {building_zpid}: {e}")
                            failed += 1
                else:
                    # No individual units listed, insert one row per floor plan
                    unit_zpid = f"{building_zpid}_fp{fp_idx}"
                    price = _parse_unit_price(floor_plan.get("price") or floor_plan.get("minPrice"))
                    try:
                        client.rpc(
                            "insert_cleaned_listing",
                            {
                                "p_run_id": run_id,
                                "p_scraped_at": row_scraped_at,
                                "p_zip_code": zip_code,
                                "p_zpid": unit_zpid,
                                "p_address_raw": address_raw,
                                "p_address_street": address_street,
                                "p_address_city": parent_listing.get("addressCity") or parsed_addr.get("city"),
                                "p_address_state": parent_listing.get("addressState") or parsed_addr.get("state"),
                                "p_address_zip": parent_listing.get("addressZipcode") or parsed_addr.get("postcode"),
                                "p_price": price,
                                "p_beds": beds,
                                "p_baths": baths,
                                "p_area": area,
                                "p_availability_date": None,
                                "p_has_fireplace": None,
                                "p_has_ac": None,
                                "p_has_spa": None,
                                "p_has_pool": None,
                                "p_lat": float(lat) if lat is not None else None,
                                "p_lng": float(lng) if lng is not None else None,
                                "p_is_sfr": False,
                                "p_raw_scrape_id": None,
                                "p_img_src": img_src,
                                "p_detail_url": detail_url,
                                "p_is_building": False,
                                "p_building_zpid": building_zpid,
                            },
                        ).execute()
                        inserted += 1
                    except Exception as e:
                        context.log.error(f"Failed floor plan {unit_zpid} for building {building_zpid}: {e}")
                        failed += 1

    context.log.info(f"Done. inserted={inserted}, failed={failed}")

    return Output(
        value=inserted,
        metadata={
            "run_id": run_id,
            "buildings_processed": len(building_rows),
            "inserted": inserted,
            "failed": failed,
        },
    )
