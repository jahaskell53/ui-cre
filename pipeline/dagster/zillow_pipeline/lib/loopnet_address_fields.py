"""Shared LoopNet address_* derivation (libpostal when available)."""

from __future__ import annotations


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
