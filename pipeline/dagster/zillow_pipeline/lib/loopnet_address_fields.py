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


def _parse_city_state_zip_from_location(location: str) -> tuple[str, str, str]:
    """
    Extract city, state, zip from a locality string like "San Francisco, CA 94103".

    Returns (city, state, zip) as strings; empty strings when not parseable.
    Libpostal is tried first; a simple heuristic is used as fallback.
    """
    loc = (location or "").strip()
    if not loc:
        return "", "", ""

    parsed = normalize_address_parts(loc)
    if parsed:
        return (
            (parsed.get("city") or "").strip(),
            (parsed.get("state") or "").strip(),
            (parsed.get("postcode") or "").strip(),
        )

    # Heuristic: "City, ST ZIP" or "City, ST" — common LoopNet header format.
    # Split on the last comma to separate city from "ST[ ZIP]".
    parts = loc.rsplit(",", 1)
    if len(parts) == 2:
        city_part = parts[0].strip()
        rest = parts[1].strip().split()
        state_part = rest[0] if rest else ""
        zip_part = rest[1] if len(rest) > 1 else ""
        return city_part, state_part, zip_part

    return "", "", ""


def build_address_fields_from_row(
    address: str | None,
    location: str | None,
    zip_code: str | None,
) -> dict[str, str]:
    """
    Build address_raw, address_street, address_city, address_state, address_zip
    from loopnet_listing_details column values.

    City and state are derived from ``location`` (and libpostal when available)
    rather than from the raw scraper ``city``/``state`` columns.
    """
    street_line = (address or "").strip()
    loc_line = (location or "").strip()
    zip_s = (zip_code or "").strip()

    if street_line and loc_line:
        address_raw = f"{street_line}, {loc_line}"
    elif street_line:
        address_raw = street_line
    else:
        address_raw = loc_line

    parsed = normalize_address_parts(address_raw) if address_raw else {}
    street_from_postal = " ".join(
        p for p in (parsed.get("house_number", "").strip(), parsed.get("road", "").strip()) if p
    )
    address_street = (street_from_postal.title() if street_from_postal else street_line) or ""

    # Prefer libpostal output from the full address_raw; fall back to parsing location directly.
    if parsed.get("city") or parsed.get("state"):
        address_city = (parsed.get("city") or "").strip()
        address_state = (parsed.get("state") or "").strip()
        address_zip = (parsed.get("postcode") or zip_s).strip()
    else:
        loc_city, loc_state, loc_zip = _parse_city_state_zip_from_location(loc_line)
        address_city = loc_city
        address_state = loc_state
        address_zip = (parsed.get("postcode") or loc_zip or zip_s).strip()

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
    Recompute address_* on loopnet_listing_details from address, location, and zip.

    City and state are derived from location (via libpostal or heuristic), not from the
    raw city/state columns — making this job independent of those columns so they can be
    dropped in a follow-up migration.

    Returns counts: scanned, updated, unchanged, skipped_empty, errors.
    """
    page_size = max(1, page_size)
    scanned = updated = unchanged = skipped_empty = errors = 0
    offset = 0

    while True:
        q = (
            client.table("loopnet_listing_details")
            .select("id,address,location,zip,address_raw,address_street,address_city,address_state,address_zip")
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
            z = row.get("zip")

            if not (str(addr or "").strip() or str(loc or "").strip()):
                skipped_empty += 1
                continue

            desired = build_address_fields_from_row(addr, loc, z)
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
