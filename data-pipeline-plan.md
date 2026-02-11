# Data Pipeline Plan: Realie Location Search → Zillow Detail Scraper

Pipeline that discovers properties via **Realie Location Search**, stores them in a database, then enriches each with listing details from **Zillow Detail Scraper** (Apify) into a second table.

---

## 1. Overview

| Step | Source | Action | Storage |
|------|--------|--------|---------|
| 1 | [Realie Location Search](https://docs.realie.ai/api-reference/property/location-search) | Find properties in a radius (lat/lon) | Table: `realie_properties` |
| 2 | Address → Zillow URL | Resolve Zillow listing URL per property | In-memory / temp column |
| 3 | [Zillow Detail Scraper](https://apify.com/maxcopell/zillow-detail-scraper) (Apify) | Scrape full listing for each URL | Table: `zillow_properties` |

**Inputs:** Center point (`latitude`, `longitude`), `radius` (miles, max 2), optional `residential` filter, `limit`/`offset` for pagination.

**Outputs:** Two DB tables with a link between them (e.g. `realie_property_id` on the Zillow table).

---

## 2. Step 1: Realie Location Search → DB

### 2.1 API

- **Endpoint:** `GET https://app.realie.ai/api/public/property/location/`
- **Auth:** `Authorization: <api-key>` header
- **Query params:**
  - `longitude` (float, required)
  - `latitude` (float, required)
  - `radius` (float, 0–2 miles, default 1)
  - `limit` (int, 1–100, default 10)
  - `offset` (int, ≥ 0, default 0)
  - `residential` (boolean, optional)

### 2.2 Response shape

```json
{
  "properties": [ { /* property object */ }, ... ],
  "metadata": {
    "limit": 10,
    "offset": 0,
    "count": 10,
    "searchCenter": { "longitude": -122.36, "latitude": 37.58 },
    "radiusMiles": 1
  }
}
```

Each property object includes (see `realie/1220-el-camino.json` and `realie/realie-data-dictionary-human-readable.md`):

- **locationInformation:** address, city, state, zipCode, latitude, longitude, parcelNumber, county
- **transferInformation:** mostRecentTransferDate, transferPrice, purchaseLTV, countyAssessedMarketValue
- **homeOwnershipInformation:** ownerName, ownerAddress, ownerCityState, ownerZipCode
- **propertyUseInformation:** useCode, officialDescription, simpleDescription
- **buildingInformation:** yearBuilt, buildingArea, numberOfStories, totalBedrooms, totalBathrooms, pool, garage, garageCount, garageType, residential
- **constructionInformation:** constructionType
- **landInformation:** landArea, acres, zoningCode, subdivision, blockNumber, lotNumber, etc.
- **financialInformation:** lenderName, taxValue, taxYear, assessedValue, lienCount, lienBalance, etc.

### 2.3 Table: `realie_properties`

- **Primary key:** `id` (e.g. UUID or auto-increment).
- **Stable identifier:** Use `parcel_number` (+ county/state if needed) or a hash of address for deduplication.
- **Columns:** Flatten the fields you need from the Realie JSON (at least: address, city, state, zip_code, latitude, longitude, parcel_number, year_built, building_area, assessed_value, transfer_price, owner_name, plus raw JSON if desired).
- **Pipeline metadata:** e.g. `search_center_lat`, `search_center_lon`, `radius_miles`, `fetched_at`, `run_id` (if you run the pipeline in batches).

### 2.4 Pagination

- Call with `limit=100` and `offset=0`, then `offset=100`, etc., until `metadata.count < limit` (or 0).
- Insert/upsert each property into `realie_properties` (e.g. keyed by parcel + county or by `id` from API if provided).

---

## 3. Step 2: Resolve Zillow URL per Realie property

Zillow Detail Scraper expects **Zillow listing URLs**, not addresses. So for each row in `realie_properties` you need a **Zillow URL** (e.g. `https://www.zillow.com/homedetails/...`).

Options:

1. **Zillow search by address**  
   Use an Apify actor that searches Zillow by address (e.g. “Zillow Search Scraper” or “Zillow ZIP Code Search Scraper”) and take the first matching listing URL for the given address.
2. **External search API / scraper**  
   Any service that returns a Zillow detail URL from address (city, state, zip, street).
3. **Manual / CSV**  
   For testing, provide a mapping table or CSV: `realie_property_id` or address → Zillow URL.

Recommendation: add a step that, for each `realie_properties` row, calls a “Zillow address search” actor (or equivalent), gets one URL, and stores it in a column like `zillow_url` on `realie_properties` or in a small `realie_to_zillow_url` table. Skip or flag rows where no URL is found so the pipeline can still complete and you can backfill later.

---

## 4. Step 3: Zillow Detail Scraper → DB

### 4.1 Apify actor

- **Actor:** [maxcopell/zillow-detail-scraper](https://apify.com/maxcopell/zillow-detail-scraper)
- **Input:** List of Zillow listing URLs (from Step 2).
- **Input example:**

```json
{
  "propertyStatus": "FOR_SALE",
  "startUrls": [
    { "url": "https://www.zillow.com/homedetails/17199-Park-Ave-Sonoma-CA-95476/15800416_zpid/" }
  ]
}
```

You can set `propertyStatus` to `FOR_SALE`, `FOR_RENT`, or `SOLD` as needed; the actor can also accept a dataset ID from another Zillow search actor.

### 4.2 Output shape

The actor returns one rich object per listing (see `zillow/1220-el-camino.json`, `zillow/301-oak-ave-apt-b.json`, and `zillow/zillow-data-dictionary-human-readable.md`). It includes:

- **Identifiers:** zpid, maloneId, address, streetAddress, city, state, zipcode
- **Location:** latitude, longitude, county, parcelId, countyFIPS
- **Attributes:** bedrooms, bathrooms, livingArea, lotSize, yearBuilt, homeType
- **Pricing:** price, zestimate, rentZestimate, lastSoldPrice, dateSold, taxHistory, priceHistory
- **Listing:** homeStatus, listingDataSource, brokerageName, attributionInfo (agent, broker, MLS)
- **Media:** responsivePhotos, photos
- **Structured details:** resoFacts, schools, nearbyHomes, comps, description, etc.

### 4.3 Table: `zillow_properties`

- **Primary key:** `id` (e.g. UUID or auto-increment).
- **Zillow id:** `zpid` (unique, from Zillow).
- **Link to Realie:** `realie_property_id` (FK to `realie_properties.id`). Optional if you run Zillow-only jobs.
- **Columns:** Flatten the fields you need (zpid, address, city, state, zipcode, lat/lon, bedrooms, bathrooms, living_area, lot_size, year_built, home_type, price, zestimate, last_sold_price, date_sold, home_status, listing_source, brokerage_name, agent_name, etc.) and optionally a `raw_json` (JSONB) for the full payload.
- **Timestamps:** `scraped_at`, `created_at`, `updated_at`.

### 4.4 Execution

- Batch the URLs (e.g. 10–50 per run to respect Apify cost and rate limits).
- For each batch: run the actor with `startUrls` = batch of URLs; on success, parse the dataset items and insert/upsert into `zillow_properties` keyed by `zpid`.
- Set `realie_property_id` from your mapping (Realie row → Zillow URL → Zillow result).

---

## 5. Database schema (minimal)

- **realie_properties**  
  - id, parcel_number (or composite key), address, city, state, zip_code, latitude, longitude, year_built, building_area, assessed_value, transfer_price, owner_name, (optional: zillow_url), raw_json (optional), search_center_lat, search_center_lon, radius_miles, fetched_at, run_id.

- **zillow_properties**  
  - id, zpid (unique), realie_property_id (FK nullable), address, city, state, zipcode, latitude, longitude, bedrooms, bathrooms, living_area, lot_size, year_built, home_type, price, zestimate, last_sold_price, date_sold, home_status, brokerage_name, raw_json (optional), scraped_at, created_at, updated_at.

- **Indexes:**  
  - realie: (parcel_number, county) or (latitude, longitude), fetched_at, run_id.  
  - zillow: zpid, realie_property_id, scraped_at.

---

## 6. Pipeline flow (summary)

1. **Input:** latitude, longitude, radius (≤ 2 mi), optional residential, optional limit/offset.
2. **Realie:** Loop with limit=100 and increasing offset; call Location Search; insert/upsert into `realie_properties`; record run_id/search params.
3. **Resolve URLs:** For each `realie_properties` row without `zillow_url`, call Zillow address search (or lookup table); update `zillow_url` (or equivalent).
4. **Zillow:** Collect all `zillow_url`; batch (e.g. 10–50); for each batch run Zillow Detail Scraper; insert/upsert into `zillow_properties` with `realie_property_id` set.
5. **Optional:** Retries for failed URL resolution or failed scraper runs; idempotent upserts by zpid and by realie key.

---

## 7. References

- Realie Location Search: [https://docs.realie.ai/api-reference/property/location-search](https://docs.realie.ai/api-reference/property/location-search)
- Zillow Detail Scraper: [https://apify.com/maxcopell/zillow-detail-scraper](https://apify.com/maxcopell/zillow-detail-scraper)
- Realie data dictionary: `realie/realie-data-dictionary-human-readable.md`
- Zillow data dictionary: `zillow/zillow-data-dictionary-human-readable.md`
- Zillow example responses: `zillow/*.json`, `zillow/schema.json`
