# Comps plan (by address)

**Input:** Any property address (user-provided; the subject does **not** need to be in the database). Optionally: subject attributes (price, beds, baths, area) for similarity scoring.  
**Output:** Top N comparable listings from the latest cleaned run, ordered by similarity (or by distance if no subject attributes given).

Assumes cleaned data lives in Supabase with PostGIS (see [MVP Data Pipeline Plan](mvp-data-pipeline-plan.md)); comps use the **newest** cleaned data (latest `run_id`).

TODO: do I want to use just latest run id? 

---

## 1. Geocode the address

- **Geocode** the input address to get (lat, lng) — e.g. via a geocoding API (Google, Mapbox, Nominatim, etc.). No lookup in `cleaned_listings`; the subject may be off-market or outside the scraped set.
- If geocoding fails, return an error (e.g. "Address not found").
- Optional: derive zip from the geocode result for display or for a zip-based fallback.

## 2. Build comp pool

- Use the **latest** `run_id` (newest cleaned data only).
- **Spatial:** Build a point from (lng, lat) and use PostGIS: `ST_DWithin(ST_SetSRID(ST_Point(lng, lat), 4326)::geography, candidate.geometry::geography, radius_m)` with a radius of e.g. **1–2 miles** (1609–3218 m) so comps are from the same neighborhood.
- **Filter:** `is_sfr = true`. Optionally exclude any listing whose normalized address matches the input (so the subject doesn’t appear as its own comp if it happens to be in the DB).
- Optional: drop rows missing key fields (price, beds) so scoring is stable.

## 3. Score each candidate

- **Distance:** Closer = better. Score = 1 / (1 + distance_km) using PostGIS `ST_Distance(geocoded_point::geography, candidate.geometry::geography)` (meters → km). Normalize so best (closest) is 1.
- **If subject attributes (price, beds, baths, area) are provided:** score similarity to the subject:
  - **Price:** `price_score = 1 / (1 + |log(subject_price / comp_price)|)` or normalized % difference.
  - **Beds:** Exact = 1; off by 1 = 0.5; off by 2+ = 0.25 (or 0). Same for **baths** (allow half baths).
  - **Area:** `1 / (1 + |subject_area - comp_area| / subject_area)`; treat NULL as neutral (e.g. 0.5).
  - **Composite:** e.g. `0.35 * distance + 0.35 * price + 0.15 * beds + 0.10 * baths + 0.05 * area`; tune weights by market.
- **If no subject attributes:** rank by **distance only** (closest first), or by distance then price.

## 4. Return

- Order by composite score **desc** (or by distance asc if no subject attributes), limit N (e.g. 10). Return comp rows with key fields (address, price, beds, baths, area, distance_m).

---

**Implementation note:** Pass the geocoded (lng, lat) into SQL; use `ST_SetSRID(ST_Point($lng, $lat), 4326)::geography` for the subject point. Do spatial filter and distance in PostGIS; compute price/beds/baths/area scores in SQL or in app. Single query with `ST_DWithin` + `ST_Distance` plus optional similarity expressions; then `ORDER BY composite_score DESC LIMIT N` (or `ORDER BY distance_m ASC LIMIT N` when no subject attributes).
