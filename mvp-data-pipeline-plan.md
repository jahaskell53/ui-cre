# MVP Data Pipeline Plan

High-level plan for the Bay Area (BA) property data pipeline: zip-based Zillow ingestion, cleaning, and weekly runs with diff/trend handling. Cleaned data is ingested into **Supabase Postgres** with the **PostGIS** extension enabled.

---

## 1. Get all zip codes in BA

- Build or load the list of zip codes that define the Bay Area.
- This list is the input for all zip-based Zillow searches.
- Store in supabase DB so it's changeable/exandable. 

---

## 2. For each zip code

### 2a. Get general info using Zillow search by zip code (Apify)

- Call the Zillow Search Scraper (Apify) with each BA zip code.
- Retrieve general listing/property info (prices, beds, baths, addresses, etc.) per zip.

### 2b. Store raw JSON with timestamp

- Persist the full API response as raw JSON.
- Attach a **timestamp** (e.g.`scraped_at`) to each run so runs are distinguishable and comparable over time.

---

## 3. Clean

### 3a. Unit / property filtering (SFR vs other)

- **Rule:** Filter for **single-family residence (SFR)** so the MVP focuses on the right product type (e.g. houses for rent), and exclude other types (e.g. apartments, townhouses, multi-family).
- **Implementation:** Use Zillow’s **`statusText`** (and/or equivalent fields) to classify listings. For example, keep only listings where `statusText` indicates a house (e.g. “House for rent”, “Single family for rent”) and drop listings that indicate apartments, condos, or other non-SFR types.
- Apply this filter **before** normalizing and ingesting so only SFR units are cleaned and stored.

### 3b. Normalize addresses using libpostal

- Run every address from the raw data through **libpostal** to get a standardized form (e.g. consistent street suffix, no extra spaces, normalized abbreviations).
- Use the normalized address as the canonical address in the schema so "297 Gaff St" and "297 Gaff Street" match and dedupe correctly.

### 3c. Normalize important fields into schema

- From raw JSON, normalize the most important fields into a defined schema.
- Examples: **Price**, **Price history**, **# of units**, and other key attributes you need for analysis and comps.
- Output: cleaned, typed records (e.g. in a DB or warehouse) keyed in a stable way (e.g. by listing/property ID + zip + timestamp).

### 3d. Spatial geometry conversion (PostGIS)

- **Action:** Convert latitude and longitude into a PostGIS `GEOMETRY` object and store it in Supabase.
- **Logic:** Use `ST_SetSRID(ST_Point(lng, lat), 4326)` so each record has a proper WGS84 point. (Note: PostGIS `ST_Point` takes longitude first, then latitude.)
- **Goal:** You can't do neighborhood analysis with raw numbers. With a geometry column, SQL can answer "Which neighborhood is this in?" using spatial queries (e.g. `ST_Within`, `ST_Contains` with neighborhood polygons) instead of hardcoding zip code lists.

### 3e. Field sanitization & casting

Scraped data is notoriously "stringy"; normalize and cast before ingest.

- **Numeric (e.g. price):** Strip symbols (`$`, `,`, `+`) and cast to **INTEGER**. Example: `"$2,450+"` → `2450`. Apply to top-level `price` / `unformattedPrice` and to `units[].price` if present. Prefer **one canonical price** per row: use `unformattedPrice` or `hdpData.homeInfo.price` when present, else parsed `price` string.
- **Relative dates:** Convert values like `"2 days ago"` or `"Yesterday"` (e.g. from `listCardRecommendation.flexFieldRecommendations[].displayString` when `contentType` is `timeOnInfo`) into an **ISO-8601** timestamp using scrape/run timestamp as reference.
- **Boolean flags:** Convert feature text (e.g. "Laundry in building") into searchable **TRUE/FALSE** columns. From the schema, **factsAndFeatures** (hasFireplace, hasAirConditioning, hasSpa, hasPool) are already booleans—store as BOOL; half/full bathroom counts as INTEGER.
- **beds / baths / area:** Schema allows **beds** as `integer | string`; normalize **beds** to INTEGER (e.g. `"1"` → `1`). **baths** and **area**: cast to numeric (decimal for baths, integer for area); treat empty/missing as NULL.
- **Dates from API:** Parse **availabilityDate** (e.g. `"2026-08-01 00:00:00"`) to DATE or TIMESTAMP. Convert **hdpData.homeInfo.datePriceChanged** (Unix ms) to TIMESTAMP for “price changed at” and trend analysis.
- **Stable ID:** **zpid** is string (numeric for single units after SFR filter). Store as a consistent type (e.g. string or bigint) for dedupe and joins.
- **Canonical location:** Prefer one source for coordinates—e.g. top-level **latLong** for list payload, or **hdpData.homeInfo** when present—so geometry and address don’t diverge. Same for address: normalize one canonical field (e.g. **addressStreet** or **hdpData.homeInfo.streetAddress**) via libpostal.
- **Null/empty:** Treat empty string and missing key as NULL in the DB so queries don’t mix `''` and NULL.

---


## 4. Scrape weekly with new timestamp

- Re-run the zip-based Zillow scrape on a **weekly** schedule.
- Each run gets a **new timestamp** and is stored like step 2b.

### 4a. Check for diffs

- Compare new data to the previous run (e.g. by listing/property ID and key fields).
- Identify what changed: new listings, removed listings, price changes, etc.

### 4b. Keep old info

- Do **not** overwrite or delete prior runs. Keep historical raw and cleaned data so you have a full history.

### 4c. Use diffs for trends

- Use the diffs (and the time series of cleaned data) to compute **trends** (e.g. price changes over time, new supply, delistings).

### 4d. For comps, ref newest data

- When running **comps** (comparable sales/listings), always use the **newest** cleaned data (latest timestamp) as the reference so comps reflect current market.

---

## Summary flow

```
BA zip list → [For each zip: Apify Zillow search → Store raw JSON + timestamp]
            → Clean: filter for SFR (e.g. statusText “house for rent”) + normalize addresses (libpostal) + sanitize & cast (price→INT, relative dates→ISO-8601, features→BOOL) + key fields + PostGIS geometry; ingest to Supabase
            → Weekly: re-scrape with new timestamp → diff vs previous → keep history → trends; comps use newest data
```
