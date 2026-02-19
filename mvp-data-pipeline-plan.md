# MVP Data Pipeline Plan

High-level plan for the Bay Area (BA) property data pipeline: zip-based Zillow ingestion, cleaning, and weekly runs with diff/trend handling.

---

## 1. Get all zip codes in BA

- Build or load the list of zip codes that define the Bay Area.
- This list is the input for all zip-based Zillow searches.

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

### 3a. Normalize important fields into schema

- From raw JSON, normalize the most important fields into a defined schema.
- Examples: **Price**, **Price history**, **# of units**, and other key attributes you need for analysis and comps.
- Output: cleaned, typed records (e.g. in a DB or warehouse) keyed in a stable way (e.g. by listing/property ID + zip + timestamp).

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
            → Clean: normalize key fields (Price, Price history, # units, …) into schema
            → Weekly: re-scrape with new timestamp → diff vs previous → keep history → trends; comps use newest data
```
