"""
Backfill address_street for existing cleaned_listings rows.
Re-parses address_raw with libpostal to produce "house_number + road".
"""

import os
from dotenv import load_dotenv
from postal.parser import parse_address
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

PAGE_SIZE = 500


def normalize_street(raw: str) -> str | None:
    if not raw:
        return None
    parts = {label: value for value, label in parse_address(raw)}
    return " ".join(filter(None, [parts.get("house_number"), parts.get("road")])) or None


def main():
    import sys
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    total_updated = 0

    while True:
        # Recreate client each page to avoid HTTP/2 stream exhaustion
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

        rows = (
            client.table("cleaned_listings")
            .select("id, address_raw")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        ).data

        if not rows:
            break

        print(f"Processing rows {offset}–{offset + len(rows) - 1} ...")

        for row in rows:
            new_street = normalize_street(row["address_raw"] or "")
            client.table("cleaned_listings").update({"address_street": new_street}).eq("id", row["id"]).execute()
            total_updated += 1

        offset += len(rows)
        if len(rows) < PAGE_SIZE:
            break

    print(f"Done. Updated {total_updated} rows.")


if __name__ == "__main__":
    main()
