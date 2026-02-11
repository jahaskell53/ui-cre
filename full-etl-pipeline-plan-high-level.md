# ETL Pipeline — High-Level Overview

This document describes the OpenMidmarket property data pipeline in plain language. For technical details (APIs, schemas, field lists), see `full-etl-pipeline-plan.md`.

---

## What the pipeline does

You give it a **location** (latitude, longitude) and a **radius** (up to 2 miles). The pipeline:

1. **Finds** all properties in that area using county-style data (Realie).
2. **Enriches** each with listing data from Zillow (prices, beds/baths, photos, etc.).
3. **Cleans up** addresses so "301 Oak St" and "297 Oak Street" can be recognized as the same place.
4. **Ties** every property to an official parcel (APN) and then **groups** parcels into single buildings when they're really one asset (e.g. one building that physically spans three parcels).

At the end, you have **one building ID** per physical asset. All sales history, rent history, and listing data from different sources and address spellings roll up under that ID.

---

## The six steps (in order)

### Part 1 — Getting the data (Extract)

**Step 1: Realie location search**  
We call Realie's API with your center point and radius. Realie returns properties (address, parcel number, owner, taxes, building details, etc.). We store these in a table and paginate until we've pulled everything in the radius.

**Step 2: Resolve Zillow URLs**  
Zillow's scraper needs a Zillow listing URL, not just an address. For each property from Realie, we look up the matching Zillow page (e.g. via a Zillow search by address) and save that URL. Some properties may not have a Zillow listing; we skip those and can backfill later.

**Step 3: Zillow Search Scraper**  
We send the collected Zillow URLs to the Zillow Search Scraper (Apify). It returns full listing data—price, beds, baths, photos, zestimate, sale history, agent info, etc. We store that in a second table and link each row back to the Realie property we started from.

After Part 1 we have two main tables: **county-style records** (Realie) and **listing-style records** (Zillow), with a link between them.

---

### Part 2 — Making it one source of truth (Transform)

**Step 4: Address normalization**  
Addresses are messy: "297 Oak St" vs "297-301 Oak Street" vs "301 Oak." We run every address through a standardizer (e.g. libpostal) so we can compare them. We also make sure every record has reliable latitude/longitude.

**Step 5: Parcel linking**  
We attach every record to an official **parcel ID (APN)**. Both Realie and Zillow can provide a parcel ID (Realie: parcel number; Zillow: parcelId). We use whichever we have and link them when both sources exist for the same property. For records that still have no APN (e.g. Zillow returned null), we look them up in our known address→APN list from Realie: we standardize the record's address and see if it matches any address we already have a parcel for—same building, different source. If we still don't get an APN, we use a **spatial join**: take the property's coordinates (lat/lon point) and see which parcel polygon boundary it falls inside (point-in-polygon query).

**Step 6: Entity resolution (building ID)**  
A single building can show up as multiple parcels (e.g. one 50-unit building on three parcels) or multiple addresses (e.g. 297 and 301 Oak). We group parcels into one **Building UUID** based on:

- **Building footprint overlap (GIS):** The only reliable signal for multi-parcel buildings. We overlay building footprint polygons (from county GIS via Lightbox) onto parcel polygons. If one building structure physically spans multiple parcels, those parcels are one building. Adjacent parcels alone don't count — the same owner could own two separate buildings next door to each other.

All parcels and address aliases that belong to the same building point to that one Building UUID. When you query a building, you get combined sales history, rent history, and listings from every source and address that resolved to it.

---

## Edge cases we handle

| What goes wrong | How we handle it |
|-----------------|-------------------|
| **Same building, different addresses** (Zillow "301 Oak," county "297 Oak") | We treat the county "situs" address as the main one and store the others as aliases, all tied to the same parcel and building. |
| **One building, many parcels** (e.g. 50-unit building on 3 APNs) | We use building footprint data (Lightbox GIS) to find parcels that share the same physical structure, and assign them one Building UUID. |
| **Address ranges** (listing says "299 Oak," legal record says "297–301 Oak") | We treat a single street number as matching if it falls inside a known legal address range. |
| **Unit count mismatch** (county/assessor says 4 units, Zillow says 6) | We don't force them to agree; we flag a "unit count discrepancy" so you can see possible unpermitted units or data noise. Note: Realie may only provide unit ranges (e.g. "5+ units") rather than exact counts. |

---

## What you get at the end

- **Raw data:** Realie properties and Zillow listings stored and linked.
- **Cleaned data:** Standardized addresses and coordinates; every record tied to a parcel (APN).
- **Unified view:** Buildings as single entities (Building UUID). Each building has one "master" address, its parcels, and all address aliases (Zillow, county, etc.). Sales and rent history from any of those sources roll up to that building.

So: one location + one radius in → one coherent set of buildings out, with full history and listings attached.
