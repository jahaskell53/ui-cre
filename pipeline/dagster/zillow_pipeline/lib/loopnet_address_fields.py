"""Shared LoopNet address_* derivation (libpostal when available)."""

from __future__ import annotations

from supabase import Client

_ADDRESS_KEYS = ("address_raw", "address_street", "address_city", "address_state", "address_zip")


def normalize_address_parts(raw: str) -> dict[str, str]:
    """Parse a free-form address with libpostal; empty dict if unavailable or blank."""
    if not raw or not str(raw).strip():
        return {}
    try:
        from postal.parser import parse_address
    except ImportError:
        return {}
    parts = parse_address(str(raw).strip())
    return {label: value for value, label in parts}


def build_address_fields_from_row(
    address: str | None,
    location: str | None,
    city: str | None,
    state: str | None,
    zip_code: str | None,
) -> dict[str, str]:
    """
    Build address_raw, address_street, address_city, address_state, address_zip
    from loopnet_listings column values (same rules as cleaned_loopnet_listings
    raw JSON mapping).
    """
    street_line = (address or "").strip()
    city_s = (city or "").strip()
    state_s = (state or "").strip()
    zip_s = (zip_code or "").strip()
    city_state = ", ".join(p for p in (city_s, state_s) if p)
    if city_state and zip_s:
        locality_line = f"{city_state} {zip_s}"
    elif city_state:
        locality_line = city_state
    else:
        locality_line = zip_s

    loc_line = (location or "").strip()
    if street_line and locality_line:
        address_raw = f"{street_line}, {locality_line}"
    elif street_line and loc_line:
        # e.g. run_id 2: street in `address`, locality in `location` ("City, ST ZIP"), no city/state/zip columns
        address_raw = f"{street_line}, {loc_line}"
    elif street_line:
        address_raw = street_line
    elif locality_line:
        address_raw = locality_line
    else:
        address_raw = loc_line

    parsed = normalize_address_parts(address_raw) if address_raw else {}
    street_from_postal = " ".join(
        p for p in (parsed.get("house_number", "").strip(), parsed.get("road", "").strip()) if p
    )
    address_street = (street_from_postal.title() if street_from_postal else street_line) or ""
    address_city = (parsed.get("city") or city_s or "").strip() or ""
    address_state = (parsed.get("state") or state_s or "").strip() or ""
    address_zip = (parsed.get("postcode") or zip_s or "").strip() or ""

    return {
        "address_raw": address_raw,
        "address_street": address_street,
        "address_city": address_city,
        "address_state": address_state,
        "address_zip": address_zip,
    }


def _row_address_fields_match(row: dict, desired: dict[str, str]) -> bool:
    for k in _ADDRESS_KEYS:
        cur = (row.get(k) or "") or ""
        nxt = desired.get(k) or ""
        if cur != nxt:
            return False
    return True


def run_loopnet_address_backfill(
    client: Client,
    *,
    dry_run: bool = False,
    page_size: int = 200,
    limit: int | None = None,
) -> dict[str, int]:
    """
    Recompute address_* on loopnet_listing_details from address, location, city, state, zip.

    Returns counts: scanned, updated, unchanged, skipped_empty, errors.
    """
    page_size = max(1, page_size)
    scanned = updated = unchanged = skipped_empty = errors = 0
    offset = 0

    while True:
        q = (
            client.table("loopnet_listing_details")
            .select("id,address,location,city,state,zip,address_raw,address_street,address_city,address_state,address_zip")
            .order("id")
        )
        result = q.range(offset, offset + page_size - 1).execute()
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            if limit is not None and scanned >= limit:
                break

            scanned += 1
            rid = row.get("id")
            addr = row.get("address")
            loc = row.get("location")
            city = row.get("city")
            state = row.get("state")
            z = row.get("zip")

            if not (str(addr or "").strip() or str(loc or "").strip() or str(city or "").strip()):
                skipped_empty += 1
                continue

            desired = build_address_fields_from_row(addr, loc, city, state, z)
            if _row_address_fields_match(row, desired):
                unchanged += 1
                continue

            if dry_run:
                updated += 1
                continue

            try:
                client.table("loopnet_listing_details").update(desired).eq("id", rid).execute()
                updated += 1
            except Exception:
                errors += 1

        if limit is not None and scanned >= limit:
            break

        if len(rows) < page_size:
            break
        offset += page_size

    return {
        "scanned": scanned,
        "updated": updated,
        "unchanged": unchanged,
        "skipped_empty": skipped_empty,
        "errors": errors,
    }
