# ETL Pipeline Plan: Ingest → Normalize → Link → Resolve

End-to-end pipeline for OpenMidmarket. Discovers properties via Realie, enriches them with Zillow listing data, then normalizes addresses, links records to parcels, and resolves everything into unified building entities.

---

## Pipeline at a Glance

| Phase | Step | Action | Output |
|-------|------|--------|--------|
| **Extract** | 1. Realie Location Search | Find properties in a radius | `realie_properties` |
| **Extract** | 2. Resolve Zillow URLs | Map each address to a Zillow listing URL | `zillow_url` column |
| **Extract** | 3. Zillow Search Scraper | Scrape full listing per URL | `zillow_properties` |
| **Transform** | 4. Address Normalization | Standardize all addresses (libpostal) + geocode | Standardized addresses on both tables |
| **Transform** | 5. Parcel Linking | Map standardized address → APN; fallback: spatial join | `parcels` table populated |
| **Transform** | 6. Entity Resolution | Group APNs into building entities by footprint/owner | `building_entities` + `address_aliases` |

**Inputs:** Center point (lat, lon), radius (≤ 2 mi), optional `residential` filter.

**Final output:** Every record from Realie and Zillow rolled up under a single **Building UUID**, queryable as one entity.

---

## Phase 1: Extract

### Step 1 — Realie Location Search → `realie_properties`

#### API

- **Endpoint:** `GET https://app.realie.ai/api/public/property/location/`
- **Auth:** `Authorization: <api-key>` header
- **Query params:**
  - `longitude` (float, required)
  - `latitude` (float, required)
  - `radius` (float, 0–2 miles, default 1)
  - `limit` (int, 1–100, default 10)
  - `offset` (int, ≥ 0, default 0)
  - `residential` (boolean, optional)

#### Response shape

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

Each property object includes (see `realie/realie-data-dictionary-human-readable.md`):

- **locationInformation:** address, city, state, zipCode, latitude, longitude, parcelNumber, county
- **transferInformation:** mostRecentTransferDate, transferPrice, purchaseLTV
- **homeOwnershipInformation:** ownerName, ownerAddress, ownerCityState, ownerZipCode
- **propertyUseInformation:** useCode, officialDescription, simpleDescription
- **buildingInformation:** yearBuilt, buildingArea, numberOfStories, totalBedrooms, totalBathrooms, pool, garage, residential
- **landInformation:** landArea, acres, zoningCode, subdivision, blockNumber, lotNumber
- **financialInformation:** lenderName, taxValue, assessedValue, lienCount, lienBalance

#### Pagination

Call with `limit=100` and `offset=0`, then `offset=100`, etc., until `metadata.count < limit`. Insert/upsert into `realie_properties` keyed by `parcel_number + county`.

#### Table: `realie_properties`

| Column | Notes |
|--------|-------|
| id | PK (UUID or auto-increment) |
| parcel_number | From Realie `locationInformation.parcelNumber` |
| address, city, state, zip_code | Raw address fields |
| latitude, longitude | Coordinates |
| county | County name |
| year_built, building_area | Building basics |
| assessed_value, transfer_price | Financial basics |
| owner_name | Current owner |
| zillow_url | Populated in Step 2 (nullable) |
| raw_json | Full Realie payload (JSONB, optional) |
| search_center_lat, search_center_lon, radius_miles | Search params for this run |
| fetched_at, run_id | Pipeline metadata |

---

### Step 2 — Resolve Zillow URL per Property

Zillow Search Scraper expects Zillow listing URLs, not addresses. For each `realie_properties` row, resolve its address to a Zillow URL (`https://www.zillow.com/homedetails/...`).

**Options:**

1. **Zillow Search Scraper** (Apify) — search Zillow by address, take the first matching URL.
2. **External search API / scraper** — any service returning a Zillow detail URL from an address.
3. **Manual / CSV** — for testing, provide a mapping of address → Zillow URL.

Store the result in `realie_properties.zillow_url`. Skip/flag rows where no URL is found so the pipeline can complete and you can backfill later.

---

### Step 3 — Zillow Search Scraper → `zillow_properties`

#### Apify actor

- **Actor:** [maxcopell/zillow-scraper](https://apify.com/maxcopell/zillow-scraper)
- **Input example:**

```json
{
  "propertyStatus": "FOR_SALE",
  "startUrls": [
    { "url": "https://www.zillow.com/homedetails/17199-Park-Ave-Sonoma-CA-95476/15800416_zpid/" }
  ]
}
```

Set `propertyStatus` to `FOR_SALE`, `FOR_RENT`, or `SOLD` as needed.

#### Output shape

One rich object per listing (see `zillow/zillow-data-dictionary-human-readable.md`):

- **Identifiers:** zpid, maloneId, address, streetAddress, city, state, zipcode
- **Location:** latitude, longitude, county, parcelId, countyFIPS
- **Attributes:** bedrooms, bathrooms, livingArea, lotSize, yearBuilt, homeType
- **Pricing:** price, zestimate, rentZestimate, lastSoldPrice, dateSold, taxHistory, priceHistory
- **Listing:** homeStatus, listingDataSource, brokerageName, attributionInfo (agent, broker, MLS)
- **Media:** responsivePhotos, photos
- **Structured details:** resoFacts, schools, nearbyHomes, comps, description

#### Execution

- Batch URLs (10–50 per run for Apify cost/rate limits).
- Parse the dataset items and insert/upsert into `zillow_properties` keyed by `zpid`.
- Set `realie_property_id` from the mapping (Realie row → Zillow URL → Zillow result).

#### Table: `zillow_properties`

| Column | Notes |
|--------|-------|
| id | PK (UUID or auto-increment) |
| zpid | Zillow property ID (unique) |
| realie_property_id | FK to `realie_properties.id` (nullable) |
| address, city, state, zipcode | Raw address fields |
| latitude, longitude | Coordinates |
| bedrooms, bathrooms, living_area, lot_size | Property attributes |
| year_built, home_type | Building basics |
| price, zestimate, last_sold_price, date_sold | Pricing |
| home_status, brokerage_name | Listing info |
| raw_json | Full Zillow payload (JSONB, optional) |
| scraped_at, created_at, updated_at | Timestamps |

---

## Phase 2: Transform — Normalize, Link, Resolve

After extraction, the raw Realie and Zillow data needs to be reconciled into a single source of truth. The core problem: addresses are inconsistent across sources (e.g. Zillow shows "301 Gaff St", County shows "297 Gaff St" — same building). The architecture anchors everything to **Parcel ID (APN)** with a **Building** layer above it.

### Step 4 — Address Normalization

Standardize every address from both `realie_properties` and `zillow_properties` so they can be compared and linked.

1. **Address normalization** — Use a tool like `libpostal` to parse and standardize (e.g. "297 Gaff St" and "297-301 Gaff Street" become the same canonical form).
2. **Geocoding** — Ensure every record has a lat/lon. Realie and Zillow both provide coordinates; re-geocode only if missing or flagged as bad (`hasBadGeocode`).

Output: a `standardized_address` value on each record (or in a lookup column) ready for linking.

---

### Step 5 — Parcel Linking

Map each standardized address to a **Parcel ID (APN)**.

1. **Use source parcel IDs** — Realie provides `parcelNumber`; Zillow provides `parcelId` (and sometimes `parcelNumber` in resoFacts). Use whichever is present.
2. **Cross-match** — When both Realie and Zillow exist for the same property, match their parcel IDs and normalize to one APN.
3. **Address match (fill gaps)** — For records missing a parcel ID, match on standardized address against known parcel data (e.g. from Realie).
4. **Spatial join (fallback)** — If still no APN, use the record's lat/lon to find which parcel boundary the coordinates fall into (requires parcel geometry data, e.g. from county GIS).

Output: every record in both tables has an APN. Populate the `parcels` table.

---

### Step 6 — Entity Resolution (Building UUID)

Group multiple APNs that share a single building footprint or common owner into one **Building UUID**.

1. **Spatial aggregation** — Use GIS data to find adjacent parcels with the same or overlapping building footprint.
2. **Owner matching** — Link properties by owner mailing address (from Realie `homeOwnershipInformation`). If tax bills go to the same address, they likely belong to the same entity.
3. **Assign Building UUID** — Each group of related APNs gets one UUID. All rent history, sales history, and listing data from different "aliases" roll up under this UUID.

Output: `building_entities` and `address_aliases` tables populated. Any query for a building returns the aggregated data from all its parcels and address variants.

---

## Edge Cases & Mitigations

| Edge Case | Symptom | Mitigation |
|-----------|---------|------------|
| **Address Aliases** | Zillow shows "301 Gaff," County shows "297 Gaff" | Use County Situs as primary label; store Zillow addresses as aliases linked to the same APN |
| **Multi-Parcel Assets** | A 50-unit building spans 3 APNs | Spatial aggregation — find adjacent parcels with same owner, link all to one Building UUID |
| **Address Ranges** | Listing is "299 Gaff," legal record is "297-301 Gaff" | Regex range matcher — if a number falls within a known Situs range, auto-match |
| **The LLC Veil** | Properties owned by "Gaff Street LLC" and "Redwood Partners LLC" | Tax billing match — link by owner mailing address |
| **Unpermitted Units** | City says 4 units, Zillow shows 6 | Delta flagging — create a `unit_count_discrepancy` flag |

---

## Database Schema

### Raw / Extract tables

```
realie_properties
  id, parcel_number, address, city, state, zip_code, latitude, longitude,
  county, year_built, building_area, assessed_value, transfer_price,
  owner_name, zillow_url, raw_json, search_center_lat, search_center_lon,
  radius_miles, fetched_at, run_id

zillow_properties
  id, zpid (unique), realie_property_id (FK nullable), address, city,
  state, zipcode, latitude, longitude, bedrooms, bathrooms, living_area,
  lot_size, year_built, home_type, price, zestimate, last_sold_price,
  date_sold, home_status, brokerage_name, raw_json, scraped_at,
  created_at, updated_at
```

### Resolved / Transform tables

```sql
CREATE TABLE building_entities (
    id UUID PRIMARY KEY,
    master_situs_address TEXT,
    total_units_recorded INT,
    geometry POLYGON              -- physical footprint
);

CREATE TABLE parcels (
    apn TEXT PRIMARY KEY,
    building_id UUID REFERENCES building_entities(id),
    situs_address TEXT
);

CREATE TABLE address_aliases (
    standardized_address TEXT PRIMARY KEY,
    building_id UUID REFERENCES building_entities(id),
    source_type TEXT               -- 'Zillow', 'County', 'MLS'
);
```

When you query a building, the system pulls sales history from one APN and rent history from another address alias because they all point to the same **Building UUID**.

### Indexes

- `realie_properties`: (parcel_number, county), (latitude, longitude), fetched_at, run_id
- `zillow_properties`: zpid, realie_property_id, scraped_at
- `parcels`: building_id
- `address_aliases`: building_id

---

## Pipeline Flow (End-to-End Summary)

1. **Input:** latitude, longitude, radius (≤ 2 mi), optional residential filter.
2. **Realie Location Search:** Paginate with limit=100; insert/upsert into `realie_properties`.
3. **Resolve Zillow URLs:** For each row missing `zillow_url`, call Zillow address search; update column.
4. **Zillow Search Scraper:** Batch URLs (10–50); run Apify actor; insert/upsert into `zillow_properties` with FK.
5. **Normalize:** Standardize addresses (libpostal) and verify geocoding on both tables.
6. **Link:** Map standardized addresses → APNs; fallback to spatial join; populate `parcels`.
7. **Resolve:** Group APNs by building footprint/owner into `building_entities`; store all address variants in `address_aliases`.

---

## References

- Realie Location Search: https://docs.realie.ai/api-reference/property/location-search
- Zillow Search Scraper: https://apify.com/maxcopell/zillow-scraper
- Realie data dictionary: `realie/realie-data-dictionary-human-readable.md`
- Zillow data dictionary: `zillow/zillow-data-dictionary-human-readable.md`
- Zillow example responses: `zillow/*.json`, `zillow/schema.json`
