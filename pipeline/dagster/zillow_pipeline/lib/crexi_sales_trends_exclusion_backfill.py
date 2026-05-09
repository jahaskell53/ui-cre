"""Backfill Crexi sales-trends exclusions in bounded id partitions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable

from supabase import Client

from zillow_pipeline.resources.apify import ApifyResource

BATCH_SIZE = 1000
PROGRESS_LOG_INTERVAL = 25


def partition_key_to_id_range(partition_key: str, *, batch_size: int = BATCH_SIZE) -> tuple[int, int]:
    """Return [start_id, end_id_exclusive) for a zero-based partition key."""
    try:
        partition_index = int(partition_key)
    except ValueError as exc:
        raise ValueError(f"Invalid partition key: {partition_key}") from exc

    if partition_index < 0:
        raise ValueError(f"Invalid partition key: {partition_key}")

    start_id = partition_index * batch_size + 1
    return start_id, start_id + batch_size


def backfill_crexi_sales_trends_exclusion_partition(
    client: Client,
    apify: ApifyResource,
    partition_key: str,
    *,
    batch_size: int = BATCH_SIZE,
    log_fn: Callable[[str], None] | None = None,
) -> dict[str, int]:
    """Mark one id-range batch of one-unit and Zillow-scraped condo sales comps."""
    start_id, end_id_exclusive = partition_key_to_id_range(partition_key, batch_size=batch_size)

    one_unit_result = (
        client.table("crexi_api_comps")
        .update(
            {
                "exclude_from_sales_trends": True,
                "sales_trends_exclusion_reason": "crexi_num_units_1",
            }
        )
        .gte("id", start_id)
        .lt("id", end_id_exclusive)
        .eq("is_sales_comp", True)
        .eq("exclude_from_sales_trends", False)
        .eq("num_units", 1)
        .execute()
    )

    probable_single_unit_exclusion_result = client.rpc(
        "backfill_crexi_probable_single_unit_sales_trends_exclusions",
        {
            "p_start_id": start_id,
            "p_end_id_exclusive": end_id_exclusive,
        },
    ).execute()
    probable_single_unit_excluded_updated = (
        probable_single_unit_exclusion_result.data[0]["updated_count"] if probable_single_unit_exclusion_result.data else 0
    )
    if log_fn:
        log_fn(
            f"Crexi sales-trends exclusion partition {partition_key}: "
            f"probable_single_unit_excluded={probable_single_unit_excluded_updated} before Zillow scrape"
        )

    zillow_scrape_stats = scrape_zillow_condo_xrefs_for_partition(
        client,
        apify,
        start_id,
        end_id_exclusive,
        partition_key=partition_key,
        limit=batch_size,
        log_fn=log_fn,
    )
    zillow_exclusion_result = client.rpc(
        "backfill_crexi_zillow_condo_sales_trends_exclusions",
        {
            "p_start_id": start_id,
            "p_end_id_exclusive": end_id_exclusive,
        },
    ).execute()
    zillow_excluded_updated = zillow_exclusion_result.data[0]["updated_count"] if zillow_exclusion_result.data else 0
    one_unit_updated = len(one_unit_result.data or [])

    return {
        "start_id": start_id,
        "end_id": end_id_exclusive - 1,
        "updated": one_unit_updated + zillow_excluded_updated + probable_single_unit_excluded_updated,
        "one_unit_updated": one_unit_updated,
        "zillow_excluded_updated": zillow_excluded_updated,
        "probable_single_unit_excluded_updated": probable_single_unit_excluded_updated,
        "zillow_scraped": zillow_scrape_stats["scraped"],
        "zillow_matched": zillow_scrape_stats["matched"],
    }


def scrape_zillow_condo_xrefs_for_partition(
    client: Client,
    apify: ApifyResource,
    start_id: int,
    end_id_exclusive: int,
    *,
    partition_key: str,
    limit: int,
    log_fn: Callable[[str], None] | None = None,
) -> dict[str, int]:
    candidates = (
        client.rpc(
            "get_crexi_zillow_condo_scrape_candidates",
            {
                "p_start_id": start_id,
                "p_end_id_exclusive": end_id_exclusive,
                "p_limit": limit,
            },
        )
        .execute()
        .data
        or []
    )

    if log_fn:
        log_fn(f"Crexi Zillow scrape partition {partition_key}: {len(candidates)} candidates")

    scraped = matched = 0
    for index, candidate in enumerate(candidates, start=1):
        raw_items = apify.run_zillow_property_lookup(candidate["query_address"], log_fn=log_fn)
        matched_item = _first_matching_zillow_item(raw_items, candidate)
        home_type = _extract_home_type(matched_item) if matched_item else None
        exclusion_reason = _sales_trends_exclusion_reason(home_type)
        client.table("crexi_zillow_condo_xrefs").upsert(
            {
                "run_id": candidate["run_id"],
                "crexi_comp_id": candidate["crexi_comp_id"],
                "crexi_id": candidate["crexi_id"],
                "query_address": candidate["query_address"],
                "zpid": _extract_zpid(matched_item) if matched_item else None,
                "zillow_url": _extract_detail_url(matched_item) if matched_item else None,
                "home_type": home_type,
                "is_condo": _is_condo_home_type(home_type),
                "is_sales_trends_excluded": exclusion_reason is not None,
                "sales_trends_exclusion_reason": exclusion_reason,
                "raw_json": raw_items,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="crexi_comp_id",
        ).execute()
        scraped += 1
        matched += 1 if matched_item else 0
        if log_fn and (index == 1 or index % PROGRESS_LOG_INTERVAL == 0 or index == len(candidates)):
            log_fn(f"Crexi Zillow scrape partition {partition_key}: scraped {index}/{len(candidates)} candidates (matched={matched})")

    return {"scraped": scraped, "matched": matched}


def _first_matching_zillow_item(items: list[dict], candidate: dict) -> dict | None:
    for item in items:
        if _item_matches_candidate(item, candidate):
            return item
    return None


def _item_matches_candidate(item: dict, candidate: dict) -> bool:
    item_address = _extract_address_fields(item)
    street = _normalize_address_part(candidate.get("address_street"))
    city = _normalize_address_part(candidate.get("city"))
    state = _normalize_address_part(candidate.get("state"))
    zip_code = _digits5(candidate.get("zip"))

    if item_address["street"] and item_address["city"] and item_address["state"] and item_address["zip"]:
        return (
            item_address["street"] == street
            and item_address["city"] == city
            and item_address["state"] == state
            and item_address["zip"] == zip_code
        )

    full_address = _normalize_address_part(item.get("address"))
    return bool(
        full_address
        and street in full_address
        and city in full_address
        and state in full_address
        and zip_code in full_address
    )


def _extract_address_fields(item: dict) -> dict[str, str]:
    home_info = (item.get("hdpData") or {}).get("homeInfo") or {}
    address = item.get("address")
    if isinstance(address, dict):
        address_dict = address
        full_address = address_dict.get("streetAddress") or address_dict.get("address")
    else:
        address_dict = {}
        full_address = address

    return {
        "street": _normalize_address_part(
            item.get("addressStreet")
            or item.get("streetAddress")
            or home_info.get("streetAddress")
            or address_dict.get("streetAddress")
        ),
        "city": _normalize_address_part(
            item.get("addressCity") or item.get("city") or home_info.get("city") or address_dict.get("city")
        ),
        "state": _normalize_address_part(
            item.get("addressState") or item.get("state") or home_info.get("state") or address_dict.get("state")
        ),
        "zip": _digits5(
            item.get("addressZipcode")
            or item.get("zipcode")
            or home_info.get("zipcode")
            or address_dict.get("zipcode")
            or full_address
        ),
    }


def _extract_home_type(item: dict | None) -> str | None:
    if not item:
        return None
    home_info = (item.get("hdpData") or {}).get("homeInfo") or {}
    home_type = item.get("homeType") or item.get("home_type") or home_info.get("homeType")
    return str(home_type).upper() if home_type else None


def _extract_zpid(item: dict | None) -> str | None:
    if not item:
        return None
    home_info = (item.get("hdpData") or {}).get("homeInfo") or {}
    zpid = item.get("zpid") or home_info.get("zpid")
    return str(zpid) if zpid else None


def _extract_detail_url(item: dict | None) -> str | None:
    if not item:
        return None
    return item.get("detailUrl") or item.get("detail_url") or item.get("url")


def _is_condo_home_type(home_type: str | None) -> bool:
    return (home_type or "").upper() in {"CONDO", "CONDOMINIUM"}


def _is_sales_trends_excluded_home_type(home_type: str | None) -> bool:
    return _sales_trends_exclusion_reason(home_type) is not None


def _sales_trends_exclusion_reason(home_type: str | None) -> str | None:
    normalized = (home_type or "").upper()
    if normalized in {"CONDO", "CONDOMINIUM"}:
        return "zillow_home_type_condo"
    if normalized in {"SINGLE_FAMILY", "SINGLEFAMILY"}:
        return "zillow_home_type_single_family"
    return None


def _normalize_address_part(value: object) -> str:
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def _digits5(value: object) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    return digits[:5]
